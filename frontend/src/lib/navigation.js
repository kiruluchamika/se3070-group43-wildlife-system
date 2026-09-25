import {
  BarChart3,
  Bell,
  ClipboardList,
  FileText,
  History,
  Home,
  Map,
  MessageSquareWarning,
  ShieldAlert,
  Siren,
  UploadCloud,
  Users,
} from 'lucide-react'

export const ROLES = Object.freeze({
  VILLAGER: 'villager',
  RANGER: 'ranger',
  LIAISON_OFFICER: 'liaison-officer',
  PARK_MANAGER: 'park-manager',
  DATA_ANALYST: 'data-analyst',
})

export const ROLE_LABELS = {
  [ROLES.VILLAGER]: 'Villager',
  [ROLES.RANGER]: 'Ranger',
  [ROLES.LIAISON_OFFICER]: 'Community Liaison Officer',
  [ROLES.PARK_MANAGER]: 'Park Manager',
  [ROLES.DATA_ANALYST]: 'Data Analyst',
}

/** Group 43 module owners (see docs/WORK_PLAN.md). */
export const MODULE_OWNERS = {
  UC01: { name: 'WITTAHACHCHI D.K.G', title: 'Respond to Human–Elephant Conflict' },
  UC02: { name: 'JALATHGE C.A.J', title: 'Analyze Conservation Data and Generate Reports' },
  UC03: { name: 'KALMADU H L G', title: 'Report Wildlife and Poaching Incident' },
  UC04: { name: 'HETTIGE K.C.', title: 'Monitor Patrol Coverage and Allocate Resources' },
}

/**
 * Single registry for navigation. The sidebar and the route table are both
 * built from it, so each member adds their screens here only.
 * `ready: false` shows the module placeholder until the owner merges the page.
 */
export const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: Home, roles: Object.values(ROLES), ready: true, end: true },

  // UC04 — Park Manager
  { path: '/patrol', label: 'Patrol Coverage', icon: Map, roles: [ROLES.PARK_MANAGER], useCase: 'UC04', ready: true, end: true },
  { path: '/patrol/alerts', label: 'Alerts', icon: ShieldAlert, roles: [ROLES.PARK_MANAGER], useCase: 'UC04', ready: true },
  { path: '/patrol/teams', label: 'Ranger Teams', icon: Users, roles: [ROLES.PARK_MANAGER], useCase: 'UC04', ready: true },
  { path: '/patrol/history', label: 'Allocation History', icon: History, roles: [ROLES.PARK_MANAGER], useCase: 'UC04', ready: true },
  // UC04 — Ranger (supporting actor)
  { path: '/my-assignment', label: 'My Assignment', icon: ClipboardList, roles: [ROLES.RANGER], useCase: 'UC04', ready: true },

  // UC03 — Ranger
  { path: '/incidents/new', label: 'Report Incident', icon: Siren, roles: [ROLES.RANGER], useCase: 'UC03' },
  { path: '/incidents/pending', label: 'Pending Reports', icon: UploadCloud, roles: [ROLES.RANGER], useCase: 'UC03' },

  // UC01 — Villager, Liaison Officer, Ranger
  { path: '/conflicts/report', label: 'Report Conflict', icon: MessageSquareWarning, roles: [ROLES.VILLAGER], useCase: 'UC01' },
  { path: '/conflicts', label: 'Conflict Queue', icon: MessageSquareWarning, roles: [ROLES.LIAISON_OFFICER], useCase: 'UC01', end: true },
  { path: '/response-tasks', label: 'Response Tasks', icon: Bell, roles: [ROLES.RANGER], useCase: 'UC01' },

  // UC02 — Data Analyst, Park Manager (receives shared reports)
  { path: '/analytics', label: 'Analysis', icon: BarChart3, roles: [ROLES.DATA_ANALYST], useCase: 'UC02' },
  { path: '/reports', label: 'Reports', icon: FileText, roles: [ROLES.DATA_ANALYST, ROLES.PARK_MANAGER], useCase: 'UC02' },
]

export const navItemsFor = (role) => NAV_ITEMS.filter((item) => item.roles.includes(role))
