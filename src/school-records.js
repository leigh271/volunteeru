import { state, persist, refresh } from "./store.js";
import { currentSchoolRequirements } from "./school.js";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const kinds = {
  capstone: "Capstone project",
  serviceLearning: "Service learning",
};
function registry() {
  try {
    const r = JSON.parse(localStorage.getItem("volunteeru.schools.v1"));
    return r?.version === 1 && Array.isArray(r.schools) ? r : { schools: [] };
  } catch {
    return { schools: [] };
  }
}
function schoolFor(a) {
  return (
    a.studentSnapshot?.schoolConnection ||
    (a.studentId === state.student.id ? state.student.schoolConnection : null)
  );
}
export function studentRequirementsMarkup() {
  const school = currentSchoolRequirements();
  if (!school) return "";
  const records = state.requirementSubmissions.filter(
    (r) => r.studentId === state.student.id && r.schoolId === school.id,
  );
  return `<section class="journey-panel"><h2>Your school project submissions</h2><p>Submit a reflection or project summary for your school coordinator’s review. This local demo does not send files to a real school.</p>${Object.entries(
    kinds,
  )
    .filter(([key]) => school[key])
    .map(([key, label]) => {
      const latest = records.filter((r) => r.kind === key).at(-1);
      return `<article class="journey-record"><h3>${label}</h3><p>${esc(school[key])}</p>${latest ? `<span class="chip">${esc({ pending: "Awaiting school review", approved: "School approved · DEMO", needs_corrections: "Corrections requested" }[latest.status])}</span><p>${esc(latest.evidence)}</p>${latest.note ? `<p>School feedback: ${esc(latest.note)}</p>` : ""}` : ""}${!latest || latest.status === "needs_corrections" ? `<form data-requirement-form="${key}"><label>${label} summary or reflection<textarea name="evidence" minlength="20" maxlength="2000" rows="3" required></textarea></label><button class="primary">Submit for school review</button></form>` : ""}</article>`;
    })
    .join("")}<p role="status" id="requirement-status"></p></section>`;
}
export function bindStudentRequirements(render) {
  document.querySelectorAll("[data-requirement-form]").forEach((form) =>
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const evidence = new FormData(form).get("evidence").trim(),
        kind = form.dataset.requirementForm;
      refresh();
      const school = currentSchoolRequirements();
      if (
        !school ||
        !school[kind] ||
        evidence.length < 20 ||
        evidence.length > 2000
      )
        return;
      const latest = state.requirementSubmissions
        .filter(
          (r) =>
            r.schoolId === school.id &&
            r.studentId === state.student.id &&
            r.kind === kind,
        )
        .at(-1);
      if (latest && latest.status !== "needs_corrections") return render();
      state.requirementSubmissions.push({
        id: crypto.randomUUID(),
        schoolId: school.id,
        studentId: state.student.id,
        studentName: state.student.name,
        kind,
        evidence,
        status: "pending",
        submittedAt: new Date().toISOString(),
      });
      if (persist()) render();
    }),
  );
}
export function schoolRecordsMarkup() {
  const data = registry(),
    school = data.schools.find((s) => s.id === data.activeId);
  if (!school) return "";
  const apps = state.applications.filter(
    (a) => schoolFor(a)?.schoolId === school.id,
  );
  const approvedHours = state.hours.filter(
    (h) =>
      h.status === "approved" &&
      Number.isFinite(Number(h.hours)) &&
      Number(h.hours) > 0 &&
      apps.some((a) => a.id === h.applicationId && a.studentId === h.studentId),
  );
  const attendance = state.attendanceRecords.filter(
    (r) =>
      r.status === "present" &&
      apps.some(
        (a) =>
          a.id === r.applicationId &&
          a.studentId === r.studentId &&
          a.opportunityId === r.eventId,
      ),
  );
  const submissions = state.requirementSubmissions.filter(
    (r) => r.schoolId === school.id,
  );
  return `<section class="profile-card school-portal"><h2>Verified attendance & school review</h2><p>Browser-local demo. Only records linked to this school are shown; nonprofit-approved hours update automatically. Self-reported school names do not establish membership.</p><div class="school-stats"><article><strong>${new Set(attendance.map((a) => a.applicationId)).size}</strong><span>Coordinator-confirmed attendances</span></article><article><strong>${approvedHours.reduce((n, h) => n + Number(h.hours), 0).toFixed(2)}</strong><span>Approved service hours</span></article><article><strong>${submissions.filter((r) => r.status === "approved").length}</strong><span>Approved school submissions</span></article></div>${
    approvedHours.length
      ? `<div class="school-table-wrap"><table class="school-table"><thead><tr><th>Student</th><th>Date</th><th>Approved hours</th></tr></thead><tbody>${approvedHours
          .map((h) => {
            const a = apps.find((a) => a.id === h.applicationId);
            return `<tr><td>${esc(a.studentSnapshot?.name || "Student")}</td><td>${esc(h.date || "Not supplied")}</td><td>${esc(h.hours)}</td></tr>`;
          })
          .join("")}</tbody></table></div>`
      : "<p>No nonprofit-approved hours linked to this school yet.</p>"
  }<h3>Capstone & service learning review</h3>${submissions.length ? submissions.map((r) => `<article class="journey-record"><h3>${esc(r.studentName)} · ${esc(kinds[r.kind])}</h3><p>${esc(r.evidence)}</p><span class="chip">${esc(r.status)}</span>${r.status === "pending" ? `<label>School review note<input maxlength="500" data-requirement-note="${esc(r.id)}"></label><div class="nearby-actions"><button class="primary" data-school-review="${esc(r.id)}" data-review="approved">Approve submission</button><button class="secondary" data-school-review="${esc(r.id)}" data-review="needs_corrections">Request corrections</button></div>` : r.note ? `<p>${esc(r.note)}</p>` : ""}</article>`).join("") : "<p>No student project submissions yet.</p>"}<p id="school-review-status" role="status"></p></section>`;
}
export function bindSchoolRecords(render) {
  document.querySelectorAll("[data-school-review]").forEach((button) =>
    button.addEventListener("click", () => {
      const note =
        document
          .querySelector(
            `[data-requirement-note="${CSS.escape(button.dataset.schoolReview)}"]`,
          )
          ?.value.trim() || "";
      refresh();
      const data = registry(),
        school = data.schools.find((s) => s.id === data.activeId),
        r = state.requirementSubmissions.find(
          (r) =>
            r.id === button.dataset.schoolReview &&
            r.schoolId === school?.id &&
            r.status === "pending",
        );
      if (!r) return;
      if (button.dataset.review === "needs_corrections" && !note) {
        document.querySelector("#school-review-status").textContent =
          "Add feedback so the student knows what to correct.";
        return;
      }
      r.status = button.dataset.review;
      r.note = note;
      r.updatedAt = new Date().toISOString();
      if (persist()) render();
    }),
  );
}
