import { state } from "./store.js";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const stamp = (v) =>
  v && !Number.isNaN(Date.parse(v))
    ? new Date(v).toLocaleString()
    : "Not recorded";
export function coordinatorDayMarkup(event) {
  const apps = state.applications.filter((a) => a.opportunityId === event.id);
  const records = state.eventDayRecords.filter(
    (r) =>
      r.eventId === event.id &&
      apps.some((a) => a.id === r.applicationId && a.studentId === r.studentId),
  );
  const groups = new Map();
  for (const a of apps) {
    const connection =
      a.studentSnapshot?.schoolConnection ||
      (a.studentId === state.student.id
        ? state.student.schoolConnection
        : null);
    const key = connection?.schoolId || "unlinked";
    if (!groups.has(key))
      groups.set(key, {
        name: connection?.schoolName || "No confirmed school connection",
        applications: [],
        hours: 0,
        attendance: 0,
      });
    const g = groups.get(key);
    g.applications.push(a.id);
    g.hours += state.hours
      .filter(
        (h) =>
          h.status === "approved" &&
          h.studentId === a.studentId &&
          h.applicationId === a.id &&
          Number.isFinite(Number(h.hours)) &&
          Number(h.hours) > 0,
      )
      .reduce((n, h) => n + Number(h.hours), 0);
    if (
      state.attendanceRecords.some(
        (r) =>
          r.status === "present" &&
          r.applicationId === a.id &&
          r.studentId === a.studentId &&
          r.eventId === event.id,
      )
    )
      g.attendance++;
  }
  return `<section class="nonprofit-panel"><h2>Event-day attendance & reflections</h2><p>Check-in records are student-reported in this local demo. Review actual attendance before approving hours. Participant notes remain separate from aggregate impact exports.</p><div class="nonprofit-stats"><article><strong>${records.filter((r) => !r.checkOutAt).length}</strong><span>Currently checked in</span></article><article><strong>${records.filter((r) => r.checkOutAt).length}</strong><span>Completed check-outs</span></article><article><strong>${apps.filter((a) => ["approved", "accepted"].includes(a.status)).length}</strong><span>Assigned volunteers</span></article></div>${
    records
      .map((r) => {
        const a = apps.find((a) => a.id === r.applicationId);
        return `<article class="nonprofit-roster"><h3>${esc(a.studentSnapshot?.name || "Student")}</h3><p>In: ${esc(stamp(r.checkInAt))}<br>Out: ${esc(stamp(r.checkOutAt))}<br>Calculated time: ${esc(r.calculatedHours ?? "In progress")} hours · awaiting review unless approved below</p>${r.activities ? `<p><strong>Activities</strong><br>${esc(r.activities)}</p>` : ""}${r.notes ? `<p><strong>Notes</strong><br>${esc(r.notes)}</p>` : ""}${r.feedback ? `<p><strong>Feedback</strong><br>${esc(r.feedback)}</p>` : ""}</article>`;
      })
      .join("") || "<p>No digital check-ins yet.</p>"
  }<h3>Participation by school</h3>${[...groups.values()].map((g) => `<article class="nonprofit-roster"><h4>${esc(g.name)}</h4><p>${g.applications.length} registrations · ${g.attendance} confirmed attendances · ${g.hours.toFixed(2)} approved hours</p></article>`).join("") || "<p>No school participation yet.</p>"}</section>`;
}
