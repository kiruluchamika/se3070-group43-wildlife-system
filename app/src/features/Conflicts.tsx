import React, { useState } from "react";
import { Image } from "react-native";
import { useData } from "../hooks/data";
import { useSession } from "../contexts/Session";
import {
  Badge,
  Button,
  Card,
  Detail,
  Field,
  Label,
  Page,
  QueryState,
  Select,
  options,
} from "../components/ui";
import { ActionForm, Input } from "../components/ActionForm";
import { LocationInput, Point } from "../components/Capture";
import { openWork } from "../navigation/open";
import { priorities } from "./FieldReport";
const notes: Input = {
  key: "notes",
  label: "Notes",
  multiline: true,
  max: 500,
};
function OfficerActions({ report: r }: { report: any }) {
  const base = `/conflicts/${r.id}`,
    duplicates = useData(`${base}/duplicates`),
    teams = useData(`${base}/teams`);
  const teamOptions = (teams.data?.available ?? []).map((t: any) => ({
    value: t.id,
    label: `${t.name} · ${t.distanceKm ?? "Unknown"} km · ${t.etaMinutes ?? "Unknown"} min`,
  }));
  return (
    <>
      {["submitted", "pending-information"].includes(r.status) && (
        <>
          <ActionForm
            title="Validate report"
            path={`${base}/validation`}
            fields={[
              {
                key: "priority",
                label: "Priority",
                required: true,
                values: priorities,
                initial: r.suggestedPriority,
              },
              notes,
            ]}
            prepare={(v) => ({ ...v, decision: "valid" })}
          />
          <ActionForm
            title="Reject invalid report"
            path={`${base}/validation`}
            fields={[{ ...notes, required: true, min: 1 }]}
            prepare={(v) => ({ ...v, decision: "invalid" })}
            confirmation="The villager will be told why this report is invalid."
          />
          {r.status === "submitted" && (
            <ActionForm
              title="Request more information"
              path={`${base}/information-request`}
              fields={[
                {
                  key: "message",
                  label: "Question for villager",
                  required: true,
                  min: 5,
                  max: 500,
                  multiline: true,
                },
              ]}
            />
          )}
        </>
      )}
      {["submitted", "pending-information", "validated"].includes(r.status) && (
        <Card>
          <Label>Duplicate candidates</Label>
          <QueryState query={duplicates}>
            {(d) => (
              <>
                {!d.candidates.length && (
                  <Label>No duplicate candidates found.</Label>
                )}
                {d.candidates.map((c: any) => (
                  <Card key={c.report.id}>
                    <Label>
                      {c.report.reference} · {c.report.village}
                    </Label>
                    <Detail data={c.match} />
                    <Button
                      secondary
                      title="Inspect candidate"
                      onPress={() => openWork(`conflicts/${c.report.id}`)}
                    />
                    <ActionForm
                      title="Link as duplicate"
                      path={`${base}/duplicate`}
                      prepare={() => ({ primaryReportId: c.report.id })}
                      confirmation={`Close ${r.reference} as a duplicate of ${c.report.reference}?`}
                    />
                  </Card>
                ))}
              </>
            )}
          </QueryState>
        </Card>
      )}
      {["validated", "escalated", "monitoring"].includes(r.status) && (
        <Card>
          <Label>Team deployment</Label>
          <QueryState query={teams}>
            {(d) => (
              <>
                <Detail
                  data={{
                    route: d.route,
                    recommended: d.recommended?.name,
                    busy: d.busy.map((t: any) => ({
                      name: t.name,
                      status: t.status,
                    })),
                  }}
                />
                {teamOptions.length ? (
                  <ActionForm
                    title={
                      r.priority === "critical"
                        ? "Emergency deployment"
                        : "Deploy / request approval"
                    }
                    path={`${base}/deployments`}
                    method="POST"
                    fields={[
                      {
                        key: "teamId",
                        label: "Available team",
                        required: true,
                        choices: teamOptions,
                        initial: d.recommended?.id,
                      },
                      {
                        key: "instructions",
                        label: "Instructions",
                        max: 500,
                        multiline: true,
                      },
                      {
                        key: "additionalResources",
                        label: "Request additional resources",
                        boolean: true,
                      },
                    ]}
                    confirmation="The team will be committed immediately for low/medium or critical priority; high priority or additional resources require manager approval."
                  />
                ) : (
                  <Label>No team is available. Escalate to the manager.</Label>
                )}
              </>
            )}
          </QueryState>
        </Card>
      )}
      {["validated", "awaiting-approval", "monitoring"].includes(r.status) && (
        <ActionForm
          title="Escalate to park manager"
          path={`${base}/escalation`}
          fields={[
            {
              key: "reason",
              label: "Reason",
              required: true,
              min: 5,
              max: 500,
              multiline: true,
            },
          ]}
          confirmation="Raise an operational alert for the park manager?"
        />
      )}
      {r.status === "response-completed" && (
        <ActionForm
          title="Review response"
          path={`${base}/review`}
          fields={[
            {
              key: "result",
              label: "Review outcome",
              values: ["resolved", "monitoring", "escalated"],
              required: true,
            },
            { ...notes, max: 1000 },
            {
              key: "followUpAt",
              label: "Follow-up time for monitoring (ISO with timezone)",
            },
          ]}
          prepare={(v) => {
            if (
              v.result === "monitoring" &&
              (!v.followUpAt ||
                !Number.isFinite(Date.parse(v.followUpAt)) ||
                Date.parse(v.followUpAt) <= Date.now())
            )
              throw new Error("Schedule a valid future follow-up.");
            if (v.result === "escalated" && (v.notes ?? "").length < 5)
              throw new Error("Explain the escalation.");
            return v;
          }}
        />
      )}
      {r.contactStatus === "failed" && (
        <>
          <ActionForm
            title="Retry contact"
            method="POST"
            path={`${base}/contact-retry`}
          />
          <ActionForm
            title="Record alternative contact"
            method="POST"
            path={`${base}/alternative-contact`}
            fields={[
              {
                key: "method",
                label: "Contact method",
                values: [
                  "phone-call",
                  "village-officer",
                  "in-person",
                  "neighbour",
                  "other",
                ],
                required: true,
              },
              { key: "contactedPerson", label: "Person contacted", max: 80 },
              { ...notes, required: true, min: 3, max: 300 },
            ]}
          />
        </>
      )}
    </>
  );
}
export function Conflicts({ id }: { id?: string }) {
  const { user } = useSession();
  const [view, setView] = useState("new"),
    [search, setSearch] = useState(""),
    [location, setLocation] = useState<Point>();
  const path = id
    ? `/conflicts/${id}`
    : user!.role === "villager"
      ? "/conflicts/mine"
      : `/conflicts?view=${view}`;
  const q = useData(path);
  return (
    <Page
      title={id ? "Conflict case" : "Conflict reports"}
      refresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {!id && (
        <>
          {user!.role === "villager" ? (
            <Button
              title="Report a conflict"
              onPress={() => openWork("conflicts/new")}
            />
          ) : (
            <Select
              label="Queue"
              value={view}
              options={options([
                "new",
                "pending-information",
                "active",
                "review",
                "closed",
                "all",
              ])}
              onChange={setView}
            />
          )}
          <Field
            label="Search reference or village"
            value={search}
            onChange={setSearch}
          />
        </>
      )}
      <QueryState query={q}>
        {(d) =>
          id ? (
            <>
              <Card>
                <Badge value={d.report.status} />
                <Detail data={d.report} />
                {(d.report.evidence ?? []).map((p: any, i: number) => (
                  <Image
                    key={i}
                    accessibilityLabel={p.caption ?? "Conflict evidence"}
                    source={{ uri: p.dataUrl }}
                    style={{ height: 200 }}
                    resizeMode="contain"
                  />
                ))}
              </Card>
              {user!.role === "villager" &&
                d.report.status === "pending-information" && (
                  <>
                    <LocationInput value={location} onChange={setLocation} />
                    <ActionForm
                      title="Reply to information request"
                      path={`/conflicts/${id}/information`}
                      fields={[
                        {
                          key: "response",
                          label: "Your reply",
                          required: true,
                          min: 5,
                          max: 1000,
                          multiline: true,
                        },
                        {
                          key: "landmark",
                          label: "Updated landmark",
                          max: 120,
                        },
                      ]}
                      prepare={(v) => ({ ...v, location })}
                    />
                  </>
                )}
              {user!.role === "liaison-officer" && (
                <OfficerActions report={d.report} />
              )}
              <Card>
                <Label>Response progress and field history</Label>
                <Detail
                  data={{
                    tasks: d.tasks,
                    actions: d.actions,
                    suggestedReview: d.suggestedReview,
                  }}
                />
              </Card>
            </>
          ) : (
            <>
              {d.counts && (
                <Card>
                  <Detail data={d.counts} />
                </Card>
              )}
              {!d.reports.length && <Label>No reports in this queue.</Label>}
              {d.reports
                .filter((r: any) =>
                  `${r.reference} ${r.village}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((r: any) => (
                  <Card key={r.id}>
                    <Badge value={r.status} />
                    <Label>
                      {r.reference} · {r.village}
                    </Label>
                    <Label muted>{r.description}</Label>
                    <Button
                      secondary
                      title="Open case"
                      onPress={() => openWork(`conflicts/${r.id}`)}
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
