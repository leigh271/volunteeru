import { readNonprofits, saveNonprofits } from "./nonprofit-store.js";
import { state } from "./store.js";
import { connected, apiBase } from "./services.js";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const accepted = (a) => ["approved", "accepted"].includes(a.status);
const number = (value) =>
  Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
const unique = (items) => [
  ...new Map(
    items.filter((x) => x && typeof x.id === "string").map((x) => [x.id, x]),
  ).values(),
];
let orgId = null,
  month = "",
  eventId = "",
  aiDraft = null;
function syncFilters(data) {
  if (orgId !== data.activeId) {
    orgId = data.activeId;
    month = "";
    eventId = "";
    aiDraft = null;
  }
  if (
    eventId &&
    !data.events.some((e) => e.id === eventId && e.organizationId === orgId)
  )
    eventId = "";
}
function schoolOf(application) {
  const snapshot = application.studentSnapshot || {};
  const recordedConnection = snapshot.schoolConnection;
  if (recordedConnection?.schoolId && recordedConnection?.schoolName)
    return {
      id: recordedConnection.schoolId,
      name: recordedConnection.schoolName,
      source: "School connection recorded at application",
    };
  if (snapshot.schoolId && snapshot.schoolName)
    return {
      id: snapshot.schoolId,
      name: snapshot.schoolName,
      source: "School connection recorded at application",
    };
  const connection =
    application.studentId === state.student.id
      ? state.student.schoolConnection
      : null;
  if (connection?.schoolId && connection?.schoolName)
    return {
      id: connection.schoolId,
      name: connection.schoolName,
      source: "Current student school connection · local demo",
    };
  return {
    id: `self:${snapshot.school || "Unspecified"}`,
    name: snapshot.school || "Unspecified",
    source: snapshot.school
      ? "Self-reported school · membership unverified"
      : "School not provided",
  };
}
export function buildImpactReport(
  data = readNonprofits(),
  filters = { month, eventId },
) {
  const organization = data.organizations.find((o) => o.id === data.activeId);
  if (!organization) return null;
  const events = unique(
    data.events.filter(
      (e) =>
        e.organizationId === organization.id &&
        (!filters.eventId || e.id === filters.eventId) &&
        (!filters.month ||
          (typeof e.date === "string" && e.date.slice(0, 7) === filters.month)),
    ),
  );
  const ids = new Set(events.map((e) => e.id));
  const applications = unique(
    state.applications.filter((a) => ids.has(a.opportunityId)),
  );
  const acceptedApplications = applications.filter(accepted),
    appMap = new Map(acceptedApplications.map((a) => [a.id, a]));
  const hours = unique(
    state.hours.filter((h) => {
      const a = appMap.get(h.applicationId);
      return (
        a &&
        h.studentId === a.studentId &&
        h.status === "approved" &&
        number(h.hours) > 0
      );
    }),
  );
  const attendance = unique(
    (state.attendanceRecords || []).filter((r) => {
      const a = appMap.get(r.applicationId);
      return (
        a &&
        r.studentId === a.studentId &&
        r.eventId === a.opportunityId &&
        r.status === "present"
      );
    }),
  );
  const presentApps = new Set(attendance.map((r) => r.applicationId));
  const completed = unique(
    (state.eventDayRecords || []).filter((r) => {
      const a = appMap.get(r.applicationId);
      const start = Date.parse(r.checkInAt),
        end = Date.parse(r.checkOutAt);
      return (
        a &&
        r.studentId === a.studentId &&
        r.eventId === a.opportunityId &&
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        end >= start
      );
    }),
  );
  const completedApps = new Set(completed.map((r) => r.applicationId));
  const shifts = unique(
    (state.shifts || []).filter((s) => {
      const a = appMap.get(s.applicationId);
      return a && s.studentId === a.studentId && s.status === "confirmed";
    }),
  );
  const schools = new Map();
  for (const a of acceptedApplications) {
    const school = schoolOf(a);
    if (!schools.has(school.id))
      schools.set(school.id, {
        ...school,
        students: new Set(),
        applications: 0,
        attendance: 0,
        completed: 0,
        hours: 0,
      });
    const row = schools.get(school.id);
    row.students.add(a.studentId);
    row.applications++;
    if (presentApps.has(a.id)) row.attendance++;
    if (completedApps.has(a.id)) row.completed++;
    row.hours += hours
      .filter((h) => h.applicationId === a.id)
      .reduce((sum, h) => sum + number(h.hours), 0);
  }
  const groupedSchools = [...schools.values()].map((s) => ({
    ...s,
    students: s.students.size,
  }));
  const eventRows = events.map((e) => {
    const own = acceptedApplications.filter((a) => a.opportunityId === e.id),
      ownIds = new Set(own.map((a) => a.id));
    return {
      id: e.id,
      title: e.title,
      date: e.date || "Not scheduled",
      status: e.status,
      registrations: applications.filter((a) => a.opportunityId === e.id)
        .length,
      approvedRegistrations: own.length,
      attendance: [...presentApps].filter((id) => ownIds.has(id)).length,
      completedShifts: [...completedApps].filter((id) => ownIds.has(id)).length,
      approvedHours: hours
        .filter((h) => ownIds.has(h.applicationId))
        .reduce((sum, h) => sum + number(h.hours), 0),
      reach: number(e.impact?.reach),
      suppliesDistributed: number(e.impact?.suppliesDistributed),
      outcomes: typeof e.impact?.outcomes === "string" ? e.impact.outcomes : "",
      impactSource: "Coordinator-reported · not independently verified",
      impactReportedAt:
        typeof e.impact?.reportedAt === "string" ? e.impact.reportedAt : null,
    };
  });
  const totalHours = hours.reduce((sum, h) => sum + number(h.hours), 0);
  const evidenceRecordIds = [
    ...new Set(
      [
        ...events,
        ...applications,
        ...hours,
        ...attendance,
        ...completed,
        ...shifts,
      ].map((r) => r.id),
    ),
  ];
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    isDemo: true,
    organization: { id: organization.id, name: organization.name },
    filters: {
      month: filters.month || null,
      eventId: filters.eventId || null,
      basis: "Event date month; hours follow their linked event",
    },
    totals: {
      events: events.length,
      registrations: applications.length,
      approvedRegistrations: acceptedApplications.length,
      volunteers: new Set(acceptedApplications.map((a) => a.studentId)).size,
      attendance: presentApps.size,
      completedShifts: completedApps.size,
      confirmedShifts: shifts.length,
      approvedHours: totalHours,
      schools: groupedSchools.filter((s) => s.name !== "Unspecified").length,
      organizations: events.length ? 1 : 0,
      communityReach: eventRows.reduce((s, e) => s + e.reach, 0),
      suppliesDistributed: eventRows.reduce(
        (s, e) => s + e.suppliesDistributed,
        0,
      ),
    },
    events: eventRows,
    schools: groupedSchools,
    evidence: {
      eventIds: events.map((e) => e.id),
      applicationIds: applications.map((a) => a.id),
      approvedHours: hours.map((h) => ({
        id: h.id,
        applicationId: h.applicationId,
        hours: number(h.hours),
        status: h.status,
        updatedAt: h.updatedAt || null,
      })),
      attendance: attendance.map((r) => ({
        id: r.id,
        applicationId: r.applicationId,
        eventId: r.eventId,
        status: r.status,
        recordedAt: r.recordedAt || null,
      })),
      completedEventDays: completed.map((r) => ({
        id: r.id,
        applicationId: r.applicationId,
        eventId: r.eventId,
        checkInAt: r.checkInAt,
        checkOutAt: r.checkOutAt,
      })),
      confirmedShiftIds: shifts.map((s) => s.id),
      recordIds: evidenceRecordIds,
    },
    limits: [
      "Browser-local prototype; workspace selection is not authentication.",
      "Approved hours are scoped to approved applications; pending/rejected and unrelated hours are excluded.",
      "Attendance is coordinator-recorded present, deduplicated per application; checkout does not itself verify hours.",
      "School membership provenance is labeled; school names do not establish a partnership.",
      "Community reach, distributed supplies and outcomes are coordinator-reported, not independently verified.",
      "Exports omit student names, contact information, private notes and feedback. Record IDs support provenance.",
    ],
  };
  report.narrative = `${organization.name} recorded ${report.totals.events} ${report.totals.events === 1 ? "event" : "events"} for ${filters.month || "all recorded months"}, with ${report.totals.approvedRegistrations} approved registrations and ${report.totals.attendance} coordinator-recorded attendances. ${report.totals.completedShifts} completed event-day records and ${totalHours} approved volunteer hours are linked to these events. ${report.totals.schools} school groups are represented; membership sources are listed separately. Coordinators reported a community reach of ${report.totals.communityReach} and ${report.totals.suppliesDistributed} distributed supplies. These reported outcomes are not independently verified.`;
  return report;
}
function fingerprint(report) {
  return JSON.stringify({
    organization: report.organization,
    filters: report.filters,
    totals: report.totals,
    events: report.events,
    schools: report.schools,
    evidence: report.evidence,
  });
}
export function csvCell(value) {
  const text = String(value ?? "");
  const safe = /^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function reportCsv(report) {
  const rows = [
    ["DEMO IMPACT REPORT", report.organization.name],
    ["Period", report.filters.month || "All months"],
    ["Scope", report.filters.basis],
    [],
    ["Metric", "Value"],
    ...Object.entries(report.totals),
    [],
    [
      "Event",
      "Date",
      "Status",
      "Registrations",
      "Approved registrations",
      "Attendance",
      "Completed shifts",
      "Approved hours",
      "Coordinator-reported reach",
      "Coordinator-reported supplies",
      "Coordinator-reported outcomes",
    ],
    ...report.events.map((e) => [
      e.title,
      e.date,
      e.status,
      e.registrations,
      e.approvedRegistrations,
      e.attendance,
      e.completedShifts,
      e.approvedHours,
      e.reach,
      e.suppliesDistributed,
      e.outcomes,
    ]),
    [],
    [
      "School group",
      "Membership source",
      "Unique approved volunteers",
      "Approved registrations",
      "Attendance",
      "Completed shifts",
      "Approved hours",
    ],
    ...report.schools.map((s) => [
      s.name,
      s.source,
      s.students,
      s.applications,
      s.attendance,
      s.completed,
      s.hours,
    ]),
    [],
    ["Local rule-based narrative", report.narrative],
    [],
    ["Limitations"],
    ...report.limits.map((x) => [x]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
function printable(report) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>VolunteerU impact report</title><style>body{font:15px system-ui;margin:40px;color:#292a38}h1,h2{color:#7454df}table{border-collapse:collapse;width:100%;margin:24px 0}td,th{border:1px solid #ddd;padding:10px;text-align:left}p,li{line-height:1.7}@media print{body{margin:12mm}}</style><h1>${esc(report.organization.name)} · DEMO impact report</h1><p>Event month: ${esc(report.filters.month || "All recorded months")} · Generated ${esc(report.generatedAt)}</p><h2>Local rule-based summary</h2><p>${esc(report.narrative)}</p><table><tr><th>Metric</th><th>Value</th></tr>${Object.entries(
    report.totals,
  )
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`)
    .join(
      "",
    )}</table><h2>Event outcomes</h2>${report.events.map((e) => `<h3>${esc(e.title)} · ${esc(e.date)}</h3><p>${esc(e.approvedHours)} approved hours; ${esc(e.attendance)} attendances. Coordinator-reported reach: ${esc(e.reach)}; supplies: ${esc(e.suppliesDistributed)}.</p><p>${esc(e.outcomes || "No outcome narrative reported.")}</p>`).join("")}<h2>School groups</h2><table><tr><th>School</th><th>Source</th><th>Volunteers</th><th>Approved hours</th></tr>${report.schools.map((s) => `<tr><td>${esc(s.name)}</td><td>${esc(s.source)}</td><td>${s.students}</td><td>${s.hours}</td></tr>`).join("")}</table><h2>Provenance</h2><p>Source record IDs: ${report.evidence.recordIds.map(esc).join(", ") || "None"}</p><h2>Limitations</h2><ul>${report.limits.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></html>`;
}
function download(content, type, extension) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `volunteeru-impact-${month || "all-months"}.${extension}`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function reportsMarkup() {
  const data = readNonprofits();
  syncFilters(data);
  const report = buildImpactReport(data);
  if (!report)
    return `<section class="page-heading"><div><div class="eyebrow">MAKE THE GOOD VISIBLE</div><h1>Community <em>impact reports.</em></h1><p>Open a nonprofit workspace to report on its events.</p><button class="primary" data-page="Nonprofit Portal">Open nonprofit portal →</button></div></section>`;
  if (aiDraft?.fingerprint !== fingerprint(report)) aiDraft = null;
  const orgEvents = data.events.filter((e) => e.organizationId === orgId);
  return `<section class="page-heading"><div><div class="eyebrow">MAKE THE GOOD VISIBLE</div><h1>Your community <em>impact.</em></h1><p>${esc(report.organization.name)} · event and monthly reporting for your nonprofit workspace.</p></div></section><p class="demo-notice">Local demo report · no authenticated organization access or independent outcome verification. Use sample information only.</p><section class="report-panel"><div class="report-filters"><label>Event month<input id="report-month" type="month" value="${esc(month)}"></label><label>Report event<select id="report-event" aria-label="Report event"><option value="">All events in this nonprofit</option>${orgEvents.map((e) => `<option value="${esc(e.id)}" ${eventId === e.id ? "selected" : ""}>${esc(e.title)}</option>`).join("")}</select></label><button class="secondary" id="report-reset">Reset filters</button></div><p>Month filtering follows each event’s scheduled date; approved hours are grouped with that event.</p></section><div class="report-stats">${[
    ["Events", report.totals.events],
    ["Recorded attendances", report.totals.attendance],
    ["Approved volunteer hours", report.totals.approvedHours],
    ["Completed event shifts", report.totals.completedShifts],
    ["School groups", report.totals.schools],
    ["Nonprofit organizations", report.totals.organizations],
  ]
    .map(
      ([label, value]) =>
        `<article><strong>${value}</strong><span>${label}</span></article>`,
    )
    .join(
      "",
    )}</div><section class="report-panel"><h2>Event outcomes</h2><p>Attendance is recorded present once per application. Completed event-day checkout is tracked separately from approved hours.</p>${report.events.length ? `<div class="report-table"><table><thead><tr><th>Event</th><th>Approved registrations</th><th>Attendance</th><th>Completed shifts</th><th>Approved hours</th><th>Reported reach / supplies</th></tr></thead><tbody>${report.events.map((e) => `<tr><th>${esc(e.title)}<small>${esc(e.date)} · ${esc(e.status)}</small></th><td>${e.approvedRegistrations}</td><td>${e.attendance}</td><td>${e.completedShifts}</td><td>${e.approvedHours}</td><td>${e.reach} / ${e.suppliesDistributed}</td></tr>`).join("")}</tbody></table></div>` : `<div class="report-empty">No events match these filters. There are no impact results to report.</div>`}</section><section class="report-panel"><h2>School participation</h2><p>School groups reflect connected or self-reported student school names. They do not imply an institutional partnership.</p>${report.schools.length ? `<div class="report-table"><table><thead><tr><th>School group</th><th>Source</th><th>Volunteers</th><th>Approved hours</th></tr></thead><tbody>${report.schools.map((s) => `<tr><th>${esc(s.name)}</th><td>${esc(s.source)}</td><td>${s.students}</td><td>${s.hours}</td></tr>`).join("")}</tbody></table></div>` : `<p>No approved student registrations in this scope yet.</p>`}</section><section class="report-panel"><h2>Record community outcomes</h2><p>These numbers and statements are coordinator-reported. They do not verify attendance, hours, donations, or community outcomes.</p>${orgEvents.length ? `<form id="report-impact"><label>Event to update<select name="eventId" id="report-impact-event">${orgEvents.map((e) => `<option value="${esc(e.id)}" ${e.id === (eventId || report.events[0]?.id) ? "selected" : ""}>${esc(e.title)}</option>`).join("")}</select></label><div class="report-form-grid"><label>People reached<input name="reach" type="number" min="0" max="10000000" step="1" required></label><label>Supplies distributed<input name="suppliesDistributed" type="number" min="0" max="10000000" step="1" required></label><label class="report-wide">Community outcomes<textarea aria-label="Community outcomes" name="outcomes" rows="3" maxlength="2000" placeholder="Describe what happened and how your team measured it."></textarea></label></div><button class="primary" type="submit">Save coordinator-reported outcomes</button></form>` : `<p>Create an event in the nonprofit portal first.</p>`}<p id="report-impact-status" role="status"></p></section><section class="report-panel"><h2>Grant & event report draft</h2><span class="chip">Local rule-based narrative · review required</span><p class="report-narrative">${esc(report.narrative)}</p><p>Review the source records and coordinator-reported outcomes before using this in a grant application or public report.</p>${connected ? `<button class="secondary" id="report-ai">Request team AI summary</button><p>This sends the nonprofit ID and selected month/event filters to the configured team API. No student names or private notes are sent by this request.</p>` : `<p>An AI reporting service is not connected. The narrative above is generated from the displayed records using a template.</p>`}${aiDraft ? `<div class="report-ai-draft"><h3>Team AI draft · review required</h3><p>${esc(aiDraft.summary)}</p><small>Evidence record IDs: ${aiDraft.evidenceRecordIds.map(esc).join(", ")}</small></div>` : ""}<p id="report-ai-status" role="status"></p><div class="report-downloads"><button class="primary" data-report-export="csv">Download aggregate CSV</button><button class="secondary" data-report-export="json">Download JSON + provenance</button><button class="secondary" data-report-export="html">Download printable report</button></div><p>Exports omit student names, email addresses, private notes, and feedback. The JSON and printable report include source IDs; store exported reports appropriately. The printable file is HTML, ready to open and print from your browser.</p><details><summary>Report limitations & sources</summary><ul>${report.limits.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><p>Source record IDs: ${report.evidence.recordIds.map(esc).join(", ") || "None"}</p></details></section>`;
}
export function bindReports(render) {
  const data = readNonprofits();
  syncFilters(data);
  const report = buildImpactReport(data);
  if (!report) return;
  document.querySelector("#report-month").onchange = (e) => {
    month = /^\d{4}-\d{2}$/.test(e.target.value) ? e.target.value : "";
    aiDraft = null;
    render();
  };
  document.querySelector("#report-event").onchange = (e) => {
    eventId = e.target.value;
    aiDraft = null;
    render();
  };
  document.querySelector("#report-reset").onclick = () => {
    month = "";
    eventId = "";
    aiDraft = null;
    render();
  };
  const form = document.querySelector("#report-impact");
  const fillImpact = () => {
    if (!form) return;
    const event = readNonprofits().events.find(
      (e) => e.id === form.elements.eventId.value && e.organizationId === orgId,
    );
    form.elements.reach.value = number(event?.impact?.reach);
    form.elements.suppliesDistributed.value = number(
      event?.impact?.suppliesDistributed,
    );
    form.elements.outcomes.value = event?.impact?.outcomes || "";
  };
  fillImpact();
  document
    .querySelector("#report-impact-event")
    ?.addEventListener("change", fillImpact);
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const next = readNonprofits(),
      event = next.events.find(
        (e) =>
          e.organizationId === orgId && e.id === form.elements.eventId.value,
      );
    if (!event || next.activeId !== orgId) return;
    const reach = Number(form.elements.reach.value),
      suppliesDistributed = Number(form.elements.suppliesDistributed.value),
      outcomes = form.elements.outcomes.value.trim();
    if (
      ![reach, suppliesDistributed].every(
        (n) => Number.isInteger(n) && n >= 0 && n <= 10000000,
      ) ||
      outcomes.length > 2000
    )
      return;
    event.impact = {
      reach,
      suppliesDistributed,
      outcomes,
      reportedAt: new Date().toISOString(),
      source: "coordinator-reported",
      isDemo: true,
    };
    if (saveNonprofits(next)) {
      aiDraft = null;
      render();
      document.querySelector("#report-impact-status").textContent =
        "Coordinator-reported outcomes saved. These outcomes are not independently verified.";
    }
  });
  document.querySelectorAll("[data-report-export]").forEach(
    (button) =>
      (button.onclick = () => {
        const latest = buildImpactReport();
        if (!latest || latest.organization.id !== report.organization.id) {
          render();
          return;
        }
        const kind = button.dataset.reportExport;
        if (kind === "csv")
          download(reportCsv(latest), "text/csv;charset=utf-8", "csv");
        else if (kind === "json")
          download(JSON.stringify(latest, null, 2), "application/json", "json");
        else download(printable(latest), "text/html;charset=utf-8", "html");
      }),
  );
  document.querySelector("#report-ai")?.addEventListener("click", async (e) => {
    const button = e.currentTarget,
      feedback = document.querySelector("#report-ai-status"),
      original = buildImpactReport(),
      originalFingerprint = fingerprint(original),
      node = document.querySelector("#report-month");
    button.disabled = true;
    feedback.textContent =
      "Requesting an AI draft from the configured team API…";
    try {
      const response = await fetch(`${apiBase}/nonprofit/reports`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: original.organization.id,
          month: original.filters.month,
          eventId: original.filters.eventId,
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      const allowed = new Set([
        ...original.evidence.eventIds,
        ...original.evidence.applicationIds,
        ...original.evidence.approvedHours.map((h) => h.id),
      ]);
      if (
        result?.organizationId !== original.organization.id ||
        typeof result.summary !== "string" ||
        !result.summary.trim() ||
        result.summary.length > 10000 ||
        !Array.isArray(result.evidenceRecordIds) ||
        !result.evidenceRecordIds.length ||
        result.evidenceRecordIds.length > 500 ||
        result.evidenceRecordIds.some(
          (id) => typeof id !== "string" || !allowed.has(id),
        )
      )
        throw new Error();
      const current = buildImpactReport();
      if (
        !node.isConnected ||
        !current ||
        fingerprint(current) !== originalFingerprint
      ) {
        if (feedback.isConnected)
          feedback.textContent =
            "Report records or filters changed. The old AI response was discarded.";
        return;
      }
      aiDraft = {
        summary: result.summary,
        evidenceRecordIds: result.evidenceRecordIds,
        fingerprint: originalFingerprint,
      };
      render();
    } catch {
      if (feedback.isConnected)
        feedback.textContent =
          "The AI service did not return a valid report with evidence from this scope. The local report remains available.";
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  });
}
