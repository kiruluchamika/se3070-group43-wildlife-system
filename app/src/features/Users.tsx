import React, { useState } from "react";
import { useData } from "../hooks/data";
import {
  Badge,
  Button,
  Card,
  Detail,
  Label,
  Page,
  QueryState,
} from "../components/ui";
import { ActionForm, Input } from "../components/ActionForm";
import { idOf } from "../types";
const roles = [
  "villager",
  "ranger",
  "liaison-officer",
  "park-manager",
  "data-analyst",
  "administrator",
];
export function Users() {
  const [page, setPage] = useState(1);
  const q = useData(`/users?page=${page}`),
    parks = useData("/parks");
  const fields: Input[] = [
    { key: "name", label: "Full name", required: true, min: 2, max: 80 },
    { key: "email", label: "Email", required: true },
    { key: "phone", label: "Phone", max: 20 },
    { key: "role", label: "Role", values: roles, required: true },
    {
      key: "park",
      label: "Park scope",
      choices: [
        { value: "none", label: "No assigned park" },
        ...(parks.data?.parks ?? []).map((p: any) => ({
          value: p.id,
          label: p.name,
        })),
      ],
    },
  ];
  const prepare = (v: any) => ({
    ...v,
    email: v.email.toLowerCase(),
    ...(v.park ? { park: v.park === "none" ? null : v.park } : {}),
  });
  return (
    <Page title="User management" refresh={() => void q.refetch()}>
      <ActionForm
        title="Create account"
        path="/users"
        method="POST"
        fields={[
          ...fields,
          {
            key: "password",
            label: "Initial password",
            password: true,
            required: true,
            min: 8,
            max: 128,
          },
        ]}
        prepare={prepare}
      />
      <QueryState query={q}>
        {(d) => (
          <>
            {d.users.map((u: any) => (
              <Card key={u.id}>
                <Badge value={u.role} />
                <Detail data={u} />
                <ActionForm
                  key={`${u.id}:${u.name}:${u.role}:${u.park}`}
                  title="Edit account"
                  path={`/users/${u.id}`}
                  fields={fields.map((f) => ({
                    ...f,
                    initial:
                      f.key === "park"
                        ? idOf(u.park) || "none"
                        : (u[f.key] ?? ""),
                  }))}
                  prepare={prepare}
                />
                <ActionForm
                  title={u.isActive ? "Deactivate account" : "Activate account"}
                  path={`/users/${u.id}/status`}
                  prepare={() => ({ isActive: !u.isActive })}
                  confirmation={`Change access for ${u.name}? Backend self-protection and team rules still apply.`}
                />
              </Card>
            ))}
            <Label>Page {page}</Label>
            <Button
              secondary
              title="Previous page"
              disabled={page === 1}
              onPress={() => setPage(page - 1)}
            />
            <Button
              secondary
              title="Next page"
              disabled={!d.hasMore}
              onPress={() => setPage(page + 1)}
            />
          </>
        )}
      </QueryState>
    </Page>
  );
}
