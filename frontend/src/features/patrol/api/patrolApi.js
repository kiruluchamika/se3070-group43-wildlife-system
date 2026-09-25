import { api, toQuery } from '../../../lib/api'

/** UC04 endpoints (see docs/API.md). Paths are used with useApiQuery; actions return promises. */
export const patrolPaths = {
  coverage: (parkId) => `/patrol/coverage${toQuery({ parkId })}`,
  teams: (parkId, zoneId) => `/patrol/teams${toQuery({ parkId, zoneId })}`,
  alerts: (parkId, status = 'open') => `/alerts${toQuery({ parkId, status })}`,
  assignments: (parkId) => `/patrol/assignments${toQuery({ parkId })}`,
  decisions: (parkId) => `/patrol/decisions${toQuery({ parkId })}`,
  recommendations: (alertId) => `/patrol/emergency-dispatches/recommendations${toQuery({ alertId })}`,
  myAssignment: () => '/patrol/my-assignment',
}

export const patrolApi = {
  allocate: (body) => api.post('/patrol/assignments', body),
  reassign: (body) => api.post('/patrol/assignments/reassign', body),
  complete: (assignmentId) => api.patch(`/patrol/assignments/${assignmentId}/complete`),
  acknowledgeAssignment: (assignmentId) => api.patch(`/patrol/assignments/${assignmentId}/acknowledge`),
  acknowledgeAlert: (alertId) => api.patch(`/alerts/${alertId}/acknowledge`),
  dispatch: (body) => api.post('/patrol/emergency-dispatches', body),
}
