import React from "react";
import { Image } from "react-native";
import { useData } from "../hooks/data";
import { useSync } from "../contexts/Sync";
import {
  Badge,
  Button,
  Card,
  Detail,
  ErrorMessage,
  Label,
  Page,
  QueryState,
} from "../components/ui";
import { openWork } from "../navigation/open";
export function Incidents({ id }: { id?: string }) {
  const q = useData(id ? `/incidents/${id}` : "/incidents/mine"),
    sync = useSync();
  return (
    <Page
      title={id ? "Incident details" : "Field reports"}
      refresh={() => {
        void q.refetch();
        void sync.sync();
      }}
    >
      <ErrorMessage error={sync.error} />
      {!id && (
        <>
          <Button
            title="Capture incident"
            onPress={() => openWork("incidents/new")}
          />
          <Card>
            <Label>Local field queue (incidents and response updates)</Label>
            <Button title="Synchronize now" onPress={() => void sync.sync()} />
            {!sync.items.length && <Label>No saved field records.</Label>}
            {sync.items.map((item) => (
              <Card key={item.id}>
                <Badge value={item.status} />
                <Label>
                  {item.path === "/incidents"
                    ? "Incident report"
                    : "Response update"}{" "}
                  · {new Date(item.createdAt).toLocaleString()}
                </Label>
                <Label muted>
                  Attempts: {item.attempts} · ID: {item.id}
                </Label>
                <ErrorMessage error={item.error} />
                {item.status === "synced" ? (
                  <Label>
                    Server receipt confirmed
                    {item.receipt?.duplicate ? " (safe duplicate retry)" : ""}.
                  </Label>
                ) : (
                  <Button
                    secondary
                    title="Retry unchanged record"
                    onPress={() => void sync.retry(item.id)}
                  />
                )}
              </Card>
            ))}
          </Card>
        </>
      )}
      <QueryState query={q}>
        {(d) =>
          id ? (
            <Card>
              <Detail data={d} />
              {(d.photos ?? d.incident?.photos ?? []).map(
                (p: any, i: number) =>
                  p.dataUrl ? (
                    <Image
                      key={i}
                      source={{ uri: p.dataUrl }}
                      accessibilityLabel={p.caption ?? "Incident evidence"}
                      style={{ height: 200 }}
                      resizeMode="contain"
                    />
                  ) : null,
              )}
            </Card>
          ) : (
            <>
              {!d.incidents.length && <Label>No server receipts yet.</Label>}
              {d.incidents.map((i: any) => (
                <Card key={i.id}>
                  <Badge value={i.type} />
                  <Label>{i.description}</Label>
                  <Label muted>{new Date(i.observedAt).toLocaleString()}</Label>
                  <Button
                    secondary
                    title="View received report"
                    onPress={() => openWork(`incidents/${i.id}`)}
                  />
                </Card>
              ))}
            </>
          )
        }
      </QueryState>
    </Page>
  );
}
