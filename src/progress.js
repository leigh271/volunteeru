import { bloomMarkup } from "./bloom.js";
import {
  studentRequirementsMarkup,
  bindStudentRequirements,
} from "./school-records.js";
import { eventStudentMarkup, bindEventStudent } from "./event-student.js";
import { state, persist, refresh } from "./store.js";
import { currentSchoolRequirements } from "./school.js";
import { opportunities } from "./data.js";

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const trainingKey = "volunteeru.training.v1";
const accepted = (application) =>
  ["approved", "accepted"].includes(application.status);
const modules = [
  {
    id: "orientation",
    title: "Getting ready to volunteer",
    text: "Before each event, confirm the location, schedule, age requirements, guardian consent if needed, and your coordinator’s instructions.",
  },
  {
    id: "respect",
    title: "Respect, privacy & asking for help",
    text: "Respect everyone’s boundaries. Do not share personal stories or photos without permission. Ask your designated coordinator when you are unsure or need support.",
  },
];
function training() {
  try {
    const stored = JSON.parse(localStorage.getItem(trainingKey));
    return stored?.version === 1 &&
      stored.students &&
      typeof stored.students === "object"
      ? stored
      : { version: 1, students: {} };
  } catch {
    return { version: 1, students: {} };
  }
}
function studentApplications() {
  return state.applications.filter((a) => a.studentId === state.student.id);
}
function studentHours() {
  const ids = new Set(studentApplications().map((a) => a.id));
  return state.hours.filter(
    (h) => h.studentId === state.student.id && ids.has(h.applicationId),
  );
}
const role = (application) =>
  opportunities.find((o) => o.id === application?.opportunityId)?.role ||
  application?.opportunitySnapshot?.role ||
  "Volunteer opportunity";

export function progressMarkup() {
  const applications = studentApplications();
  const hours = studentHours();
  const verified = hours
    .filter(
      (h) =>
        h.status === "approved" &&
        Number.isFinite(Number(h.hours)) &&
        Number(h.hours) > 0,
    )
    .reduce((sum, h) => sum + Number(h.hours), 0);
  const pending = hours
    .filter((h) => h.status === "pending")
    .reduce((sum, h) => sum + (Number(h.hours) || 0), 0);
  const liveRequirements = currentSchoolRequirements();
  const connection = state.student.schoolConnection
    ? {
        ...state.student.schoolConnection,
        ...(liveRequirements
          ? {
              targetHours: liveRequirements.requiredHours,
              capstone: liveRequirements.capstone,
              serviceLearning: liveRequirements.serviceLearning,
            }
          : {}),
      }
    : null;
  const target = Number(connection?.targetHours);
  const percentage =
    target > 0 ? Math.min(100, Math.round((verified / target) * 100)) : 0;
  const shifts = state.shifts.filter(
    (s) =>
      s.studentId === state.student.id &&
      s.status === "confirmed" &&
      applications.some((a) => a.id === s.applicationId && accepted(a)),
  );
  const approved = applications.filter(accepted);
  const storedTraining = training().students[state.student.id];
  const completed = Array.isArray(storedTraining) ? storedTraining : [];
  return `<section class="page-heading"><div><div class="eyebrow">EVERY LITTLE STEP ADDS UP</div><h1>Your <em>impact journey.</em></h1><p>Follow your events, learning, and school progress in one place.</p></div></section>
    <p class="demo-notice">Local demo records. Self-reported training and submitted hours are separate from coordinator verification.</p>
    ${bloomMarkup()}
    <div class="journey-stats"><article><span>✓</span><strong>${esc(verified)}</strong><p>Approved hours</p></article><article><span>◷</span><strong>${esc(pending)}</strong><p>Hours awaiting review</p></article><article><span>▦</span><strong>${shifts.length}</strong><p>Confirmed event shifts</p></article></div>
    <section class="journey-panel"><h2>Your school requirements</h2>${connection ? `<p>${esc(connection.schoolName)}${connection.isDemo ? " · DEMO" : ""}</p>${target > 0 ? `<div class="journey-meter" role="progressbar" aria-label="School service hours" aria-valuemin="0" aria-valuemax="${esc(target)}" aria-valuenow="${esc(Math.min(target, verified))}"><span style="width:${percentage}%"></span></div><p><strong>${esc(verified)} / ${esc(target)} approved hours</strong> · ${percentage}% of your goal</p>` : "<p>Your school has not provided an hours target yet.</p>"}<div class="journey-requirements"><p><strong>Capstone project</strong><br>${esc(connection.capstone || "No capstone requirement provided.")}</p><p><strong>Service learning</strong><br>${esc(connection.serviceLearning || "No service learning requirement provided.")}</p></div>` : `<p>Connect through your school’s registration link to see its hours, capstone, and service learning requirements.</p><button class="secondary" data-page="Profile">Open your profile →</button>`}</section>
    <div class="journey-columns"><section class="journey-panel"><h2>Registered events</h2><p>Confirmed shifts appear after nonprofit approval and scheduling.</p>${
      shifts.length
        ? shifts
            .map((s) => {
              const a = applications.find((a) => a.id === s.applicationId);
              const date = new Date(s.startsAt);
              return `<article class="journey-record"><h3>${esc(role(a))}</h3><p>${Number.isNaN(date.getTime()) ? "Schedule to be confirmed" : esc(date.toLocaleString())}</p><span class="chip">Confirmed${s.isDemo || a?.isDemo ? " · DEMO" : ""}</span></article>`;
            })
            .join("")
        : `<div class="journey-empty">No confirmed shifts yet. An approved application alone does not confirm a scheduled event.</div>`
    }${
      applications.some((a) => a.status === "pending")
        ? `<h3>Waiting for a decision</h3>${applications
            .filter((a) => a.status === "pending")
            .map(
              (a) =>
                `<p class="journey-record">${esc(role(a))}<br><small>Application pending · DEMO</small></p>`,
            )
            .join("")}`
        : ""
    }</section>
    <section class="journey-panel"><h2>A little preparation</h2><p>These introductory guides do not replace required nonprofit training.</p>${modules.map((m) => `<article class="journey-record"><h3>${m.title}</h3><p>${m.text}</p><button class="${completed.includes(m.id) ? "secondary" : "primary"}" data-training="${m.id}" aria-pressed="${completed.includes(m.id)}">${completed.includes(m.id) ? "✓ Read · self-reported" : "Mark as read"}</button></article>`).join("")}<p><small>Reading is recorded on this device. A coordinator has not certified completion.</small></p><p role="status" id="training-status"></p></section></div>
    ${studentRequirementsMarkup()}<div class="nearby-actions"><button class="primary" data-page="Event Day">Event-day check-in & reflections →</button></div>${eventStudentMarkup()}<section class="journey-panel"><h2>Your volunteer hours</h2><p>Submit completed time for review. Submitting does not verify attendance or approve hours.</p>${approved.length ? `<form id="hours-form" class="journey-hours-form"><label>Approved opportunity<select name="applicationId" required>${approved.map((a) => `<option value="${esc(a.id)}">${esc(role(a))}</option>`).join("")}</select></label><label>Date volunteered<input type="date" name="date" required max="${localToday()}"></label><label>Hours completed<input name="hours" type="number" min="0.25" max="24" step="0.25" required></label><label class="journey-note">What did you do?<textarea name="description" required minlength="10" maxlength="1000" rows="3" placeholder="Describe your contribution for your coordinator."></textarea></label><button class="primary" type="submit">Submit for review →</button><p id="hours-status" role="status"></p></form>` : `<div class="journey-empty">Once a nonprofit approves an application, you can submit completed volunteer time here.</div>`}${hours.length ? `<div class="journey-hours-list">${hours.map((h) => `<article class="journey-record"><h3>${esc(role(applications.find((a) => a.id === h.applicationId)))}</h3><p>${esc(h.hours)} hours${h.date ? ` · ${esc(h.date)}` : ""}</p><span class="chip">${esc({ approved: "Approved", pending: "Awaiting coordinator review", needs_corrections: "Corrections requested", rejected: "Not approved" }[h.status] || "Awaiting review")}${h.isDemo ? " · DEMO" : ""}</span>${h.correctionNote ? `<p>${esc(h.correctionNote)}</p>` : ""}</article>`).join("")}</div>` : ""}</section>`;
}

export function bindProgress(rerender) {
  bindEventStudent(rerender);
  bindStudentRequirements(rerender);
  document.querySelectorAll("[data-training]").forEach((button) =>
    button.addEventListener("click", () => {
      const record = training();
      const completed = Array.isArray(record.students[state.student.id])
        ? record.students[state.student.id]
        : [];
      const id = button.dataset.training;
      record.students[state.student.id] = completed.includes(id)
        ? completed.filter((x) => x !== id)
        : [...completed, id];
      try {
        localStorage.setItem(trainingKey, JSON.stringify(record));
        rerender();
      } catch {
        document.querySelector("#training-status").textContent =
          "Your browser could not save training progress. Please enable local storage.";
      }
    }),
  );
  document.querySelector("#hours-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    refresh();
    const application = studentApplications().find(
      (a) => a.id === values.get("applicationId") && accepted(a),
    );
    const hours = Number(values.get("hours"));
    const date = values.get("date");
    const description = String(values.get("description")).trim();
    const status = document.querySelector("#hours-status");
    const dateValue = new Date(`${date}T12:00:00`);
    if (
      !application ||
      !Number.isFinite(hours) ||
      hours <= 0 ||
      hours > 24 ||
      (hours * 4) % 1 !== 0 ||
      description.length < 10 ||
      description.length > 1000 ||
      Number.isNaN(dateValue.getTime()) ||
      date > localToday()
    ) {
      status.textContent =
        "Check the opportunity, past date, hours (up to 24 in quarter-hour steps), and description.";
      return;
    }
    if (
      studentHours().some(
        (h) =>
          h.applicationId === application.id &&
          h.date === date &&
          h.status !== "rejected",
      )
    ) {
      status.textContent =
        "You already submitted time for this opportunity on this date. Ask your coordinator to review or correct that entry.";
      return;
    }
    const opportunity = opportunities.find(
      (o) => o.id === application.opportunityId,
    );
    state.hours.push({
      id: crypto.randomUUID(),
      studentId: state.student.id,
      applicationId: application.id,
      hours,
      date,
      description,
      status: "pending",
      submittedAt: new Date().toISOString(),
      isDemo: opportunity?.isDemo === true || application.isDemo === true,
    });
    if (persist()) rerender();
  });
}
