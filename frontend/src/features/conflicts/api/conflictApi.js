import { api, toQuery } from '../../../lib/api'

/** UC01 endpoints (see docs/API.md). Paths are used with useApiQuery; actions return promises. */
export const conflictPaths = {
  mine: () => '/conflicts/mine',
  queue: (parkId, view) => `/conflicts${toQuery({ parkId, view })}`,
  report: (reportId) => `/conflicts/${reportId}`,
  duplicates: (reportId) => `/conflicts/${reportId}/duplicates`,
  teams: (reportId) => `/conflicts/${reportId}/teams`,
  approvals: (parkId) => `/response-tasks/approvals${toQuery({ parkId })}`,
  myTasks: () => '/response-tasks/mine',
}

export const conflictApi = {
  // Villager
  submit: (body) => api.post('/conflicts', body),
  provideInformation: (reportId, body) => api.patch(`/conflicts/${reportId}/information`, body),

  // Community Liaison Officer
  validate: (reportId, body) => api.patch(`/conflicts/${reportId}/validation`, body),
  requestInformation: (reportId, body) => api.patch(`/conflicts/${reportId}/information-request`, body),
  linkDuplicate: (reportId, body) => api.patch(`/conflicts/${reportId}/duplicate`, body),
  deploy: (reportId, body) => api.post(`/conflicts/${reportId}/deployments`, body),
  escalate: (reportId, body) => api.patch(`/conflicts/${reportId}/escalation`, body),
  review: (reportId, body) => api.patch(`/conflicts/${reportId}/review`, body),
  retryContact: (reportId) => api.post(`/conflicts/${reportId}/contact-retry`),
  recordAlternativeContact: (reportId, body) => api.post(`/conflicts/${reportId}/alternative-contact`, body),

  // Park Manager
  decideApproval: (taskId, body) => api.patch(`/response-tasks/${taskId}/approval`, body),

  // Ranger
  acknowledgeTask: (taskId) => api.patch(`/response-tasks/${taskId}/acknowledge`),
  recordAction: (taskId, body) => api.post(`/response-tasks/${taskId}/actions`, body),
  completeTask: (taskId, body) => api.patch(`/response-tasks/${taskId}/complete`, body),
}
