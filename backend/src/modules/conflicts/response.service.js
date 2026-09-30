const { BusinessRuleError, ConflictError, NotFoundError } = require('../../shared/errors/AppError')
const { estimateEtaMinutes, haversineKm } = require('../../shared/utils/geo')
const { toId } = require('../../shared/utils/serialize')
const { TEAM_STATUS } = require('../teams/ranger-team.model')
const { DISPATCH_TYPES, REPORT_STATUS: S, TASK_STATUS: T } = require('./conflict.constants')
const { DUPLICATE_KEY } = require('./conflict.repository')
const { DEPLOYABLE_STATUSES, deploymentRouteFor, pointOf } = require('./conflict.rules')
const { TYPE_LABELS } = require('./conflict.service')

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000
const WORKING_STATUSES = [T.ASSIGNED, T.ACKNOWLEDGED]

/**
 * UC01 team deployment and field response:
 * - find suitable teams and deploy one (main flow step 3)
 * - high priority or additional resources → park manager approval
 * - critical → emergency dispatch (A2)
 * - ranger acknowledges, records field actions and completes the task (step 4),
 *   with idempotent uploads for work done offline (E4)
 *
 * Team availability goes through the shared teamService, so UC04 sees a
 * responding team as busy and cannot allocate it twice.
 */
function createResponseService({
  transactionRunner,
  conflictRepository,
  teamRepository,
  teamService,
  alertService,
  access,
  workflow,
  notifier,
  clock = () => new Date()
}) {
  const { requireReport, requireTask, transition, raiseAlert } = workflow

  async function requireTeam(teamId, parkId) {
    const team = await teamRepository.findById(teamId)
    if (!team) throw new NotFoundError('The selected ranger team was not found.', 'TEAM_NOT_FOUND')
    if (toId(team.park) !== toId(parkId)) {
      throw new BusinessRuleError(`${team.name} belongs to a different park.`, 'TEAM_PARK_MISMATCH')
    }
    return team
  }

  /** Creates the task, turning the unique "one open task per report" index into a clear error. */
  async function createTask(data, session) {
    try {
      return await conflictRepository.createTask(data, { session })
    } catch (error) {
      if (error?.code === DUPLICATE_KEY) throw new ConflictError('This report already has an open response task.', 'TASK_EXISTS')
      throw error
    }
  }

  /** Loads a task for a ranger and checks they belong to its team. */
  async function loadRangerTask(taskId, actor) {
    const task = await requireTask(taskId)
    const team = await teamRepository.findById(task.team)
    access.assertTeamMember(actor, team)
    return { task, team }
  }

  function assertNotInFuture(date) {
    if (new Date(date).getTime() > clock().getTime() + FUTURE_TOLERANCE_MS) {
      throw new BusinessRuleError('The recorded time cannot be in the future.', 'TIME_IN_FUTURE')
    }
  }

  const taskTitle = (report) => `${TYPE_LABELS[report.conflictType]} at ${report.village}`

  /** Tells the park's liaison officers about an approval decision. */
  function notifyOfficersOfDecision(report, title, message, session) {
    return notifier.officers(report.park, { title, message, link: notifier.officerLink(report) }, { session })
  }

  return {
    /** Main flow step 3: teams in the report's park, available first and nearest first. */
    async listTeams(reportId, actor) {
      const report = await requireReport(reportId)
      access.assertParkAccess(actor, report.park)
      const teams = await teamRepository.listByPark(report.park)
      const target = pointOf(report.location)

      const describe = (team) => {
        const distanceKm = target ? haversineKm(team.lastKnownLocation, target) : null
        return {
          ...team,
          distanceKm: distanceKm === null ? null : Math.round(distanceKm * 10) / 10,
          etaMinutes: estimateEtaMinutes(distanceKm)
        }
      }
      const byDistance = (first, second) => (first.distanceKm ?? Infinity) - (second.distanceKm ?? Infinity) || first.name.localeCompare(second.name)

      const available = teams.filter((team) => teamService.isAvailable(team)).map(describe).sort(byDistance)
      const busy = teams.filter((team) => !teamService.isAvailable(team)).map(describe).sort(byDistance)
      return {
        route: report.priority ? deploymentRouteFor(report.priority) : null,
        available,
        busy,
        recommended: available[0] ?? null
      }
    },

    /**
     * Deploys a team to a validated report. The route depends on priority:
     * direct assignment, approval request, or emergency dispatch.
     */
    async deploy(reportId, { teamId, instructions, additionalResources = false }, actor) {
      const report = await requireReport(reportId)
      access.assertParkAccess(actor, report.park)
      if (!DEPLOYABLE_STATUSES.includes(report.status)) {
        throw new ConflictError(`A team cannot be deployed while the report is ${report.status.replaceAll('-', ' ')}.`, 'REPORT_NOT_DEPLOYABLE')
      }
      if (!report.priority) throw new BusinessRuleError('Set a priority before deploying a team.', 'PRIORITY_REQUIRED')

      const team = await requireTeam(teamId, report.park)
      if (!teamService.isAvailable(team)) {
        throw new ConflictError(`${team.name} is not available (currently ${team.status}). Choose another team or escalate.`, 'TEAM_NOT_AVAILABLE', {
          status: team.status
        })
      }

      const { dispatchType, requiresApproval } = deploymentRouteFor(report.priority, { additionalResources })
      const emergency = dispatchType === DISPATCH_TYPES.EMERGENCY
      const now = clock()
      const base = {
        report: report._id,
        park: report.park,
        team: team._id,
        priority: report.priority,
        dispatchType,
        additionalResources,
        instructions,
        proposedBy: actor.id,
        approval: { required: requiresApproval }
      }

      if (requiresApproval) {
        const task = await transactionRunner.run(async (session) => {
          const created = await createTask({ ...base, status: T.AWAITING_APPROVAL }, session)
          await transition(
            report,
            S.AWAITING_APPROVAL,
            { actor, action: 'deployment-proposed', note: `${team.name} proposed${additionalResources ? ' (additional resources requested)' : ''}` },
            { session }
          )
          await notifier.managers(
            report.park,
            {
              title: `Approval needed: ${taskTitle(report)}`,
              message: `${report.reference} (${report.priority}) — ${team.name} proposed by ${actor.name}.`,
              link: '/conflicts/approvals'
            },
            { session }
          )
          return created
        })
        return { task, route: 'approval' }
      }

      const task = await transactionRunner.run(async (session) => {
        await teamService.commitTeam(team._id, TEAM_STATUS.RESPONDING, { session })
        let alert = null
        if (emergency) {
          alert = await raiseAlert(report, { title: `EMERGENCY conflict: ${taskTitle(report)}`, message: `${report.reference}: ${team.name} dispatched.` }, { session })
          await alertService.markDispatched(alert._id, { session })
        }
        const created = await createTask({ ...base, status: T.ASSIGNED, assignedAt: now, alert: alert?._id }, session)
        await transition(
          report,
          S.RESPONSE_ASSIGNED,
          { actor, action: emergency ? 'emergency-dispatched' : 'team-assigned', note: `${team.name}${instructions ? ` — ${instructions}` : ''}` },
          { session }
        )
        await notifier.team(
          team,
          {
            taskId: toId(created._id),
            title: emergency ? `EMERGENCY: ${taskTitle(report)}` : `New conflict response: ${taskTitle(report)}`,
            message: `${report.reference}. ${instructions || report.description.slice(0, 160)}`
          },
          { session }
        )
        if (emergency) {
          await notifier.managers(
            report.park,
            { title: `Emergency dispatch: ${taskTitle(report)}`, message: `${team.name} sent to critical report ${report.reference}.`, link: '/patrol/alerts' },
            { session }
          )
        }
        return created
      })

      await notifier.community(report, {
        purpose: emergency ? 'emergency-dispatch' : 'team-assigned',
        title: `Rangers assigned to ${report.reference}`,
        message: emergency
          ? `${team.name} is on the way. Stay indoors and keep away from the elephant.`
          : `${team.name} has been assigned to respond to your report.`
      })
      return { task, route: emergency ? 'emergency' : 'direct' }
    },

    /** Park manager: deployments waiting for approval. */
    listApprovals({ parkId }, actor) {
      const park = parkId ?? actor.park
      if (park) access.assertParkAccess(actor, park)
      return conflictRepository.listTasks({ park, statuses: [T.AWAITING_APPROVAL] })
    },

    /** Park manager approves (optionally with another team) or rejects a proposed deployment. */
    async decideApproval(taskId, { decision, teamId, notes }, actor) {
      const task = await requireTask(taskId)
      access.assertParkAccess(actor, task.park)
      if (task.status !== T.AWAITING_APPROVAL) {
        throw new ConflictError('This deployment has already been decided.', 'APPROVAL_ALREADY_DECIDED')
      }
      const report = await requireReport(task.report)
      const approval = { 'approval.decision': decision === 'approve' ? 'approved' : 'rejected', 'approval.by': actor.id, 'approval.at': clock(), 'approval.notes': notes }

      if (decision === 'reject') {
        return transactionRunner.run(async (session) => {
          const rejected = await conflictRepository.updateTaskIf(task._id, [T.AWAITING_APPROVAL], { $set: { status: T.REJECTED, ...approval } }, { session })
          if (!rejected) throw new ConflictError('This deployment has already been decided.', 'APPROVAL_ALREADY_DECIDED')
          await transition(report, S.VALIDATED, { actor, action: 'deployment-rejected', note: notes }, { session })
          await notifyOfficersOfDecision(report, `Deployment for ${report.reference} rejected`, notes, session)
          return rejected
        })
      }

      const team = await requireTeam(teamId ?? task.team, task.park)
      const approved = await transactionRunner.run(async (session) => {
        await teamService.commitTeam(team._id, TEAM_STATUS.RESPONDING, { session })
        const updated = await conflictRepository.updateTaskIf(
          task._id,
          [T.AWAITING_APPROVAL],
          { $set: { status: T.ASSIGNED, team: team._id, assignedAt: clock(), ...approval } },
          { session }
        )
        if (!updated) throw new ConflictError('This deployment has already been decided.', 'APPROVAL_ALREADY_DECIDED')
        await transition(report, S.RESPONSE_ASSIGNED, { actor, action: 'deployment-approved', note: `${team.name}${notes ? ` — ${notes}` : ''}` }, { session })
        await notifier.team(
          team,
          { taskId: toId(task._id), title: `New conflict response: ${taskTitle(report)}`, message: `${report.reference}. ${task.instructions || report.description.slice(0, 160)}` },
          { session }
        )
        await notifyOfficersOfDecision(report, `Deployment for ${report.reference} approved`, `${team.name} is responding.`, session)
        return updated
      })

      await notifier.community(report, { purpose: 'team-assigned', title: `Rangers assigned to ${report.reference}`, message: `${team.name} has been assigned to respond to your report.` })
      return approved
    },

    /** Ranger: the team's tasks, with their field actions so the app can show them offline (E4). */
    async listMyTasks(actor) {
      const team = await teamRepository.findByMember(actor.id)
      if (!team) return { team: null, tasks: [] }

      const tasks = await conflictRepository.listTasks({ team: team._id, statuses: [T.ASSIGNED, T.ACKNOWLEDGED, T.COMPLETED], limit: 20 })
      const actions = tasks.length ? await conflictRepository.listActionsByTasks(tasks.map((task) => task._id)) : []
      return {
        team,
        tasks: tasks.map((task) => ({ ...task, actions: actions.filter((action) => toId(action.task) === toId(task._id)) }))
      }
    },

    /** Ranger: confirm the team received the task. Repeating it is harmless. */
    async acknowledge(taskId, actor) {
      const { task } = await loadRangerTask(taskId, actor)
      if (task.status === T.ACKNOWLEDGED) return task
      if (task.status !== T.ASSIGNED) throw new ConflictError('This task is no longer open.', 'TASK_CLOSED')

      const updated = await conflictRepository.updateTaskIf(task._id, [T.ASSIGNED], { $set: { status: T.ACKNOWLEDGED, acknowledgedBy: actor.id, acknowledgedAt: clock() } })
      return updated ?? requireTask(task._id)
    },

    /**
     * Ranger: record one field action. A retried upload with the same
     * clientUpdateId returns the stored action instead of creating a copy (E4).
     * Returns `{ action, created }`.
     */
    async recordAction(taskId, { clientUpdateId, type, note, location, recordedAt, recordedOffline = false }, actor) {
      const existing = await conflictRepository.findActionByClientId(clientUpdateId)
      if (existing) {
        if (toId(existing.task) !== taskId) throw new ConflictError('This update id was already used for another task.', 'CLIENT_ID_REUSED')
        return { action: existing, created: false }
      }

      const { task } = await loadRangerTask(taskId, actor)
      if (!WORKING_STATUSES.includes(task.status)) throw new ConflictError('This task is closed, so no more actions can be recorded.', 'TASK_CLOSED')
      assertNotInFuture(recordedAt)

      // Recording an action shows the team has the task, so it counts as the acknowledgement.
      if (task.status === T.ASSIGNED) {
        await conflictRepository.updateTaskIf(task._id, [T.ASSIGNED], { $set: { status: T.ACKNOWLEDGED, acknowledgedBy: actor.id, acknowledgedAt: clock() } })
      }
      return conflictRepository.createAction({
        task: task._id,
        report: task.report,
        clientUpdateId,
        type,
        note,
        location,
        recordedAt,
        recordedOffline,
        recordedBy: actor.id
      })
    },

    /**
     * Ranger: finish the response with its outcome (A6: elephant not located).
     * Frees the team, resolves an emergency alert and hands the report to the
     * officer for review. Idempotent for the same clientUpdateId (E4).
     * Returns `{ task, created }`.
     */
    async complete(taskId, { clientUpdateId, outcome, notes, completedAt }, actor) {
      const { task } = await loadRangerTask(taskId, actor)
      if (task.status === T.COMPLETED) {
        if (task.completion?.clientUpdateId === clientUpdateId) return { task, created: false }
        throw new ConflictError('This task has already been completed.', 'TASK_ALREADY_COMPLETED')
      }
      if (!WORKING_STATUSES.includes(task.status)) throw new ConflictError('This task is no longer open.', 'TASK_CLOSED')
      assertNotInFuture(completedAt)

      const report = await requireReport(task.report)
      const now = clock()
      const completed = await transactionRunner.run(async (session) => {
        const updated = await conflictRepository.updateTaskIf(
          task._id,
          WORKING_STATUSES,
          {
            $set: {
              status: T.COMPLETED,
              acknowledgedBy: task.acknowledgedBy ?? actor.id,
              acknowledgedAt: task.acknowledgedAt ?? now,
              completion: { outcome, notes, completedBy: actor.id, completedAt, syncedAt: now, clientUpdateId }
            }
          },
          { session }
        )
        if (!updated) throw new ConflictError('This task was changed by someone else. Refresh and try again.', 'CONCURRENT_UPDATE')

        await teamService.releaseTeam(task.team, { session })
        if (task.alert) await alertService.resolve(task.alert, { session })
        await transition(report, S.RESPONSE_COMPLETED, { actor, action: 'response-completed', note: `${outcome.replaceAll('-', ' ')}${notes ? ` — ${notes}` : ''}` }, { session })
        await notifier.officers(
          report.park,
          { title: `Review needed: ${report.reference}`, message: `Field response completed: ${outcome.replaceAll('-', ' ')}.`, link: notifier.officerLink(report) },
          { session }
        )
        return updated
      })
      return { task: completed, created: true }
    }
  }
}

module.exports = { createResponseService }
