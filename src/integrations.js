let session = null,
  records = null,
  feedback = "",
  restored = false,
  generation = 0;
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
async function request(path, method = "GET", data, expectedSession = session) {
  const r = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(expectedSession?.csrfToken
        ? { "X-CSRF-Token": expectedSession.csrfToken }
        : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  let result;
  try {
    result = await r.json();
  } catch {
    throw new Error(
      "The authenticated API is unavailable. Start the server to connect.",
    );
  }
  if (!r.ok) throw new Error(result.error || "The request failed.");
  return result;
}
export function integrationsMarkup() {
  return `<section class="page-heading"><div><div class="eyebrow">YOUR CONNECTED WORKSPACE</div><h1>One platform. <em>Shared progress.</em></h1><p>Authenticated server records are separate from the browser demo.</p></div></section><section class="integration-panel"><span class="chip">${session ? "Connected · authenticated workspace" : "Server workspace · sign in to connect"}</span><p>School and nonprofit registration records a declaration of authorization; it does not independently verify institutional authority. Use sample accounts for this prototype.</p><p id="integration-feedback" role="status">${esc(feedback)}</p>${session ? `<div class="integration-actions"><h2>${esc(session.user.name)} · ${esc(session.user.role)}</h2><button class="secondary" id="server-refresh">Refresh server records</button><button class="secondary" id="server-logout">Sign out</button></div>${workspace()}` : `<div class="integration-columns"><form id="server-login"><h2>Sign in</h2><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Password<input name="password" type="password" required autocomplete="current-password"></label><button class="primary">Sign in to server</button></form><form id="server-register"><h2>Create a server account</h2><label>Account role<select name="role"><option value="student">Student</option><option value="school_admin">School administrator</option><option value="nonprofit">Nonprofit coordinator</option></select></label><label>Your name<input name="name" required maxlength="80" autocomplete="name"></label><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Password (12+ characters)<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label><label>Age (students only)<input name="age" type="number" min="13" max="100"></label><label>School or nonprofit name (coordinators)<input name="organizationName" maxlength="120"></label><label>School invitation token (students)<input name="invitationToken" value="${esc(new URLSearchParams(location.search).get("invite") || "")}"></label><label class="checkbox"><input type="checkbox" name="authorized"> I am authorized to coordinate this school or nonprofit (coordinators only).</label><button class="primary">Create server account</button></form></div>`}</section>`;
}
function workspace() {
  if (!records) return "<p>Refresh to load your role’s records.</p>";
  if (session.user.role === "school_admin")
    return `<h3>School reporting</h3><p>${esc(records.school?.name)} · ${esc(records.school?.required_hours)} required hours</p><button class="primary" id="server-invite">Create 7-day student invitation</button><div class="integration-records">${(records.students || []).map((s) => `<article><strong>${esc(s.name)}</strong><p>${esc(s.approvedHours)} approved hours</p></article>`).join("") || "<p>No students have joined through your invitation yet.</p>"}</div>`;
  return `${session.user.role === "nonprofit" ? '<section><h3>AI meeting and impact drafts</h3><p>These explicit actions send notes or scoped aggregate records to the server-configured AI provider. No provider is connected by default.</p><form id="server-ai-notes"><label>Meeting transcript for AI processing<textarea name="transcript" required maxlength="25000" rows="4"></textarea></label><button class="secondary">Generate server AI meeting draft</button></form><button class="secondary" id="server-ai-report">Generate server AI impact summary</button></section>' : ""}<h3>${session.user.role === "nonprofit" ? "Manage your published events" : "Published volunteer events"}</h3>${session.user.role === "nonprofit" ? eventForm() + '<form id="server-update"><h3>Post an in-app update</h3><label>Event<select name="eventId">' + (records.events || []).map((e) => '<option value="' + esc(e.id) + '">' + esc(e.title) + "</option>").join("") + '</select></label><label>Update message<textarea name="message" required maxlength="2000"></textarea></label><button class="secondary">Queue in-app update</button></form>' : ""}<div class="integration-records">${(records.events || []).map((e) => `<article><h4>${esc(e.title)}</h4><p>${esc(e.date)} · ${esc(e.city)} · ${esc(e.location)} · ${esc(e.hours)} hours · ${esc(e.status)}</p><p>${esc(e.description)}</p>${session.user.role === "student" ? `<button class="secondary" data-server-apply="${esc(e.id)}">Apply to event</button>` : ""}</article>`).join("") || "<p>No server events yet.</p>"}</div>${session.user.role === "student" ? "<h3>Your in-app updates</h3>" + (records.notifications || []).map((n) => "<article><p>" + esc(n.message) + "</p><small>In-app only · " + esc(n.created_at) + "</small></article>").join("") : ""}<h3>Applications & attendance</h3><div class="integration-records">${(records.applications || []).map((a) => `<article><strong>${esc(a.title)}</strong><p>${esc(a.student_name || "Your registration")} · ${esc(a.status)}</p>${session.user.role === "nonprofit" ? `<button class="secondary" data-server-decision="${esc(a.id)}" data-status="approved">Approve</button><button class="secondary" data-server-decision="${esc(a.id)}" data-status="rejected">Decline</button>` : a.status === "approved" ? `<button class="secondary" data-server-check="${esc(a.id)}" data-action="check-in">Check in</button><button class="secondary" data-server-check="${esc(a.id)}" data-action="check-out">Check out</button>` : ""}</article>`).join("") || "<p>No applications yet.</p>"}${
    session.user.role === "nonprofit"
      ? (records.attendance || [])
          .filter((a) => a.checked_out && a.status !== "present")
          .map(
            (a) =>
              `<article><p>Attendance ${esc(a.application_id)} · checked out</p><button class="secondary" data-server-attendance="${esc(a.id)}">Verify attendance present</button></article>`,
          )
          .join("")
      : ""
  }</div><h3>Server-timed volunteer hours</h3><p>Check-in and check-out use the server clock. A coordinator verifies attendance and approves elapsed time after the event.</p>${(records.hours || []).map((h) => `<article><strong>${esc(h.title)}</strong><p>${esc(Math.round(h.hours * 100) / 100)} hours · ${esc(h.status)}</p>${session.user.role === "nonprofit" && h.status !== "approved" ? `<button class="secondary" data-server-hours="${esc(h.id)}">Approve verified hours</button>` : ""}</article>`).join("") || "<p>No submitted hours yet.</p>"}`;
}
function eventForm() {
  return `<form id="server-event" class="integration-event"><h3>Create a published event</h3><label>Event title<input name="title" required maxlength="120"></label><label>Event date<input name="date" type="date" required></label><label>Event start time<input name="time" type="time" required></label><label>Duration in hours<input name="hours" type="number" min="0.25" max="24" step="0.25" value="2" required></label><label>City<input name="city" required></label><label>County<select name="location"><option>Broward</option><option>Miami-Dade</option><option>Remote</option></select></label><label>Latitude (optional)<input name="lat" type="number" min="-90" max="90" step="any"></label><label>Longitude (optional)<input name="lon" type="number" min="-180" max="180" step="any"></label><label>Minimum age<input name="minAge" type="number" min="13" max="100" value="13" required></label><label>Volunteer target<input name="volunteerTarget" type="number" min="1" max="10000" value="10" required></label><label>Volunteer work<textarea name="description" required maxlength="2000"></textarea></label><label>Requirements<textarea name="requirements" required maxlength="2000"></textarea></label><button class="primary">Publish server event</button></form>`;
}
async function loadRecords(expected = session, requestGeneration = generation) {
  if (!expected) return;
  const get = (path) => request(path, "GET", undefined, expected);
  let next;
  if (expected.user.role === "school_admin")
    next = await get("/reports/school");
  else {
    const [events, applications, hours, attendance, notifications] =
      await Promise.all([
        get("/events"),
        get("/applications"),
        get("/hours"),
        get("/attendance"),
        expected.user.role === "student"
          ? get("/notifications")
          : Promise.resolve({}),
      ]);
    next = {
      ...events,
      ...applications,
      ...hours,
      ...attendance,
      ...notifications,
    };
  }
  if (generation === requestGeneration && session === expected) records = next;
}
export function bindIntegrations(rerender) {
  const roleSelect = document.querySelector('#server-register [name="role"]');
  function showRoleFields() {
    const student = roleSelect?.value === "student";
    for (const name of [
      "age",
      "invitationToken",
      "organizationName",
      "authorized",
    ]) {
      const input = document.querySelector(`#server-register [name="${name}"]`);
      if (!input) continue;
      const applies = ["age", "invitationToken"].includes(name)
        ? student
        : !student;
      input.closest("label").hidden = !applies;
      input.disabled = !applies;
      input.required = applies;
    }
  }
  roleSelect?.addEventListener("change", showRoleFields);
  if (roleSelect) showRoleFields();

  if (!restored) {
    restored = true;
    restoreIntegrationSession(rerender);
  }
  const act = async (action) => {
    const actionGeneration = ++generation;
    try {
      feedback = "";
      await action(actionGeneration);
      if (generation !== actionGeneration) return;
      if (session) await loadRecords(session, actionGeneration);
      if (generation === actionGeneration) rerender();
    } catch (e) {
      if (generation !== actionGeneration) return;
      feedback = e.message;
      const target = document.querySelector("#integration-feedback");
      if (target) target.textContent = feedback;
    }
  };
  document
    .querySelector("#server-ai-notes")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const transcript = new FormData(event.currentTarget).get("transcript");
      act(async (actionGeneration) => {
        const result = await request("/nonprofit/plans", "POST", {
          transcript,
        });
        if (generation === actionGeneration)
          feedback = JSON.stringify(result, null, 2);
      });
    });
  document.querySelector("#server-ai-report")?.addEventListener("click", () =>
    act(async (actionGeneration) => {
      const result = await request("/nonprofit/reports", "POST", {});
      if (generation === actionGeneration)
        feedback = JSON.stringify(result, null, 2);
    }),
  );
  document
    .querySelector("#server-update")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      act(async (actionGeneration) => {
        const result = await request("/notifications", "POST", data);
        if (generation === actionGeneration)
          feedback = `Queued ${result.queued} in-app updates. No email or SMS was sent.`;
      });
    });
  document
    .querySelector("#server-login")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const d = Object.fromEntries(new FormData(event.currentTarget));
      act(async (actionGeneration) => {
        const next = await request("/auth/login", "POST", d);
        if (generation === actionGeneration) {
          session = next;
          records = null;
        }
      });
    });
  document
    .querySelector("#server-register")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const d = Object.fromEntries(new FormData(event.currentTarget));
      d.age = d.age ? Number(d.age) : null;
      d.schoolName = d.organizationName;
      d.authorized = d.authorized === "on";
      act(async (actionGeneration) => {
        const next = await request("/auth/register", "POST", d);
        if (generation === actionGeneration) {
          session = next;
          records = null;
        }
      });
    });
  document
    .querySelector("#server-refresh")
    ?.addEventListener("click", () => act(async () => {}));
  document.querySelector("#server-logout")?.addEventListener("click", () =>
    act(async (actionGeneration) => {
      await request("/auth/logout", "POST", {});
      if (generation === actionGeneration) {
        session = null;
        records = null;
      }
    }),
  );
  document.querySelector("#server-invite")?.addEventListener("click", () =>
    act(async (actionGeneration) => {
      const result = await request("/schools/invitations", "POST", {});
      if (generation === actionGeneration)
        feedback = `Student registration link: ${result.registrationLink}`;
    }),
  );
  document
    .querySelector("#server-event")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const d = Object.fromEntries(new FormData(event.currentTarget));
      d.startsAt = new Date(`${d.date}T${d.time}`).toISOString();
      for (const key of ["hours", "minAge", "volunteerTarget"])
        d[key] = Number(d[key]);
      d.lat = d.lat ? Number(d.lat) : null;
      d.lon = d.lon ? Number(d.lon) : null;
      d.status = "published";
      act(() => request("/events", "POST", d));
    });
  document.querySelectorAll("[data-server-apply]").forEach(
    (b) =>
      (b.onclick = () =>
        act(() =>
          request("/applications", "POST", {
            eventId: b.dataset.serverApply,
          }),
        )),
  );
  document.querySelectorAll("[data-server-decision]").forEach(
    (b) =>
      (b.onclick = () =>
        act(() =>
          request(`/applications/${b.dataset.serverDecision}`, "PATCH", {
            status: b.dataset.status,
          }),
        )),
  );
  document.querySelectorAll("[data-server-check]").forEach(
    (b) =>
      (b.onclick = () =>
        act(() =>
          request(`/attendance/${b.dataset.action}`, "POST", {
            applicationId: b.dataset.serverCheck,
          }),
        )),
  );
  document.querySelectorAll("[data-server-attendance]").forEach(
    (b) =>
      (b.onclick = () =>
        act(() =>
          request(`/attendance/${b.dataset.serverAttendance}`, "PATCH", {
            status: "present",
          }),
        )),
  );
  document.querySelectorAll("[data-server-hours]").forEach(
    (b) =>
      (b.onclick = () =>
        act(() =>
          request(`/hours/${b.dataset.serverHours}`, "PATCH", {
            status: "approved",
          }),
        )),
  );
}
export async function restoreIntegrationSession(rerender) {
  const requestGeneration = generation;
  try {
    const restoredSession = await request(
      "/auth/session",
      "GET",
      undefined,
      null,
    );
    if (generation !== requestGeneration || session) return;
    session = restoredSession;
    records = null;
    await loadRecords(restoredSession, requestGeneration);
    if (generation === requestGeneration && session === restoredSession)
      rerender();
  } catch {
    if (generation === requestGeneration) {
      session = null;
      records = null;
    }
  }
}

export const integrationSession = () => session;
export const requestIntegration = request;

export async function signOutStudentIntegration() {
  generation++;
  if (session?.user?.role !== "student") return;
  await request("/auth/logout", "POST", {});
  session = null;
  records = null;
  feedback = "Signed out.";
}
