import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MAYA_EVENT,
  FLOWERS_NAME,
  linkFlowersEvent,
} from "../src/flowers-event.js";
import { bridgeRecords } from "../src/herwell-model.js";
const load = () =>
  JSON.parse(
    readFileSync(
      new URL("../public/herwell-demo/dataset.json", import.meta.url),
    ),
  );
test("Maya and coordinator share the November 21 two-hour event with a confirmed Maya registration", () => {
  const d = load();
  linkFlowersEvent(d);
  const b = bridgeRecords(
    d,
    {},
    { organizations: [], events: [] },
    { schools: [] },
  );
  const event = b.nonprofits.events.find((e) => e.id.endsWith(MAYA_EVENT.id));
  assert.equal(d.organization.name, FLOWERS_NAME);
  assert.equal(event.title, "Community Wellness Day");
  assert.equal(event.date, "2026-11-21");
  assert.equal(event.startsAt, "2026-11-21T10:00:00-05:00");
  assert.equal(event.hours, 2);
  assert.match(event.time, /10:00 AM.*12:00 PM/);
  assert.equal(
    b.shared.applications.find((a) => a.studentId === "herwell:MAYA-CHEN")
      .opportunityId,
    event.id,
  );
  assert.equal(
    d.attendance.filter((a) => a.event_id === MAYA_EVENT.id).length,
    0,
  );
});
test("linking is idempotent, preserves original attendance, and does not invent completed hours", () => {
  const d = load(),
    attendance = structuredClone(d.attendance);
  assert.equal(linkFlowersEvent(d), true);
  assert.equal(linkFlowersEvent(d), false);
  assert.equal(d.events.filter((e) => e.id === MAYA_EVENT.id).length, 1);
  assert.equal(
    d.registrations.filter((r) => r.event_id === MAYA_EVENT.id).length,
    4,
  );
  assert.deepEqual(d.attendance, attendance);
  assert.equal(
    d.profiles.find((p) => p.volunteer_id === "MAYA-CHEN").age,
    null,
  );
});
