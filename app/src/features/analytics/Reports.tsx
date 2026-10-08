import React, { useRef, useState } from "react";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { randomUUID } from "expo-crypto";
import { useData, useRefresh } from "../../hooks/data";
import { useSession } from "../../contexts/Session";
import { mutate, query, request } from "../../api/client";
import {
  Badge,
  Button,
  Card,
  Detail,
  ErrorMessage,
  Label,
  Page,
  QueryState,
  Select,
  confirm,
  options,
} from "../../components/ui";
import { ActionForm } from "../../components/ActionForm";
import { openWork } from "../../navigation/open";
import { Analysis } from "./Analysis";
function ReportDetail({ report: r }: { report: any }) {
  const { user } = useSession(),
    refresh = useRefresh();
  const analyst = user?.role === "data-analyst",
    recipients = useData(
      analyst && r.status === "finalized"
        ? `/reports/${r.id}/recipients`
        : null,
    );
  const [chosen, setChosen] = useState<string[]>([]),
    [error, setError] = useState<any>(),
    [busy, setBusy] = useState(false),
    [reanalyze, setReanalyze] = useState<any>(),
    [shared, setShared] = useState<any>();
  const finalBody = useRef<any>(undefined);
  async function pdf() {
    setBusy(true);
    setError(undefined);
    let file: File | undefined;
    try {
      const bytes = await request<ArrayBuffer>(`/reports/${r.id}/export`, {
        binary: true,
      });
      file = new File(Paths.cache, `WildGuard-${r.id}.pdf`);
      file.write(new Uint8Array(bytes));
      if (!(await Sharing.isAvailableAsync()))
        throw new Error("Native file sharing is unavailable on this device.");
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
      });
    } catch (e) {
      setError(e);
    } finally {
      try {
        if (file?.exists) file.delete();
      } catch {
        setError("PDF shared, but temporary file cleanup failed.");
      }
      setBusy(false);
    }
  }
  async function finalize() {
    setBusy(true);
    setError(undefined);
    try {
      if (
        !(await confirm(
          "Finalize draft?",
          "Replace this draft with a read-only finalized report?",
        ))
      )
        return;
      if (!finalBody.current)
        finalBody.current = {
          requestId: randomUUID(),
          status: "finalized",
          title: r.title,
          findings: r.findings,
          recommendations: r.recommendations,
          snapshot: r.snapshot,
          replaceDraft: { id: r.id, revision: r.revision ?? 0 },
        };
      const result = await mutate("/reports", finalBody.current);
      await refresh();
      openWork(`reports/${result.report.id}`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (reanalyze) return <Analysis sourceDraft={reanalyze} />;
  return (
    <>
      <Badge value={r.status} />
      <Card>
        <Label>{r.title}</Label>
        <Label>{r.findings}</Label>
        <Label>{r.recommendations}</Label>
        <Detail data={r.snapshot} />
        <Label muted>
          Saved{" "}
          {new Date(r.createdAt).toLocaleString("en-GB", {
            timeZone: "Asia/Colombo",
          })}{" "}
          · Sri Lanka time
        </Label>
      </Card>
      <ErrorMessage error={error} />
      {r.status === "draft" && analyst ? (
        <>
          <ActionForm
            key={`${r.id}:${r.revision}`}
            title="Edit draft narratives"
            path={`/reports/${r.id}`}
            fields={[
              {
                key: "title",
                label: "Title",
                required: true,
                max: 200,
                initial: r.title,
              },
              {
                key: "findings",
                label: "Findings",
                max: 5000,
                multiline: true,
                initial: r.findings,
              },
              {
                key: "recommendations",
                label: "Recommendations",
                max: 5000,
                multiline: true,
                initial: r.recommendations,
              },
            ]}
            prepare={(v) => ({
              ...v,
              findings: v.findings ?? "",
              recommendations: v.recommendations ?? "",
              revision: r.revision ?? 0,
            })}
          />
          <Button
            secondary
            title="Restore filters and re-analyze"
            onPress={() =>
              void request(`/reports/${r.id}/reanalysis`)
                .then((d) => setReanalyze(d.draft))
                .catch(setError)
            }
          />
          <Button
            title="Finalize saved draft"
            disabled={busy}
            onPress={() => void finalize()}
          />
        </>
      ) : (
        <>
          <Button
            title={busy ? "Preparing PDF…" : "Download & share server PDF"}
            disabled={busy}
            onPress={() => void pdf()}
          />
          {analyst && (
            <Card>
              <Label>Share with authorized park managers</Label>
              <QueryState query={recipients}>
                {(d) => (
                  <>
                    {d.managers.map((m: any) => (
                      <Button
                        key={m.id}
                        secondary={!chosen.includes(m.id)}
                        title={`${chosen.includes(m.id) ? "☑" : "☐"} ${m.name}`}
                        onPress={() =>
                          setChosen(
                            chosen.includes(m.id)
                              ? chosen.filter((id) => id !== m.id)
                              : [...chosen, m.id],
                          )
                        }
                      />
                    ))}
                    {!d.managers.length && <Label>No eligible managers.</Label>}
                    <Button
                      title="Share finalized report"
                      disabled={!chosen.length || busy}
                      onPress={() =>
                        void (async () => {
                          setBusy(true);
                          try {
                            setShared(
                              await mutate(`/reports/${r.id}/share`, {
                                recipients: chosen,
                              }),
                            );
                            await refresh();
                          } catch (e) {
                            setError(e);
                          } finally {
                            setBusy(false);
                          }
                        })()
                      }
                    />
                    {shared && <Detail data={shared} />}
                  </>
                )}
              </QueryState>
            </Card>
          )}
        </>
      )}
    </>
  );
}
export function Reports({ id }: { id?: string }) {
  const [page, setPage] = useState(1),
    [status, setStatus] = useState("all");
  const q = useData(
    id
      ? `/reports/${id}`
      : "/reports" +
          query({ page, status: status === "all" ? undefined : status }),
  );
  return (
    <Page
      title={id ? "Conservation report" : "Saved reports"}
      refresh={() => void q.refetch()}
    >
      {!id && (
        <Select
          label="Status"
          value={status}
          options={options(["all", "draft", "finalized"])}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
      )}
      <QueryState query={q}>
        {(d) =>
          id ? (
            <ReportDetail key={d.report.id} report={d.report} />
          ) : (
            <>
              {!d.reports.length && <Label>No reports on this page.</Label>}
              {d.reports.map((r: any) => (
                <Card key={r.id}>
                  <Badge value={r.status} />
                  <Label>{r.title}</Label>
                  <Label muted>
                    {r.snapshot.context.filters.startDate} to{" "}
                    {r.snapshot.context.filters.endDate}
                  </Label>
                  <Button
                    secondary
                    title="Open report"
                    onPress={() => openWork(`reports/${r.id}`)}
                  />
                </Card>
              ))}
              <Label>Page {page}</Label>
              <Button
                secondary
                title="Previous"
                disabled={page === 1}
                onPress={() => setPage(page - 1)}
              />
              <Button
                secondary
                title="Next"
                disabled={!d.hasMore}
                onPress={() => setPage(page + 1)}
              />
            </>
          )
        }
      </QueryState>
    </Page>
  );
}
