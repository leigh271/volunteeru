import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  metrics,
  filterProfiles,
  bridgeRecords,
  csvText,
  approveAttendance,
} from "../src/herwell-model.js";
const d = JSON.parse(
  readFileSync(new URL("../public/herwell-demo/dataset.json", import.meta.url)),
);
test("deduplicates 112 submissions into 100 people without losing source history", () => {
  assert.equal(d.profiles.length, 100);
  assert.equal(d.registrations.length, 100);
  assert.equal(d.submissions.length, 112);
  assert.equal(
    d.profiles.reduce((n, p) => n + p.sources.length, 0),
    112,
  );
  assert.equal(new Set(d.profiles.map((p) => p.email)).size, 100);
  assert.equal(new Set(d.profiles.map((p) => p.volunteer_id)).size, 100);
});
test("reconciles turnout and approved hours with canonical evidence", () => {
  const m = metrics(d);
  assert.equal(m.attended, 35);
  assert.equal(m.noShows, 65);
  assert.equal(m.missing, 3);
  assert.equal(m.pending, 2);
  assert.equal(m.approvedHours, 81.76);
  assert.equal(metrics(d, "E001").students, 60);
  assert.equal(metrics(d, "E001").attended, 20);
  assert.equal(metrics(d, "E002").attended, 15);
});
test("school and explicit education classification are preserved", () => {
  assert.equal(d.schools.length, 10);
  assert.equal(
    d.profiles.filter((p) => p.education_level === "High school").length,
    40,
  );
  assert.equal(
    d.profiles.filter((p) => p.education_level === "Undergraduate").length,
    44,
  );
  assert.equal(
    d.profiles.filter((p) => p.education_level === "Graduate").length,
    16,
  );
});
test("missing checkout is unknown and no-show is zero", () => {
  for (const a of d.attendance) {
    if (a.review_status === "pending_missing_checkout") {
      assert.equal(a.calculated_hours, null);
      assert.equal(a.approved_hours, null);
    }
    if (a.attendance_status === "no_show") assert.equal(a.calculated_hours, 0);
  }
});
test("combined filters and date scope use profile records", () => {
  const rows = filterProfiles(d, {
    education: "High school",
    county: "Broward",
    interest: "Period health",
    start: "2026-10-01",
    end: "2026-10-31",
  });
  assert.ok(rows.length > 0);
  assert.ok(
    rows.every(
      (p) =>
        p.education_level === "High school" &&
        p.interests.includes("Period health"),
    ),
  );
  assert.equal(filterProfiles(d, { start: "2027-01-01" }).length, 0);
});
const shared = {
  applications: [{ id: "existing" }],
  hours: [],
  attendanceRecords: [],
  eventDayRecords: [],
  shifts: [],
};
test("adapter preserves existing records and is idempotent", () => {
  const b = bridgeRecords(
    d,
    shared,
    { organizations: [], events: [] },
    { schools: [] },
  );
  const again = bridgeRecords(d, b.shared, b.nonprofits, b.schools, b.archive);
  assert.equal(b.shared.applications.length, 101);
  assert.equal(again.shared.applications.length, 101);
  assert.equal(again.archive.length, 100);
  assert.equal(again.schools.schools.length, 10);
  assert.equal(b.shared.applications[0].id, "existing");
  assert.equal(
    b.shared.hours
      .filter((h) => h.status === "approved")
      .reduce((n, h) => n + Math.round(h.hours * 100), 0),
    8176,
  );
});
test("school rollups include approved hours only", () => {
  const b = bridgeRecords(
    d,
    shared,
    { organizations: [], events: [] },
    { schools: [] },
  );
  assert.equal(
    b.schools.schools
      .flatMap((s) => s.students)
      .reduce((n, s) => n + Math.round(s.hours * 100), 0),
    8176,
  );
  assert.equal(b.shared.hours.length, 32);
  assert.equal(b.shared.hours.filter((h) => h.status === "pending").length, 2);
});
test("task drafts retain exact source evidence, null owners, and null dates", () => {
  for (const t of d.tasks) {
    assert.equal(t.status, "draft");
    assert.ok(
      d.meetings
        .find((m) => m.id === t.evidence.document)
        .text.includes(t.evidence.excerpt),
    );
  }
  const optional = d.tasks.find((t) => t.title.includes("food"));
  assert.equal(optional.owner, null);
  assert.equal(optional.due, null);
});
test("CSV escapes quotes and formula-like cell text", () => {
  const csv = csvText(["Name"], [["=SUM(A1)"], ['a"b']]);
  assert.ok(csv.includes("'=SUM(A1)"));
  assert.ok(csv.includes('a""b'));
});

test("approved corrections synchronize all portal totals and retain source evidence", () => {
  const changed = structuredClone(d);
  const a = changed.attendance.find((a) => a.attendance_id === "ATT002");
  assert.equal(a.approved_hours, null);
  approveAttendance(
    changed,
    "ATT002",
    "2026-11-14T09:00:00-05:00",
    0,
    "Verified mock departure",
    "2026-11-14T17:00:00-05:00",
  );
  assert.equal(a.approved_hours, 2.33);
  assert.equal(metrics(changed).approvedHours, 84.09);
  assert.equal(metrics(changed).missing, 2);
  assert.equal(changed.audit[0].before.approved_hours, null);
  const b = bridgeRecords(
    changed,
    shared,
    { organizations: [], events: [] },
    { schools: [] },
  );
  assert.equal(
    b.shared.hours
      .filter((h) => h.status === "approved")
      .reduce((n, h) => n + Math.round(h.hours * 100), 0),
    8409,
  );
  assert.equal(
    b.schools.schools
      .flatMap((s) => s.students)
      .reduce((n, p) => n + Math.round(p.hours * 100), 0),
    8409,
  );
});
test("hours review rejects no-shows, out-of-shift departures, missing reasons, and excess breaks", () => {
  const changed = structuredClone(d);
  const noShow = changed.attendance.find(
    (a) => a.attendance_status === "no_show",
  );
  assert.throws(() =>
    approveAttendance(
      changed,
      noShow.attendance_id,
      "2026-11-14T09:00:00-05:00",
      0,
      "test",
    ),
  );
  assert.throws(() =>
    approveAttendance(
      changed,
      "ATT002",
      "2026-11-14T10:00:00-05:00",
      0,
      "test",
    ),
  );
  assert.throws(() =>
    approveAttendance(changed, "ATT002", "2026-11-14T09:00:00-05:00", 0, ""),
  );
  assert.throws(() =>
    approveAttendance(
      changed,
      "ATT002",
      "2026-11-14T09:00:00-05:00",
      999,
      "test",
    ),
  );
  assert.equal(metrics(changed).approvedHours, 81.76);
});
