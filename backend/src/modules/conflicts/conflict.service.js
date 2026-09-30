const { BusinessRuleError, ConflictError, NotFoundError } = require('../../shared/errors/AppError')
const { ROLES } = require('../../shared/roles')
const { toId } = require('../../shared/utils/serialize')
const { CLOSED_STATUSES, DUPLICATE_WINDOW_HOURS, QUEUE_VIEWS, duplicateReason, generateReference, isLocationAdequate, suggestPriority, suggestReviewResult } =
  require('./conflict.rules')
const { CONTACT_STATUS, REPORT_STATUS: S, REVIEW_RESULTS, TASK_STATUS } = require('./conflict.constants')
const { DUPLICATE_KEY } = require('./conflict.repository')

const HOUR = 60 * 60 * 1000
/** Clock skew allowed between a phone and the server before a time counts as "in the future". */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000
const REFERENCE_ATTEMPTS = 3

const TYPE_LABELS = {
  'elephant-sighting': 'Elephant sighting',
  'crop-damage': 'Crop damage',
  'property-damage': 'Property damage',
  'human-threat': 'Threat to people',
  'human-injury': 'Human injury',
  other: 'Conflict'
}

/** What the villager is told about each status when contact is retried (E3). */
const STATUS_MESSAGES = {
  [S.SUBMITTED]: 'Your report is waiting for verification by a community liaison officer.',
  [S.PENDING_INFORMATION]: 'We need more information about the location. Please open the report and reply.',
  [S.VALIDATED]: 'Your report has been verified and a ranger response is being arranged.',
  [S.AWAITING_APPROVAL]: 'A ranger deployment has been proposed and is awaiting park manager approval.',
  [S.RESPONSE_ASSIGNED]: 'A ranger team has been assigned and is responding.',
  [S.RESPONSE_COMPLETED]: 'The ranger team has finished its response. The outcome is being reviewed.',
  [S.ESCALATED]: 'Your report has been escalated to the park manager for additional action.',
  [S.MONITORING]: 'Rangers are monitoring the area for further elephant activity.',
  [S.RESOLVED]: 'Your report has been resolved.',
  [S.INVALID]: 'Your report could not be verified.',
  [S.DUPLICATE]: 'Your report has been linked to an existing report that already has a response.'
}

/**
 * UC01 report-level operations: villager submission (main flow step 1),
 * officer verification and priority (step 2), duplicates (A4), escalation (A5),
 * final review (step 5) and community contact (E1–E3).
 * Team deployment and ranger tasks live in response.service.js.
 */
function createConflictService({
  transactionRunner,
  conflictRepository,
  parkRepository,
  access,
  workflow,
  notifier,
  clock = () => new Date(),
  random = Math.random
}) {
  const { requireReport, transition, raiseAlert } = workflow

  async function loadStaffReport(reportId, actor, options) {
    const report = await requireReport(reportId, options)
    access.assertParkAccess(actor, report.park)
    return report
  }

  function assertNotInFuture(date, label) {
    if (new Date(date).getTime() > clock().getTime() + FUTURE_TOLERANCE_MS) {
      throw new BusinessRuleError(`${label} cannot be in the future.`, 'TIME_IN_FUTURE')
    }
  }

  async function createWithUniqueReference(data) {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await conflictRepository.createReport({ ...data, reference: generateReference(clock(), random) })
      } catch (error) {
        if (error?.code !== DUPLICATE_KEY || attempt >= REFERENCE_ATTEMPTS) throw error
      }
    }
  }

  /** A5, and "Escalated" at review: raise a UC04 alert and ask the park managers for more resources. */
  async function escalate(report, { reason, actor, action = 'escalated', set = {} }, session) {
    const alert = await raiseAlert(
      report,
      { title: `Escalated conflict: ${TYPE_LABELS[report.conflictType]} at ${report.village}`, message: `${report.reference}: ${reason}` },
      { session }
    )
    const updated = await transition(
      report,
      S.ESCALATED,
      { actor, action, note: reason, set: { ...set, escalation: { reason, by: actor.id, at: clock(), alert: alert._id } } },
      { session }
    )
    await notifier.managers(
      report.park,
      {
        title: `Conflict escalated: ${report.village}`,
        message: `${report.reference} (${report.priority ?? 'unprioritised'}) needs additional resources. ${reason}`,
        link: '/patrol/alerts'
      },
      { session }
    )
    return updated
  }

  return {
    /** Main flow step 1 (and A1 damage details, A2 immediate danger). */
    async submit(data, actor) {
      const park = await parkRepository.findParkById(data.parkId)
      if (!park) throw new NotFoundError('The selected park was not found.', 'PARK_NOT_FOUND')
      assertNotInFuture(data.occurredAt, 'The time of the incident')

      const now = clock()
      const { parkId, ...fields } = data
      const report = await createWithUniqueReference({
        ...fields,
        park: parkId,
        reporter: actor.id,
        status: S.SUBMITTED,
        locationAdequate: isLocationAdequate(fields),
        suggestedPriority: suggestPriority(fields),
        history: [{ at: now, by: actor.id, action: 'submitted', toStatus: S.SUBMITTED }]
      })

      const label = TYPE_LABELS[report.conflictType]
      await notifier.officers(report.park, {
        title: report.immediateDanger ? `IMMEDIATE DANGER: ${label} at ${report.village}` : `New conflict report: ${label} at ${report.village}`,
        message: `${report.reference} — ${report.description.slice(0, 160)}`,
        link: notifier.officerLink(report)
      })
      await notifier.community(report, {
        purpose: 'acknowledgement',
        title: `Report ${report.reference} received`,
        message: report.immediateDanger
          ? 'Officers have been alerted. Move people to a safe place and keep away from the elephant.'
          : 'A community liaison officer will verify your report shortly.'
      })

      return conflictRepository.findReportById(report._id)
    },

    listMine(actor) {
      return conflictRepository.listReports({ reporter: actor.id })
    },

    /**
     * Full report with its tasks and field actions. Villagers see only their
     * own reports; officers and managers only reports in their park; rangers
     * only reports their team was sent to.
     */
    async getReport(reportId, actor) {
      const report = await requireReport(reportId, { populate: true })
      const tasks = await conflictRepository.listTasksByReport(report._id)

      if (actor.role === ROLES.VILLAGER) access.assertReporter(actor, report)
      else if (actor.role === ROLES.RANGER) {
        if (!tasks.some((task) => (task.team?.members ?? []).some((member) => toId(member) === actor.id))) {
          access.assertReporter(actor, report)
        }
      } else access.assertParkAccess(actor, report.park)

      const actions = tasks.length ? await conflictRepository.listActionsByTasks(tasks.map((task) => task._id)) : []
      const latestCompleted = tasks.find((task) => task.status === TASK_STATUS.COMPLETED)
      return {
        report: actor.role === ROLES.VILLAGER ? { ...report, contactAttempts: undefined } : report,
        tasks,
        actions,
        suggestedReview: latestCompleted ? suggestReviewResult(latestCompleted.completion?.outcome) : null
      }
    },

    /** A3: the villager answers the officer's request for more location information. */
    async provideInformation(reportId, { response, landmark, location }, actor) {
      const report = await requireReport(reportId)
      access.assertReporter(actor, report)
      if (report.status !== S.PENDING_INFORMATION) {
        throw new ConflictError('This report is not waiting for more information.', 'INFORMATION_NOT_REQUESTED')
      }

      const merged = { village: report.village, landmark: landmark ?? report.landmark, location: location ?? report.location }
      const updated = await transition(report, S.SUBMITTED, {
        actor,
        action: 'information-provided',
        note: response,
        set: {
          landmark: merged.landmark,
          location: merged.location,
          locationAdequate: isLocationAdequate(merged),
          'informationRequest.response': response,
          'informationRequest.respondedAt': clock()
        }
      })
      await notifier.officers(report.park, {
        title: `Information received for ${report.reference}`,
        message: response.slice(0, 200),
        link: notifier.officerLink(report)
      })
      return updated
    },

    /** Officer queue with the number of reports in each tab. */
    async listQueue({ parkId, view = 'new' }, actor) {
      const park = parkId ?? actor.park
      if (park) access.assertParkAccess(actor, park)

      const [reports, byStatus] = await Promise.all([
        conflictRepository.listReports({ park, statuses: QUEUE_VIEWS[view] }),
        conflictRepository.countByStatus({ park })
      ])
      const counts = Object.fromEntries(
        Object.entries(QUEUE_VIEWS).map(([name, statuses]) => [name, statuses.reduce((total, status) => total + (byStatus[status] ?? 0), 0)])
      )
      return { park, view, reports, counts }
    },

    /** Main flow step 2: mark the report valid (with a priority) or invalid. */
    async validate(reportId, { decision, priority, notes }, actor) {
      const report = await loadStaffReport(reportId, actor)
      const valid = decision === 'valid'
      if (valid && !report.locationAdequate) {
        throw new BusinessRuleError('The location is too vague to send a team. Request more information from the villager first.', 'LOCATION_INADEQUATE')
      }

      const updated = await transition(report, valid ? S.VALIDATED : S.INVALID, {
        actor,
        action: valid ? 'validated' : 'marked-invalid',
        note: valid ? `Priority ${priority}${notes ? ` — ${notes}` : ''}` : notes,
        set: { validation: { decision, notes, by: actor.id, at: clock() }, ...(valid && { priority }) }
      })
      await notifier.community(updated, {
        purpose: valid ? 'validated' : 'invalid',
        title: valid ? `Report ${report.reference} verified` : `Report ${report.reference} could not be verified`,
        message: valid ? STATUS_MESSAGES[S.VALIDATED] : notes
      })
      return updated
    },

    /** A3: inadequate location → ask the villager for more information. */
    async requestInformation(reportId, { message }, actor) {
      const report = await loadStaffReport(reportId, actor)
      const updated = await transition(report, S.PENDING_INFORMATION, {
        actor,
        action: 'information-requested',
        note: message,
        set: { informationRequest: { message, requestedBy: actor.id, requestedAt: clock() } }
      })
      await notifier.community(updated, { purpose: 'information-request', title: `More information needed for ${report.reference}`, message })
      return updated
    },

    /** A4: open reports that look like the same event (documented rule in conflict.rules.js). */
    async findDuplicates(reportId, actor) {
      const report = await loadStaffReport(reportId, actor)
      const occurredAt = new Date(report.occurredAt).getTime()
      const candidates = await conflictRepository.listRecentOpenReports({
        park: report.park,
        excludeId: report._id,
        excludeStatuses: CLOSED_STATUSES,
        from: new Date(occurredAt - DUPLICATE_WINDOW_HOURS * HOUR),
        to: new Date(occurredAt + DUPLICATE_WINDOW_HOURS * HOUR)
      })
      return candidates
        .map((candidate) => ({ report: candidate, match: duplicateReason(report, candidate) }))
        .filter((entry) => entry.match)
        .sort((first, second) => (first.match.distanceKm ?? Infinity) - (second.match.distanceKm ?? Infinity))
    },

    /** A4: link the report to the primary one, so the existing response covers it and no second task is created. */
    async linkDuplicate(reportId, { primaryReportId, notes }, actor) {
      if (reportId === primaryReportId) throw new BusinessRuleError('A report cannot be linked to itself.', 'SELF_LINK')
      const [report, primary] = await Promise.all([loadStaffReport(reportId, actor), requireReport(primaryReportId)])
      if (toId(report.park) !== toId(primary.park)) {
        throw new BusinessRuleError('Only reports from the same park can be linked.', 'PARK_MISMATCH')
      }
      if (CLOSED_STATUSES.includes(primary.status)) {
        throw new BusinessRuleError(`${primary.reference} is ${primary.status}; link to an open report instead.`, 'PRIMARY_CLOSED')
      }

      const updated = await transactionRunner.run(async (session) => {
        const linked = await transition(
          report,
          S.DUPLICATE,
          { actor, action: 'linked-as-duplicate', note: notes ?? `Duplicate of ${primary.reference}`, set: { duplicateOf: primary._id } },
          { session }
        )
        await conflictRepository.updateReport(
          primary._id,
          {
            $addToSet: { linkedReports: report._id },
            $push: { history: { at: clock(), by: actor.id, action: 'duplicate-linked', note: `${report.reference} linked to this report` } }
          },
          { session }
        )
        return linked
      })
      await notifier.community(updated, {
        purpose: 'duplicate',
        title: `Report ${report.reference} linked`,
        message: `Your report was linked to ${primary.reference}, which already covers this event. ${STATUS_MESSAGES[primary.status] ?? ''}`.trim()
      })
      return updated
    },

    /** A5: no suitable team (or the officer needs more resources) → escalate to the park manager. */
    async escalate(reportId, { reason }, actor) {
      const report = await loadStaffReport(reportId, actor)
      workflow.assertCanTransition(report, S.ESCALATED)

      const updated = await transactionRunner.run(async (session) => {
        // A proposal still waiting for approval is withdrawn, so the manager does not approve a stale plan.
        if (report.status === S.AWAITING_APPROVAL) {
          const pending = await conflictRepository.findOpenTaskByReport(report._id, { session })
          if (pending) {
            await conflictRepository.updateTaskIf(
              pending._id,
              [TASK_STATUS.AWAITING_APPROVAL],
              { $set: { status: TASK_STATUS.REJECTED, 'approval.decision': 'rejected', 'approval.notes': `Withdrawn: ${reason}`, 'approval.at': clock() } },
              { session }
            )
          }
        }
        return escalate(report, { reason, actor }, session)
      })
      await notifier.community(updated, { purpose: 'escalated', title: `Update on ${report.reference}`, message: STATUS_MESSAGES[S.ESCALATED] })
      return updated
    },

    /** Main flow step 5: the officer reviews the completed response and sets the outcome. */
    async review(reportId, { result, notes, followUpAt }, actor) {
      const report = await loadStaffReport(reportId, actor)
      if (report.status !== S.RESPONSE_COMPLETED) {
        throw new ConflictError('Only a report whose response has been completed can be reviewed.', 'REVIEW_NOT_READY')
      }
      if (result === REVIEW_RESULTS.MONITORING && new Date(followUpAt).getTime() <= clock().getTime()) {
        throw new BusinessRuleError('The follow-up check must be scheduled in the future.', 'FOLLOW_UP_IN_PAST')
      }

      const [latestTask] = (await conflictRepository.listTasksByReport(report._id)).filter((task) => task.status === TASK_STATUS.COMPLETED)
      const outcome = {
        'outcome.result': result,
        'outcome.fieldOutcome': latestTask?.completion?.outcome,
        'outcome.notes': notes,
        'outcome.followUpAt': result === REVIEW_RESULTS.MONITORING ? followUpAt : undefined,
        'outcome.reviewedBy': actor.id,
        'outcome.reviewedAt': clock()
      }

      const updated =
        result === REVIEW_RESULTS.ESCALATED
          ? await transactionRunner.run((session) => escalate(report, { reason: notes, actor, action: 'reviewed-escalated', set: outcome }, session))
          : await transition(report, result === REVIEW_RESULTS.RESOLVED ? S.RESOLVED : S.MONITORING, {
              actor,
              action: `reviewed-${result}`,
              note: notes,
              set: outcome
            })

      await notifier.community(updated, {
        purpose: `review-${result}`,
        title: `Update on ${report.reference}`,
        message: `${STATUS_MESSAGES[updated.status]}${notes ? ` ${notes}` : ''}`
      })
      return updated
    },

    /** E3: try the community channels again with the report's current status. */
    async retryContact(reportId, actor) {
      const report = await loadStaffReport(reportId, actor)
      const result = await notifier.community(report, {
        purpose: 'retry',
        title: `Update on ${report.reference}`,
        message: STATUS_MESSAGES[report.status]
      })
      return { ...result, report: await conflictRepository.findReportById(report._id) }
    },

    /** E2: all channels failed, so the officer records how the community was reached instead. */
    async recordAlternativeContact(reportId, { method, contactedPerson, notes }, actor) {
      const report = await loadStaffReport(reportId, actor)
      const at = clock()
      const detail = [contactedPerson, notes].filter(Boolean).join(' — ')
      return conflictRepository.updateReport(report._id, {
        $set: { contactStatus: 'ok' },
        $push: {
          contactAttempts: { at, purpose: 'alternative-contact', channel: 'alternative', status: CONTACT_STATUS.RECORDED, method, detail, recordedBy: actor.id },
          history: { at, by: actor.id, action: 'alternative-contact-recorded', note: `${method}: ${detail}` }
        }
      })
    }
  }
}

module.exports = { createConflictService, STATUS_MESSAGES, TYPE_LABELS }
