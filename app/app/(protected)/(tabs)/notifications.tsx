import React, { useState } from "react";
import {
  Badge,
  Button,
  Card,
  ErrorMessage,
  Label,
  Page,
  QueryState,
} from "../../../src/components/ui";
import { useData, useRefresh } from "../../../src/hooks/data";
import { mutate } from "../../../src/api/client";
import { useSession } from "../../../src/contexts/Session";
import { notificationRoute } from "../../../src/navigation/routes";
import { openWork } from "../../../src/navigation/open";
export default function Notifications() {
  const q = useData("/notifications/me"),
    refresh = useRefresh(),
    { user } = useSession();
  const [error, setError] = useState<any>();
  async function read(id?: string) {
    try {
      await mutate(
        id ? `/notifications/${id}/read` : "/notifications/read-all",
        undefined,
        "PATCH",
      );
      await refresh();
    } catch (e) {
      setError(e);
    }
  }
  return (
    <Page
      title="Notifications"
      refresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      <ErrorMessage error={error} />
      <Button title="Mark all as read" onPress={() => void read()} />
      <QueryState query={q}>
        {(d) => (
          <>
            {!d.notifications.length && <Label>No notifications yet.</Label>}
            {d.notifications.map((n: any) => {
              const target = notificationRoute(n.link, user!.role);
              return (
                <Card key={n.id}>
                  <Badge value={n.readAt ? "read" : "unread"} />
                  <Label>{n.title}</Label>
                  <Label muted>{n.message}</Label>
                  <Label muted>{new Date(n.createdAt).toLocaleString()}</Label>
                  {!n.readAt && (
                    <Button
                      secondary
                      title="Mark read"
                      onPress={() => void read(n.id)}
                    />
                  )}
                  {target && (
                    <Button
                      title="Open related record"
                      onPress={() => {
                        void read(n.id);
                        openWork(target);
                      }}
                    />
                  )}
                </Card>
              );
            })}
          </>
        )}
      </QueryState>
      <Label muted>
        Refreshes every 30 seconds while open. SMS integrations may be
        simulated; this is not push delivery.
      </Label>
    </Page>
  );
}
