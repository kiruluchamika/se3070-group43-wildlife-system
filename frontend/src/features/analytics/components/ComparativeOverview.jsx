import { Card } from '../../../components/ui/Card'
import { comparisonRows } from '../lib/compareParks'

export function ComparativeOverview({ parks }) {
  const number = (value) => value == null ? 'Unavailable' : value.toLocaleString('en-GB', { maximumFractionDigits: 2 })
  return <Card title="Comparative Overview" className="mt-6">
    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <caption className="sr-only">Independent park results for the selected filters</caption>
      <thead><tr>{['Park', 'Event records', 'Alerts', 'Conflicts', 'Zones represented', 'Hotspot zones', 'Patrol records', 'Patrol hours'].map((heading) => <th key={heading} scope="col" className="whitespace-nowrap border-b border-line px-3 py-3 font-semibold text-fg">{heading}</th>)}</tr></thead>
      <tbody>{comparisonRows(parks).map((row) => <tr key={row.id}>
        <th scope="row" className="border-b border-line px-3 py-3 font-semibold text-fg">{row.name}</th>
        {['totalEventRecords', 'alertRecords', 'conflictRecords', 'representedZones', 'hotspots', 'patrolRecords', 'patrolHours'].map((key) => <td key={key} className="border-b border-line px-3 py-3 text-muted tabular-nums">{number(row[key])}</td>)}
      </tr>)}</tbody>
    </table></div>
    <p className="mt-3 text-xs text-muted">Each park is calculated independently. Event records are not unique incidents. Patrol hours measure effort; coverage percentages remain per zone against each park's targets.</p>
  </Card>
}
