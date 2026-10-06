import { AlertTriangle, CheckCircle2, CloudUpload, FilePlus2, Inbox, MapPin, RefreshCw, Trash2, Wifi, WifiOff } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback'
import { PageHeader } from '../../../components/ui/PageHeader'
import { useAuth } from '../../../context/auth-context'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { formatDateTime, humanize } from '../../../lib/format'
import { incidentPaths } from '../api/incidentApi'
import { SyncStatusBadge } from '../components/SyncStatusBadge'
import { TYPE_LABELS } from '../lib/incident'
import { useIncidentQueue } from '../offline/useIncidentQueue'

function IncidentSummary({ item, onRetry, onDiscard, busy }) {
  const payload = item.payload
  const reference = item.serverResult?.incident?.reference
  return (
    <li className="rounded-2xl border border-line bg-surface-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-fg">{TYPE_LABELS[payload.type] ?? humanize(payload.type)}</p>
            <SyncStatusBadge status={item.status} />
          </div>
          <p className="mt-1 text-xs text-muted">Observed {formatDateTime(payload.observedAt)} · {item.photoCount ?? payload.photos?.length ?? 0} photo(s)</p>
          {reference && <p className="mt-1 font-mono text-xs font-semibold text-brand-700 dark:text-brand-300">{reference}</p>}
        </div>
        <Badge tone={payload.severity === 'critical' ? 'red' : payload.severity === 'high' ? 'amber' : 'neutral'}>{humanize(payload.severity)}</Badge>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-muted">{payload.description}</p>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-subtle">
        <MapPin className="size-3.5" aria-hidden="true" />
        {payload.location ? `${payload.location.lat}, ${payload.location.lng}` : payload.locationNote}
      </p>
      {item.lastError && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-200">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> {item.lastError}
        </p>
      )}
      {(item.status === 'failed' || item.status === 'queued') && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={RefreshCw} loading={busy} onClick={() => onRetry(item.clientId)}>Retry</Button>
          {item.status === 'failed' && <Button size="sm" variant="ghost" icon={Trash2} onClick={() => onDiscard(item.clientId)}>Discard local copy</Button>}
        </div>
      )}
    </li>
  )
}

function ServerIncident({ incident }) {
  return (
    <li className="rounded-2xl border border-line bg-surface-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-fg">{TYPE_LABELS[incident.type] ?? humanize(incident.type)}</p>
            <Badge tone="green" icon={CheckCircle2}>Report received</Badge>
          </div>
          <p className="mt-1 font-mono text-xs font-semibold text-brand-700 dark:text-brand-300">{incident.reference}</p>
        </div>
        <Badge tone={incident.severity === 'critical' ? 'red' : incident.severity === 'high' ? 'amber' : 'neutral'}>{humanize(incident.severity)}</Badge>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-muted">{incident.description}</p>
      <p className="mt-2 text-xs text-subtle">Observed {formatDateTime(incident.observedAt)} · {incident.photoCount} photo(s)</p>
    </li>
  )
}

export default function PendingIncidentsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const remote = useApiQuery(incidentPaths.mine(), { refreshMs: 30000 })
  const reloadRemote = remote.reload
  const onSynced = useCallback(() => reloadRemote(), [reloadRemote])
  const queue = useIncidentQueue(user.id, { onSynced })
  const [workingId, setWorkingId] = useState(null)

  const groups = useMemo(() => ({
    attention: queue.items.filter((item) => item.status === 'failed'),
    waiting: queue.items.filter((item) => item.status === 'queued' || item.status === 'syncing'),
    sent: queue.items.filter((item) => item.status === 'synced'),
  }), [queue.items])
  const localIds = new Set(queue.items.map((item) => item.clientId))
  const serverOnly = (remote.data?.incidents ?? []).filter((incident) => !localIds.has(incident.clientId))
  const empty = queue.items.length === 0 && serverOnly.length === 0

  async function retry(clientId) {
    setWorkingId(clientId)
    try {
      const result = await queue.retry(clientId)
      if (result?.synced) toast.success('Report received by WildGuard.')
      else if (result?.stoppedBy) toast.error('Still unable to send. Your report remains safe on this device.')
    } finally {
      setWorkingId(null)
    }
  }

  async function discard(clientId) {
    if (!window.confirm('Discard this failed local report? This cannot be undone.')) return
    await queue.discard(clientId)
    toast.success('Local report discarded.')
  }

  return (
    <>
      <PageHeader
        eyebrow="UC03 · Offline sync"
        title="Incident reports"
        description="See what is safe on this device and what the wildlife office has received."
        actions={<Button icon={FilePlus2} onClick={() => navigate('/incidents/new')}>New report</Button>}
      />

      <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${queue.online ? 'border-emerald-400/25 bg-emerald-500/8' : 'border-amber-400/30 bg-amber-500/10'}`}>
        <div className="flex items-center gap-3">
          {queue.online ? <Wifi className="size-5 text-emerald-600 dark:text-emerald-300" /> : <WifiOff className="size-5 text-amber-600 dark:text-amber-300" />}
          <div>
            <p className="text-sm font-semibold text-fg">{queue.online ? 'Connected' : 'Working offline'}</p>
            <p className="text-xs text-muted">{queue.online ? 'Waiting reports send automatically while this page is open.' : 'New reports remain safely on this device until the connection returns.'}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" icon={CloudUpload} loading={queue.syncing} disabled={!queue.online || groups.waiting.length === 0} onClick={queue.sync}>Sync now</Button>
      </div>

      {remote.loading && queue.items.length === 0 ? (
        <Skeleton className="h-64" />
      ) : empty && !remote.error ? (
        <div className="panel"><EmptyState icon={Inbox} title="No incident reports" description="Reports saved in the field will appear here with their sync status." action={<Button icon={FilePlus2} onClick={() => navigate('/incidents/new')}>Create first report</Button>} /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.attention.length > 0 && (
            <Card title="Needs attention" icon={AlertTriangle} className="border-red-400/20">
              <ul className="grid gap-3">{groups.attention.map((item) => <IncidentSummary key={item.clientId} item={item} busy={workingId === item.clientId} onRetry={retry} onDiscard={discard} />)}</ul>
            </Card>
          )}
          {groups.waiting.length > 0 && (
            <Card title="Waiting to sync" icon={CloudUpload}>
              <ul className="grid gap-3">{groups.waiting.map((item) => <IncidentSummary key={item.clientId} item={item} busy={workingId === item.clientId || queue.syncing} onRetry={retry} onDiscard={discard} />)}</ul>
            </Card>
          )}
          {(groups.sent.length > 0 || serverOnly.length > 0) && (
            <Card title="Received by WildGuard" icon={CheckCircle2} className="lg:col-span-2">
              <ul className="grid gap-3 md:grid-cols-2">
                {groups.sent.map((item) => <IncidentSummary key={item.clientId} item={item} onRetry={retry} onDiscard={discard} />)}
                {serverOnly.map((incident) => <ServerIncident key={incident.id} incident={incident} />)}
              </ul>
            </Card>
          )}
        </div>
      )}

      {remote.error && (
        <div className="mt-4 panel">
          <ErrorState title="Server history unavailable" message="Local reports are still shown above. Reconnect to refresh reports already received by the server." onRetry={remote.reload} />
        </div>
      )}
    </>
  )
}
