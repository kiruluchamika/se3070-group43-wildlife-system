import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '../../context/auth-context'
import { useApiQuery } from '../../hooks/useApiQuery'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback'
import { PageHeader } from '../../components/ui/PageHeader'
import { ForbiddenPage } from '../errors/ForbiddenPage'
import { ROLE_LABELS } from '../../lib/navigation'
import { UserEditor, UserStatusDialog } from './UserDialogs'

export default function UsersPage() {
  const { user } = useAuth()
  const allowed = user?.role === 'administrator'
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Math.min(100000, Math.floor(Number(params.get('page')) || 1)))
  const query = useApiQuery(`/users?page=${page}`, { enabled: allowed })
  const parks = useApiQuery('/parks', { enabled: allowed })
  const [dialog, setDialog] = useState(null)
  const [message, setMessage] = useState(null)
  if (!allowed) return <ForbiddenPage />
  const saved = (text) => { setDialog(null); setMessage(text); query.reload() }
  return <>
    <PageHeader eyebrow="Administration" title="User Management" description="Manage accounts, roles and access to WildGuard."
      actions={<Button disabled={!parks.data} onClick={() => { setMessage(null); setDialog({ kind: 'create' }) }}>Create User</Button>} />
    {message && <p role="status" className="mb-5 text-sm text-fg">{message}</p>}
    {parks.error && <ErrorState message="Unable to load park options." onRetry={parks.reload} />}
    {query.loading ? <Skeleton className="h-64" /> : query.error ? <ErrorState message="Unable to load users." onRetry={query.reload} /> : <>
      {!query.data?.users.length && <Card><EmptyState title="No users on this page." /></Card>}
      <div className="grid gap-4">{query.data?.users.map((item) => <Card key={item.id}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1"><h2 className="break-words font-semibold text-fg">{item.name}</h2><p className="break-all text-sm text-muted">{item.email}</p>
            <p className="mt-2 text-sm text-muted">{ROLE_LABELS[item.role] ?? item.role} · {parks.data?.parks.find((park) => park.id === item.park)?.name ?? (item.park ? 'Assigned park' : 'No assigned park')}</p></div>
          <Badge tone={item.isActive !== false ? 'green' : 'amber'}>{item.isActive !== false ? 'Active' : 'Inactive'}</Badge>
          <div className="flex flex-wrap gap-2">
            <Button variant={item.isActive !== false ? 'danger' : 'secondary'} disabled={item.id === user.id} onClick={() => setDialog({ kind: 'status', user: item })}>{item.isActive !== false ? 'Deactivate' : 'Activate'}</Button></div>
        </div>
      </Card>)}</div>
      <div className="mt-5 flex items-center justify-between gap-3"><Button variant="secondary" disabled={page === 1} onClick={() => setParams({ page: String(page - 1) })}>Previous</Button><span className="text-sm text-muted">Page {page}</span><Button variant="secondary" disabled={!query.data?.hasMore} onClick={() => setParams({ page: String(page + 1) })}>Next</Button></div>
    </>}
    {dialog?.kind === 'create' && <UserEditor parks={parks.data?.parks ?? []} currentUserId={user.id} onClose={() => setDialog(null)} onSaved={saved} />}
    {dialog?.kind === 'status' && <UserStatusDialog user={dialog.user} onClose={() => setDialog(null)} onSaved={saved} />}
  </>
}
