import { state, persist } from "./store.js";
import { connected, fetchStudentUpdates } from "./services.js";
// Safe to leave disconnected in a demo. No fabricated server decisions are
// generated: updates must be supplied by the shared authenticated backend.
export function startStudentUpdates(onChange) {
  if (!connected) return;
  let inFlight = false;
  async function sync() {
    if (inFlight || !state.student.onboarded || document.hidden) return;
    inFlight = true;
    try {
      const feed = await fetchStudentUpdates();
      if (feed.studentId !== state.student.id) return;
      const applications = feed.applications.filter(
        (a) =>
          a &&
          a.studentId === feed.studentId &&
          typeof a.id === "string" &&
          typeof a.opportunityId === "string" &&
          ["pending", "approved", "accepted", "rejected", "declined"].includes(
            a.status,
          ) &&
          !Number.isNaN(Date.parse(a.submittedAt)),
      );
      const appIds = new Set(applications.map((a) => a.id));
      const hours = feed.hours.filter(
        (h) =>
          h &&
          h.studentId === feed.studentId &&
          typeof h.id === "string" &&
          appIds.has(h.applicationId) &&
          ["pending", "approved", "needs_corrections"].includes(h.status),
      );
      const shifts = feed.shifts.filter(
        (s) =>
          s &&
          s.studentId === feed.studentId &&
          typeof s.id === "string" &&
          appIds.has(s.applicationId) &&
          !Number.isNaN(Date.parse(s.startsAt)),
      );
      const current = JSON.stringify([
        state.applications,
        state.hours,
        state.shifts,
      ]);
      const merged = [applications, hours, shifts].map((records, index) => {
        const existing = [state.applications, state.hours, state.shifts][index];
        const map = new Map(existing.map((record) => [record.id, record]));
        for (const record of records) map.set(record.id, record);
        return [...map.values()];
      });
      if (JSON.stringify(merged) !== current) {
        [state.applications, state.hours, state.shifts] = merged;
        if (persist()) onChange();
      }
    } catch {
      // Keep the last-known records. A failed refresh must never invent a
      // decision or a message-success notification.
    } finally {
      inFlight = false;
    }
  }
  sync();
  window.addEventListener("focus", sync);
  window.addEventListener("volunteeru:student-ready", sync);
  document.addEventListener("visibilitychange", sync);
  setInterval(sync, 60000);
}
