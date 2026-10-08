import React from "react";
import { Redirect, Stack } from "expo-router";
import { useSession } from "../../src/contexts/Session";
import { colors, Loading } from "../../src/components/ui";
export default function Protected() {
  const { loading, user } = useSession();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="work/[...path]"
        options={{ title: "WildGuard workspace" }}
      />
    </Stack>
  );
}
