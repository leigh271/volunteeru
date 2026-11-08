import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { linkFlowersEvent, MAYA_EVENT } from "../src/flowers-event.js";
import {
  seedEventAttendanceDemo,
  approveRecordedCheckout,
  eventDayAttendance,
  reviewArrival,
  setCheckoutReminder,
} from "../src/event-attendance-demo.js";
test("event-day scenario is idempotent with explicit demo approvals, missing departures and reviewed no-shows", () => {
  const d = JSON.parse(
    fs.readFileSync(
      new URL("../public/herwell-demo/dataset.json", import.meta.url),
    ),
  );
  linkFlowersEvent(d);
  seedEventAttendanceDemo(d);
  const rows = eventDayAttendance(d, MAYA_EVENT.id);
  assert.equal(rows.length, 8);
  assert.equal(
    rows.filter((a) => a.actual_check_in && !a.actual_check_out).length,
    2,
  );
  assert.equal(rows.filter((a) => !a.actual_check_in).length, 3);
  const maya = rows.find((a) => a.volunteer_id === "MAYA-CHEN");
  assert.equal(maya.actual_check_out, "2026-11-21T12:00:00-05:00");
  assert.equal(seedEventAttendanceDemo(d), false);
  assert.throws(() =>
    approveRecordedCheckout(
      d,
      rows.find((a) => a.volunteer_id === "ANA-RAMIREZ").attendance_id,
    ),
  );
  assert.equal(maya.approved_hours, 2);
  const ana = rows.find((a) => a.volunteer_id === "ANA-RAMIREZ");
  reviewArrival(d, MAYA_EVENT.id, ana.volunteer_id);
  assert.equal(ana.checkin_review, "approved");
  const jordan = rows.find((a) => a.volunteer_id === "JORDAN-JAMES");
  reviewArrival(d, MAYA_EVENT.id, jordan.volunteer_id);
  assert.equal(jordan.checkin_review, "no_show_approved");
  assert.equal(jordan.approved_hours, 0);
  setCheckoutReminder(
    d,
    ana.attendance_id,
    "2026-11-22T15:00:00Z",
    "Confirm departure and hours",
  );
  assert.equal(ana.checkout_reminder.status, "scheduled");
  assert.throws(() =>
    setCheckoutReminder(d, maya.attendance_id, "2026-11-22T15:00:00Z", ""),
  );
  ana.actual_check_out = "2026-11-21T12:00:00-05:00";
  assert.equal(approveRecordedCheckout(d, ana.attendance_id), true);
  assert.equal(ana.approved_hours, 1.88);
  assert.equal(approveRecordedCheckout(d, maya.attendance_id), false);
  assert.equal(maya.approved_hours, 2);
  assert.equal(
    d.audit.filter((a) => a.action === "checkout.approved").length,
    1,
  );
});
