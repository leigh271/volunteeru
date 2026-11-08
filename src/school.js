import { state, persist } from "./store.js";

const KEY = "volunteeru.schools.v1";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
function readSchools() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (data?.version === 1 && Array.isArray(data.schools)) {
      data.schools = data.schools.filter(
        (school) =>
          school &&
          typeof school.id === "string" &&
          typeof school.name === "string" &&
          Number.isFinite(school.requiredHours) &&
          school.requiredHours >= 0,
      );
      for (const school of data.schools)
        school.students = Array.isArray(school.students)
          ? school.students.filter(
              (student) =>
                student &&
                typeof student.id === "string" &&
                typeof student.name === "string" &&
                Number.isFinite(student.hours) &&
                student.hours >= 0 &&
                Number.isInteger(student.applications) &&
                student.applications >= 0,
            )
          : [];
      data.activeId =
        typeof data.activeId === "string" &&
        data.schools.some((school) => school.id === data.activeId)
          ? data.activeId
          : null;
      return data;
    }
  } catch {
    /* A missing or damaged demo registry starts empty. */
  }
  return { version: 1, activeId: null, schools: [] };
}
function writeSchools(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    alert(
      "This browser could not save the school. Please enable local storage and try again.",
    );
    return false;
  }
}
const activeSchool = (data) =>
  data.schools.find((school) => school.id === data.activeId);
function requirementFields(school = {}) {
  return `<label>Graduation volunteer hours<input name="requiredHours" type="number" min="0" max="10000" step="1" required value="${esc(school.requiredHours ?? 40)}"></label><label>Capstone project requirement<textarea name="capstone" maxlength="500" rows="2" placeholder="For example: present your community impact project">${esc(school.capstone)}</textarea></label><label>Service learning requirement<textarea name="serviceLearning" maxlength="500" rows="2" placeholder="For example: submit a reflection after each event">${esc(school.serviceLearning)}</textarea></label>`;
}
export function syncSchoolStudent() {
  const connection = state.student.schoolConnection;
  const data = readSchools();
  const school = connection?.isDemo
    ? data.schools.find((item) => item.id === connection.schoolId)
    : null;
  let changed = false;
  // A student's current demo membership belongs to one school at a time.
  // Remove stale roster entries when they switch or disconnect their school.
  for (const item of data.schools) {
    if (item.id === school?.id) continue;
    const students = item.students.filter(
      (student) => student.id !== state.student.id,
    );
    if (students.length !== item.students.length) {
      item.students = students;
      changed = true;
    }
  }
  if (!school || !state.student.onboarded) {
    if (changed) writeSchools(data);
    return;
  }
  const applicationIds = new Set(
    state.applications
      .filter((item) => item.studentId === state.student.id)
      .map((item) => item.id),
  );
  const approvedHours = state.hours
    .filter(
      (item) =>
        item.studentId === state.student.id &&
        applicationIds.has(item.applicationId) &&
        item.status === "approved" &&
        Number.isFinite(Number(item.hours)) &&
        Number(item.hours) > 0,
    )
    .reduce((sum, item) => sum + Number(item.hours), 0);
  const record = {
    id: state.student.id,
    name: state.student.name,
    hours: approvedHours,
    applications: applicationIds.size,
    updatedAt: new Date().toISOString(),
  };
  school.students = Array.isArray(school.students) ? school.students : [];
  const index = school.students.findIndex((item) => item.id === record.id);
  if (
    index >= 0 &&
    school.students[index].name === record.name &&
    school.students[index].hours === record.hours &&
    school.students[index].applications === record.applications
  ) {
    if (changed) writeSchools(data);
    return;
  }
  if (index < 0) school.students.push(record);
  else school.students[index] = record;
  writeSchools(data);
}
export function schoolPortalMarkup() {
  syncSchoolStudent();
  const data = readSchools(),
    school = activeSchool(data);
  const heading = `<section class="page-heading"><div><div class="eyebrow">GROW GOOD TOGETHER</div><h1>Your school’s <em>impact.</em></h1><p>Give students a clear path from their first event to their graduation goal.</p></div></section><p class="demo-notice">School administrator demo · no authentication or cross-device sharing. Registration records your authorization declaration; it does not verify your role. Use sample information only.</p>`;
  if (!school)
    return `${heading}<section class="profile-card school-portal"><h2>Register your school</h2><p>Set the goals. Share the invitation. See the good add up.</p><form id="register-school"><div class="school-form-grid"><label>School name<input name="schoolName" required maxlength="120" autocomplete="organization"></label><label>Administrator or coordinator name<input name="adminName" required maxlength="80" autocomplete="name"></label><label>Work email<input name="adminEmail" required type="email" maxlength="160" autocomplete="email"></label>${requirementFields()}</div><label class="checkbox"><input name="authorized" type="checkbox" required> I am authorized to coordinate volunteering for this school.</label><button class="primary" type="submit">Create demo school →</button><p id="school-feedback" role="status"></p></form>${data.schools.length ? `<label>Or reopen a demo school on this device<select id="select-school"><option value="">Choose a school</option>${data.schools.map((item) => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("")}</select></label>` : ""}</section>`;
  const students = school.students || [],
    total = students.reduce((sum, item) => sum + Number(item.hours || 0), 0);
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set("school", school.id);
  return `${heading}<section class="profile-card school-portal"><div class="school-title"><div><span class="eyebrow">DEMO SCHOOL WORKSPACE</span><h2>${esc(school.name)}</h2><p>Coordinator: ${esc(school.adminName)}</p></div><button class="secondary" id="switch-school">Switch / register school</button></div><div class="school-stats"><article><strong>${students.length}</strong><span>Connected students</span></article><article><strong>${esc(total)}</strong><span>Approved volunteer hours</span></article><article><strong>${esc(school.requiredHours)}</strong><span>Graduation hours per student</span></article></div><section class="school-invite-card"><h3>Your student registration link</h3><p>Students review your school and confirm the connection before joining. This demo link works only in the browser where the school was created.</p><label>Unique school link<input id="school-link" readonly value="${esc(url.href)}"></label><button class="secondary" id="copy-school-link">Copy registration link</button><p id="school-copy-status" role="status"></p></section><h3>School requirements</h3><form id="school-requirements"><div class="school-form-grid">${requirementFields(school)}</div><button class="primary" type="submit">Save requirements</button><p id="school-feedback" role="status"></p></form></section><section class="profile-card school-portal"><h2>Student participation</h2><p>Only approved hours count toward the goal. Attendance and hours must be verified by the nonprofit integration.</p>${
    students.length
      ? `<div class="school-table-wrap"><table class="school-table"><thead><tr><th scope="col">Student</th><th scope="col">Applications</th><th scope="col">Approved hours</th><th scope="col">Graduation progress</th></tr></thead><tbody>${students
          .map((student) => {
            const percent =
              school.requiredHours > 0
                ? Math.min(
                    100,
                    Math.round((student.hours / school.requiredHours) * 100),
                  )
                : 100;
            return `<tr><th scope="row">${esc(student.name)}</th><td>${esc(student.applications)}</td><td>${esc(student.hours)} / ${esc(school.requiredHours)}</td><td><progress max="100" value="${percent}" aria-label="${esc(student.name)} graduation hours progress"></progress><span>${percent}%</span></td></tr>`;
          })
          .join("")}</tbody></table></div>`
      : `<div class="empty"><h3>Your first student is one invitation away.</h3><p>Share the school link and complete a student profile to see participation here.</p></div>`
  }</section>`;
}
export function bindSchoolPortal(rerender) {
  document
    .querySelector("#register-school")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const values = new FormData(form),
        name = values.get("schoolName").trim(),
        adminName = values.get("adminName").trim();
      if (!name || !adminName) {
        document.querySelector("#school-feedback").textContent =
          "Please enter a school and coordinator name.";
        return;
      }
      const data = readSchools();
      const school = {
        id: crypto.randomUUID(),
        name,
        adminName,
        adminEmail: values.get("adminEmail").trim(),
        requiredHours: Number(values.get("requiredHours")),
        capstone: values.get("capstone").trim(),
        serviceLearning: values.get("serviceLearning").trim(),
        isDemo: true,
        students: [],
      };
      data.schools.push(school);
      data.activeId = school.id;
      if (writeSchools(data)) rerender();
    });
  document
    .querySelector("#select-school")
    ?.addEventListener("change", (event) => {
      const data = readSchools();
      if (!data.schools.some((item) => item.id === event.target.value)) return;
      data.activeId = event.target.value;
      if (writeSchools(data)) rerender();
    });
  document.querySelector("#switch-school")?.addEventListener("click", () => {
    const data = readSchools();
    data.activeId = null;
    if (writeSchools(data)) rerender();
  });
  document
    .querySelector("#school-requirements")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!event.currentTarget.reportValidity()) return;
      const values = new FormData(event.currentTarget),
        data = readSchools(),
        school = activeSchool(data);
      if (!school) return;
      Object.assign(school, {
        requiredHours: Number(values.get("requiredHours")),
        capstone: values.get("capstone").trim(),
        serviceLearning: values.get("serviceLearning").trim(),
      });
      if (writeSchools(data)) {
        rerender();
        document.querySelector("#school-feedback").textContent =
          "School requirements saved.";
      }
    });
  document
    .querySelector("#copy-school-link")
    ?.addEventListener("click", async () => {
      const input = document.querySelector("#school-link"),
        status = document.querySelector("#school-copy-status");
      try {
        await navigator.clipboard.writeText(input.value);
        status.textContent = "Registration link copied.";
      } catch {
        input.select();
        status.textContent = "Select and copy the link above.";
      }
    });
}
export function invitationMarkup() {
  const id = new URLSearchParams(window.location.search).get("school");
  if (!id) return "";
  const school = readSchools().schools.find((item) => item.id === id);
  if (!school)
    return `<section class="school-invitation"><h3>School invitation unavailable</h3><p>This demo school link cannot be found in this browser. Ask the coordinator to open the link on the device where the school was created.</p></section>`;
  const joined = state.student.schoolConnection?.schoolId === id;
  return `<section class="school-invitation school-link-invitation"><span class="demo-label">SCHOOL INVITATION · DEMO</span><h3>${esc(school.name)}</h3><p>${esc(school.requiredHours)} graduation hours${school.capstone ? ` · Capstone: ${esc(school.capstone)}` : ""}${school.serviceLearning ? ` · Service learning: ${esc(school.serviceLearning)}` : ""}</p>${joined ? `<span class="chip">School connected · requirements linked</span>` : `<p>Confirm your school to attach these requirements to your student profile. Demo data stays in this browser.</p><button type="button" class="secondary" id="join-school-link">Join this school</button>`}</section>`;
}
export function bindInvitation(rerender) {
  document.querySelector("#join-school-link")?.addEventListener("click", () => {
    const id = new URLSearchParams(window.location.search).get("school"),
      school = readSchools().schools.find((item) => item.id === id);
    if (!school) return;
    const identityForm = document.querySelector("#profile-form");
    if (identityForm?.querySelector('[name="name"]')) {
      const draft = new FormData(identityForm);
      state.student.name = String(draft.get("name") || "").trim();
      const age = Number(draft.get("age"));
      state.student.age =
        Number.isInteger(age) && age >= 13 && age <= 100 ? age : "";
    }
    state.student.schoolConnection = {
      schoolId: school.id,
      schoolName: school.name,
      isDemo: true,
      targetHours: school.requiredHours,
      capstone: school.capstone,
      serviceLearning: school.serviceLearning,
    };
    state.student.school = school.name;
    if (persist()) {
      syncSchoolStudent();
      rerender();
    }
  });
}
export function currentSchoolRequirements() {
  const connection = state.student.schoolConnection;
  if (!connection?.isDemo) return null;
  return (
    readSchools().schools.find((item) => item.id === connection.schoolId) ||
    null
  );
}
