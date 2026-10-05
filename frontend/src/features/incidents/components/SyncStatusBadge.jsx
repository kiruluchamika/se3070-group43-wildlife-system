import { AlertTriangle, CheckCircle2, CloudUpload, Loader2, WifiOff } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'

const STATUS = {
  queued: { label: 'Waiting to sync', tone: 'amber', icon: WifiOff },
  syncing: { label: 'Sending', tone: 'sky', icon: Loader2 },
  failed: { label: 'Needs attention', tone: 'red', icon: AlertTriangle },
  synced: { label: 'Report received', tone: 'green', icon: CheckCircle2 },
}

export function SyncStatusBadge({ status }) {
  const config = STATUS[status] ?? { label: 'Saved', tone: 'neutral', icon: CloudUpload }
  return <Badge tone={config.tone} icon={config.icon}>{config.label}</Badge>
}
