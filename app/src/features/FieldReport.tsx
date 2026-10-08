import React, { useRef, useState } from "react";
import { useSession } from "../contexts/Session";
import { useSync } from "../contexts/Sync";
import { useRefresh } from "../hooks/data";
import { mutate } from "../api/client";
import {
  Badge,
  Button,
  Card,
  Detail,
  ErrorMessage,
  Field,
  Label,
  Page,
  Select,
  confirm,
  options,
} from "../components/ui";
import {
  LocationInput,
  Photo,
  PhotosInput,
  Point,
} from "../components/Capture";
import { ParkSelect } from "../components/ParkSelect";
import { DateInput } from '../components/DateInput';
import { idOf } from "../types";
import { openWork } from "../navigation/open";
export const conflictTypes = [
  "elephant-sighting",
  "crop-damage",
  "property-damage",
  "human-threat",
  "human-injury",
  "other",
];
export const incidentTypes = [
  "wildlife-sighting",
  "injured-wildlife",
  "snare",
  "carcass",
  "illegal-camp",
  "footprint",
  "fire",
  "other",
];
export const priorities = ["low", "medium", "high", "critical"];
export function FieldReport({ incident = false }: { incident?: boolean }) {
  const { user, offline } = useSession(),
    sync = useSync(),
    refresh = useRefresh();
  const [park, setPark] = useState(idOf(user?.park)),
    [type, setType] = useState(
      incident ? "wildlife-sighting" : "elephant-sighting",
    ),
    [severity, setSeverity] = useState("low"),
    [description, setDescription] = useState(""),
    [at, setAt] = useState(new Date().toISOString()),
    [location, setLocation] = useState<Point>(),
    [photos, setPhotos] = useState<Photo[]>([]),
    [extra, setExtra] = useState<Record<string, string>>({
      contactName: user?.name ?? "",
      contactPhone: user?.phone ?? "",
    }),
    [danger, setDanger] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<any>(),
    [saved, setSaved] = useState<any>();
  const submitting = useRef(false);
  function field(key: string, label: string) {
    return (
      <Field
        key={key}
        label={label}
        value={extra[key] ?? ""}
        onChange={(v) => setExtra({ ...extra, [key]: v })}
      />
    );
  }
  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(undefined);
    try {
      if (!park) throw new Error("Choose a park.");
      if (description.trim().length < 10 || description.length > 1000)
        throw new Error("Describe the event in 10–1,000 characters.");
      const date = new Date(at);
      if (
        !Number.isFinite(date.getTime()) ||
        date.getTime() > Date.now() + 300000
      )
        throw new Error("Enter a valid event time that is not in the future.");
      if (incident) {
        if (!location && !extra.locationNote?.trim())
          throw new Error("Add coordinates or a location note.");
        if (
          !(await confirm(
            "Save field report?",
            "This report will be saved on this device before upload. Server receipt appears in Incident reports.",
          ))
        )
          return;
        await sync.enqueue("/incidents", {
          parkId: park,
          type,
          severity,
          description: description.trim(),
          observedAt: date.toISOString(),
          deviceCreatedAt: new Date().toISOString(),
          location,
          locationNote: extra.locationNote?.trim(),
          species: extra.species?.trim() || undefined,
          recordedOffline: offline,
          photos,
        });
        setSaved({ local: true });
      } else {
        if ((extra.village ?? "").trim().length < 2)
          throw new Error("Enter the village.");
        if (
          (extra.contactName ?? "").trim().length < 2 ||
          !/^\+?[0-9 ()-]{7,20}$/.test(extra.contactPhone ?? "")
        )
          throw new Error("Enter a contact name and valid phone number.");
        const damage: any = {};
        if (type === "crop-damage") {
          if (
            !extra.cropType?.trim() ||
            !extra.affectedAreaAcres ||
            !Number.isFinite(Number(extra.affectedAreaAcres)) ||
            Number(extra.affectedAreaAcres) < 0
          )
            throw new Error(
              "Enter crop type and a non-negative affected area.",
            );
          damage.cropType = extra.cropType.trim();
          damage.affectedAreaAcres = Number(extra.affectedAreaAcres);
        }
        if (type === "property-damage") {
          if (!extra.propertyType?.trim())
            throw new Error("Describe the damaged property.");
          damage.propertyType = extra.propertyType.trim();
        }
        if (extra.estimatedLossLkr) {
          if (
            !Number.isFinite(Number(extra.estimatedLossLkr)) ||
            Number(extra.estimatedLossLkr) < 0
          )
            throw new Error("Estimated loss must be non-negative.");
          damage.estimatedLossLkr = Number(extra.estimatedLossLkr);
        }
        if (
          !(await confirm(
            "Submit conflict report?",
            "Send this report to the liaison officer? If the connection is interrupted, check My reports before submitting again.",
          ))
        )
          return;
        const result = await mutate("/conflicts", {
          parkId: park,
          conflictType: type,
          village: extra.village.trim(),
          landmark: extra.landmark?.trim(),
          occurredAt: date.toISOString(),
          description: description.trim(),
          contactName: extra.contactName.trim(),
          contactPhone: extra.contactPhone.trim(),
          location,
          immediateDanger: danger,
          damage: Object.keys(damage).length ? damage : undefined,
          evidence: photos,
        });
        setSaved(result.report);
        await refresh();
      }
    } catch (e) {
      setError(e);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  if (saved)
    return (
      <Page title={saved.local ? "Saved on this device" : "Conflict submitted"}>
        <Card>
          <Badge value={saved.local ? "queued" : "received"} />
          {saved.local ? (
            <Label>
              Local save confirmed. Check the queue for server receipt; keep
              this account signed in to synchronize.
            </Label>
          ) : (
            <Detail
              data={{
                reference: saved.reference,
                suggestedPriority: saved.suggestedPriority,
                locationAdequate: saved.locationAdequate,
              }}
            />
          )}
          <Button
            title={incident ? "Open incident reports" : "View report"}
            onPress={() =>
              openWork(incident ? "incidents" : `conflicts/${saved.id}`)
            }
          />
        </Card>
      </Page>
    );
  return (
    <Page
      title={
        incident ? "Report wildlife incident" : "Report human–elephant conflict"
      }
    >
      <ParkSelect value={park} onChange={setPark} />
      <Select
        label="Type"
        value={type}
        options={options(incident ? incidentTypes : conflictTypes)}
        onChange={setType}
      />
      {incident ? (
        <>
          <Select
            label="Urgency"
            value={severity}
            options={options(priorities)}
            onChange={setSeverity}
          />
          {field("species", "Species (optional)")}
          {field("locationNote", "Location note (required without GPS)")}
        </>
      ) : (
        <>
          {field("village", "Village *")}
          {field("landmark", "Landmark")}
          {field("contactName", "Contact name *")}
          {field("contactPhone", "Contact phone *")}
          <Button
            secondary
            title={`${danger ? "☑" : "☐"} Immediate danger`}
            onPress={() => setDanger(!danger)}
          />
          {type === "crop-damage" && (
            <>
              {field("cropType", "Crop type *")}
              {field("affectedAreaAcres", "Affected acres *")}
            </>
          )}
          {type === "property-damage" &&
            field("propertyType", "Property damaged *")}
          {["crop-damage", "property-damage"].includes(type) &&
            field("estimatedLossLkr", "Estimated loss (LKR)")}
        </>
      )}
      <DateInput
        label="Event time (ISO, include +05:30 or Z) *"
        value={at}
        onChange={setAt}
      />
      <Field
        label="Description *"
        value={description}
        onChange={setDescription}
        multiline
      />
      <LocationInput value={location} onChange={setLocation} />
      <PhotosInput photos={photos} onChange={setPhotos} />
      <ErrorMessage error={error} />
      <Button
        title={
          busy
            ? "Saving…"
            : incident
              ? "Save locally & synchronize"
              : "Submit conflict"
        }
        disabled={busy || (!incident && offline)}
        onPress={() => void submit()}
      />
      {!incident && offline && (
        <Label>Conflict submission requires a connection.</Label>
      )}
    </Page>
  );
}
