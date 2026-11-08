import { state, persist, refresh } from "./store.js";
import { readNonprofits } from "./nonprofit-store.js";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const records = () =>
  Array.isArray(state.eventDayRecords) ? state.eventDayRecords : [];
function assignments() {
  const events = readNonprofits().events;
  return state.applications
    .filter(
      (a) =>
        a.studentId === state.student.id &&
        ["approved", "accepted"].includes(a.status),
    )
    .map((application) => ({
      application,
      event: events.find((e) => e.id === application.opportunityId),
      shift: state.shifts.find(
        (s) =>
          s.studentId === application.studentId &&
          s.applicationId === application.id &&
          s.status === "confirmed",
      ),
    }))
    .filter(
      ({ event, shift }) =>
        event &&
        shift &&
        Number.isFinite(Date.parse(event.startsAt)) &&
        Number(event.hours) > 0,
    );
}
const ownRecord = (a) =>
  records().find(
    (r) =>
      r.studentId === state.student.id &&
      r.applicationId === a.application.id &&
      r.eventId === a.event.id,
  );
const dateLabel = (value) => new Date(value).toLocaleString();
const windowEnd = (event) =>
  Date.parse(event.startsAt) + Number(event.hours) * 3600000;
function summary(record) {
  if (!record) return "Not checked in";
  if (!record.checkOutAt) return `Checked in ${dateLabel(record.checkInAt)}`;
  const submitted = state.hours.find(
    (h) =>
      h.eventDayRecordId === record.id &&
      h.studentId === record.studentId &&
      h.applicationId === record.applicationId,
  );
  const status =
    {
      approved: "coordinator approved",
      needs_corrections: "corrections requested",
      rejected: "not approved",
    }[submitted?.status] || "pending coordinator review";
  return `Checked out ${dateLabel(record.checkOutAt)} · ${record.calculatedHours} calculated hours · ${status}`;
}
export function eventDayMarkup() {
  const list = assignments();
  return `<section class="journey-panel event-day-panel"><div class="eyebrow">SHOW UP. GIVE BACK. REFLECT.</div><h2>Your event day</h2><p>Check in and out for confirmed nonprofit shifts, then document what you did.</p><p class="demo-notice">Digital check-in is a local demo time record, not verified identity or attendance. Only the scheduled interval counts. A coordinator reviews attendance and approves hours separately.</p>${
    list.length
      ? list
          .map((a) => {
            const record = ownRecord(a),
              start = Date.parse(a.event.startsAt),
              end = windowEnd(a.event),
              now = Date.now(),
              canIn = now >= start && now <= end + 2 * 3600000;
            return `<article class="event-day-card" data-event-day-card="${esc(a.application.id)}"><h3>${esc(a.event.title)}</h3><p>${esc(dateLabel(a.event.startsAt))} · ${esc(a.event.city)} · ${esc(a.event.hours)} scheduled hours</p><p class="event-day-state">${esc(summary(record))}</p>${!record ? `<button class="primary" data-event-checkin="${esc(a.application.id)}" ${canIn ? "" : "disabled"}>Check in for event</button>${canIn && now >= end ? "<p><small>The scheduled event has ended. A late check-in records your visit but earns no scheduled volunteer time.</small></p>" : ""}${!canIn ? `<p><small>${now < start ? "Check-in opens when the event starts." : "The check-in window has closed."}</small></p>` : ""}` : `<form data-event-day-reflection="${esc(a.application.id)}"><label>Activities completed<textarea aria-label="Activities completed" name="activities" maxlength="1000" rows="3" placeholder="Describe how you helped.">${esc(record.activities)}</textarea></label><label>Event notes<textarea aria-label="Event notes" name="notes" maxlength="1000" rows="2" placeholder="What did you learn or notice?">${esc(record.notes)}</textarea></label><label>Feedback for the coordinator<textarea aria-label="Feedback for the coordinator" name="feedback" maxlength="1000" rows="2" placeholder="Suggestions for the next event.">${esc(record.feedback)}</textarea></label><div class="event-day-actions"><button class="secondary" type="submit">Save event reflection</button>${!record.checkOutAt ? '<button class="primary" type="submit" name="checkout" value="yes">Check out & submit hours</button>' : ""}</div></form>`}<p role="status" data-event-day-status="${esc(a.application.id)}"></p></article>`;
          })
          .join("")
      : '<div class="journey-empty">Your approved, confirmed nonprofit shifts will appear here. Applying alone does not enable event check-in.</div>'
  }</section>`;
}
function feedback(applicationId, text) {
  document
    .querySelector(`[data-event-day-status="${CSS.escape(applicationId)}"]`)
    ?.replaceChildren(document.createTextNode(text));
}
export function bindEventDay(render) {
  document.querySelectorAll("[data-event-checkin]").forEach((button) =>
    button.addEventListener("click", () => {
      const id = button.dataset.eventCheckin;
      refresh();
      const assignment = assignments().find((a) => a.application.id === id);
      if (!assignment)
        return feedback(
          id,
          "This event needs an approved registration and confirmed shift.",
        );
      const now = Date.now(),
        start = Date.parse(assignment.event.startsAt),
        end = windowEnd(assignment.event);
      if (now < start || now > end + 2 * 3600000)
        return feedback(
          id,
          "Check-in is available from the event start until two hours after its end.",
        );
      if (ownRecord(assignment)) {
        render();
        return;
      }
      state.eventDayRecords ||= [];
      state.eventDayRecords.push({
        id: crypto.randomUUID(),
        studentId: state.student.id,
        applicationId: id,
        eventId: assignment.event.id,
        checkInAt: new Date(now).toISOString(),
        checkOutAt: null,
        calculatedHours: null,
        activities: "",
        notes: "",
        feedback: "",
        submittedAt: null,
        isDemo: true,
      });
      if (persist()) {
        render();
        feedback(
          id,
          "Checked in on this device. Remember to check out and submit your reflection.",
        );
      }
    }),
  );
  document.querySelectorAll("[data-event-day-reflection]").forEach((form) =>
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const id = form.dataset.eventDayReflection,
        values = new FormData(form),
        checkingOut = event.submitter?.name === "checkout";
      refresh();
      const assignment = assignments().find((a) => a.application.id === id),
        record = assignment && ownRecord(assignment);
      if (!record)
        return feedback(
          id,
          "This registration no longer has a confirmed shift. Ask your coordinator for help.",
        );
      const draft = {
        activities: String(values.get("activities") || "").trim(),
        notes: String(values.get("notes") || "").trim(),
        feedback: String(values.get("feedback") || "").trim(),
      };
      if (Object.values(draft).some((v) => v.length > 1000))
        return feedback(
          id,
          "Keep each reflection field within 1,000 characters.",
        );
      if (checkingOut && !record.checkOutAt) {
        const now = Date.now(),
          checkin = Date.parse(record.checkInAt);
        if (!Number.isFinite(checkin) || now <= checkin)
          return feedback(
            id,
            "Check-out must happen after your check-in time.",
          );
        const existing = state.hours.find(
          (h) =>
            h.studentId === state.student.id &&
            h.applicationId === id &&
            (h.eventDayRecordId === record.id ||
              (h.date === assignment.event.date && h.status !== "rejected")),
        );
        if (existing && existing.eventDayRecordId !== record.id) {
          Object.assign(record, draft);
          persist();
          return feedback(
            id,
            "You already submitted hours for this event date. Ask the coordinator to resolve that submission before checking out. Your check-in and reflection are retained.",
          );
        }
        const elapsed = Math.max(
          0,
          Math.min(now, windowEnd(assignment.event)) -
            Math.max(checkin, Date.parse(assignment.event.startsAt)),
        );
        const hours = Math.round((elapsed / 3600000) * 10000) / 10000;
        Object.assign(record, draft, {
          checkOutAt: new Date(now).toISOString(),
          calculatedHours: hours,
          submittedAt: new Date(now).toISOString(),
        });
        if (!existing)
          state.hours.push({
            id: crypto.randomUUID(),
            studentId: state.student.id,
            applicationId: id,
            eventDayRecordId: record.id,
            eventId: assignment.event.id,
            date: assignment.event.date,
            hours,
            description:
              draft.activities ||
              "Digital event-day check-in and check-out record; coordinator review required.",
            status: "pending",
            submittedAt: record.submittedAt,
            isDemo: true,
          });
      } else Object.assign(record, draft);
      if (persist()) {
        render();
        feedback(
          id,
          checkingOut
            ? "Checked out. Calculated time was submitted for coordinator review; it is not approved hours."
            : "Event reflection saved on this device.",
        );
      }
    }),
  );
}
export function eventDayNotifications(now = Date.now()) {
  return assignments().flatMap((a) => {
    const r = ownRecord(a),
      end = windowEnd(a.event);
    if (!r || r.checkOutAt || now < end) return [];
    return [
      {
        id: `event-day-checkout:${r.id}`,
        kind: "Check-out reminder",
        text: `Remember to check out of ${a.event.title} and submit your event reflection. Hours require coordinator approval.`,
        isDemo: true,
        opportunityId: a.event.id,
      },
    ];
  });
}
