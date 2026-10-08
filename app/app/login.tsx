import React, { useState } from "react";
import { Redirect } from "expo-router";
import { useSession } from "../src/contexts/Session";
import { Logo } from "../src/components/Logo";
import {
  Button,
  Card,
  ErrorMessage,
  Field,
  Label,
  Page,
  Select,
} from "../src/components/ui";
export default function Login() {
  const { user, login, message } = useSession();
  const [register, setRegister] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<any>();
  if (user) return <Redirect href="/(protected)/(tabs)" />;
  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        throw new Error("Enter a valid email address.");
      if (
        !password ||
        (register && (password.length < 8 || name.trim().length < 2))
      )
        throw new Error(
          "Registration needs a name and a password of at least 8 characters.",
        );
      await login(
        {
          email: email.trim().toLowerCase(),
          password,
          ...(register ? { name: name.trim(), phone: phone.trim() } : {}),
        },
        register,
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="WildGuard">
      <Logo />
      <Label>
        Protect wildlife. Connect communities. Coordinate conservation.
      </Label>
      <Card>
        <Label>
          {register
            ? "Create a villager account"
            : "Sign in to your conservation workspace"}
        </Label>
        <ErrorMessage error={message} />
        {register && (
          <>
            <Field label="Full name" value={name} onChange={setName} />
            <Field
              label="Phone (optional)"
              value={phone}
              onChange={setPhone}
              keyboard="phone-pad"
            />
          </>
        )}
        <Field
          label="Email"
          value={email}
          onChange={setEmail}
          keyboard="email-address"
        />
        <Field
          label="Password"
          value={password}
          onChange={setPassword}
          secure={!visible}
        />
        <Button
          secondary
          title={visible ? "Hide password" : "Show password"}
          onPress={() => setVisible(!visible)}
        />
        <ErrorMessage error={error} />
        <Button
          title={
            busy ? "Signing in…" : register ? "Register as villager" : "Sign in"
          }
          disabled={busy}
          onPress={() => void submit()}
        />
        <Button
          secondary
          title={
            register
              ? "Already registered? Sign in"
              : "Create a villager account"
          }
          onPress={() => {
            setRegister(!register);
            setError(undefined);
          }}
        />
      </Card>
      {__DEV__ && !register && (
        <Card>
          <Label>Development demo accounts — real backend users</Label>
          <Select
            label="Seeded account"
            value={email}
            options={[
              "manager",
              "ranger",
              "liaison",
              "analyst",
              "villager",
            ].map((v) => ({ value: `${v}@wildguard.lk`, label: v }))}
            onChange={setEmail}
          />
          <Label muted>
            Enter the password configured by the backend seed process. Demo
            credentials are never bundled or saved.
          </Label>
        </Card>
      )}
    </Page>
  );
}
