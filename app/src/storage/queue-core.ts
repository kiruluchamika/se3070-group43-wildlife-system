export interface QueueItem {
  id: string;
  owner: string;
  path: string;
  method: string;
  payload: any;
  status: "queued" | "syncing" | "failed" | "synced";
  attempts: number;
  error?: string;
  createdAt: number;
  receipt?: any;
}
export interface QueueStore {
  list(owner: string): Promise<QueueItem[]>;
  put(item: QueueItem): Promise<void>;
}
/** Serial, owner-scoped processing. Persist before send; immutable id and payload on every retry. */
export async function processQueue(
  store: QueueStore,
  owner: string,
  send: (item: QueueItem) => Promise<any>,
  active: () => boolean,
) {
  const blockedTasks = new Set<string>();
  for (const item of (await store.list(owner)).sort(
    (a, b) => a.createdAt - b.createdAt,
  )) {
    const task = item.path.startsWith("/response-tasks/")
      ? item.path.split("/")[2]
      : null;
    if (task && item.status === "failed") blockedTasks.add(task);
    if (task && blockedTasks.has(task)) continue;
    if (!active() || !["queued", "syncing"].includes(item.status)) continue;
    const sending = {
      ...item,
      status: "syncing" as const,
      attempts: item.attempts + 1,
      error: undefined,
    };
    await store.put(sending);
    if (!active()) {
      await store.put({ ...sending, status: "queued" });
      break;
    }
    try {
      const receipt = await send(sending);
      // Release sensitive payload only AFTER confirmed server receipt.
      await store.put({
        ...sending,
        status: "synced",
        payload: {},
        receipt: {
          id: receipt.incident?.id ?? receipt.task?.id ?? receipt.action?.id,
          duplicate: receipt.duplicate,
        },
      });
    } catch (error: any) {
      const transient =
        !error.status || error.status === 401 || error.status >= 500;
      await store.put({
        ...sending,
        status: transient ? "queued" : "failed",
        error: error.message,
      });
      if (task) blockedTasks.add(task);
      if (transient) break;
    }
  }
}
