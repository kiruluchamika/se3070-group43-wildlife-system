import React from "react";
import { useData } from "../hooks/data";
import { Select, QueryState } from "./ui";
export function ParkSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const q = useData("/parks", true);
  return (
    <QueryState query={q}>
      {(d) => (
        <Select
          label="Park"
          value={value}
          onChange={onChange}
          options={d.parks.map((p: any) => ({ value: p.id, label: p.name }))}
        />
      )}
    </QueryState>
  );
}
