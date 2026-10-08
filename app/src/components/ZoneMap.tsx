import React, { useState } from "react";
import Svg, { Circle, Path, Polyline, Text as SvgText } from "react-native-svg";
import { Card, Label, Select } from "./ui";
import { polygonPositions } from '../features/analytics/calculations/calculateVisualizations';
/** A geographic diagram from backend coordinates; no external tiles or invented boundaries. */
export function ZoneMap({
  zones,
  teams = [],
  routes = [],
  selected,
  onSelect,
}: {
  zones: any[];
  teams?: any[];
  routes?: any[];
  selected?: string;
  onSelect?: (id: string) => void;
}) {
  const [marker, setMarker] = useState("");
  const valid = zones.filter((r) => polygonPositions((r.zone ?? r).boundary));
  const points = valid
    .flatMap((r) => (r.zone ?? r).boundary.coordinates.flat())
    .filter(
      (p: any) =>
        Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]),
    );
  if (!points.length) return <Label>No geographic boundaries available.</Label>;
  const xs = points.map((p: any) => p[0]),
    ys = points.map((p: any) => p[1]),
    minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const scale = Math.min(320 / (maxX - minX || 1), 230 / (maxY - minY || 1));
  const x = (v: number) => 20 + (v - minX) * scale,
    y = (v: number) => 250 - (v - minY) * scale;
  return (
    <Card>
      <Label>Park zones · illustrative boundaries</Label>
      <Svg
        width="100%"
        height={280}
        viewBox="0 0 360 280"
        accessibilityLabel="Illustrative park zones, north is up"
      >
        {valid.map((r, i) => {
          const z = r.zone ?? r;
          const d = z.boundary.coordinates
            .map(
              (ring: any) =>
                ring
                  .map(
                    (p: any, j: number) =>
                      `${j ? "L" : "M"}${x(p[0])},${y(p[1])}`,
                  )
                  .join(" ") + " Z",
            )
            .join(" ");
          return (
            <Path
              key={z.id}
              d={d}
              fill={
                r.status === "under-patrolled"
                  ? "#a84642"
                  : r.status === "covered"
                    ? "#127b70"
                    : "#536e48"
              }
              fillOpacity={0.65}
              stroke={selected === z.id ? "#ffffff" : "#9dbac0"}
              strokeWidth={selected === z.id ? 3 : 1}
              fillRule="evenodd"
              onPress={() => onSelect?.(z.id)}
            />
          );
        })}
        {routes.map((r: any) => (
          <Polyline
            key={r.id}
            points={(r.route ?? [])
              .filter(
                (p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
              )
              .map((p: any) => `${x(p.lng)},${y(p.lat)}`)
              .join(" ")}
            stroke="#38d6f5"
            strokeWidth={2}
            fill="none"
          />
        ))}
        {teams
          .filter(
            (t) =>
              Number.isFinite(t.location?.lat) &&
              Number.isFinite(t.location?.lng),
          )
          .map((t) => (
            <Circle
              key={t.id}
              cx={x(t.location.lng)}
              cy={y(t.location.lat)}
              r={5}
              fill="#ffffff"
              onPress={() => setMarker(t.name)}
            />
          ))}
        <SvgText x={320} y={18} fill="#e7f5f2">
          N ↑
        </SvgText>
      </Svg>
      <Label muted>
        Red: under-patrolled · Teal: covered · Olive: other/adequate. White:
        team position. Cyan: recent patrol route.
      </Label>
      <Label muted>
        Longitude {minX.toFixed(3)}–{maxX.toFixed(3)} · Latitude{" "}
        {minY.toFixed(3)}–{maxY.toFixed(3)}. Not official park boundaries.
      </Label>
      {marker && <Label>Team: {marker}</Label>}
      {onSelect && (
        <Select
          label="Select zone (accessible list)"
          value={selected ?? ""}
          onChange={onSelect}
          options={zones.map((r) => ({
            value: (r.zone ?? r).id,
            label: (r.zone ?? r).name,
          }))}
        />
      )}
    </Card>
  );
}
