export type Role =
  | "villager"
  | "ranger"
  | "liaison-officer"
  | "park-manager"
  | "data-analyst"
  | "administrator";
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  park?: string | { id: string; name: string };
  isActive?: boolean;
}
export type RecordData = Record<string, any>;
export const idOf = (value: any): string =>
  typeof value === "string" ? value : (value?.id ?? "");
