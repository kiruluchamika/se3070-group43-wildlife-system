import React, { useState } from "react";
import {
  Button,
  Card,
  Detail,
  ErrorMessage,
  Label,
  Page,
  confirm,
} from "../../../src/components/ui";
import { useSession } from "../../../src/contexts/Session";
import { useSync } from "../../../src/contexts/Sync";
import { request } from "../../../src/api/client";
export default function Profile() {
  const { user, logout, message, verify } = useSession(),
    { items } = useSync();
  const [result, setResult] = useState<any>(),
    [error, setError] = useState<any>();
  async function health() {
    try {
      setResult(await request("/health", { public: true }));
      setError(undefined);
    } catch (e) {
      setError(e);
    }
  }
  return (
    <Page title="Account">
      <Card>
        <Detail data={user} />
      </Card>
      <ErrorMessage error={message || error} />
      <Label>
        Backend: {process.env.EXPO_PUBLIC_API_URL || "Not configured"}
      </Label>
      <Button
        secondary
        title="Test API connection"
        onPress={() => void health()}
      />
      {result && <Detail data={result} />}
      <Button secondary title="Verify session" onPress={() => void verify()} />
      <Button
        title="Sign out"
        onPress={() =>
          void (async () => {
            if (
              await confirm(
                "Sign out?",
                `${items.filter((i) => i.status !== "synced").length} pending field records stay on this device for this account. Sign in again to synchronize them.`,
              )
            ) {
              try {
                await logout();
              } catch (e) {
                setError(e);
              }
            }
          })()
        }
      />
    </Page>
  );
}
