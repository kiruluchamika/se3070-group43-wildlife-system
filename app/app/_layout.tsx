import React from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { SessionProvider } from "../src/contexts/Session";
import { SyncProvider } from "../src/contexts/Sync";
import { safeRetry } from "../src/api/client";
import { colors } from "../src/components/ui";
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: safeRetry, staleTime: 15000 },
    mutations: { retry: false },
  },
});
export default function Layout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <SessionProvider>
          <SyncProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen
                name="login"
                options={{ title: "Welcome to WildGuard" }}
              />
              <Stack.Screen
                name="(protected)"
                options={{ headerShown: false }}
              />
            </Stack>
          </SyncProvider>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
