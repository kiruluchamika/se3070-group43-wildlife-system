import React from "react";
import { Page, Button, Label } from "../../../src/components/ui";
import { useSession } from "../../../src/contexts/Session";
import { routesFor } from "../../../src/navigation/routes";
import { openWork } from "../../../src/navigation/open";
export default function Workspace() {
  const { user } = useSession();
  return (
    <Page title="Your workspace">
      <Label>Tools for {user!.name}</Label>
      {routesFor(user!.role).map((m) => (
        <Button
          key={m.key}
          secondary
          title={m.title}
          onPress={() => openWork(m.key)}
        />
      ))}
    </Page>
  );
}
