import { approveAttendance } from "./herwell-model.js";
import { MAYA_EVENT } from "./flowers-event.js";

// Explicit future-data presentation scenario; never overwrites recorded attendance.
export function seedEventAttendanceDemo(d) {
  if (d.eventAttendanceDemoVersion === 2) return false;
  const e = d.events.find((e) => e.id === MAYA_EVENT.id);
  if (!e) return false;
  for (const id of ["VOL002", "VOL003", "VOL004", "VOL005"]) {
    if (d.registrations.filter((r) => r.event_id === e.id).length >= 8) break;
    if (
      d.registrations.some((r) => r.event_id === e.id && r.volunteer_id === id)
    )
      continue;
    const p = d.profiles.find((p) => p.volunteer_id === id);
    if (!p) continue;
    const template = d.registrations.find((r) => r.event_id === e.id);
    d.registrations.push({
      ...template,
      id: `${id}:${e.id}:${template.shift_id}`,
      volunteer_id: id,
      school_id: p.school_id,
      source: "Simulated event-day demo",
      submission_ids: [],
    });
  }
  for (const [id, arrival, departure] of [
    ["MAYA-CHEN", "10:00", "12:00"],
    ["ANA-RAMIREZ", "10:07", null],
    ["KAI-THOMPSON", "10:12", null],
    ["JORDAN-JAMES", null, null],
    ["VOL002", "10:05", "12:00"],
    ["VOL003", "10:10", "12:00"],
    ["VOL004", null, null],
    ["VOL005", null, null],
  ]) {
    if (d.attendance.some((a) => a.event_id === e.id && a.volunteer_id === id))
      continue;
    const r = d.registrations.find(
      (r) => r.event_id === e.id && r.volunteer_id === id,
    );
    if (!r) continue;
    d.attendance.push({
      attendance_id: `DEMO-ATT-${e.id}-${id}`,
      volunteer_id: id,
      school_id: r.school_id,
      event_id: e.id,
      shift_id: r.shift_id,
      role: r.role,
      program_category: r.program_category,
      scheduled_start: r.scheduled_start,
      scheduled_end: r.scheduled_end,
      attendance_status: arrival ? "attended" : "not_checked_in",
      actual_check_in: arrival ? `${e.date}T${arrival}:00-05:00` : null,
      actual_check_out: departure ? `${e.date}T${departure}:00-05:00` : null,
      unpaid_break_minutes: 0,
      calculated_hours: departure ? 2 : null,
      approved_hours: null,
      review_status: departure ? "pending_coordinator_review" : "pending",
      record_source: "Simulated event-day demo",
      follow_up_note: "",
    });
  }
  for (const a of d.attendance.filter(
    (a) =>
      a.event_id === e.id &&
      ["MAYA-CHEN", "VOL002", "VOL003"].includes(a.volunteer_id) &&
      a.actual_check_out,
  )) {
    a.checkin_review = "approved";
    if (a.review_status !== "approved")
      approveAttendance(
        d,
        a.attendance_id,
        a.actual_check_out,
        0,
        "Approved fictional event-day example",
      );
    a.checkout_approved_at ||= "2026-11-21T12:30:00-05:00";
    a.checkout_approved_by ||= "Demo coordinator";
  }
  d.eventAttendanceDemoVersion = 2;
  return true;
}

export function approveRecordedCheckout(d, id, now = new Date().toISOString()) {
  const a = d.attendance.find((a) => a.attendance_id === id);
  if (!a?.actual_check_in || !a.actual_check_out)
    throw Error("A recorded check-in and checkout are required.");
  if (a.checkout_approved_at && a.review_status === "approved") return false;
  approveAttendance(
    d,
    id,
    a.actual_check_out,
    a.unpaid_break_minutes || 0,
    "Coordinator approved recorded checkout and service hours",
    now,
  );
  if (a.checkout_reminder) a.checkout_reminder.status = "resolved";
  a.checkout_approved_at = now;
  a.checkout_approved_by = "Demo coordinator";
  (d.audit ||= []).push({
    action: "checkout.approved",
    id,
    actor: "Demo coordinator",
    reviewedAt: now,
    checkout: a.actual_check_out,
  });
  return true;
}

export function eventDayAttendance(d, eventId) {
  const rows = d.attendance.filter((a) => a.event_id === eventId);
  const missing = d.registrations.filter(
    (r) =>
      r.event_id === eventId &&
      !rows.some((a) => a.volunteer_id === r.volunteer_id),
  );
  return [
    ...rows,
    ...missing.map((r) => ({
      ...r,
      actual_check_in: null,
      actual_check_out: null,
    })),
  ];
}

export function reviewArrival(
  d,
  eventId,
  personId,
  now = new Date().toISOString(),
) {
  let a = d.attendance.find(
    (a) => a.event_id === eventId && a.volunteer_id === personId,
  );
  if (!a) {
    const r = d.registrations.find(
      (r) => r.event_id === eventId && r.volunteer_id === personId,
    );
    if (!r) throw Error("Registration required.");
    a = {
      ...r,
      attendance_id: `DEMO-ATT-${eventId}-${personId}`,
      actual_check_in: null,
      actual_check_out: null,
      approved_hours: 0,
      calculated_hours: null,
    };
    d.attendance.push(a);
  }
  if (a.checkin_review) return;
  a.checkin_review = a.actual_check_in ? "approved" : "no_show_approved";
  if (!a.actual_check_in) {
    a.attendance_status = "no_show";
    a.calculated_hours = 0;
    a.approved_hours = 0;
  }
  (d.audit ||= []).push({
    action: "attendance.reviewed",
    id: a.attendance_id,
    status: a.checkin_review,
    reviewedAt: now,
    actor: "Demo coordinator",
  });
}
export function setCheckoutReminder(d, id, dueAt, note) {
  const a = d.attendance.find((a) => a.attendance_id === id);
  if (
    !a?.actual_check_in ||
    a.actual_check_out ||
    !Number.isFinite(Date.parse(dueAt))
  )
    throw Error("Choose a reminder date for a missing checkout.");
  a.checkout_reminder = {
    dueAt,
    note: String(note || ""),
    status: "scheduled",
  };
  (d.audit ||= []).push({
    action: "checkout.reminder_set",
    id,
    dueAt,
    note: a.checkout_reminder.note,
    reviewedAt: new Date().toISOString(),
  });
}
