import { api } from '../../../lib/api'

/** Download only the server-authorized PDF; no popup or browser printing. */
export async function downloadFinalizedReport(reportId) {
  const pdf = await api.get(`/reports/${encodeURIComponent(reportId)}/export`, { responseType: 'blob' })
  if (pdf.type !== 'application/pdf' || pdf.size === 0) throw new Error('The server did not return a PDF.')
  const url = URL.createObjectURL(pdf)
  const link = document.createElement('a')
  try {
    link.href = url
    link.download = `WildGuard-report-${reportId.replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`
    document.body.appendChild(link)
    link.click()
  } finally {
    link.remove()
    // Give the browser time to begin reading the download before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
}
