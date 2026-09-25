import { AlertOctagon, AlertTriangle, CheckCircle2, Circle, Moon, Navigation, Radio, Shield, ShieldAlert, Siren } from 'lucide-react'
import { humanize } from '../../lib/format'
import { Badge } from './Badge'

const RISK = {
  high: { tone: 'red', icon: AlertOctagon, label: 'High' },
  medium: { tone: 'amber', icon: AlertTriangle, label: 'Medium' },
  low: { tone: 'green', icon: Shield, label: 'Low' },
}

export function RiskBadge({ level }) {
  const config = RISK[level] ?? RISK.low
  return (
    <Badge tone={config.tone} icon={config.icon}>
      {config.label}
    </Badge>
  )
}

const SEVERITY = {
  critical: { tone: 'red', icon: Siren, pulse: true },
  high: { tone: 'red', icon: AlertOctagon },
  medium: { tone: 'amber', icon: AlertTriangle },
  low: { tone: 'sky', icon: Circle },
}

export function SeverityBadge({ severity }) {
  const config = SEVERITY[severity] ?? SEVERITY.low
  return (
    <Badge tone={config.tone} icon={config.pulse ? undefined : config.icon} pulse={config.pulse}>
      {humanize(severity)}
    </Badge>
  )
}

const TEAM_STATUS = {
  available: { tone: 'green', icon: CheckCircle2, label: 'Available' },
  'on-patrol': { tone: 'sky', icon: Navigation, label: 'On Patrol' },
  responding: { tone: 'violet', icon: Radio, label: 'Responding' },
  'off-duty': { tone: 'neutral', icon: Moon, label: 'Off Duty' },
}

export function TeamStatusBadge({ status }) {
  const config = TEAM_STATUS[status] ?? { tone: 'neutral', icon: Circle, label: humanize(status) }
  return (
    <Badge tone={config.tone} icon={config.icon}>
      {config.label}
    </Badge>
  )
}

const ALERT_STATUS = {
  active: { tone: 'red', icon: ShieldAlert },
  acknowledged: { tone: 'amber', icon: CheckCircle2 },
  dispatched: { tone: 'violet', icon: Radio },
  resolved: { tone: 'green', icon: CheckCircle2 },
}

export function AlertStatusBadge({ status }) {
  const config = ALERT_STATUS[status] ?? ALERT_STATUS.active
  return (
    <Badge tone={config.tone} icon={config.icon}>
      {humanize(status)}
    </Badge>
  )
}
