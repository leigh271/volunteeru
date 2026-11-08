import { seedEventAttendanceDemo } from "./event-attendance-demo.js";
import { processDemoTrainingReminder } from "./outreach-demo-model.js";
import { linkFlowersEvent } from "./flowers-event.js";
import { commandCenterMarkup, bindCommandCenter } from "./command-center.js";
import { state, refresh, persist, signOutStudent } from "./store.js";
import { readNonprofits } from "./nonprofit-store.js";
import {
  DEMO_KEY,
  metrics,
  filterProfiles,
  studentRecord,
  bridgeRecords,
  csvText,
  approveAttendance,
} from "./herwell-model.js";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const read = (k, f) => {
  try {
    return JSON.parse(localStorage.getItem(k)) || f;
  } catch {
    return f;
  }
};
let eventId = "E001",
  tab = "preparation",
  filters = {},
  section = "Command Center",
  draft = "",
  listPage = 1;
const get = () => read(DEMO_KEY, null);
function write(d) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(d));
}
function bridge(d) {
  linkFlowersEvent(d);
  refresh();
  const b = bridgeRecords(
    d,
    state,
    readNonprofits(),
    read("volunteeru.schools.v1", { schools: [] }),
    read("volunteeru.student-profiles.v1", []),
  );
  const changes = {
    "volunteeru.shared.v1": b.shared,
    "volunteeru.nonprofits.v1": b.nonprofits,
    "volunteeru.schools.v1": b.schools,
    "volunteeru.student-profiles.v1": b.archive,
    [DEMO_KEY]: d,
  };
  const previous = Object.fromEntries(
    Object.keys(changes).map((k) => [k, localStorage.getItem(k)]),
  );
  try {
    Object.entries(changes).forEach(([k, v]) =>
      localStorage.setItem(k, JSON.stringify(v)),
    );
  } catch (e) {
    Object.entries(previous).forEach(([k, v]) =>
      v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v),
    );
    throw e;
  }
  refresh();
  window.dispatchEvent(new Event("volunteeru:nonprofit-change"));
}
const chip = (s, t = "") => `<span class="hw-chip ${t}">${esc(s)}</span>`;
const date = (v) =>
  v
    ? new Date(v).toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Not recorded";
const stat = (v, l, sub = "") =>
  `<article class="hw-stat"><strong>${esc(v)}</strong><span>${esc(l)}</span><small>${esc(sub)}</small></article>`;
const empty = (t) => `<p class="hw-empty">${esc(t)}</p>`;
function demoBanner() {
  return `<div class="hw-banner"><span>◈ SYNTHETIC DEMO</span> Flowers for Women · September–December 2026. November attendance is simulated future data. Browser-local records; no external messages or services connected.</div>`;
}
export function herwellContextMarkup(workspace) {
  const linked =
    workspace === "student"
      ? state.student.id.startsWith("herwell:")
      : workspace === "school" &&
        String(read("volunteeru.schools.v1", {}).activeId || "").startsWith(
          "herwell:",
        );
  return linked
    ? `<div class="hw">${demoBanner()}${workspace === "student" ? '<p class="hw-note">Imported demo profile: county starts from the assigned event because the source has no preferred-county field. Review your profile to set your preference. The growth visual uses your connected school’s hours requirement.</p>' : ""}</div>`
    : "";
}
export function herwellEntryMarkup() {
  return `<section class="hw-entry"><div><strong>Meet Flowers for Women</strong><p>Explore your volunteers, schools, events, and the coordinator command center.</p></div><button class="primary" data-page="Demo Tour">Open Flowers for Women demo →</button></section>`;
}
export function herwellMarkup(name) {
  section = name;
  const d = get();
  if (name === "Command Center" && d) return commandCenterMarkup(d);
  return `<div class="hw"><section class="page-heading"><div><div class="eyebrow">VOLUNTEERU · FLOWERS FOR WOMEN</div><h1>${name === "Command Center" ? "Your event <em>command center.</em>" : name === "Volunteer Directory" ? "Your volunteer <em>community.</em>" : name === "Demo Tour" ? "One community. <em>Three perspectives.</em>" : "Clear records. <em>Meaningful impact.</em>"}</h1><p>From the first conversation to the final approved hour.</p></div>${d ? chip("HerWell fixture loaded", "green") : ""}</section>${demoBanner()}${!d ? `<section class="hw-panel hw-welcome"><div class="hw-orbit">✳</div><h2>Bring the platform to life.</h2><p>Load the supplied HerWell dataset into the existing VolunteerU student, nonprofit, and school demo workspaces. Existing browser records are preserved; authenticated accounts stay separate.</p><div class="hw-stats">${stat(100, "Unique students")}${stat(10, "Partner schools · fictional")}${stat(2, "November events")}</div><button class="primary" id="hw-load">Load HerWell mock data →</button><p id="hw-status" role="status"></p></section>` : name === "Command Center" ? commandCenterMarkup(d) : name === "Volunteer Directory" ? directory(d) : name === "School Reports" ? reports(d) : tour(d)}<p id="hw-feedback" role="status"></p></div>`;
}
function narrative(d, id = "") {
  const m = metrics(d, id);
  return `In this fictional November 2026 scenario, ${m.students} registered students filled ${m.planned} planned shift places. ${m.attended} attended and ${m.noShows} were recorded as no-shows. Coordinators approved ${m.approvedHours.toFixed(2)} service hours. ${m.missing} missing check-outs and ${m.pending} complete time pairs still require review. Registration, attendance, supply outputs, and approved hours are separate measures. No resource-distribution counts were supplied.`;
}
function filterMarkup(d) {
  return `<div class="hw-filters"><label class="hw-search">Search name or school<input id="hw-search" type="search" value="${esc(filters.q || "")}" placeholder="Find a volunteer…"></label>${[
    ["school", "School", d.schools.map((s) => [s.school_id, s.school_name])],
    [
      "education",
      "Education",
      ["High school", "Undergraduate", "Graduate", "Community", "Other"].map(
        (v) => [v, v],
      ),
    ],
    [
      "county",
      "Event county",
      [
        ["Broward", "Broward"],
        ["Miami-Dade", "Miami-Dade"],
      ],
    ],
    [
      "interest",
      "Health interest",
      Object.keys(programMapLocal).map((v) => [v, v]),
    ],
    [
      "skill",
      "Skill",
      [...new Set(d.profiles.flatMap((p) => p.skills))].map((v) => [v, v]),
    ],
    [
      "availability",
      "Available day",
      [...new Set(d.profiles.flatMap((p) => p.availability))].map((v) => [
        v,
        v,
      ]),
    ],
    [
      "age",
      "Age group",
      [
        ["Under 18", "Under 18"],
        ["18+", "18+"],
      ],
    ],
    ["event", "Event", d.events.map((e) => [e.id, e.title])],
  ]
    .map(
      ([k, l, opts]) =>
        `<label>${l}<select data-hw-filter="${k}"><option value="">All</option>${opts.map(([v, t]) => `<option value="${esc(v)}" ${filters[k] === v ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`,
    )
    .join(
      "",
    )}<label>Registered from<input type="date" data-hw-filter="start" value="${esc(filters.start || "")}"></label><label>Through<input type="date" data-hw-filter="end" value="${esc(filters.end || "")}"></label><button class="secondary" id="hw-reset">Reset filters</button></div>`;
}
const programMapLocal = {
  "Period health": 1,
  "Cancer support": 1,
  "Maternal health": 1,
  "Mental health": 1,
};
function directory(d) {
  const rows = filterProfiles(d, filters),
    m = metrics(d);
  return `<div class="hw-stats">${stat(d.profiles.length, "Unique students", `${d.submissions.length} original submissions`)}${stat(d.profiles.filter((p) => p.education_level === "High school").length, "High school")}${stat(d.profiles.filter((p) => p.education_level === "Undergraduate").length, "Undergraduate")}${stat(d.profiles.filter((p) => p.education_level === "Graduate").length, "Graduate")}</div><section class="hw-panel"><div class="hw-panel-title"><div><h2>Volunteer Directory</h2><p class="hw-sub">County below is the assigned event county; the signup file does not contain a home county. Schools and education levels are separate fields.</p></div><button class="primary" id="hw-export-directory">Export filtered CSV</button></div>${filterMarkup(d)}<div class="hw-table-wrap"><table><thead><tr><th>Volunteer</th><th>School / education</th><th>Event county</th><th>Interests / skills</th><th>Availability</th><th>Readiness</th></tr></thead><tbody>${
    rows
      .slice((listPage - 1) * 15, listPage * 15)
      .map((p) => {
        const r = d.registrations.find(
            (r) => r.volunteer_id === p.volunteer_id,
          ),
          e = d.events.find((e) => e.id === r?.event_id);
        return `<tr><td><button class="hw-person" data-hw-profile="${esc(p.volunteer_id)}"><span>${esc(
          p.name
            .split(" ")
            .map((x) => x[0])
            .join(""),
        )}</span><strong>${esc(p.name)}</strong></button><small>${esc(p.volunteer_id)} · ${p.age == null ? "Not shared" : p.age < 18 ? "Under 18" : "18+"}</small></td><td>${esc(p.school_name)}<small>${esc(p.education_level)}</small></td><td>${esc(e?.county || "Not supplied")}<small>Assigned event location</small></td><td>${p.interests.map((i) => chip(i)).join("")}<small>${esc(p.skills.join(", "))}</small></td><td>${esc(p.availability.join(", "))}<small>${esc(p.available_start_time)}–${esc(p.available_end_time)} Eastern</small></td><td>${chip(p.training_status === "completed" ? "Training complete" : "Training pending", p.training_status === "completed" ? "green" : "amber")}${p.age != null && p.age < 18 ? "<small>Guardian consent " + esc(p.guardian_consent_status) + "</small>" : ""}</td></tr>`;
      })
      .join("") || '<tr><td colspan="6">No matching volunteers.</td></tr>'
  }</tbody></table></div><div class="hw-pagination"><span>${rows.length} matching volunteers · page ${listPage} of ${Math.max(1, Math.ceil(rows.length / 15))}</span><div><button class="secondary" id="hw-prev" ${listPage <= 1 ? "disabled" : ""}>Previous</button><button class="secondary" id="hw-next" ${listPage * 15 >= rows.length ? "disabled" : ""}>Next</button></div></div></section>`;
}
function reports(d) {
  const profiles = filterProfiles(d, filters),
    ids = new Set(profiles.map((p) => p.volunteer_id));
  const a = d.attendance.filter((a) => ids.has(a.volunteer_id));
  const approved = a
    .filter((a) => a.review_status === "approved")
    .reduce((s, a) => s + a.approved_hours, 0);
  return `<div class="hw-stats">${stat(profiles.length, "Unique students in scope")}${stat(new Set(profiles.map((p) => p.school_id)).size, "Schools in scope")}${stat(approved.toFixed(2), "Approved demo hours")}${stat(a.filter((a) => a.attendance_status === "attended").length, "Simulated attendees")}</div><section class="hw-panel"><div class="hw-panel-title"><div><h2>School & university participation</h2><p class="hw-sub">School requirements are authoritative for the demo. Personal signup targets stay separate. A single event does not certify a capstone.</p></div><div class="hw-report-actions"><button class="primary" id="hw-export-report">Export school report</button><button class="secondary" id="hw-print">Print / save PDF</button></div></div>${filterMarkup(d)}<div class="hw-table-wrap"><table><thead><tr><th>School</th><th>Students</th><th>Attendees</th><th>Approved hours</th><th>Requirement</th><th>Deadline / review</th></tr></thead><tbody>${d.schools
    .filter((s) => profiles.some((p) => p.school_id === s.school_id))
    .map((s) => {
      const pp = profiles.filter((p) => p.school_id === s.school_id),
        pa = a.filter((a) => pp.some((p) => p.volunteer_id === a.volunteer_id));
      return `<tr><td>${esc(s.school_name)}<small>${esc(s.school_type)}</small><button class="hw-link" data-hw-school="${esc(s.school_id)}">Open school workspace →</button></td><td>${pp.length}</td><td>${pa.filter((a) => a.attendance_status === "attended").length}</td><td>${pa
        .filter((a) => a.review_status === "approved")
        .reduce((n, a) => n + a.approved_hours, 0)
        .toFixed(
          2,
        )}</td><td>${esc(s.required_hours)} hours per student</td><td>${esc(s.verification_deadline)}${s.capstone_review_required === "yes" ? "<small>Separate capstone review required</small>" : ""}</td></tr>`;
    })
    .join(
      "",
    )}</tbody></table></div></section><div class="hw-columns"><section class="hw-panel"><h2>Recruitment funnel</h2><div class="hw-funnel">${[
    ["Target unique students", d.recruitmentTarget],
    ["Raw submissions", d.submissions.length],
    ["Unique students", d.profiles.length],
    ["Required shift places", metrics(d).planned],
    ["Simulated attendees", metrics(d).attended],
  ]
    .map(
      ([n, v]) =>
        `<div><span>${n}</span><strong>${v}</strong><div class="hw-track"><i style="width:${(v / d.recruitmentTarget) * 100}%"></i></div></div>`,
    )
    .join(
      "",
    )}</div><p>${d.submissions.length - d.profiles.length} repeated submissions retained as referral history, not extra students.</p></section><section class="hw-panel"><h2>Campaign sources</h2><p class="hw-sub">Raw submissions by source. Channels can overlap for the same person.</p>${[...new Set(d.submissions.map((s) => s.referral_channel))].map((c) => `<div class="hw-logistic"><strong>${esc(c)}</strong><span>${d.submissions.filter((s) => s.referral_channel === c).length} submissions</span></div>`).join("")}<p class="hw-note">All records were collected through the VolunteerU central form. LinkedIn, Luma, Eventbrite, and email are referral channels; no live imports are connected.</p></section></div><section class="hw-panel"><h2>Coordinator report draft · full dataset</h2><blockquote>${esc(narrative(d))}</blockquote></section>`;
}
function tour(d) {
  const m = metrics(d);
  return `<div class="hw-stats">${stat(d.profiles.length, "Unique students")}${stat(d.schools.length, "Fictional schools")}${stat(m.approvedHours.toFixed(2), "Approved demo hours")}${stat(m.missing + m.pending, "Reviews needing attention")}</div><div class="hw-tour-grid"><section class="hw-panel"><span class="hw-orbit">✳</span><h2>Nonprofit coordinator</h2><p>Review staffing and training, approve preparation tasks, follow attendance, and verify hours.</p><button class="primary" data-page="Command Center">Open command center →</button><button class="secondary" data-page="Volunteer Directory">Browse volunteer directory</button></section><section class="hw-panel"><span class="hw-orbit">☺</span><h2>Student volunteer</h2><p>Choose a fictional student to view their existing VolunteerU profile, school requirements, applications, and progress.</p><label>Demo student<select id="hw-student">${d.profiles.map((p) => `<option value="${esc(p.volunteer_id)}">${esc(p.name)} · ${esc(p.volunteer_id)} · ${esc(p.education_level)}</option>`).join("")}</select></label><button class="primary" id="hw-open-student">Open student experience →</button></section><section class="hw-panel"><span class="hw-orbit">⌂</span><h2>School administrator</h2><p>Compare participation and approved hours while keeping each school’s requirements separate.</p><label>Demo school<select id="hw-school">${d.schools.map((s) => `<option value="${esc(s.school_id)}">${esc(s.school_name)}</option>`).join("")}</select></label><button class="primary" id="hw-open-school">Open school experience →</button><button class="secondary" data-page="School Reports">Compare school reports</button></section></div><section class="hw-panel"><div class="hw-panel-title"><h2>Your demo story</h2><button class="secondary" id="hw-sync">Refresh linked demo views</button></div><ol class="hw-story"><li><strong>September: plan with evidence.</strong> Review meeting-linked tasks and distinguish confirmed logistics from open commitments.</li><li><strong>October: recruit once, track every source.</strong> 112 submissions become 100 people; repeated names with different emails stay separate.</li><li><strong>November: show what happened.</strong> 100 planned places, 35 simulated attendees, 65 no-shows.</li><li><strong>December: report verified contributions.</strong> Start with 81.76 approved hours. Missing check-outs and pending reviews never inflate school totals.</li></ol><p>Demo workspace selection is not authentication. The existing Integrations screen continues to use the separate authenticated server.</p></section>`;
}
function showModal(html) {
  document.querySelector("#hw-modal")?.remove();
  const el = document.createElement("dialog");
  el.id = "hw-modal";
  el.className = "hw-modal hw";
  el.innerHTML = `<button class="hw-close" aria-label="Close dialog">×</button>${html}`;
  document.body.append(el);
  el.querySelector(".hw-close").onclick = () => el.close();
  el.addEventListener("close", () => el.remove());
  el.showModal();
  return el;
}
function showProfile(d, id) {
  const p = d.profiles.find((p) => p.volunteer_id === id),
    s = d.schools.find((s) => s.school_id === p.school_id),
    r = d.registrations.find((r) => r.volunteer_id === id),
    a = d.attendance.find((a) => a.volunteer_id === id);
  showModal(
    `<div class="eyebrow">FICTIONAL VOLUNTEER · ${esc(id)}</div><h2>${esc(p.name)}</h2><p>${esc(p.school_name)} · ${esc(p.education_level)}</p><dl class="hw-details">${[
      [
        "Age group",
        p.age == null ? "Not shared" : p.age < 18 ? "Under 18" : "18+",
      ],
      [
        "School requirement",
        s.required_hours + " hours by " + s.verification_deadline,
      ],
      [
        "Student stated target",
        p.required_hours + " hours by " + p.hours_deadline,
      ],
      ["Experience goal", p.experience_goal],
      [
        "Availability",
        p.available_days +
          " " +
          p.available_start_time +
          "–" +
          p.available_end_time +
          " Eastern",
      ],
      ["Health interests", p.interests.join(", ")],
      ["Skills", p.skills.join(", ")],
      ["Preferred role", p.preferred_role],
      ["Training", p.training_status],
      ["Guardian consent", p.guardian_consent_status],
      ["Assigned role", r?.role],
      [
        "Approved hours",
        a?.review_status === "approved" ? a.approved_hours : "Not approved",
      ],
    ]
      .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
      .join(
        "",
      )}</dl><h3>Referral history · ${p.sources.length} submissions</h3>${p.sources.map((s) => `<p>${esc(s.submissionId)} · ${esc(s.channel)} · ${esc(s.at.slice(0, 10))}</p>`).join("")}<p>Same normalized email and stable profile ID identify repeat submissions. Names alone never identify a person.</p>`,
  );
}
function download(name, text) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportReport(d) {
  const pp = filterProfiles(
    d,
    section === "Command Center" ? { event: eventId } : filters,
  );
  download(
    "herwell-approved-school-hours-DEMO.csv",
    csvText(
      [
        "DEMO",
        "School",
        "Student ID",
        "Student",
        "Education",
        "Event",
        "Shift",
        "Attendance",
        "Calculated hours (not verified)",
        "Approved hours",
        "Review status",
        "School required hours",
        "Deadline",
      ],
      pp.map((p) => {
        const a = d.attendance.find((a) => a.volunteer_id === p.volunteer_id),
          s = d.schools.find((s) => s.school_id === p.school_id);
        return [
          "SYNTHETIC FUTURE SCENARIO",
          s.school_name,
          p.volunteer_id,
          p.name,
          p.education_level,
          a.event_id,
          a.shift_id,
          a.attendance_status,
          a.calculated_hours,
          a.review_status === "approved" ? a.approved_hours : null,
          a.review_status,
          s.required_hours,
          s.verification_deadline,
        ];
      }),
    ),
  );
}
export function bindHerwell(render) {
  const d = get(),
    on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.onclick = fn;
    },
    all = (s, fn) => document.querySelectorAll(s).forEach(fn),
    notify = (m) => {
      const el = document.querySelector("#hw-feedback");
      if (el) el.textContent = m;
    };
  on("hw-load", async () => {
    const b = document.querySelector("#hw-load");
    b.disabled = true;
    try {
      const r = await fetch("/herwell-demo/dataset.json");
      if (!r.ok) throw Error("Fixture could not be loaded");
      const data = await r.json();
      if (
        data.version !== 1 ||
        data.profiles.length !== 100 ||
        data.isDemo !== true
      )
        throw Error("Invalid fixture");
      bridge(data);
      render();
    } catch (e) {
      document.querySelector("#hw-status").textContent = e.message;
      b.disabled = false;
    }
  });
  if (!d) return;
  if (section === "Command Center") {
    bindCommandCenter(d, {
      render,
      save: write,
      bridge,
      profile: showProfile,
      reviewHours,
    });
    return;
  }
  on("hw-sync", () => {
    try {
      bridge(d);
      render();
      notify("Linked student, school, and nonprofit views refreshed.");
    } catch (e) {
      notify(e.message);
    }
  });
  all(
    "[data-hw-event]",
    (b) =>
      (b.onclick = () => {
        eventId = b.dataset.hwEvent;
        render();
      }),
  );
  all(
    "[data-hw-tab]",
    (b) =>
      (b.onclick = () => {
        tab = b.dataset.hwTab;
        render();
      }),
  );
  all(
    "[data-hw-profile]",
    (b) => (b.onclick = () => showProfile(d, b.dataset.hwProfile)),
  );
  const search = document.querySelector("#hw-search");
  if (search)
    search.oninput = (e) => {
      const value = e.target.value,
        pos = e.target.selectionStart;
      filters.q = value;
      listPage = 1;
      render();
      const n = document.querySelector("#hw-search");
      n.focus();
      n.setSelectionRange(pos, pos);
    };
  all(
    "[data-hw-filter]",
    (s) =>
      (s.onchange = () => {
        filters[s.dataset.hwFilter] = s.value;
        listPage = 1;
        render();
      }),
  );
  on("hw-reset", () => {
    filters = {};
    listPage = 1;
    render();
  });
  on("hw-prev", () => {
    listPage--;
    render();
  });
  on("hw-next", () => {
    listPage++;
    render();
  });
  on("hw-export-directory", () => {
    const pp = filterProfiles(d, filters);
    download(
      "herwell-volunteers-DEMO.csv",
      csvText(
        [
          "DEMO",
          "ID",
          "Name",
          "School",
          "Education",
          "Age group",
          "Health interests",
          "Skills",
          "Available days",
          "Training",
          "Submissions",
        ],
        pp.map((p) => [
          "SYNTHETIC",
          p.volunteer_id,
          p.name,
          p.school_name,
          p.education_level,
          p.age == null ? "Not shared" : p.age < 18 ? "Under 18" : "18+",
          p.interests.join("; "),
          p.skills.join("; "),
          p.availability.join("; "),
          p.training_status,
          p.sources.length,
        ]),
      ),
    );
  });
  on("hw-export-report", () => exportReport(d));
  on("hw-print", () => window.print());
  all(
    "[data-hw-task]",
    (b) =>
      (b.onclick = () => {
        const t = d.tasks.find((t) => t.id === b.dataset.hwTask);
        if (b.dataset.action === "approved" && (!t.owner || !t.due)) {
          const modal = showModal(
            `<h2>Complete task details</h2><p>${esc(t.title)}</p><p>The meeting did not agree every detail. Add a coordinator decision before approving.</p><form id="hw-task-form"><label>Assigned owner<input name="owner" value="${esc(t.owner || "")}" required maxlength="100"></label><label>Due date<input type="date" name="due" value="${esc(t.due || "")}" required></label><label>Decision note<textarea name="note" required maxlength="500"></textarea></label><button class="primary">Approve demo task</button></form>`,
          );
          modal.querySelector("form").onsubmit = (e) => {
            e.preventDefault();
            const f = new FormData(e.target);
            t.owner = f.get("owner").trim();
            t.due = f.get("due");
            t.decisionNote = f.get("note").trim();
            if (!t.owner || !t.decisionNote) return;
            t.status = "approved";
            audit(d, "task.approved", t.id, t.decisionNote);
            write(d);
            modal.close();
            render();
          };
          return;
        }
        t.status = b.dataset.action;
        audit(d, "task." + t.status, t.id, "Coordinator demo action");
        write(d);
        render();
      }),
  );
  on("hw-save-message", () => {
    draft = document.querySelector("#hw-message").value;
    d.messageDrafts = { ...d.messageDrafts, [eventId]: draft };
    write(d);
    notify("Draft saved locally. No message was sent.");
  });
  all(
    "[data-hw-match]",
    (b) =>
      (b.onclick = () => {
        const e = d.events.find((e) => e.id === eventId),
          s = e.shifts.find((s) => s.id === b.dataset.hwMatch);
        const candidates = d.profiles
          .filter(
            (p) => p.age >= 18 || p.guardian_consent_status === "recorded",
          )
          .map((p) => ({
            p,
            score:
              (p.preferred_role.toLowerCase().includes(s.role.toLowerCase())
                ? 3
                : 0) +
              (p.interests.includes(s.category) ? 2 : 0) +
              (p.training_status === "completed" ? 1 : 0),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        document.querySelector("#hw-matches").innerHTML =
          `<div class="hw-note"><h3>Suggested candidates · ${esc(s.role)}</h3><p>Transparent rule matching, not a model decision. All students already have one primary shift; these are reassignment candidates. Verify role training and adult supervision before changing assignments.</p>${candidates.map(({ p }) => `<p><strong>${esc(p.name)} · ${esc(p.volunteer_id)}</strong><br>${esc(p.preferred_role)} preference · ${esc(p.training_status)} training · ${esc(p.interests.join(", "))}</p>`).join("")}</div>`;
      }),
  );
  all(
    "[data-hw-review]",
    (b) => (b.onclick = () => reviewHours(d, b.dataset.hwReview, render)),
  );
  const form = document.querySelector("#hw-concern");
  if (form)
    form.onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(form);
      d.concerns = d.concerns || [];
      d.concerns.push({
        id: crypto.randomUUID(),
        eventId,
        priority: f.get("priority"),
        observation: f.get("observation").trim(),
        staff: f.get("staff").trim(),
        status: "needs review",
        createdAt: new Date().toISOString(),
      });
      write(d);
      render();
    };
  all(
    "[data-hw-resolve]",
    (b) =>
      (b.onclick = () => {
        const modal = showModal(
          '<h2>Record reviewed resolution</h2><form><label>Staff follow-up and resolution<textarea name="resolution" required maxlength="1000"></textarea></label><button class="primary">Save reviewed resolution</button></form>',
        );
        modal.querySelector("form").onsubmit = (e) => {
          e.preventDefault();
          const resolution = new FormData(e.target).get("resolution").trim();
          if (!resolution) return;
          const c = d.concerns.find((c) => c.id === b.dataset.hwResolve);
          c.status = "resolved";
          c.resolution = resolution;
          audit(d, "concern.resolved", c.id, resolution);
          write(d);
          modal.close();
          render();
        };
      }),
  );
  on("hw-open-student", () => {
    const p = d.profiles.find(
      (p) => p.volunteer_id === document.querySelector("#hw-student").value,
    );
    refresh();
    if (
      state.student.onboarded &&
      state.student.id !== `herwell:${p.volunteer_id}`
    ) {
      if (!signOutStudent()) return;
      refresh();
    }
    state.student = studentRecord(p, d);
    state.saved = [];
    if (persist()) location.href = "/?view=student";
  });
  const openSchool = (id) => {
    const data = read("volunteeru.schools.v1", {});
    data.activeId = "herwell:" + id;
    localStorage.setItem("volunteeru.schools.v1", JSON.stringify(data));
    location.href = "/?view=school";
  };
  on("hw-open-school", () =>
    openSchool(document.querySelector("#hw-school").value),
  );
  all(
    "[data-hw-school]",
    (b) => (b.onclick = () => openSchool(b.dataset.hwSchool)),
  );
}
function audit(d, action, id, note, before = null) {
  d.audit = d.audit || [];
  d.audit.push({
    action,
    id,
    note,
    before,
    actor: "Local demo coordinator",
    reviewedAt: new Date().toISOString(),
  });
}
function reviewHours(d, id, render) {
  const a = d.attendance.find((a) => a.attendance_id === id);
  const p = d.profiles.find((p) => p.volunteer_id === a.volunteer_id);
  const modal = showModal(
    `<h2>Review ${esc(p.name)}’s hours</h2><p>Fictional attendance correction. Original source values stay in the audit record. Only actual shift time minus unpaid breaks is eligible.</p><form><label>Actual check-out (Eastern time)<input type="datetime-local" name="checkout" required min="${esc(a.actual_check_in.slice(0, 16))}" max="${esc(a.scheduled_end.slice(0, 16))}" value="${esc((a.actual_check_out || "").slice(0, 16))}"></label><label>Unpaid break minutes<input type="number" name="break" min="0" max="480" required value="${a.unpaid_break_minutes}"></label><label>Correction / approval reason<textarea name="reason" required maxlength="1000"></textarea></label><p id="hw-review-error" role="status"></p><button class="primary">Approve demo hours</button></form>`,
  );
  modal.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      checkout = f.get("checkout") + ":00-05:00",
      breaks = Number(f.get("break")),
      reason = f.get("reason").trim(),
      minutes =
        (Date.parse(checkout) - Date.parse(a.actual_check_in)) / 60000 - breaks;
    const end = Date.parse(a.scheduled_end);
    if (
      !reason ||
      !Number.isFinite(minutes) ||
      minutes < 0 ||
      breaks < 0 ||
      Date.parse(checkout) > end ||
      Date.parse(a.actual_check_in) < Date.parse(a.scheduled_start)
    ) {
      modal.querySelector("#hw-review-error").textContent =
        "Verify time, break, and reason. Check-out must be within the scheduled shift.";
      return;
    }
    try {
      approveAttendance(d, id, checkout, breaks, reason);
      a.checkout_approved_at = a.reviewed_at;
      a.checkout_approved_by = "Demo coordinator";
      if (a.checkout_reminder) a.checkout_reminder.status = "resolved";
    } catch (err) {
      modal.querySelector("#hw-review-error").textContent = err.message;
      return;
    }
    try {
      bridge(d);
      modal.close();
      render();
    } catch (err) {
      modal.querySelector("#hw-review-error").textContent =
        "Could not save this review. " + err.message;
    }
  };
}

export function ensureFlowersWorkspace() {
  const d = get();
  if (d) {
    const linked = linkFlowersEvent(d);
    const seeded = seedEventAttendanceDemo(d);
    if (linked || seeded) bridge(d);
  }
}

export function saveDemoParticipant(d) {
  bridge(d);
}
export function runDueDemoReminders() {
  const d = get();
  if (!d) return false;
  const before = JSON.stringify(d.commandWorkflow);
  for (const e of d.events) processDemoTrainingReminder(d, e.id);
  if (before !== JSON.stringify(d.commandWorkflow)) {
    write(d);
    return true;
  }
  return false;
}

export async function initializeNonprofitDemo() {
  const params = new URLSearchParams(location.search);
  if (
    params.get("view") !== "nonprofit" ||
    params.get("demo") !== "herwell" ||
    get()
  )
    return;
  const response = await fetch("/herwell-demo/dataset.json");
  if (!response.ok) throw Error("Could not load nonprofit demo data.");
  const d = await response.json();
  if (d.version !== 1 || d.isDemo !== true || d.profiles.length !== 100)
    throw Error("Invalid demo data.");
  linkFlowersEvent(d);
  seedEventAttendanceDemo(d);
  bridge(d);
}
