import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateMeetingPlan,
  validateImpactSummary,
  nearbyEvents,
  generateMeetingPlan,
} from "./providers.js";
test("meeting drafts reject unsupported evidence and cross-organization output", () => {
  const input = { organizationId: "org", transcript: "Goal: Assemble 20 kits" };
  const result = {
    organizationId: "org",
    goals: [{ text: "Assemble kits", evidence: "Goal: Assemble 20 kits" }],
    actions: [],
    deadlines: [],
    partnerships: [],
    funding: [],
    responsibilities: [],
  };
  assert.equal(validateMeetingPlan(result, input).goals.length, 1);
  assert.throws(() =>
    validateMeetingPlan({ ...result, organizationId: "other" }, input),
  );
  assert.throws(() =>
    validateMeetingPlan(
      {
        ...result,
        goals: [{ text: "Invented", evidence: "Confirmed $10,000" }],
      },
      input,
    ),
  );
});
test("impact summaries reference only scoped records", () => {
  const input = {
    organizationId: "org",
    report: { sourceRecordIds: ["event-a", "hours-a"] },
  };
  assert.equal(
    validateImpactSummary(
      {
        organizationId: "org",
        summary: "Two hours approved.",
        evidenceRecordIds: ["hours-a"],
      },
      input,
    ).summary,
    "Two hours approved.",
  );
  assert.throws(() =>
    validateImpactSummary(
      {
        organizationId: "org",
        summary: "Foreign hours",
        evidenceRecordIds: ["foreign-hours"],
      },
      input,
    ),
  );
});
test("nearby lookup filters distances and excludes unknown coordinates", () => {
  const list = nearbyEvents(
    [
      { id: "near", latitude: 25.7617, longitude: -80.1918 },
      { id: "far", latitude: 26.1224, longitude: -80.1373 },
      { id: "missing" },
    ],
    { latitude: 25.7617, longitude: -80.1918, radiusKm: 10 },
  );
  assert.deepEqual(
    list.map((e) => e.id),
    ["near"],
  );
  assert.equal(list[0].distanceKm, 0);
  assert.throws(() => nearbyEvents([], { latitude: 0, longitude: 0 }));
});
test("unconfigured AI makes no provider request", async () => {
  const oldUrl = process.env.VOLUNTEERU_AI_URL,
    oldKey = process.env.VOLUNTEERU_AI_KEY;
  delete process.env.VOLUNTEERU_AI_URL;
  delete process.env.VOLUNTEERU_AI_KEY;
  try {
    await assert.rejects(
      generateMeetingPlan({ organizationId: "org", transcript: "Goal: Help" }),
      /not configured/,
    );
  } finally {
    if (oldUrl !== undefined) process.env.VOLUNTEERU_AI_URL = oldUrl;
    if (oldKey !== undefined) process.env.VOLUNTEERU_AI_KEY = oldKey;
  }
});
