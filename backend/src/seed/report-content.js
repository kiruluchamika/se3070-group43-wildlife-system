/** Narrative for explicitly identified development reports, using their stored
 * snapshots only. No source records, calculations or production reports change. */
function sampleReportContent(snapshot) {
  const sections = snapshot.parks || [snapshot]
  const number = value => Number(value).toLocaleString('en-GB', { maximumFractionDigits: 2 })
  const findings = []
  const recommendations = []
  for (const section of sections) {
    const { context, statistics, analysis } = section
    const { startDate, endDate, species, incidentType } = context.filters
    const name = context.park.name
    findings.push(`${name}: From ${startDate} to ${endDate}, the saved analysis contains ${statistics.alertRecords} alert records and ${statistics.conflictRecords} conflict records, with ${statistics.patrolRecords} patrol records retained separately. The selection covers ${species || 'all recorded species'} and ${incidentType || 'all incident types'}. Event totals describe records, not unique wildlife incidents.`)
    if (statistics.totalEventRecords === 0) {
      findings.push('No matching event records were available when this report was prepared. This does not establish that wildlife activity or conservation threats were absent.')
      recommendations.push(`${name}: Check field-device synchronization and monitoring coverage before interpreting the lack of event records. Maintain routine wildlife monitoring and patrol reporting.`)
    }
    if (analysis.hotspots.status === 'error') findings.push('Hotspot analysis was unavailable in the saved snapshot.')
    else if (!analysis.hotspots.hotspots.length) findings.push('No zone met the threshold of three zone-linked alert events during this period.')
    else {
      const zones = analysis.hotspots.hotspots.map(row => `${row.zone.name} (${row.count} alert events)`).join(', ')
      findings.push(`Alert activity met the hotspot threshold in ${zones}. These counts require field verification and do not establish population size or threat severity.`)
      recommendations.push(`${name}: Review the supporting observations and schedule field checks in ${analysis.hotspots.hotspots.map(row => row.zone.name).join(' and ')} before changing conservation priorities.`)
    }
    if (analysis.coverage.status === 'error') {
      findings.push('Patrol coverage was unavailable in the saved snapshot.')
      recommendations.push(`${name}: Verify patrol intervals and zone targets before planning changes to patrol allocation.`)
    } else {
      const zones = analysis.coverage.zones
      findings.push(zones.length
        ? `Recorded patrol effort: ${zones.map(row => `${row.zone.name}: ${number(row.hours)} ${row.hours === 1 ? 'hour' : 'hours'}${!Number.isFinite(row.percent) ? ' (coverage unavailable)' : ` (${row.percent}% of the prorated target)`}`).join('; ')}. Coverage describes effort against targets, not geographic area covered.`
        : 'No zone-level patrol effort is available in this saved analysis.')
      const below = zones.filter(row => Number.isFinite(row.percent) && row.percent < 100)
      recommendations.push(below.length
        ? `${name}: Review patrol scheduling for ${below.map(row => row.zone.name).join(', ')} against the configured zone targets, terrain and operational risk. Confirm missing patrol records before treating low recorded effort as a field coverage gap.`
        : `${name}: Maintain documented patrol effort and review monitoring observations alongside zone targets and operational risk.`)
    }
  }
  const { startDate, endDate } = snapshot.context.filters
  return { title: `${sections.map(section => section.context.park.name).join(' and ')} Conservation ${sections.length > 1 ? 'Comparison' : 'Review'}: ${startDate} to ${endDate}`,
    findings: findings.join('\n\n'), recommendations: recommendations.join('\n\n') }
}
module.exports = { sampleReportContent }
