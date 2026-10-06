import { api } from '../../../lib/api'

export const incidentPaths = {
  mine: () => '/incidents/mine',
  detail: (incidentId) => `/incidents/${incidentId}`,
}

export const incidentApi = {
  submit: (body) => api.post('/incidents', body),
}
