import React, { useRef, useState } from "react";
import { mutate } from "../api/client";
import {
  Button,
  Card,
  ErrorMessage,
  Field,
  Label,
  Select,
  confirm,
  options,
} from "./ui";
import { useRefresh } from "../hooks/data";
import { validateFields } from '../utils/forms';
import { DateInput } from './DateInput';
export type Input = {
  key: string;
  label: string;
  required?: boolean;
  choices?: { value: string; label: string }[];
  values?: string[];
  number?: boolean;
  boolean?: boolean;
  multiline?: boolean;
  min?: number;
  max?: number;
  initial?: any;
  password?: boolean;
};
export function ActionForm({
  title,
  fields = [],
  path,
  method = "PATCH",
  prepare,
  onSubmit,
  onDone,
  confirmation,
  successMessage = "Saved successfully.",
}: {
  title: string;
  fields?: Input[];
  path?: string;
  method?: string;
  prepare?: (v: any) => any;
  onSubmit?: (v: any) => Promise<any>;
  onDone?: (v: any) => void;
  confirmation?: string;
  successMessage?: string;
}) {
  const [open, setOpen] = useState(false),
    [values, setValues] = useState<any>(() =>
      Object.fromEntries(
        fields.map((f) => [f.key, f.initial ?? (f.boolean ? false : "")]),
      ),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<any>(),
    [done, setDone] = useState(false);
  const lock = useRef(false);
  const refresh = useRefresh();
  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    setDone(false);
    try {
      const body = validateFields(fields, values);
      const payload = prepare ? prepare(body) : body;
      if (confirmation && !(await confirm(title, confirmation))) return;
      const result = onSubmit
        ? await onSubmit(payload)
        : await mutate(path!, payload, method);
      await refresh();
      setDone(true);
      setOpen(false);
      onDone?.(result);
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Card>
      <Button
        title={title}
        secondary
        onPress={() => {
          setOpen(!open);
          setDone(false);
        }}
      />
      {done && <Label>{successMessage}</Label>}
      {open && (
        <>
          {fields.map((f) => (
            <React.Fragment key={f.key}>
              {f.boolean ? (
                <Button
                  title={`${values[f.key] ? "☑" : "☐"} ${f.label}`}
                  secondary
                  onPress={() =>
                    setValues({ ...values, [f.key]: !values[f.key] })
                  }
                />
              ) : f.choices || f.values ? (
                <Select
                  label={f.label}
                  value={values[f.key] ?? ""}
                  options={f.choices ?? options(f.values!)}
                  onChange={(v) => setValues({ ...values, [f.key]: v })}
                />
              ) : f.key.endsWith('At') ? (
                <DateInput label={f.label} value={String(values[f.key]??'')} onChange={v=>setValues({...values,[f.key]:v})}/>
              ) : (
                <Field
                  label={f.label + (f.required ? " *" : "")}
                  value={String(values[f.key] ?? "")}
                  onChange={(v) => setValues({ ...values, [f.key]: v })}
                  secure={f.password}
                  multiline={f.multiline}
                  keyboard={f.number ? "decimal-pad" : "default"}
                />
              )}
            </React.Fragment>
          ))}
          <ErrorMessage error={error} />
          <Button
            title={busy ? "Saving…" : "Save"}
            disabled={busy}
            onPress={() => void submit()}
          />
        </>
      )}
    </Card>
  );
}
