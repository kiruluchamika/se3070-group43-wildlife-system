import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { request, setSessionToken } from "../../src/api/client";
import { calculateStatistics } from "../../src/features/analytics/calculations/calculateStatistics";
import { calculateVisualizations } from "../../src/features/analytics/calculations/calculateVisualizations";
import { reportSaveBody } from "../../src/features/analytics/calculations/reportSnapshot";
const require = createRequire(import.meta.url);
const { createApp } = require("../../../backend/src/app");
const {
  createContainer,
  createRepositories,
} = require("../../../backend/src/container");
const {
  createTransactionRunner,
} = require("../../../backend/src/config/database");
const { loadConfig } = require("../../../backend/src/config/env");
const {
  connectTestDatabase,
} = require("../../../backend/src/test-support/memory-db");
const {
  createPasswordHasher,
} = require("../../../backend/src/shared/security/password-hasher");
const {
  createSmsGateway,
} = require("../../../backend/src/modules/notifications/sms-gateway");
let db: any,
  server: any,
  parkId: string,
  zoneId: string,
  teamId: string,
  managerId: string;
const password = "Mobile-test-only-123!";
async function login(role: string) {
  setSessionToken(null);
  const session = await request("/auth/login", {
    method: "POST",
    public: true,
    body: { email: `mobile-${role}@example.test`, password },
  });
  setSessionToken(session.token);
  return session.user;
}
beforeAll(async () => {
  if (!process.env.MONGO_TEST_URI)
    throw new Error(
      "Integration requires the isolated MongoDB replica set; no production database fallback is allowed.",
    );
  db = await connectTestDatabase("mobile-workflows");
  const m = db.models;
  const park = await m.Park.create({
    code: "MOBILE",
    name: "Mobile test park",
  });
  parkId = String(park._id);
  const zone = await m.Zone.create({
    park: park._id,
    code: "WEST",
    name: "West",
    targetWeeklyPatrolHours: 14,
    boundary: {
      type: "Polygon",
      coordinates: [
        [
          [81.2, 6.3],
          [81.3, 6.3],
          [81.3, 6.4],
          [81.2, 6.4],
          [81.2, 6.3],
        ],
      ],
    },
  });
  zoneId = String(zone._id);
  const passwordHash = await createPasswordHasher().hash(password);
  const users: any = {};
  for (const role of [
    "villager",
    "ranger",
    "liaison-officer",
    "park-manager",
    "data-analyst",
  ])
    users[role] = await m.User.create({
      name: `Mobile ${role}`,
      email: `mobile-${role}@example.test`,
      role,
      passwordHash,
      park: park._id,
      isActive: true,
    });
  managerId = String(users["park-manager"]._id);
  const team = await m.RangerTeam.create({
    park: park._id,
    code: "MOBILE",
    name: "Mobile ranger team",
    status: "available",
    members: [users.ranger._id],
    lastKnownLocation: { lat: 6.35, lng: 81.25 },
  });
  teamId = String(team._id);
  await m.User.updateOne(
    { _id: users.ranger._id },
    { $set: { team: team._id } },
  );
  const config = loadConfig({ JWT_SECRET: "mobile-integration-test-secret" }),
    container = createContainer({
      config,
      repositories: createRepositories(m),
      transactionRunner: createTransactionRunner(db.connection),
      smsGateway: createSmsGateway({ logger: {} }),
    });
  const app = createApp({
    config,
    routes: container.routes,
    logger: { error: () => {} },
  });
  server = await new Promise<any>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  process.env.EXPO_PUBLIC_API_URL = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(async () => {
  setSessionToken(null);
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((e: any) => (e ? reject(e) : resolve())),
    );
  await db?.disconnect();
});
describe("mobile HTTP client against unchanged Express + isolated MongoDB", () => {
  it("UC01: submits, validates, deploys, acknowledges, records an idempotent action and resolves", async () => {
    await login("villager");
    const { report } = await request("/conflicts", {
      method: "POST",
      body: {
        parkId,
        conflictType: "elephant-sighting",
        village: "Test village",
        landmark: "Test water tank",
        occurredAt: new Date(Date.now() - 60000).toISOString(),
        description: "Mobile integration elephant sighting",
        contactName: "Test villager",
        contactPhone: "0711234567",
        location: { lat: 6.35, lng: 81.25 },
      },
    });
    expect(report.reference).toMatch(/^HEC-/);
    await login("liaison-officer");
    await request(`/conflicts/${report.id}/validation`, {
      method: "PATCH",
      body: { decision: "valid", priority: "medium" },
    });
    const { task } = await request(`/conflicts/${report.id}/deployments`, {
      method: "POST",
      body: { teamId, instructions: "Mobile test response" },
    });
    await login("ranger");
    await request(`/response-tasks/${task.id}/acknowledge`, {
      method: "PATCH",
    });
    const action = {
      clientUpdateId: randomUUID(),
      type: "arrived-on-site",
      recordedAt: new Date().toISOString(),
      recordedOffline: true,
    };
    await request(`/response-tasks/${task.id}/actions`, {
      method: "POST",
      body: action,
    });
    expect(
      (
        await request(`/response-tasks/${task.id}/actions`, {
          method: "POST",
          body: action,
        })
      ).duplicate,
    ).toBe(true);
    await request(`/response-tasks/${task.id}/complete`, {
      method: "PATCH",
      body: {
        clientUpdateId: randomUUID(),
        outcome: "elephant-driven-away",
        completedAt: new Date().toISOString(),
      },
    });
    await login("liaison-officer");
    await request(`/conflicts/${report.id}/review`, {
      method: "PATCH",
      body: { result: "resolved" },
    });
    await login("villager");
    expect((await request(`/conflicts/${report.id}`)).report.status).toBe(
      "resolved",
    );
  });
  it("UC03: replays a photo incident without duplicate records or alerts", async () => {
    await login("ranger");
    const body = {
      clientId: randomUUID(),
      parkId,
      zoneId,
      type: "snare",
      severity: "high",
      description: "Mobile integration snare evidence",
      observedAt: new Date().toISOString(),
      deviceCreatedAt: new Date().toISOString(),
      recordedOffline: true,
      photos: [
        {
          caption: "Test evidence",
          dataUrl: "data:image/jpeg;base64," + "A".repeat(100),
        },
      ],
    };
    const first = await request("/incidents", { method: "POST", body });
    const retry = await request("/incidents", { method: "POST", body });
    expect(retry.incident.id).toBe(first.incident.id);
    expect(retry.duplicate).toBe(true);
    expect(
      (await request(`/incidents/${first.incident.id}`)).photos,
    ).toHaveLength(1);
    expect(
      await db.models.Alert.countDocuments({ sourceRef: first.incident.id }),
    ).toBe(1);
  });
  it("UC04: allocates a patrol and reflects ranger acknowledgement and completion", async () => {
    await login("park-manager");
    const coverage = await request(`/patrol/coverage?parkId=${parkId}`);
    expect(coverage.zones[0]).toHaveProperty("priorityScore");
    const { assignment } = await request("/patrol/assignments", {
      method: "POST",
      body: { zoneId, teamId, notes: "Mobile integration patrol" },
    });
    await login("ranger");
    await request(`/patrol/assignments/${assignment.id}/acknowledge`, {
      method: "PATCH",
    });
    expect(
      (await request("/patrol/my-assignment")).assignment.acknowledgedAt,
    ).toBeTruthy();
    await login("park-manager");
    await request(`/patrol/assignments/${assignment.id}/complete`, {
      method: "PATCH",
    });
    expect(
      (await request(`/patrol/decisions?parkId=${parkId}`)).decisions.length,
    ).toBeGreaterThan(0);
  });
  it("UC02: saves computed draft, rejects stale edit, transactionally finalizes and shares", async () => {
    await login("data-analyst");
    const today = new Date(Date.now() + 19800000).toISOString().slice(0, 10),
      dataset = await request(
        `/analytics?parkId=${parkId}&startDate=${today}&endDate=${today}`,
      );
    const result: any = calculateStatistics(dataset),
      analysis = calculateVisualizations(result, dataset);
    const body = reportSaveBody(
      {
        ...result,
        analysis,
        title: "Mobile test analysis",
        findings: "Test observations",
        recommendations: "Monitor",
      },
      randomUUID(),
      "draft",
      undefined,
    );
    const { report } = await request("/reports", { method: "POST", body });
    const edit = {
      title: "Edited mobile draft",
      findings: "Updated",
      recommendations: "Monitor",
      revision: report.revision ?? 0,
    };
    const updated = await request(`/reports/${report.id}`, {
      method: "PATCH",
      body: edit,
    });
    await expect(
      request(`/reports/${report.id}`, {
        method: "PATCH",
        body: { ...edit, title: "Stale edit" },
      }),
    ).rejects.toMatchObject({ code: "DRAFT_CHANGED" });
    const finalized = await request("/reports", {
      method: "POST",
      body: {
        ...body,
        requestId: randomUUID(),
        status: "finalized",
        title: updated.report.title,
        replaceDraft: { id: report.id, revision: updated.report.revision },
      },
    });
    await request(`/reports/${finalized.report.id}/share`, {
      method: "POST",
      body: { recipients: [managerId] },
    });
    await login("park-manager");
    expect(
      (await request(`/reports/${finalized.report.id}`)).report.status,
    ).toBe("finalized");
    expect((await request("/notifications/me")).unreadCount).toBeGreaterThan(0);
  });
});
