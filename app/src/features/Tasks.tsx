import React, { useState } from "react";
import { useData } from "../hooks/data";
import { useSession } from "../contexts/Session";
import { useSync } from "../contexts/Sync";
import {
  Badge,
  Button,
  Card,
  Detail,
  Disclosure,
  Label,
  Page,
  QueryState,
} from "../components/ui";
import { ActionForm } from "../components/ActionForm";
import { LocationInput, Point } from "../components/Capture";
import { openWork } from "../navigation/open";
import { idOf } from "../types";
function TaskCard({ task: t, approval }: { task: any; approval: boolean }) {
  const { offline } = useSession(),
    sync = useSync();
  const [location, setLocation] = useState<Point>();
  const park = idOf(t.park);
  const teams = useData(approval && park ? `/teams?parkId=${park}` : null);
  const pendingCompletion = sync.items.some(
    (item) =>
      item.path === `/response-tasks/${t.id}/complete` &&
      item.status !== "synced",
  );
  const open =
    ["assigned", "acknowledged"].includes(t.status) && !pendingCompletion;
  return (
    <Card>
      <Badge value={t.status} />
      <Label>
        {t.report?.reference ?? "Conflict response"} ·{" "}
        {t.team?.name ?? "Your team"}
      </Label>
      <Label>{t.instructions || "No additional instructions."}</Label>
      <Disclosure title="Task details & response history">
        <Detail data={t} />
      </Disclosure>
      {pendingCompletion && (
        <Label>
          Completion is saved locally and awaits server receipt. Check the field
          queue.
        </Label>
      )}
      {idOf(t.report) && (
        <Button
          secondary
          title="View conflict case"
          onPress={() => openWork(`conflicts/${idOf(t.report)}`)}
        />
      )}
      {approval ? (
        <ActionForm
          title="Decide response approval"
          path={`/response-tasks/${t.id}/approval`}
          fields={[
            {
              key: "decision",
              label: "Decision",
              values: ["approve", "reject"],
              required: true,
            },
            {
              key: "teamId",
              label: "Alternative team (optional)",
              choices: (teams.data?.teams ?? [])
                .filter((x: any) => x.status === "available")
                .map((x: any) => ({ value: x.id, label: x.name })),
            },
            {
              key: "notes",
              label: "Decision notes",
              max: 500,
              multiline: true,
            },
          ]}
          prepare={(v) => {
            if (v.decision === "reject" && (v.notes ?? "").length < 5)
              throw new Error(
                "Provide at least five characters explaining rejection.",
              );
            return v;
          }}
          confirmation="Apply this approval decision and notify the officer?"
        />
      ) : (
        <>
          {t.status === "assigned" && (
            <ActionForm
              title="Acknowledge response assignment"
              path={`/response-tasks/${t.id}/acknowledge`}
            />
          )}
          {open && (
            <>
              <LocationInput value={location} onChange={setLocation} />
              <ActionForm
                title="Save field action locally"
                successMessage="Saved on this device. The field queue shows server receipt."
                fields={[
                  {
                    key: "type",
                    label: "Action",
                    values: [
                      "arrived-on-site",
                      "elephant-located",
                      "drive-away",
                      "deterrent-used",
                      "community-briefing",
                      "damage-assessed",
                      "first-aid",
                      "other",
                    ],
                    required: true,
                  },
                  {
                    key: "note",
                    label: "Field notes",
                    multiline: true,
                    max: 500,
                  },
                  {
                    key: "recordedAt",
                    label: "Action time (ISO)",
                    required: true,
                    initial: new Date().toISOString(),
                  },
                ]}
                onSubmit={async (v) => {
                  if (!Number.isFinite(Date.parse(v.recordedAt)))
                    throw new Error("Enter a valid action time.");
                  await sync.enqueue(`/response-tasks/${t.id}/actions`, {
                    ...v,
                    location,
                    recordedOffline: offline,
                  });
                }}
              />
              <ActionForm
                title="Save task completion locally"
                successMessage="Completion saved on this device. Await server receipt before treating the team as available."
                fields={[
                  {
                    key: "outcome",
                    label: "Outcome",
                    required: true,
                    values: [
                      "elephant-driven-away",
                      "elephant-not-located",
                      "situation-contained",
                      "requires-further-action",
                    ],
                  },
                  {
                    key: "notes",
                    label: "Completion notes",
                    multiline: true,
                    max: 1000,
                  },
                ]}
                onSubmit={(v) =>
                  sync.enqueue(
                    `/response-tasks/${t.id}/complete`,
                    { ...v, completedAt: new Date().toISOString() },
                    "PATCH",
                  )
                }
                confirmation="Queue task completion? The team is freed only after the server confirms receipt."
              />
              <Label muted>
                Local saves remain in Incident reports until server receipt.
                Retries keep the same update ID.
              </Label>
            </>
          )}
        </>
      )}
    </Card>
  );
}
export function Tasks({ approval = false }: { approval?: boolean }) {
  const q = useData(
    approval ? "/response-tasks/approvals" : "/response-tasks/mine",
    !approval,
  );
  return (
    <Page
      title={approval ? "Pending approvals" : "Response tasks"}
      refresh={() => void q.refetch()}
    >
      <QueryState query={q}>
        {(d) => (
          <>
            {!d.tasks.length && <Label>No response tasks.</Label>}
            {d.tasks.map((t: any) => (
              <TaskCard key={t.id} task={t} approval={approval} />
            ))}
          </>
        )}
      </QueryState>
    </Page>
  );
}
