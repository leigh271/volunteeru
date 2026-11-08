import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { scopedImpactReport } from "./report-scope.js";
test("impact report filters restrict events, registrations, approved hours and all source ids", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`CREATE TABLE events(id TEXT,title TEXT,date TEXT,status TEXT,organization_id TEXT);CREATE TABLE applications(id TEXT,event_id TEXT,status TEXT);CREATE TABLE hours(id TEXT,application_id TEXT,hours REAL,status TEXT);
 INSERT INTO events VALUES('nov','November','2026-11-10','published','ours'),('dec','December','2026-12-10','published','ours'),('other','Other org','2026-11-10','published','theirs');
 INSERT INTO applications VALUES('anov','nov','approved'),('adec','dec','approved'),('arejected','nov','rejected'),('aother','other','approved');
 INSERT INTO hours VALUES('hnov','anov',2,'approved'),('hdec','adec',9,'approved'),('hbad','arejected',10,'approved'),('hpending','anov',5,'pending'),('hother','aother',50,'approved');`);
    const report = scopedImpactReport(db, "ours", { month: "2026-11" });
    assert.equal(report.approvedHours, 2);
    assert.deepEqual(
      report.sourceRecordIds.sort(),
      ["nov", "anov", "arejected", "hnov"].sort(),
    );
    assert.equal(report.totals.events, 1);
    assert.equal(
      scopedImpactReport(db, "ours", { eventId: "dec" }).approvedHours,
      9,
    );
    assert.throws(() => scopedImpactReport(db, "ours", { eventId: "other" }), {
      status: 400,
    });
    assert.throws(() => scopedImpactReport(db, "ours", { month: "2026-99" }), {
      status: 400,
    });
    assert.throws(
      () =>
        scopedImpactReport(db, "ours", { month: "2026-11", eventId: "dec" }),
      { status: 400 },
    );
  } finally {
    db.close();
  }
});
