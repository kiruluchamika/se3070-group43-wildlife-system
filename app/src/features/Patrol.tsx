import React, { useState } from "react";
import { useData } from "../hooks/data";
import { useSession } from "../contexts/Session";
import { query } from "../api/client";
import {
  Badge,
  Button,
  Card,
  Detail,
  Label,
  Page,
  QueryState,
  Select,
  options,
} from "../components/ui";
import { ActionForm } from "../components/ActionForm";
import { ParkSelect } from "../components/ParkSelect";
import { ZoneMap } from "../components/ZoneMap";
import { idOf } from "../types";
function Allocation({
  parkId,
  zone,
  zones,
}: {
  parkId: string;
  zone: any;
  zones: any[];
}) {
  const q = useData("/patrol/teams" + query({ parkId, zoneId: zone.zone.id }));
  const [teamId, setTeamId] = useState("");
  return (
    <Card>
      <Label>Allocate resources to {zone.zone.name}</Label>
      <QueryState query={q}>
        {(d) => {
          const t = d.teams.find((t: any) => t.id === teamId),
            from = zones.find(
              (z) => z.zone.id === idOf(t?.currentAssignment?.zone),
            );
          return (
            <>
              <Select
                label="Team"
                value={teamId}
                onChange={setTeamId}
                options={d.teams.map((t: any) => ({
                  value: t.id,
                  label: `${t.name} · ${t.status} · ${t.distanceKm ?? "?"} km / ${t.etaMinutes ?? "?"} min`,
                }))}
              />
              {!d.teams.length && (
                <Label>No teams available in this park.</Label>
              )}
              {t && (
                <>
                  <Detail
                    data={{
                      status: t.status,
                      currentAssignment: t.currentAssignment,
                      travelKm: t.distanceKm,
                      estimatedMinutes: t.etaMinutes,
                      targetPriority: zone.priorityScore,
                      currentPriority: from?.priorityScore,
                    }}
                  />
                  {t.status === "available" ? (
                    <ActionForm
                      key={`${t.id}:${zone.zone.id}:assign`}
                      title="Assign selected team"
                      method="POST"
                      path="/patrol/assignments"
                      fields={[
                        {
                          key: "notes",
                          label: "Instructions",
                          max: 500,
                          multiline: true,
                        },
                      ]}
                      prepare={(v) => ({
                        ...v,
                        zoneId: zone.zone.id,
                        teamId: t.id,
                      })}
                      confirmation={`Assign ${t.name} to ${zone.zone.name}? The team will be notified.`}
                    />
                  ) : t.status === "on-patrol" ? (
                    <>
                      <Label>
                        The current patrol will end. Its zone may be left
                        without a team.
                      </Label>
                      <ActionForm
                        key={`${t.id}:${zone.zone.id}:reassign`}
                        title="Reassign selected team"
                        method="POST"
                        path="/patrol/assignments/reassign"
                        fields={[
                          {
                            key: "reason",
                            label: "Reason",
                            required: true,
                            min: 5,
                            max: 500,
                            multiline: true,
                          },
                          { key: "notes", label: "Instructions", max: 500 },
                          {
                            key: "override",
                            label: "Override equal/lower destination priority",
                            boolean: true,
                          },
                        ]}
                        prepare={(v) => ({
                          ...v,
                          zoneId: zone.zone.id,
                          teamId: t.id,
                        })}
                        confirmation={`Move ${t.name} from ${from?.zone.name ?? "its current zone"} to ${zone.zone.name}? Its previous patrol will be ended.`}
                      />
                    </>
                  ) : (
                    <Label>
                      This team is responding and cannot be reassigned to a
                      patrol.
                    </Label>
                  )}
                </>
              )}
            </>
          );
        }}
      </QueryState>
    </Card>
  );
}
function Dispatch({ alert }: { alert: any }) {
  const q = useData(
    "/patrol/emergency-dispatches/recommendations" +
      query({ alertId: alert.id }),
  );
  return (
    <Card>
      <Label>Emergency response recommendations</Label>
      <QueryState query={q}>
        {(d) =>
          d.mode === "none" ? (
            <Label>
              No available or divertible teams. Contact field teams by radio or
              telephone.
            </Label>
          ) : (
            <>
              <Label>Recommended: {d.recommended?.team?.name ?? "None"}</Label>
              <Detail
                data={[...d.available, ...d.divertible].map((c: any) => ({
                  team: c.team.name,
                  distanceKm: c.distanceKm,
                  etaMinutes: c.etaMinutes,
                  currentAssignment: c.currentAssignment,
                }))}
              />
              <ActionForm
                title="Dispatch emergency team"
                method="POST"
                path="/patrol/emergency-dispatches"
                fields={[
                  {
                    key: "teamId",
                    label: "Response team",
                    required: true,
                    initial: d.recommended?.team?.id,
                    choices: [...d.available, ...d.divertible].map(
                      (c: any) => ({
                        value: c.team.id,
                        label: `${c.team.name} · ${c.etaMinutes ?? "?"} min${c.currentAssignment ? " · diverts existing patrol" : ""}`,
                      }),
                    ),
                  },
                  {
                    key: "notes",
                    label: "Instructions",
                    max: 500,
                    multiline: true,
                  },
                ]}
                prepare={(v) => ({ ...v, alertId: alert.id })}
                confirmation="Dispatch immediately? If the chosen team is on patrol, that patrol ends and its previous zone may lose coverage."
              />
            </>
          )
        }
      </QueryState>
    </Card>
  );
}
export function Patrol({ mode = "patrol" }: { mode?: string }) {
  const { user } = useSession(),
    [park, setPark] = useState(idOf(user?.park)),
    [selected, setSelected] = useState(""),
    [status, setStatus] = useState("open"),
    [dispatch, setDispatch] = useState("");
  const parks = useData("/parks");
  const parkId = park || parks.data?.parks?.[0]?.id;
  const paths: Record<string, string> = {
    patrol: "/patrol/coverage",
    teams: "/patrol/teams",
    history: "/patrol/decisions",
    alerts: "/alerts",
  };
  const q = useData(
    mode === "assignment"
      ? "/patrol/my-assignment"
      : parkId
        ? paths[mode] +
          query({ parkId, ...(mode === "alerts" ? { status } : {}) })
        : null,
    mode === "assignment",
  );
  const assignments = useData(
    mode === "teams" && parkId
      ? "/patrol/assignments" + query({ parkId })
      : null,
  );
  return (
    <Page
      title={
        {
          patrol: "Patrol coverage",
          teams: "Ranger teams",
          history: "Allocation history",
          alerts: "Operational alerts",
          assignment: "My patrol assignment",
        }[mode] ?? mode
      }
      refresh={() => {
        void q.refetch();
        if (mode === "teams") void assignments.refetch();
      }}
    >
      {mode !== "assignment" && (
        <ParkSelect
          value={parkId ?? ""}
          onChange={(v) => {
            setPark(v);
            setSelected("");
            setDispatch("");
          }}
        />
      )}
      {mode === "alerts" && (
        <Select
          label="Alert status"
          value={status}
          onChange={setStatus}
          options={options([
            "open",
            "all",
            "active",
            "acknowledged",
            "dispatched",
            "resolved",
          ])}
        />
      )}
      <QueryState query={q}>
        {(d) =>
          mode === "patrol" ? (
            <>
              <Card>
                <Detail data={d.summary} />
                <Label muted>
                  Generated {new Date(d.generatedAt).toLocaleString()}
                </Label>
              </Card>
              <ZoneMap
                zones={d.zones}
                teams={d.teams}
                routes={d.routes}
                selected={selected}
                onSelect={setSelected}
              />
              {d.zones.map((z: any) => (
                <Card key={z.zone.id}>
                  <Badge value={z.status} />
                  <Label>{z.zone.name}</Label>
                  <Detail
                    data={{
                      coveragePercent: z.coveragePercent,
                      lastPatrolledAt: z.lastPatrolledAt,
                      hoursSinceLastPatrol: z.hoursSinceLastPatrol,
                      effectiveRisk: z.effectiveRisk,
                      priorityScore: z.priorityScore,
                      reasons: z.reasons,
                      recommendedAction: z.recommendedAction,
                      assignedTeams: z.assignedTeams,
                    }}
                  />
                  <Button
                    secondary
                    title="Select for allocation"
                    onPress={() => setSelected(z.zone.id)}
                  />
                </Card>
              ))}
              {selected && d.zones.some((z: any) => z.zone.id === selected) && (
                <Allocation
                  key={`${parkId}:${selected}`}
                  parkId={parkId}
                  zone={d.zones.find((z: any) => z.zone.id === selected)}
                  zones={d.zones}
                />
              )}
            </>
          ) : mode === "assignment" ? (
            <Card>
              {d.assignment ? (
                <>
                  <Detail data={d} />
                  {!d.assignment.acknowledgedAt && (
                    <ActionForm
                      title="Acknowledge patrol assignment"
                      path={`/patrol/assignments/${d.assignment.id}/acknowledge`}
                    />
                  )}
                </>
              ) : (
                <Label>
                  {d.team
                    ? "No current patrol assignment."
                    : "You are not assigned to a ranger team. Contact park administration."}
                </Label>
              )}
            </Card>
          ) : mode === "teams" ? (
            <>
              {d.teams.map((t: any) => (
                <Card key={t.id}>
                  <Badge value={t.status} />
                  <Detail data={t} />
                </Card>
              ))}
              <QueryState query={assignments}>
                {(a) => (
                  <>
                    {!a.assignments.length && (
                      <Label>No active assignments.</Label>
                    )}
                    {a.assignments.map((x: any) => (
                      <Card key={x.id}>
                        <Detail data={x} />
                        <ActionForm
                          title="Complete patrol"
                          path={`/patrol/assignments/${x.id}/complete`}
                          confirmation="End this patrol, record coverage, free the team and resolve its emergency alert if applicable?"
                        />
                      </Card>
                    ))}
                  </>
                )}
              </QueryState>
            </>
          ) : mode === "history" ? (
            <>
              {!d.decisions.length && (
                <Label>No allocation decisions yet.</Label>
              )}
              {d.decisions.map((x: any) => (
                <Card key={x.id}>
                  <Detail data={x} />
                </Card>
              ))}
            </>
          ) : (
            <>
              {!d.alerts.length && <Label>No matching alerts.</Label>}
              {d.alerts.map((a: any) => (
                <Card key={a.id}>
                  <Badge value={`${a.severity} · ${a.status}`} />
                  <Label>{a.title}</Label>
                  {a.simulated && <Badge value="simulated source" />}
                  <Detail data={a} />
                  {a.status === "active" && (
                    <ActionForm
                      title="Acknowledge alert"
                      path={`/alerts/${a.id}/acknowledge`}
                    />
                  )}
                  {["active", "acknowledged"].includes(a.status) &&
                    ["high", "critical"].includes(a.severity) && (
                      <Button
                        title="Prepare emergency dispatch"
                        onPress={() =>
                          setDispatch(dispatch === a.id ? "" : a.id)
                        }
                      />
                    )}
                  {dispatch === a.id && <Dispatch alert={a} />}
                </Card>
              ))}
            </>
          )
        }
      </QueryState>
    </Page>
  );
}
