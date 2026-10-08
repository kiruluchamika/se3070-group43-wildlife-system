import React, { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SessionProvider, useSession } from "../src/contexts/Session";
import { useRefresh } from "../src/hooks/data";
const mocks = vi.hoisted(() => ({
  secure: new Map<string, string>(),
  clearCache: vi.fn(async () => {}),
  network: null as any,
}));
vi.mock("expo-secure-store", () => ({
  getItemAsync: async (k: string) => mocks.secure.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => {
    mocks.secure.set(k, v);
  },
  deleteItemAsync: async (k: string) => {
    mocks.secure.delete(k);
  },
}));
vi.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: () => ({ remove: () => {} }),
  },
}));
vi.mock("@react-native-community/netinfo", () => ({
  default: {
    addEventListener: (fn: any) => {
      mocks.network = fn;
      return () => {};
    },
  },
}));
vi.mock("../src/storage/database", () => ({
  clearCache: mocks.clearCache,
  cacheGet: async () => null,
  cachePut: async () => {},
}));
let root: any, current: ReturnType<typeof useSession>, refresh: any;
function Probe() {
  const session = useSession(),
    invalidate = useRefresh();
  useEffect(() => {
    current = session;
    refresh = invalidate;
  }, [session, invalidate]);
  return null;
}
beforeEach(() => {
  mocks.secure.clear();
  mocks.clearCache.mockClear();
  process.env.EXPO_PUBLIC_API_URL = "http://localhost:5000/api";
  // Real React hooks/effects with a null-output host. This is not a device rendering test.
  const document: any = {
    nodeType: 9,
    activeElement: null,
    addEventListener() {},
    removeEventListener() {},
    documentElement: { namespaceURI: "http://www.w3.org/1999/xhtml" },
  };
  const window = { document, HTMLIFrameElement: class {} };
  document.defaultView = window;
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", window);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  root = createRoot({
    nodeType: 1,
    nodeName: "DIV",
    tagName: "DIV",
    ownerDocument: document,
    namespaceURI: "http://www.w3.org/1999/xhtml",
    addEventListener() {},
    removeEventListener() {},
    textContent: "",
  } as any);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});
async function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <SessionProvider>
          <Probe />
        </SessionProvider>
      </QueryClientProvider>,
    ),
  );
  return client;
}
it("authenticates, securely persists JWT, invalidates query data and clears session caches on logout", async () => {
  const user = {
    id: "ranger1",
    name: "Ranger",
    email: "ranger@example.test",
    role: "ranger",
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ token: "signed-jwt", user })),
  );
  const client = await mount();
  expect(current!.loading).toBe(false);
  expect(current!.user).toBeNull();
  await act(async () =>
    current!.login({ email: user.email, password: "never-persist-this" }),
  );
  expect(current!.user).toEqual(user);
  expect(mocks.secure.get("wildguard.session")).toContain("signed-jwt");
  expect(mocks.secure.get("wildguard.session")).not.toContain(
    "never-persist-this",
  );
  client.setQueryData(["ranger1", "/response-tasks/mine"], { tasks: [] });
  await act(async () => refresh());
  expect(
    client.getQueryState(["ranger1", "/response-tasks/mine"])?.isInvalidated,
  ).toBe(true);
  await act(async () => current!.logout());
  expect(current!.user).toBeNull();
  expect(mocks.secure.size).toBe(0);
  expect(client.getQueryCache().getAll()).toHaveLength(0);
  expect(mocks.clearCache).toHaveBeenCalledOnce();
});
it("restores an offline identity, then rejects the session when the server returns 401", async () => {
  const user = { id: "ranger1", name: "Ranger", role: "ranger" };
  mocks.secure.set(
    "wildguard.session",
    JSON.stringify({ token: "old-jwt", user }),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("Offline");
    }),
  );
  await mount();
  expect(current!.user?.id).toBe("ranger1");
  expect(current!.message).toContain("Cannot reach");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        { message: "Expired", code: "SESSION_EXPIRED" },
        { status: 401 },
      ),
    ),
  );
  await act(async () => current!.verify());
  expect(current!.user).toBeNull();
  expect(mocks.secure.size).toBe(0);
  expect(current!.message).toContain("expired");
});
