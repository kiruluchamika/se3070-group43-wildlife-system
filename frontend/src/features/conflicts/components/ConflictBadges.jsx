import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  Copy,
  Eye,
  HelpCircle,
  MessageSquareWarning,
  PhoneOff,
  Radio,
  ShieldAlert,
  Siren,
  XCircle,
} from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { humanize } from '../../../lib/format'
import { REPORT_STATUS_LABELS } from '../lib/conflict'

const STATUS = {
  submitted: { tone: 'sky', icon: Clock },
  'pending-information': { tone: 'amber', icon: HelpCircle },
  validated: { tone: 'brand', icon: CheckCircle2 },
  invalid: { tone: 'neutral', icon: XCircle },
  duplicate: { tone: 'neutral', icon: Copy },
  'awaiting-approval': { tone: 'amber', icon: CircleDashed },
  'response-assigned': { tone: 'violet', icon: Radio },
  'response-completed': { tone: 'sky', icon: Eye },
  escalated: { tone: 'red', icon: ShieldAlert },
  monitoring: { tone: 'amber', icon: Eye },
  resolved: { tone: 'green', icon: CheckCircle2 },
}

export function ConflictStatusBadge({ status }) {
  const config = STATUS[status] ?? { tone: 'neutral', icon: MessageSquareWarning }
  return (
    <Badge tone={config.tone} icon={config.icon}>
      {REPORT_STATUS_LABELS[status] ?? humanize(status)}
    </Badge>
  )
}

const PRIORITY = {
  critical: { tone: 'red', pulse: true },
  high: { tone: 'red', icon: AlertOctagon },
  medium: { tone: 'amber', icon: AlertTriangle },
  low: { tone: 'sky', icon: CircleDashed },
}

export function PriorityBadge({ priority, suggested = false }) {
  if (!priority) return null
  const config = PRIORITY[priority] ?? PRIORITY.low
  return (
    <Badge tone={config.tone} icon={config.pulse ? undefined : config.icon} pulse={config.pulse}>
      {suggested ? `Suggested: ${priority}` : humanize(priority)}
    </Badge>
  )
}

export function DangerBadge() {
  return (
    <Badge tone="red" icon={Siren}>
      Immediate danger
    </Badge>
  )
}

export function ContactFailedBadge() {
  return (
    <Badge tone="red" icon={PhoneOff}>
      Contact failed
    </Badge>
  )
}

const TASK_STATUS = {
  'awaiting-approval': { tone: 'amber', label: 'Awaiting approval' },
  assigned: { tone: 'violet', label: 'Assigned' },
  acknowledged: { tone: 'sky', label: 'Acknowledged' },
  completed: { tone: 'green', label: 'Completed' },
  rejected: { tone: 'neutral', label: 'Rejected' },
}

export function TaskStatusBadge({ status }) {
  const config = TASK_STATUS[status] ?? { tone: 'neutral', label: humanize(status) }
  return <Badge tone={config.tone}>{config.label}</Badge>
}
