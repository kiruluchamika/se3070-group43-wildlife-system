import { api } from '../../../lib/api'

/** The browser owns PDF creation/download; cancellation never changes a report. */
export async function printFinalizedReport(reportId, openWindow = () => window.open('', '_blank')) {
  const popup = openWindow()
  if (!popup) throw new Error('Allow pop-ups for WildGuard, then retry Export.')
  try {
    popup.opener = null
    const { html } = await api.get(`/reports/${encodeURIComponent(reportId)}/export`)
    if (popup.closed) throw new Error('The export window was closed. Please retry Export.')
    popup.document.open()
    popup.document.write(html)
    popup.document.close()
    await popup.document.fonts?.ready
    popup.focus()
    popup.print()
  } catch (error) {
    popup.close()
    throw error
  }
}
