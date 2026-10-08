import React from "react";
import { useSession } from "../../../src/contexts/Session";
import { useSync } from "../../../src/contexts/Sync";
import { useData, useRefresh } from "../../../src/hooks/data";
import {
  Badge,
  Button,
  Card,
  Detail,
  Label,
  Page,
  QueryState,
} from "../../../src/components/ui";
import { routesFor } from "../../../src/navigation/routes";
import { openWork } from "../../../src/navigation/open";
import { idOf } from "../../../src/types";
export default function Home() {
  const { user, offline } = useSession(),
    sync = useSync(),
    refresh = useRefresh();
  const parks = useData("/parks", user?.role === "ranger");
  const parkId = idOf(user?.park) || parks.data?.parks?.[0]?.id;
  const paths: Record<string, string> = {
    villager: "/conflicts/mine",
    ranger: "/patrol/my-assignment",
    "liaison-officer": "/conflicts?view=new",
    "park-manager": `/patrol/coverage?parkId=${parkId}`,
    "data-analyst": "/reports?status=draft",
    administrator: "/users?page=1",
  };
  const data = useData(
    user?.role === "park-manager" && !parkId ? null : paths[user!.role],
    user?.role === "ranger",
  );
  const tasks = useData(
    user?.role === "ranger"
      ? "/response-tasks/mine"
      : user?.role === "park-manager"
        ? "/response-tasks/approvals"
        : null,
    user?.role === "ranger",
  );
  const notifications = useData("/notifications/me");
  const finalized = useData(
    ["park-manager", "data-analyst"].includes(user!.role)
      ? "/reports?status=finalized"
      : null,
  );
  return (
    <Page
      title={`Welcome, ${user!.name.split(" ")[0]}`}
      refresh={() => void refresh()}
    >
      <Badge value={user!.role} />
      {offline && <Label>Offline — field reports can be saved locally.</Label>}
      <QueryState query={data}>
        {(d) => (
          <Card>
            {d.summary ? (
              <Detail data={d.summary} />
            ) : d.assignment ? (
              <>
                <Label>Current patrol</Label>
                <Detail data={d.assignment} />
              </>
            ) : d.reports ? (
              <Label>
                {d.reports.length}{" "}
                {user!.role === "data-analyst"
                  ? "draft reports on this page"
                  : "conflict reports"}
              </Label>
            ) : d.users ? (
              <Label>{d.users.length} accounts on the first page</Label>
            ) : (
              <Label>No current patrol assignment.</Label>
            )}
            {d.counts && <Detail data={d.counts} />}
          </Card>
        )}
      </QueryState>
      {tasks.data && (
        <Card>
          <Label>
            {
              tasks.data.tasks.filter(
                (t: any) => !["completed", "rejected"].includes(t.status),
              ).length
            }{" "}
            {user!.role === "ranger"
              ? "active response tasks"
              : "pending response approvals"}
          </Label>
          <Button
            secondary
            title="Open response work"
            onPress={() =>
              openWork(user!.role === "ranger" ? "tasks" : "approvals")
            }
          />
        </Card>
      )}
      {finalized.data && (
        <Card>
          <Label>
            {finalized.data.reports.length} finalized reports on the first page
            {finalized.data.hasMore ? " (more available)" : ""}
          </Label>
          <Button
            secondary
            title="View conservation reports"
            onPress={() => openWork("reports")}
          />
        </Card>
      )}
      {notifications.data && (
        <Label>{notifications.data.unreadCount} unread notifications</Label>
      )}
      {user!.role === "ranger" && (
        <Card>
          <Label>
            {sync.items.filter((i) => i.status !== "synced").length} field
            records awaiting receipt
          </Label>
          <Button
            title="Open offline queue"
            onPress={() => openWork("incidents")}
          />
        </Card>
      )}
      {routesFor(user!.role).map((m) => (
        <Button
          key={m.key}
          secondary
          title={m.title}
          onPress={() => openWork(m.key)}
        />
      ))}
    </Page>
  );
}
