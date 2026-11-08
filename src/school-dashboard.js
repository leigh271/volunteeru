import { state } from "./store.js";
import "./school-dashboard.css";

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const number = (value) =>
  Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
const fmt = (value) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
const distinct = (rows) => [
  ...new Map(
    rows.filter((r) => r && typeof r.id === "string").map((r) => [r.id, r]),
  ).values(),
];
const bands = [
  { id: "not-started", label: "Not started", color: "#c6bdd9" },
  { id: "below-half", label: "Below halfway", color: "#b58bba" },
  { id: "halfway", label: "Halfway or more", color: "#8b78ca" },
  { id: "complete", label: "Hours goal met", color: "#7454df" },
];
let rosterQuery = "",
  rosterBand = "all",
  rosterPage = 0,
  selectedSchool = null;
const pageSize = 20;
let dashboardModel = null;

export function schoolDashboardModel(
  school,
  records = state,
  now = new Date(),
) {
  // Only this explicitly tagged fictional scenario uses a future as-of date.
  if (school.fixtureId === "herwell")
    now = new Date("2026-12-18T12:00:00-05:00");
  const goal = number(school.requiredHours);
  const students = distinct(school.students || [])
    .map((s) => {
      const hours = number(s.hours);
      const progress =
        goal > 0 ? Math.min(100, Math.floor((hours / goal) * 100)) : null;
      const band =
        goal <= 0
          ? "no-goal"
          : hours >= goal
            ? "complete"
            : hours === 0
              ? "not-started"
              : hours < goal / 2
                ? "below-half"
                : "halfway";
      return {
        id: s.id,
        name: String(s.name || "Student"),
        hours,
        applications: number(s.applications),
        progress,
        band,
      };
    })
    .sort((a, b) => a.hours - b.hours || a.name.localeCompare(b.name));
  const studentIds = new Set(students.map((s) => s.id));
  const applications = new Map(
    distinct(records.applications || [])
      .filter((a) => {
        const connection =
          a.studentSnapshot?.schoolConnection ||
          (a.studentId === records.student?.id
            ? records.student.schoolConnection
            : null);
        return (
          connection?.schoolId === school.id && studentIds.has(a.studentId)
        );
      })
      .map((a) => [a.id, a]),
  );
  const hours = distinct(records.hours || []).filter(
    (h) =>
      applications.get(h.applicationId)?.studentId === h.studentId &&
      number(h.hours) > 0,
  );
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("en-US", { month: "short" }),
      fullLabel: date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
      hours: 0,
    };
  });
  let datedApproved = 0,
    undatedApproved = 0;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  for (const h of hours.filter((h) => h.status === "approved")) {
    const validDate =
      /^\d{4}-\d{2}-\d{2}$/.test(h.date || "") &&
      !Number.isNaN(Date.parse(h.date)) &&
      new Date(h.date + "T12:00:00Z").toISOString().slice(0, 10) === h.date;
    if (!validDate) {
      undatedApproved += number(h.hours);
      continue;
    }
    if (h.date > today) continue;
    const month = months.find((m) => m.key === h.date.slice(0, 7));
    if (month) {
      month.hours += number(h.hours);
      datedApproved += number(h.hours);
    }
  }
  const submissions = distinct(records.requirementSubmissions || []).filter(
    (r) => r.schoolId === school.id,
  );
  const reviews = [
    { label: "Awaiting school review", status: "pending", color: "#8b78ca" },
    {
      label: "Corrections requested",
      status: "needs_corrections",
      color: "#bd8a50",
    },
    { label: "School approved", status: "approved", color: "#7454df" },
  ].map((r) => ({
    ...r,
    value: submissions.filter((s) => s.status === r.status).length,
  }));
  return {
    students,
    goal,
    bands: bands.map((b) => ({
      ...b,
      value: students.filter((s) => s.band === b.id).length,
    })),
    totalHours: students.reduce((sum, s) => sum + s.hours, 0),
    completed: goal > 0 ? students.filter((s) => s.hours >= goal).length : 0,
    months,
    datedApproved,
    undatedApproved,
    reviews,
    pendingReviews: reviews[0].value,
  };
}
function donut(model) {
  if (!model.students.length)
    return '<div class="dashboard-empty">Connect students to see their progress distribution.</div>';
  if (!model.goal)
    return '<div class="dashboard-empty">Set a positive hours goal in School settings to see progress.</div>';
  let angle = 0;
  const slices = model.bands.map((b) => {
    const start = angle;
    angle += (b.value / model.students.length) * 360;
    return `${b.color} ${start}deg ${angle}deg`;
  });
  return `<div class="school-donut-layout"><div class="school-donut" role="img" aria-label="Student goal progress: ${model.bands.map((b) => `${b.label}, ${b.value} students`).join("; ")}" style="background:conic-gradient(${slices.join(",")})"><span><strong>${model.students.length}</strong>students</span></div><div class="school-chart-legend">${model.bands.map((b) => `<button type="button" data-roster-band="${b.id}" aria-pressed="${rosterBand === b.id}"><span class="legend-dot" style="background:${b.color}" aria-hidden="true"></span><span>${b.label}</span><strong>${b.value}</strong><small>${Math.round((b.value / model.students.length) * 100)}%</small></button>`).join("")}</div></div><p class="school-chart-note">Select a category to filter the student list. Goal met means coordinator-approved hours reached ${fmt(model.goal)}; school acceptance remains separate.</p>`;
}
function monthlyBars(model) {
  if (!model.datedApproved)
    return `<div class="dashboard-empty">No dated approved service records in the last six months.</div>`;
  const max = Math.max(...model.months.map((m) => m.hours));
  const ceiling = Math.max(5, Math.ceil(max / 5) * 5);
  return `<div class="school-month-chart"><div class="school-chart-axis" aria-hidden="true"><span>${fmt(ceiling)} h</span><span>${fmt(ceiling / 2)} h</span><span>0 h</span></div><div class="school-month-bars" role="list" aria-label="Monthly approved service hours">${model.months.map((m) => `<div class="school-month" role="listitem" aria-label="${m.fullLabel}: ${fmt(m.hours)} approved hours"><div class="school-month-plot"><span>${fmt(m.hours)}</span><div class="school-month-bar" style="height:${(m.hours / ceiling) * 160}px"></div></div><span>${m.label}</span></div>`).join("")}</div></div>`;
}
export function schoolDashboardMarkup(school) {
  if (selectedSchool !== school.id) {
    selectedSchool = school.id;
    rosterQuery = "";
    rosterBand = "all";
    rosterPage = 0;
  }
  const model = schoolDashboardModel(school);
  dashboardModel = model;
  const rate =
    model.students.length && model.goal
      ? `${Math.round((model.completed / model.students.length) * 100)}%`
      : "—";
  return `<section class="school-dashboard" aria-label="School analytics dashboard"><div class="school-dashboard-heading"><div><h2>School overview</h2><p>All connected students · ${model.goal > 0 ? `${fmt(model.goal)}-hour goal` : "No hours goal set"}</p></div><a class="secondary" href="#school-review-queue">Review school submissions (${model.pendingReviews}) →</a></div>
    <div class="school-kpis"><article><strong>${model.students.length}</strong><span>Connected students</span></article><article><strong>${rate}</strong><span>Hours goal met · ${model.completed} students</span></article><article><strong>${fmt(model.totalHours)}</strong><span>Coordinator-approved hours</span></article><article><strong>${model.pendingReviews}</strong><span>School submissions awaiting review</span></article></div>
    <div class="school-charts"><section class="school-chart"><h3>Student goal progress</h3>${donut(model)}</section><section class="school-chart"><h3>Approved service hours by month</h3>${school.fixtureId === "herwell" ? '<p class="demo-notice">HerWell future-data scenario · chart as of December 18, 2026.</p>' : ""}<p class="school-chart-note">${esc(model.months[0].fullLabel)}–${esc(model.months[5].fullLabel)} · service date</p>${monthlyBars(model)}<p class="school-chart-note">Dated, school-linked records for connected students only; roster summaries may include additional history.${model.undatedApproved ? ` ${fmt(model.undatedApproved)} approved hours have no valid service date and are excluded.` : ""}</p></section></div>
    <section class="school-chart school-review-chart"><h3>School submission workload</h3><p class="school-chart-note">Capstone and service learning submissions linked to this school, including former students.</p><div class="school-review-bars">${model.reviews.map((r) => `<div><span>${r.label}</span><div class="review-bar-track"><span style="width:${(r.value / Math.max(1, ...model.reviews.map((x) => x.value))) * 100}%;background:${r.color}"></span></div><strong>${r.value}</strong></div>`).join("")}</div><a href="#school-review-queue">Open submission reviews →</a></section>
    <details class="school-metric-definitions"><summary>What these numbers include</summary><p>Student counts, total hours, and goal progress use this school’s connected roster summaries. Goal progress is approved hours divided by the school’s configured target, capped at 100%. Pending hours do not count. The monthly chart uses available dated approved hour records joined to matching student applications and the application-time school connection. It covers only the six displayed calendar months, through today. The workload chart counts school submissions by review status. These are browser-local demo records, not a live district feed.</p></details></section>`;
}
function filteredStudents() {
  return (dashboardModel?.students || []).filter(
    (s) =>
      (!rosterQuery ||
        s.name.toLocaleLowerCase().includes(rosterQuery.toLocaleLowerCase())) &&
      (rosterBand === "all" || s.band === rosterBand),
  );
}
function rosterRows() {
  const rows = filteredStudents();
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  rosterPage = Math.min(rosterPage, pages - 1);
  const visible = rows.slice(
    rosterPage * pageSize,
    (rosterPage + 1) * pageSize,
  );
  const goal = dashboardModel.goal;
  return `<p id="school-roster-count" role="status">${rows.length} matching students · Page ${rosterPage + 1} of ${pages}</p>${rows.length ? `<div class="school-table-wrap"><table class="school-table"><thead><tr><th scope="col">Student</th><th scope="col">Applications</th><th scope="col">Approved hours</th><th scope="col">Hours goal progress</th></tr></thead><tbody>${visible.map((s) => `<tr><th scope="row">${esc(s.name)}</th><td>${fmt(s.applications)}</td><td>${fmt(s.hours)} / ${fmt(goal)}</td><td>${s.progress === null ? "Goal not set" : `<progress max="100" value="${s.progress}" aria-label="${esc(s.name)} graduation hours progress"></progress><span>${s.progress}%</span>`}</td></tr>`).join("")}</tbody></table></div>` : '<div class="dashboard-empty">No students match these filters.</div>'}<div class="school-pagination"><button class="secondary" data-roster-page="-1" ${rosterPage === 0 ? "disabled" : ""}>Previous students</button><button class="secondary" data-roster-page="1" ${rosterPage >= pages - 1 ? "disabled" : ""}>Next students</button></div>`;
}
export function schoolRosterMarkup() {
  return `<section class="profile-card school-portal" id="school-student-list"><div class="school-dashboard-heading"><div><h2>Student participation</h2><p>Search or filter the roster. Overview charts above always show all connected students.</p></div><button class="secondary" id="export-school-roster">Export filtered students</button></div><div class="school-roster-controls"><label>Find a student<input id="school-student-search" type="search" maxlength="120" value="${esc(rosterQuery)}" placeholder="Search by name" aria-controls="school-roster-results"></label><label>Hours progress<select id="school-progress-filter" aria-controls="school-roster-results"><option value="all">All students</option>${[...bands, { id: "no-goal", label: "Goal not set" }].map((b) => `<option value="${b.id}" ${rosterBand === b.id ? "selected" : ""}>${b.label}</option>`).join("")}</select></label><button class="text-button" id="reset-school-filters">Clear filters</button></div><div id="school-roster-results">${rosterRows()}</div></section>`;
}
export function bindSchoolDashboard() {
  const update = () => {
    document.querySelector("#school-roster-results").innerHTML = rosterRows();
    document.querySelectorAll("[data-roster-page]").forEach(
      (b) =>
        (b.onclick = () => {
          rosterPage += Number(b.dataset.rosterPage);
          update();
          document
            .querySelector("#school-roster-count")
            .scrollIntoView({ block: "nearest" });
        }),
    );
    document
      .querySelectorAll("[data-roster-band]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.rosterBand === rosterBand),
        ),
      );
  };
  if (!document.querySelector("#school-roster-results")) return;
  document.querySelector("#school-student-search").oninput = (e) => {
    rosterQuery = e.target.value;
    rosterPage = 0;
    update();
  };
  document.querySelector("#school-progress-filter").onchange = (e) => {
    rosterBand = e.target.value;
    rosterPage = 0;
    update();
  };
  document.querySelector("#reset-school-filters").onclick = () => {
    rosterQuery = "";
    rosterBand = "all";
    rosterPage = 0;
    document.querySelector("#school-student-search").value = "";
    document.querySelector("#school-progress-filter").value = "all";
    update();
  };
  document.querySelectorAll("[data-roster-band]").forEach(
    (b) =>
      (b.onclick = () => {
        rosterBand = b.dataset.rosterBand;
        rosterPage = 0;
        document.querySelector("#school-progress-filter").value = rosterBand;
        update();
        document
          .querySelector("#school-student-list")
          .scrollIntoView({ block: "start", behavior: "instant" });
        document.querySelector("#school-progress-filter").focus();
      }),
  );
  document.querySelector("#export-school-roster").onclick = () => {
    const cell = (value) =>
      '"' +
      String(value)
        .replace(/^[=+@\-\t\r\n]/, (c) => "'" + c)
        .replace(/"/g, '""') +
      '"';
    const rows = [
      [
        "Student",
        "Applications",
        "Coordinator-approved hours",
        "Hours goal",
        "Progress percent",
      ],
      ...filteredStudents().map((s) => [
        s.name,
        s.applications,
        s.hours,
        dashboardModel.goal,
        s.progress ?? "Goal not set",
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.map((r) => r.map(cell).join(",")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "school-student-progress.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  update();
}
