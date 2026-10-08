import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  apiUrl,
  onExpired,
  query,
  request,
  safeRetry,
  setSessionToken,
} from "../src/api/client";
import {
  canOpen,
  notificationRoute,
  routesFor,
} from "../src/navigation/routes";
import { processQueue, QueueItem } from "../src/storage/queue-core";
beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = "http://localhost:5000/api";
  setSessionToken("test-token");
});
afterEach(() => {
  vi.unstubAllGlobals();
  onExpired(() => {});
});
describe("API contract", () => {
  it("uses bearer auth and actual JSON payloads", async () => {
    const fetch = vi.fn(async () => Response.json({ report: { id: "r" } }));
    vi.stubGlobal("fetch", fetch);
    await request("/conflicts", {
      method: "POST",
      body: { village: "Test village" },
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:5000/api/conflicts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
        body: '{"village":"Test village"}',
      }),
    );
  });
  it("handles 204 and binary PDF responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    await expect(
      request("/notifications/read-all", { method: "PATCH" }),
    ).resolves.toBeUndefined();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("%PDF-1.7", {
            headers: { "content-type": "application/pdf" },
          }),
      ),
    );
    expect(
      new TextDecoder().decode(
        await request("/reports/id/export", { binary: true }),
      ),
    ).toBe("%PDF-1.7");
  });
  it("expires protected sessions and preserves validation details", async () => {
    const expired = vi.fn();
    onExpired(expired);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { message: "Expired", code: "SESSION_EXPIRED" },
          { status: 401 },
        ),
      ),
    );
    await expect(request("/auth/me")).rejects.toMatchObject({
      status: 401,
      code: "SESSION_EXPIRED",
    });
    expect(expired).toHaveBeenCalledOnce();
    expired.mockClear();
    await expect(
      request("/auth/login", { public: true }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(expired).not.toHaveBeenCalled();
  });
  it("normalizes network errors without leaking input", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("sensitive transport text");
      }),
    );
    await expect(request("/auth/me")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      status: 0,
    });
  });
  it("rejects wrong PDF content, invalid config and safely serializes filters", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "no pdf" })),
    );
    await expect(
      request("/reports/id/export", { binary: true }),
    ).rejects.toMatchObject({ code: "INVALID_PDF" });
    expect(() => apiUrl("/api")).toThrow();
    expect(
      query({ parkIds: ["a", "b"], species: "Sri Lankan elephant", empty: "" }),
    ).toBe("?parkIds=a%2Cb&species=Sri%20Lankan%20elephant");
    expect(safeRetry(0, new ApiError("Forbidden", 403))).toBe(false);
    expect(safeRetry(2, new ApiError("Offline"))).toBe(false);
  });
});
describe("role navigation", () => {
  it("guards direct routes as well as menus", () => {
    for (const role of [
      "villager",
      "ranger",
      "liaison-officer",
      "park-manager",
      "data-analyst",
      "administrator",
    ] as const) {
      for (const item of routesFor(role))
        expect(canOpen(item.key, role)).toBe(true);
    }
    expect(canOpen("users", "park-manager")).toBe(false);
    expect(canOpen("analytics", "villager")).toBe(false);
    expect(canOpen("conflicts/new", "ranger")).toBe(false);
    expect(canOpen("incidents/new", "ranger")).toBe(true);
  });
  it("maps actual web notification URLs and rejects external/unauthorized links", () => {
    const id = "123456789012345678901234";
    expect(notificationRoute(`/reports?reportId=${id}`, "park-manager")).toBe(
      `reports/${id}`,
    );
    expect(notificationRoute(`/conflicts/mine?report=${id}`, "villager")).toBe(
      `conflicts/${id}`,
    );
    expect(notificationRoute("/patrol/alerts", "villager")).toBeNull();
    expect(notificationRoute("https://evil.example", "ranger")).toBeNull();
  });
});
describe("durable queue protocol", () => {
  const row = (): QueueItem => ({
    id: "uuid-1",
    owner: "ranger-1",
    path: "/incidents",
    method: "POST",
    payload: { clientId: "uuid-1", photos: [{ dataUrl: "photo" }] },
    status: "queued",
    attempts: 0,
    createdAt: 1,
  });
  function store(initial: QueueItem[]) {
    const rows = new Map(initial.map((r) => [r.id, structuredClone(r)]));
    return {
      rows,
      list: async (owner: string) =>
        [...rows.values()].filter((r) => r.owner === owner),
      put: async (item: QueueItem) => {
        rows.set(item.id, structuredClone(item));
      },
    };
  }
  it("persists sending first, retains photos on lost receipt and retries identical bytes after restart", async () => {
    const db = store([row()]);
    const payloads: string[] = [];
    const send = vi.fn(async (item: QueueItem) => {
      expect(db.rows.get(item.id)?.status).toBe("syncing");
      payloads.push(JSON.stringify(item.payload));
      throw new ApiError("Lost response");
    });
    await processQueue(db, "ranger-1", send, () => true);
    expect(db.rows.get("uuid-1")?.payload.photos).toHaveLength(1);
    const restarted = store([...db.rows.values()]);
    await processQueue(
      restarted,
      "ranger-1",
      async (item) => {
        payloads.push(JSON.stringify(item.payload));
        return { incident: { id: "server-id" }, duplicate: true };
      },
      () => true,
    );
    expect(payloads[0]).toBe(payloads[1]);
    expect(restarted.rows.get("uuid-1")).toMatchObject({
      status: "synced",
      attempts: 2,
      payload: {},
      receipt: { id: "server-id", duplicate: true },
    });
  });
  it("retains permanent failures without automatic retries", async () => {
    const db = store([row()]);
    const send = vi.fn(async () => {
      throw new ApiError("Client ID reused", 409, "CLIENT_ID_REUSED");
    });
    await processQueue(db, "ranger-1", send, () => true);
    await processQueue(db, "ranger-1", send, () => true);
    expect(send).toHaveBeenCalledOnce();
    expect(db.rows.get("uuid-1")).toMatchObject({
      status: "failed",
      payload: row().payload,
    });
  });
  it("does not upload another account’s records or continue after logout", async () => {
    const other = { ...row(), id: "other", owner: "ranger-2" };
    const db = store([row(), other]);
    const send = vi.fn();
    await processQueue(db, "ranger-1", send, () => false);
    expect(send).not.toHaveBeenCalled();
    await processQueue(
      db,
      "ranger-1",
      async () => ({ incident: { id: "s" } }),
      () => true,
    );
    expect(db.rows.get("other")?.status).toBe("queued");
  });
  it("does not send when durable pre-send persistence fails", async () => {
    const send = vi.fn();
    await expect(
      processQueue(
        {
          list: async () => [row()],
          put: async () => {
            throw new Error("Disk full");
          },
        },
        "ranger-1",
        send,
        () => true,
      ),
    ).rejects.toThrow("Disk full");
    expect(send).not.toHaveBeenCalled();
  });
  it('does not complete a task ahead of a permanently rejected action', async()=>{
    const db=store([{...row(),path:'/response-tasks/task1/actions',status:'failed'}, {...row(),id:'completion',path:'/response-tasks/task1/complete',createdAt:2}]);
    const send=vi.fn();await processQueue(db,'ranger-1',send,()=>true);expect(send).not.toHaveBeenCalled();expect(db.rows.get('completion')?.status).toBe('queued');
  });
});
