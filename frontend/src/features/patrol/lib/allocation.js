/** Pure helpers for the Allocate / Reassign Rangers panel. */

export const ALLOCATION_MODE = Object.freeze({
  ALLOCATE: 'allocate',
  REASSIGN: 'reassign',
  UNAVAILABLE: 'unavailable',
})

/** Available teams are allocated; teams on a normal patrol are reassigned (A3); others cannot be used. */
export function allocationModeFor(team) {
  if (!team) return null
  if (team.status === 'available') return ALLOCATION_MODE.ALLOCATE
  if (team.status === 'on-patrol' && team.currentAssignment && team.currentAssignment.allocationType !== 'emergency') {
    return ALLOCATION_MODE.REASSIGN
  }
  return ALLOCATION_MODE.UNAVAILABLE
}

/**
 * What a reassignment would change: the zone the team leaves and whether that
 * zone ranks equal to or above the target (so the move would need an override).
 */
export function reassignImpact(team, targetZoneId, zones = []) {
  const fromZoneId = team?.currentAssignment?.zone?.id
  if (!fromZoneId) return null

  const from = zones.find((assessment) => assessment.zone.id === fromZoneId)
  const to = zones.find((assessment) => assessment.zone.id === targetZoneId)
  const otherTeamsInZone = (from?.assignedTeams ?? []).filter((assigned) => assigned.id !== team.id)

  return {
    fromZone: from?.zone ?? team.currentAssignment.zone,
    fromRisk: from?.effectiveRisk ?? team.currentAssignment.zone?.riskLevel,
    leavesZoneUncovered: otherTeamsInZone.length === 0,
    isPriorityDowngrade: Boolean(from && to && from.priorityScore >= to.priorityScore),
  }
}

/** Team counts used by the E2 notice (no rangers available). */
export function teamAvailability(teams = []) {
  const available = teams.filter((team) => allocationModeFor(team) === ALLOCATION_MODE.ALLOCATE).length
  const reassignable = teams.filter((team) => allocationModeFor(team) === ALLOCATION_MODE.REASSIGN).length
  return { available, reassignable, none: available === 0 && reassignable === 0 }
}

export const isDispatchable = (alert) => ['high', 'critical'].includes(alert.severity) && ['active', 'acknowledged'].includes(alert.status)
