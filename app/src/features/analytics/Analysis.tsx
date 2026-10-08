import React, { useEffect, useRef, useState } from "react";
import { ScrollView } from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import { randomUUID } from "expo-crypto";
import { useData, useRefresh } from "../../hooks/data";
import { mutate, query, request } from "../../api/client";
import {
  Badge,
  Button,
  Card,
  Detail,
  ErrorMessage,
  Field,
  Label,
  Loading,
  Page,
  QueryState,
  Select,
  confirm,
  options,
} from "../../components/ui";
import { ZoneMap } from "../../components/ZoneMap";
import { DateInput } from '../../components/DateInput';
import { calculateStatistics } from "./calculations/calculateStatistics";
import { calculateVisualizations } from "./calculations/calculateVisualizations";
import {
  calculateComparison,
  comparisonRows,
} from "./calculations/compareParks";
import { reportSaveBody } from "./calculations/reportSnapshot";
import {
  indexSupportingRecords,
  selectSupportingRecords,
} from "./calculations/supportingRecords";
import { openWork } from "../../navigation/open";
export function Chart({
  buckets,
  onSelect,
}: {
  buckets: any[];
  onSelect: (b: any) => void;
}) {
  const max = Math.max(1, ...buckets.map((b) => b.alerts + b.conflicts)),
    width = Math.max(320, buckets.length * 55);
  return (
    <Card>
      <Label>Event trend · tap a bar for source references</Label>
      <ScrollView horizontal>
        <Svg width={width} height={205}>
          {buckets.map((b, i) => {
            const h = ((b.alerts + b.conflicts) / max) * 140;
            return (
              <React.Fragment key={b.key}>
                <Rect
                  x={i * 55 + 8}
                  y={150 - h}
                  width={28}
                  height={Math.max(2, h)}
                  fill="#24d6c2"
                  onPress={() => onSelect(b)}
                />
                <SvgText
                  x={i * 55 + 22}
                  y={165}
                  fontSize={9}
                  fill="#e7f5f2"
                  textAnchor="middle"
                >
                  {b.key.slice(5)}
                </SvgText>
                <SvgText
                  x={i * 55 + 22}
                  y={Math.max(10, 145 - h)}
                  fontSize={11}
                  fill="#e7f5f2"
                  textAnchor="middle"
                >
                  {b.alerts + b.conflicts}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </ScrollView>
      <Label muted>
        Alert + conflict records, not unique wildlife incidents. Dates use
        Asia/Colombo.
      </Label>
      <Select
        label="Inspect trend period"
        value=""
        onChange={(v) => onSelect(buckets.find((b) => b.key === v))}
        options={buckets.map((b) => ({
          value: b.key,
          label: `${b.key}: ${b.alerts} alerts, ${b.conflicts} conflicts`,
        }))}
      />
    </Card>
  );
}
export function Results({ dataset }: { dataset: any }) {
  const result: any = calculateStatistics(dataset),
    analysis: any = calculateVisualizations(result, dataset);
  const [selected, setSelected] = useState<any>(),
    [category, setCategory] = useState("all"),
    [page, setPage] = useState(0),
    [zone, setZone] = useState("");
  if (result.status === "error") return <ErrorMessage error={result.message} />;
  const records = selectSupportingRecords(
    indexSupportingRecords(result),
    analysis,
    category,
    zone,
  );
  return (
    <>
      <Card>
        <Label>{result.context.park.name}</Label>
        <Detail data={result.statistics} />
        <Label muted>{result.context.dateBasis}</Label>
        {result.status === "empty" && (
          <Label>No matching conservation records.</Label>
        )}
        <Detail data={dataset.limitations} />
      </Card>
      {analysis.trends.status === "error" ? (
        <ErrorMessage error={analysis.trends.message} />
      ) : (
        <Chart buckets={analysis.trends.buckets} onSelect={setSelected} />
      )}
      {selected && (
        <Card>
          <Detail data={selected} />
          <Button
            secondary
            title="Close trend details"
            onPress={() => setSelected(undefined)}
          />
        </Card>
      )}
      <Card>
        <Label>Hotspots (at least 3 zone-linked alert events)</Label>
        {analysis.hotspots.status === "error" ? (
          <ErrorMessage error={analysis.hotspots.message} />
        ) : (
          <Detail
            data={{
              hotspots: analysis.hotspots.hotspots,
              unzoned: analysis.hotspots.unzoned,
              omitted: analysis.hotspots.omitted,
            }}
          />
        )}
      </Card>
      <ZoneMap zones={dataset.zones} />
      <Card>
        <Label>Patrol effort over selected period</Label>
        <Label muted>
          Effort against prorated targets; not physical area coverage.
        </Label>
        <Detail data={analysis.coverage} />
      </Card>
      <Card>
        <Label>Source records</Label>
        <Select
          label="Supporting category"
          value={category}
          options={options(analysis.supportingCategories)}
          onChange={(v) => {
            setCategory(v);
            setPage(0);
            setZone("");
          }}
        />
        {records.zones.length > 0 && (
          <Select
            label="Zone"
            value={zone}
            onChange={(v) => {
              setZone(v);
              setPage(0);
            }}
            options={[
              { value: "", label: "All zones" },
              ...records.zones.map((z: any) => ({
                value: z.id,
                label: z.name,
              })),
            ]}
          />
        )}
        <Label>
          {records.rows.length} records · page {page + 1}
        </Label>
        {records.rows.slice(page * 20, (page + 1) * 20).map((r: any) => (
          <Card key={`${r.source}:${r.record.id}`}>
            <Badge value={r.source} />
            <Detail data={r.record} />
          </Card>
        ))}
        <Button
          secondary
          title="Previous records"
          disabled={page === 0}
          onPress={() => setPage(page - 1)}
        />
        <Button
          secondary
          title="Next records"
          disabled={(page + 1) * 20 >= records.rows.length}
          onPress={() => setPage(page + 1)}
        />
      </Card>
    </>
  );
}
export function Analysis({
  sourceDraft,
  onSaved,
}: {
  sourceDraft?: any;
  onSaved?: (r: any) => void;
}) {
  const choices = useData("/analytics/options"),
    refresh = useRefresh();
  const initial = sourceDraft?.filters;
  const [parks, setParks] = useState<string[]>(
      initial?.parkIds ?? (initial?.parkId ? [initial.parkId] : []),
    ),
    [start, setStart] = useState(
      () =>
        initial?.startDate ??
        new Date(Date.now() - 30 * 86400000 + 19800000)
          .toISOString()
          .slice(0, 10),
    ),
    [end, setEnd] = useState(
      () =>
        initial?.endDate ??
        new Date(Date.now() + 19800000).toISOString().slice(0, 10),
    ),
    [type, setType] = useState(initial?.incidentType ?? ""),
    [species, setSpecies] = useState(initial?.species ?? ""),
    [dataset, setDataset] = useState<any>(),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<any>(),
    [title, setTitle] = useState(sourceDraft?.title ?? ""),
    [findings, setFindings] = useState(""),
    [recommendations, setRecommendations] = useState(""),
    [preview, setPreview] = useState<any>(),
    [saved, setSaved] = useState<any>();
  const controller = useRef<AbortController | null>(null),
    saveAttempt = useRef<any>(undefined);
  useEffect(() => () => controller.current?.abort(), []);
  async function retrieve() {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setError(undefined);
    setPreview(undefined);
    setDataset(undefined);
    saveAttempt.current = undefined;
    try {
      if (!parks.length) throw new Error("Choose at least one park.");
      for (const v of [start, end])
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
          !Number.isFinite(Date.parse(v + "T00:00:00Z")) ||
          new Date(v + "T00:00:00Z").toISOString().slice(0, 10) !== v
        )
          throw new Error("Use valid YYYY-MM-DD dates.");
      if (
        start > end ||
        end > new Date(Date.now() + 19800000).toISOString().slice(0, 10)
      )
        throw new Error(
          "Choose an ordered date range ending no later than today in Sri Lanka.",
        );
      const data = await request(
        "/analytics" +
          query({
            ...(parks.length === 1 ? { parkId: parks[0] } : { parkIds: parks }),
            startDate: start,
            endDate: end,
            incidentType: type,
            species,
          }),
        { signal: c.signal },
      );
      if (c.signal.aborted) return;
      setDataset(data);
      setConfirmed(!data.freshness.requiresConfirmation);
    } catch (e) {
      if (!c.signal.aborted) setError(e);
    } finally {
      if (controller.current === c) setBusy(false);
    }
  }
  function generate() {
    try {
      if (
        !title.trim() ||
        title.length > 200 ||
        findings.length > 5000 ||
        recommendations.length > 5000
      )
        throw new Error(
          "Use a title of 1–200 characters and narratives up to 5,000 characters.",
        );
      let result: any;
      if (dataset.datasets) result = calculateComparison(dataset);
      else {
        result = calculateStatistics(dataset);
        if (result.status === "error") throw new Error(result.message);
        result = {
          ...result,
          analysis: calculateVisualizations(result, dataset),
        };
      }
      if (result.parks?.some((p: any) => p.status === "error"))
        throw new Error("One park could not be analyzed. Retrieve again.");
      setPreview({ ...result, title, findings, recommendations });
      saveAttempt.current = undefined;
      setError(undefined);
    } catch (e) {
      setError(e);
    }
  }
  async function save(status: string) {
    setBusy(true);
    setError(undefined);
    try {
      if (saveAttempt.current && saveAttempt.current.status !== status)
        throw new Error(
          "Resolve the previous save attempt first. Retry the same status or check Reports before generating a new preview.",
        );
      if (
        !(await confirm(
          "Save conservation report?",
          sourceDraft
            ? "Replace the original draft transactionally? The original remains if replacement fails."
            : `Save this analysis as ${status}?`,
        ))
      )
        return;
      if (!saveAttempt.current) saveAttempt.current = reportSaveBody(preview, randomUUID(), status, sourceDraft);
      const result = await mutate("/reports", saveAttempt.current);
      setSaved(result.report);
      await refresh();
      onSaved?.(result.report);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (saved)
    return (
      <Page title="Report saved">
        <Badge value={saved.status} />
        <Label>{saved.title}</Label>
        <Button
          title="Open report"
          onPress={() => openWork(`reports/${saved.id}`)}
        />
      </Page>
    );
  return (
    <Page title={sourceDraft ? "Re-analyze draft" : "Conservation analytics"}>
      <ErrorMessage error={error} />
      {!dataset && (
        <>
          <QueryState query={choices}>
            {(d) => (
              <>
                <Label>
                  Select one park, or multiple parks for comparison.
                </Label>
                {d.parks.map((p: any) => (
                  <Button
                    key={p.id}
                    secondary={!parks.includes(p.id)}
                    title={`${parks.includes(p.id) ? "☑" : "☐"} ${p.name}`}
                    onPress={() =>
                      setParks(
                        parks.includes(p.id)
                          ? parks.filter((id) => id !== p.id)
                          : [...parks, p.id],
                      )
                    }
                  />
                ))}
                <Select
                  label="Incident type"
                  value={type}
                  onChange={setType}
                  options={[
                    { value: "", label: "All incident types" },
                    ...options(d.incidentTypes),
                  ]}
                />
                <Select
                  label="Species"
                  value={species}
                  onChange={setSpecies}
                  options={[
                    { value: "", label: "All species" },
                    ...d.species.map((s: any) => ({
                      value: s.id,
                      label: s.label,
                    })),
                  ]}
                />
              </>
            )}
          </QueryState>
          <DateInput dateOnly
            label="Start date (YYYY-MM-DD)"
            value={start}
            onChange={setStart}
          />
          <DateInput dateOnly label="End date (YYYY-MM-DD)" value={end} onChange={setEnd} />
          <Label muted>Inclusive dates in Asia/Colombo.</Label>
          {busy ? (
            <>
              <Loading />
              <Button
                secondary
                title="Cancel retrieval"
                onPress={() => {
                  controller.current?.abort();
                  setBusy(false);
                }}
              />
            </>
          ) : (
            <Button
              title="Retrieve conservation records"
              onPress={() => void retrieve()}
            />
          )}
        </>
      )}
      {dataset && (
        <>
          <Button
            secondary
            title="Return to filters"
            disabled={busy}
            onPress={() => {
              setDataset(undefined);
              setPreview(undefined);
              saveAttempt.current = undefined;
            }}
          />
          <Card>
            <Label>Data freshness</Label>
            <Detail data={dataset.freshness} />
          </Card>
          {!confirmed ? (
            <>
              <Label>
                Some patrol sources are pending synchronization. Review their
                limitations before continuing.
              </Label>
              <Button
                title="Continue with these limitations"
                onPress={() => setConfirmed(true)}
              />
            </>
          ) : (
            <>
              {dataset.datasets ? (
                <>
                  <Card>
                    <Label>Park comparison</Label>
                    <Detail
                      data={comparisonRows(calculateComparison(dataset).parks)}
                    />
                  </Card>
                  {dataset.datasets.map((d: any) => (
                    <Results key={d.park.id} dataset={d} />
                  ))}
                </>
              ) : (
                <Results dataset={dataset} />
              )}
              <Card>
                <Label>Prepare conservation report</Label>
                <Field
                  label="Report title"
                  value={title}
                  onChange={(v) => {
                    setTitle(v);
                    setPreview(undefined);
                  }}
                />
                <Field
                  label="Findings"
                  value={findings}
                  onChange={(v) => {
                    setFindings(v);
                    setPreview(undefined);
                  }}
                  multiline
                />
                <Field
                  label="Recommendations"
                  value={recommendations}
                  onChange={(v) => {
                    setRecommendations(v);
                    setPreview(undefined);
                  }}
                  multiline
                />
                <Button title="Preview report" onPress={generate} />
              </Card>
              {preview && (
                <Card>
                  <Label>Report preview</Label>
                  <Detail
                    data={{
                      title: preview.title,
                      findings: preview.findings,
                      recommendations: preview.recommendations,
                      context: preview.context,
                    }}
                  />
                  <Label>
                    The analysis displayed above will be saved with its source
                    references.
                  </Label>
                  <Button
                    title="Save draft"
                    disabled={busy}
                    onPress={() => void save("draft")}
                  />
                  <Button
                    title="Save finalized report"
                    disabled={busy}
                    onPress={() => void save("finalized")}
                  />
                </Card>
              )}
            </>
          )}
        </>
      )}
    </Page>
  );
}
