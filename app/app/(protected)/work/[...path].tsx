import React from "react";
import { useLocalSearchParams } from "expo-router";
import { useSession } from "../../../src/contexts/Session";
import { canOpen } from "../../../src/navigation/routes";
import { Label, Page } from "../../../src/components/ui";
import { FieldReport } from "../../../src/features/FieldReport";
import { Conflicts } from "../../../src/features/Conflicts";
import { Tasks } from "../../../src/features/Tasks";
import { Incidents } from "../../../src/features/Incidents";
import { Patrol } from "../../../src/features/Patrol";
import { Analysis } from "../../../src/features/analytics/Analysis";
import { Reports } from "../../../src/features/analytics/Reports";
import { Users } from "../../../src/features/Users";
export default function Work() {
  const params = useLocalSearchParams<{ path: string[] }>(),
    { user } = useSession();
  const parts = Array.isArray(params.path)
      ? params.path
      : String(params.path).split("/"),
    path = parts.join("/");
  if (!user || !canOpen(path, user.role))
    return (
      <Page title="Access unavailable">
        <Label>This workspace is not available for your role.</Label>
      </Page>
    );
  if (path === "conflicts/new") return <FieldReport key={path} />;
  if (path === "incidents/new") return <FieldReport key={path} incident />;
  if (parts[0] === "conflicts") return <Conflicts key={path} id={parts[1]} />;
  if (parts[0] === "incidents") return <Incidents key={path} id={parts[1]} />;
  if (path === "tasks" || path === "approvals")
    return <Tasks approval={path === "approvals"} />;
  if (["patrol", "teams", "history", "alerts", "assignment"].includes(path))
    return <Patrol key={path} mode={path} />;
  if (path === "analytics") return <Analysis />;
  if (parts[0] === "reports") return <Reports key={path} id={parts[1]} />;
  if (path === "users") return <Users />;
  return (
    <Page title="Screen unavailable">
      <Label>Choose a workspace from the tabs.</Label>
    </Page>
  );
}
