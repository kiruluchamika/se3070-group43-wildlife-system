import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { calculateStatistics } from "../src/features/analytics/calculations/calculateStatistics";
import { calculateVisualizations } from "../src/features/analytics/calculations/calculateVisualizations";
import { reportSaveBody } from "../src/features/analytics/calculations/reportSnapshot";
const require = createRequire(import.meta.url);
const {
  saveReportBody,
} = require("../../backend/src/modules/analytics/conservation-report.schemas.js");
const park = "123456789012345678901234",
  zone = "123456789012345678901235";
const dataset = {
  filters: {
    parkId: park,
    startDate: "2026-09-01",
    endDate: "2026-09-02",
    incidentType: "",
    species: "",
  },
  park: { id: park, name: "Test park", coveragePolicy: { windowDays: 7 } },
  period: {
    from: "2026-08-31T18:30:00.000Z",
    until: "2026-09-02T18:30:00.000Z",
    timeZone: "Asia/Colombo",
    endExclusive: true,
  },
  retrievedAt: "2026-09-03T00:00:00.000Z",
  zones: [{ id: zone, name: "West", targetWeeklyPatrolHours: 14 }],
  records: {
    alerts: [
      {
        id: "123456789012345678901236",
        eventAt: "2026-09-01T18:40:00.000Z",
        createdAt: "2026-10-01T00:00:00.000Z",
        zone,
      },
    ],
    conflicts: [],
    patrolRecords: [],
  },
  freshness: { requiresConfirmation: false },
};
describe("web/mobile analytics parity", () => {
  it("keeps pure calculators identical to the website", () => {
    for (const file of [
      "calculateStatistics",
      "calculateVisualizations",
      "compareParks",
      "reportSnapshot",
      "supportingRecords",
    ])
      expect(
        readFileSync(
          new URL(
            `../src/features/analytics/calculations/${file}.js`,
            import.meta.url,
          ),
          "utf8",
        ).replace(/\r\n/g, "\n"),
      ).toBe(
        readFileSync(
          new URL(
            `../../frontend/src/features/analytics/lib/${file}.js`,
            import.meta.url,
          ),
          "utf8",
        ).replace(/\r\n/g, "\n"),
      );
  });
  it("uses event time and Sri Lanka date buckets, and produces a backend-valid report", () => {
    const result: any = calculateStatistics(dataset),
      analysis: any = calculateVisualizations(result, dataset);
    expect(result.statistics.totalEventRecords).toBe(1);
    expect(
      analysis.trends.buckets.find((b: any) => b.key === "2026-09-02").alerts,
    ).toBe(1);
    const body = reportSaveBody(
      {
        ...result,
        analysis,
        title: "Conservation report",
        findings: "Observed event",
        recommendations: "Monitor",
      },
      "6f529102-0cdf-44b9-9f83-511a21fd6230",
      "draft",
      undefined,
    );
    expect(saveReportBody.safeParse(body).success).toBe(true);
  });
  it("preserves draft revision for transactional replacement", () => {
    const result: any = calculateStatistics(dataset),
      analysis = calculateVisualizations(result, dataset);
    const body = reportSaveBody(
      {
        ...result,
        analysis,
        title: "Re-analysis",
        findings: "",
        recommendations: "",
      },
      "6f529102-0cdf-44b9-9f83-511a21fd6230",
      "finalized",
      { id: park, revision: 3 },
    );
    expect(body.replaceDraft).toEqual({ id: park, revision: 3 });
    expect(saveReportBody.safeParse(body).success).toBe(true);
  });
});
