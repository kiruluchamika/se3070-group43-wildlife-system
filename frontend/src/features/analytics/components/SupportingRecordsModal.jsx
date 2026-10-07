import { useMemo } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { Field, Select } from '../../../components/ui/Field'
import { EmptyState, ErrorState } from '../../../components/ui/Feedback'
import { humanize } from '../../../lib/format'
import { recordTitle } from '../lib/recordDisplay'
import { CATEGORY_LABELS, EMPTY_MESSAGES, indexSupportingRecords, selectSupportingRecords, supportingCategories } from '../lib/supportingRecords'

const PAGE_SIZE = 25
const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' })
function date(value) {
  return value && Number.isFinite(new Date(value).getTime()) ? dateFormat.format(new Date(value)) : 'Not recorded'
}

export function SupportingRecordsModal({ result, dataset, analysis, state, dispatch, onClose }) {
  const index = useMemo(() => indexSupportingRecords(result), [result])
  const selected = useMemo(() => selectSupportingRecords(index, analysis, state.category, state.zoneId), [index, analysis, state.category, state.zoneId])
  const zones = useMemo(() => new Map(dataset.zones.map((zone) => [zone.id, zone.name])), [dataset])
  const categories = supportingCategories(analysis)
  const pageCount = Math.max(1, Math.ceil(selected.rows.length / PAGE_SIZE))
  const page = Math.min(state.page, pageCount - 1)
  const { context } = result
  return <Modal open={state.open} onClose={onClose} title="Supporting Records" size="lg"
    description={`${context.park.name} · ${context.filters.startDate} to ${context.filters.endDate} · ${context.filters.incidentType ? humanize(context.filters.incidentType) : 'All incident types'}`}
    footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Result Category">{(props) => <Select {...props} value={state.category} onChange={(event) => dispatch({ type: 'category', value: event.target.value })}>
        {categories.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
      </Select>}</Field>
      {(state.category === 'hotspots' || state.category === 'patrol-coverage') && <Field label={state.category === 'hotspots' ? 'Hotspot / Zone' : 'Zone'}>{(props) =>
        <Select {...props} value={state.zoneId} onChange={(event) => dispatch({ type: 'zone', value: event.target.value })}>
          <option value="">{state.category === 'hotspots' ? 'All Hotspots' : 'All Zones'}</option>
          {selected.zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
        </Select>}</Field>}
    </div>
    <p className="my-4 text-xs text-muted">{state.category === 'all'
      ? 'Retrieved alerts, conflicts and separate patrol context. Records can describe the same real-world event.'
      : state.category === 'trends' ? 'Only alert and conflict records contributing to the trend buckets.'
        : state.category === 'hotspots' ? 'Only alert records contributing to the identified hotspot zones.'
          : 'Only patrol intervals contributing to coverage. Incident type does not restrict patrol context.'} All times are Sri Lanka time.</p>
    {selected.status === 'error' ? <ErrorState message="Supporting records are unavailable because this analysis section could not be calculated. Close this dialog to retry the analysis." />
      : selected.status === 'empty' ? <EmptyState title={EMPTY_MESSAGES[state.category]} /> : <>
        <p className="mb-2 text-xs text-muted" role="status">{selected.rows.length} records · Page {page + 1} of {pageCount}</p>
        <div className="max-w-full overflow-x-auto rounded-xl border border-line" tabIndex={0} role="region" aria-label="Supporting records table">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">{CATEGORY_LABELS[state.category]} supporting records</caption>
            <thead className="bg-surface-2 text-muted"><tr>{['Date / Time', 'Zone', 'Record / Source', 'Recorded state'].map((label) => <th key={label} scope="col" className="px-3 py-3 font-semibold">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">{selected.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(({ source, record }) => {
              const patrol = source === 'patrolRecords'
              const conflict = source === 'conflicts'
              const zoneId = typeof record.zone === 'string' ? record.zone : record.zone?.id
              return <tr key={`${source}:${record.id}`} className="align-top text-fg">
                <td className="px-3 py-3">{patrol ? <><span className="block">Start: {date(record.startTime)}</span><span className="mt-1 block text-xs text-muted">End: {date(record.endTime)}</span></> : date(conflict ? record.occurredAt : record.eventAt ?? record.createdAt)}</td>
                <td className="px-3 py-3">{conflict ? 'Not recorded' : zones.get(zoneId) ?? 'Not recorded'}</td>
                <td className="max-w-64 break-words px-3 py-3"><span className="font-semibold">{patrol ? 'Patrol record' : conflict ? 'Conflict report' : 'Alert'}</span>
                  {(record.type || record.conflictType) && <span className="block text-xs">{humanize(record.type || record.conflictType)}</span>}
                  {!patrol && !conflict && record.source && <span className="block text-xs text-muted">Source: {humanize(record.source)}</span>}
                  {(record.title || record.reference) && <span className="mt-1 block text-xs text-muted">{recordTitle(record.title || record.reference)}</span>}
                  <span className="mt-1 block break-all text-xs text-subtle">ID: {record.id}</span>
                </td>
                <td className="px-3 py-3">{patrol ? (record.syncStatus ? `Sync: ${humanize(record.syncStatus)}` : 'Not recorded') : record.status ? humanize(record.status) : 'Not recorded'}</td>
              </tr>
            })}</tbody>
          </table>
        </div>
        {pageCount > 1 && <div className="mt-3 flex justify-between gap-3">
          <Button variant="secondary" disabled={page === 0} onClick={() => dispatch({ type: 'page', value: page - 1 })}>Previous</Button>
          <Button variant="secondary" disabled={page + 1 >= pageCount} onClick={() => dispatch({ type: 'page', value: page + 1 })}>Next</Button>
        </div>}
      </>}
  </Modal>
}
