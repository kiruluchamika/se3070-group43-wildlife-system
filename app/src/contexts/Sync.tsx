import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { randomUUID } from "expo-crypto";
import { useSession } from "./Session";
import { queueStore } from "../storage/database";
import { processQueue, QueueItem } from "../storage/queue-core";
import { request } from "../api/client";
import { useRefresh } from "../hooks/data";
const Context = createContext<{
  items: QueueItem[];
  error: string;
  sync: () => Promise<void>;
  enqueue: (path: string, payload: any, method?: string) => Promise<void>;
  retry: (id: string) => Promise<void>;
}>(null!);
export const useSync = () => useContext(Context);
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user, offline } = useSession();
  const [items, setItems] = useState<QueueItem[]>([]),
    [error, setError] = useState("");
  const active = useRef(user?.id),
    busy = useRef(false);
  useEffect(() => {
    active.current = user?.id;
    return () => {
      active.current = undefined;
    };
  }, [user?.id]);
  const refresh = useRefresh();
  const ownerId = user?.id;
  const load = useCallback(async () => {
    if (ownerId) {
      const rows = await queueStore.list(ownerId);
      if (active.current === ownerId) setItems(rows);
    }
  }, [ownerId]);
  const sync = useCallback(async () => {
    if (
      !ownerId ||
      offline ||
      busy.current ||
      AppState.currentState === "background"
    )
      return;
    busy.current = true;
    const owner = ownerId;
    try {
      const pending = (await queueStore.list(owner)).some((item) =>
        ["queued", "syncing"].includes(item.status),
      );
      if (!pending) return;
      await processQueue(
        queueStore,
        owner,
        (item) =>
          request(item.path, { method: item.method, body: item.payload }),
        () => active.current === owner,
      );
      await load();
      await refresh();
      setError("");
    } catch (e: any) {
      setError(
        `Local queue error: ${e.message}. Your saved records are retained.`,
      );
    } finally {
      busy.current = false;
    }
  }, [ownerId, offline, load, refresh]);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  useEffect(() => {
    const initial = setTimeout(() => void sync(), 0);
    const timer = setInterval(() => void sync(), 30000);
    const listener = AppState.addEventListener("change", (s) => {
      if (s === "active") void sync();
    });
    return () => {
      clearInterval(timer);
      clearTimeout(initial);
      listener.remove();
    };
  }, [sync]);
  async function enqueue(path: string, payload: any, method = "POST") {
    if (!user || user.role !== "ranger")
      throw new Error("Sign in as a ranger to save field records.");
    if (
      path !== "/incidents" &&
      !/^\/response-tasks\/[a-f\d]{24}\/(actions|complete)$/.test(path)
    )
      throw new Error("This operation does not support offline retries.");
    const id = payload.clientId ?? payload.clientUpdateId ?? randomUUID();
    const body =
      path === "/incidents"
        ? { ...payload, clientId: id }
        : { ...payload, clientUpdateId: id };
    await queueStore.put({
      id,
      owner: user.id,
      path,
      method,
      payload: body,
      status: "queued",
      attempts: 0,
      createdAt: Date.now(),
    });
    await load();
    void sync();
  }
  async function retry(id: string) {
    if (!user) return;
    const item = (await queueStore.list(user.id)).find((i) => i.id === id);
    if (item && item.status !== "synced") {
      await queueStore.put({ ...item, status: "queued" });
      await load();
      await sync();
    }
  }
  return (
    <Context.Provider
      value={{
        items: items.filter((item) => item.owner === ownerId),
        error,
        sync,
        enqueue,
        retry,
      }}
    >
      {children}
    </Context.Provider>
  );
}
