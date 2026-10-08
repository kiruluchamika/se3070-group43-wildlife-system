export interface FieldRule {
  key: string; label: string; required?: boolean; number?: boolean;
  min?: number; max?: number; password?: boolean;
}
export function validateFields(fields: FieldRule[], values: Record<string, any>) {
  const body: Record<string, any> = {};
  for (const f of fields) {
    let value = values[f.key];
    if (f.required && (value == null || String(value).trim() === '')) throw new Error(`${f.label} is required.`);
    if (value === '' || value == null) continue;
    if (f.number) {
      value = Number(value);
      if (!Number.isFinite(value) || (f.min !== undefined && value < f.min) || (f.max !== undefined && value > f.max)) throw new Error(`Enter a valid ${f.label.toLowerCase()}.`);
    } else if (typeof value === 'string') {
      if (!f.password) value = value.trim();
      if ((f.min !== undefined && value.length < f.min) || (f.max !== undefined && value.length > f.max)) throw new Error(`${f.label}: use ${f.min ?? 0}–${f.max ?? 'more'} characters.`);
    }
    body[f.key] = value;
  }
  return body;
}
