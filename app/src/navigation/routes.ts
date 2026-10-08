import { Role } from "../types";
export const modules = [
  { key: "conflicts/new", title: "Report a conflict", roles: ["villager"] },
  {
    key: "conflicts",
    title: "Conflict reports",
    roles: ["villager", "liaison-officer"],
  },
  { key: "tasks", title: "Response tasks", roles: ["ranger"] },
  { key: "approvals", title: "Response approvals", roles: ["park-manager"] },
  { key: "incidents/new", title: "Report an incident", roles: ["ranger"] },
  {
    key: "incidents",
    title: "Incident reports & offline queue",
    roles: ["ranger"],
  },
  { key: "assignment", title: "My patrol assignment", roles: ["ranger"] },
  {
    key: "patrol",
    title: "Patrol coverage & allocation",
    roles: ["park-manager"],
  },
  {
    key: "alerts",
    title: "Alerts & emergency dispatch",
    roles: ["park-manager"],
  },
  {
    key: "teams",
    title: "Ranger teams & assignments",
    roles: ["park-manager"],
  },
  { key: "history", title: "Allocation history", roles: ["park-manager"] },
  {
    key: "analytics",
    title: "Conservation analytics",
    roles: ["data-analyst"],
  },
  {
    key: "reports",
    title: "Conservation reports",
    roles: ["data-analyst", "park-manager"],
  },
  { key: "users", title: "User management", roles: ["administrator"] },
];
export const routesFor = (role: Role) =>
  modules.filter((m) => m.roles.includes(role));
export function canOpen(path: string, role: Role) {
  if (/^conflicts\/[a-f\d]{24}$/.test(path))
    return ["villager", "ranger", "liaison-officer", "park-manager"].includes(
      role,
    );
  if (/^incidents\/[a-f\d]{24}$/.test(path)) return role === "ranger";
  if (/^reports\/[a-f\d]{24}$/.test(path))
    return ["data-analyst", "park-manager"].includes(role);
  return routesFor(role).some((m) => m.key === path);
}
export function notificationRoute(
  link: string | undefined,
  role: Role,
): string | null {
  if (!link || !link.startsWith("/") || link.startsWith("//")) return null;
  const [path, search] = link.split("?");
  const params = new URLSearchParams(search ?? "");
  const selected =
    params.get("report") ?? params.get("reportId") ?? params.get("selected");
  const mapping: Record<string, string> = {
    "/conflicts/mine": "conflicts",
    "/conflicts/report": "conflicts/new",
    "/conflicts/approvals": "approvals",
    "/response-tasks": "tasks",
    "/my-assignment": "assignment",
    "/incidents/pending": "incidents",
    "/patrol/alerts": "alerts",
    "/patrol/teams": "teams",
    "/patrol/history": "history",
  };
  let target = mapping[path] ?? path.slice(1);
  if (
    selected &&
    /^[a-f\d]{24}$/.test(selected) &&
    ["conflicts", "reports"].includes(target)
  )
    target += "/" + selected;
  return canOpen(target, role) ? target : null;
}
