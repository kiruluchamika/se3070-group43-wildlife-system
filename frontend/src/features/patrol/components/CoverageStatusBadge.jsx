import { AlertTriangle, CheckCircle2, Navigation } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'

const STATUS = {
  'under-patrolled': { tone: 'red', icon: AlertTriangle, label: 'Under-patrolled' },
  adequate: { tone: 'green', icon: CheckCircle2, label: 'Adequate' },
  covered: { tone: 'sky', icon: Navigation, label: 'Team deployed' },
}

export function CoverageStatusBadge({ status }) {
  const config = STATUS[status] ?? STATUS.adequate
  return (
    <Badge tone={config.tone} icon={config.icon}>
      {config.label}
    </Badge>
  )
}
