import {
  eventPeople,
  eventWorkflow,
  saveEventWorkflow,
} from "./command-center-model.js";
import {
  campaign,
  createDemoInvitation,
  responseCounts,
  simulateBlast,
  simulateInvitationReminder,
  createTrainingMessage,
  simulateTrainingSend,
  respondToDemoInvitation,
  markDemoTrainingComplete,
  processDemoTrainingReminder,
} from "./outreach-demo-model.js";
import { easternTime } from "./events-calendar-model.js";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const num = (n, label) =>
  `<div class="cc-number"><strong>${n}</strong><span>${label}</span></div>`;
const channels = ["LinkedIn", "Eventbrite", "Blueboard", "Email", "Text"];
const status = (t) => `<span class="cc-pill">${esc(t)}</span>`;
function group(title, rows, subtitle) {
  return `<details class="cc-fold"><summary><span>${title}<small>${subtitle}</small></span><span class="cc-fold-end"><b>${rows.length}</b><i>⌄</i></span></summary><div class="cc-fold-body">${rows.length ? rows.slice(0, 8).map(personRow).join("") + (rows.length > 8 ? '<p class="cc-field-help">Showing eight volunteers. Open the volunteer directory for the full list.</p>' : "") : '<p class="cc-empty">No volunteers in this group.</p>'}</div></details>`;
}
function personRow(p) {
  return `<div class="cc-person-row"><button class="cc-person-name" data-cc-profile="${esc(p.profile.volunteer_id)}"><span class="cc-avatar">${esc(
    p.profile.name
      .split(" ")
      .map((n) => n[0])
      .join(""),
  )}</span><span><strong>${esc(p.profile.name)}</strong><small>${esc(p.registration.role)} · ${esc(p.profile.school_name)}</small></span></button><div class="cc-person-actions">${status(p.trained ? "Training complete" : "Waiting on training")}${p.trained && p.decision === "pending" ? `<button class="cc-secondary" data-cc-approve="${esc(p.profile.volunteer_id)}" ${p.eligible ? "" : 'disabled title="Coordinator must verify required guardian consent"'}>Confirm ready</button>` : ""}${p.decision === "approved" ? status("Ready ✓") : ""}</div></div>`;
}
export function outreachMarkup(d, e, w) {
  const c = campaign(d, e.id),
    counts = responseCounts(d, e.id);
  return `<div class="cc-demo-flow-label">✧ Demo AI workflow <span>Generated examples and sends are simulated.</span></div><div class="cc-invite-grid"><section class="cc-card"><div class="cc-card-heading"><div><span class="cc-card-icon">↗</span><h3>Create your invitation</h3></div>${status(c ? "Generated" : "Start here")}</div><p class="cc-card-description">Your outreach assistant brings the event details into one invitation, ready for every channel.</p>${c ? `<div class="out-message-preview"><strong>${esc(c.subject)}</strong><p>${esc(c.body.split("\n\n").slice(1, 2).join(""))}</p><button class="cc-text-button" id="out-edit">Review full invitation →</button></div>` : '<div class="out-generate-placeholder"><span>✧</span><p>Event name, date, location, and signup link.<br>One clear invitation.</p></div>'}<div class="cc-form-actions"><button class="cc-primary" id="out-generate">✧ ${c ? "Regenerate invitation" : "Generate invitation"}</button>${c ? `<button class="cc-secondary" id="out-blast">${c.blastAt ? "Run demo blast again" : "Send demo blast →"}</button>` : ""}</div><div class="out-channels"><h4>Your channels</h4>${channels.map((channel, i) => `<div class="out-channel-row"><span class="cc-channel-logo ch-${i}">${["in", "e", "B", "✉", "▤"][i]}</span><strong>${channel}</strong>${c?.blastAt ? `<span class="out-simulated">Demo sent ✓</span><a class="cc-text-button" target="_blank" rel="noopener" href="/?view=student&outreach=${encodeURIComponent(e.id)}&channel=${encodeURIComponent(channel)}">Open demo post ↗</a>` : '<span class="out-simulated">Ready after generation</span>'}</div>`).join("")}</div></section><div class="cc-side-stack"><section class="cc-card"><div class="cc-card-heading"><h3>Who’s coming?</h3>${status("Demo responses")}</div><div class="out-response-grid">${num(counts.yes, "said yes")}${num(counts.waiting, "haven’t responded")}${num(counts.remaining, "places still open")}</div><p class="cc-field-help">Open a demo post, follow its signup link, and respond as an invited volunteer. Return here to see the count update.</p>${c?.blastAt ? `<a class="cc-primary out-full-width" target="_blank" rel="noopener" href="${esc(c.signupUrl)}">Open volunteer website ↗</a>` : ""}<button class="cc-text-button" data-cc-stage="2">Continue to registration & training →</button></section><section class="cc-card out-reminder-card"><span class="cc-card-icon">♧</span><h3>Still need volunteers?</h3><p>Send a demo reminder only to invited people who haven’t responded.</p><button class="cc-secondary" id="out-remind" ${c?.blastAt && counts.remaining && counts.waiting ? "" : "disabled"}>Resend event reminders</button>${!counts.remaining ? "<small>All volunteer places are currently filled.</small>" : ""}<p id="out-remind-status" class="cc-status" role="status"></p></section></div></div>`;
}
export function trainingMarkup(d, e, w) {
  const people = eventPeople(d, e.id),
    trained = people.filter((p) => p.trained),
    waiting = people.filter((p) => !p.trained),
    plan = w.trainingPlan;
  return `<div class="out-team-journey"><div><span class="out-journey-step">1</span><div><strong>${people.length} registered</strong><small>Accepted the invitation</small></div></div><span class="out-journey-arrow">→</span><div><span class="out-journey-step">2</span><div><strong>${trained.length} completed training</strong><small>${waiting.length} still waiting</small></div></div></div><div class="cc-invite-grid"><section class="cc-card"><div class="cc-card-heading"><div><span class="cc-card-icon">♧</span><h3>Review your team</h3></div></div><p class="cc-card-description">From registration to training, one clear step at a time. Confirm readiness after reviewing training and any required consent.</p>${group("Registered volunteers", people, "Everyone who has joined this event")}${group("Ready for your approval", trained, "Training complete · coordinator checks still apply")}${group("Waiting on training", waiting, "A friendly reminder can help")}</section><div class="cc-side-stack"><section class="cc-card cc-assistant"><span class="cc-eyebrow">TRAINING ASSISTANT · DEMO</span><h3>A warm welcome.<br>A clear next step.</h3><p>“Thank you for accepting to volunteer. Please complete your training before the event.”</p><button class="cc-primary" id="out-training-generate">✧ ${plan?.body ? "Review training message" : "Generate training message"}</button>${plan?.body ? `<button class="cc-secondary" id="out-training-send">${plan.sentAt ? "Resend demo training message" : "Send demo training message"}</button><a class="cc-text-button" target="_blank" rel="noopener" href="${esc(plan.url)}">Open training webpage ↗</a>` : ""}<small>Simulated generation and delivery · no real email is sent</small><p id="out-training-status" class="cc-status" role="status"></p></section><section class="cc-card"><h3>Keep training on track</h3><p class="cc-field-help">Choose a deadline and when the demo reminder should be queued.</p><form id="out-deadline"><label>Training deadline (Eastern)<input type="datetime-local" name="deadline" required value="${plan?.deadlineLocal || ""}"></label><label>Remind before deadline<select name="hours">${[24, 48, 72].map((h) => `<option value="${h}" ${Number(plan?.hours || 24) === h ? "selected" : ""}>${h} hours before</option>`).join("")}</select></label><label class="out-inline-check"><input type="checkbox" name="enabled" ${plan?.enabled ? "checked" : ""}> Automatic demo reminders</label><button class="cc-secondary">Save reminder plan</button></form>${plan?.reminderAt ? `<p class="cc-field-help">Scheduled: ${esc(new Date(plan.reminderAt).toLocaleString("en-US", { timeZone: "America/New_York" }))} Eastern.</p><button class="cc-text-button" id="out-preview-due">Preview deadline reminder now →</button>` : ""}<p class="cc-field-help">The demo checks due reminders while this app is open. It does not send external messages or run when the app is closed.</p><p id="out-deadline-status" class="cc-status" role="status"></p></section></div></div>`;
}
function dialog(html) {
  document.querySelector("#out-dialog")?.remove();
  const el = document.createElement("dialog");
  el.id = "out-dialog";
  el.className = "cc cc-modal";
  el.innerHTML = `<button class="cc-close" aria-label="Close message dialog">×</button>${html}`;
  document.body.append(el);
  el.querySelector(".cc-close").onclick = () => el.close();
  el.onclose = () => el.remove();
  el.showModal();
  return el;
}
export function bindOutreachDemo(d, e, { render, save }) {
  const on = (id, fn) => {
      const n = document.getElementById(id);
      if (n) n.onclick = fn;
    },
    note = (id, t) => {
      const n = document.getElementById(id);
      if (n) n.textContent = t;
    };
  function editMessage(kind) {
    const w = eventWorkflow(d, e.id),
      message = kind === "campaign" ? w.campaign : w.trainingPlan;
    if (!message) return;
    const el = dialog(
      `<div class="cc-eyebrow">DEMO AI MESSAGE · REVIEW BEFORE THE DEMO SEND</div><h2>${kind === "campaign" ? "Your event invitation" : "Welcome your volunteers"}</h2><p>This is a generated template preview. No live AI call is made.</p><form><label>Subject<input name="subject" value="${esc(message.subject)}" required maxlength="200"></label><label>Message<textarea name="body" rows="10" required maxlength="5000">${esc(message.body)}</textarea></label><button class="cc-primary">Save message</button></form>`,
    );
    el.querySelector("form").onsubmit = (ev) => {
      ev.preventDefault();
      const f = new FormData(ev.target);
      saveEventWorkflow(d, e.id, {
        [kind]: { ...message, subject: f.get("subject"), body: f.get("body") },
      });
      save(d);
      el.close();
      render();
    };
  }
  on("out-generate", () => {
    createDemoInvitation(d, e.id, location.origin);
    save(d);
    render();
  });
  on("out-edit", () => editMessage("campaign"));
  on("out-blast", () => {
    simulateBlast(d, e.id);
    save(d);
    render();
  });
  on("out-remind", () => {
    try {
      const n = simulateInvitationReminder(d, e.id);
      save(d);
      note(
        "out-remind-status",
        `Demo reminders queued for ${n} people. No external messages were sent.`,
      );
    } catch (err) {
      note("out-remind-status", err.message);
    }
  });
  on("out-training-generate", () => {
    createTrainingMessage(d, e.id, location.origin);
    save(d);
    render();
    editMessage("trainingPlan");
  });
  on("out-training-send", () => {
    try {
      const n = simulateTrainingSend(d, e.id);
      save(d);
      render();
      note(
        "out-training-status",
        `Demo training message queued for ${n} volunteers.`,
      );
    } catch (err) {
      note("out-training-status", err.message);
    }
  });
  const form = document.getElementById("out-deadline");
  if (form)
    form.onsubmit = (ev) => {
      ev.preventDefault();
      try {
        const f = new FormData(form),
          local = f.get("deadline"),
          [date, time] = local.split("T"),
          deadline = easternTime(date, time),
          hours = Number(f.get("hours"));
        if (
          Date.parse(deadline) >
          Math.min(...e.shifts.map((s) => Date.parse(s.start)))
        )
          throw Error("Choose a training deadline before the event starts.");
        const old = eventWorkflow(d, e.id).trainingPlan || {};
        saveEventWorkflow(d, e.id, {
          trainingPlan: {
            ...old,
            deadline,
            deadlineLocal: local,
            hours,
            reminderAt: new Date(
              Date.parse(deadline) - hours * 3600000,
            ).toISOString(),
            enabled: f.get("enabled") === "on",
            reminderKey: null,
          },
        });
        save(d);
        render();
        note(
          "out-deadline-status",
          "Demo reminder plan saved. Generate and send the training message to activate it.",
        );
      } catch (err) {
        note("out-deadline-status", err.message);
      }
    };
  on("out-preview-due", () => {
    const plan = eventWorkflow(d, e.id).trainingPlan;
    if (!plan?.enabled || !plan.sentAt) {
      note(
        "out-deadline-status",
        "Enable automatic demo reminders and send the demo training message first.",
      );
      return;
    }
    const n = processDemoTrainingReminder(d, e.id, Date.parse(plan.reminderAt));
    save(d);
    note(
      "out-deadline-status",
      `${n} demo deadline reminders queued. Completed training is excluded. Repeating this preview will not queue the same reminder twice.`,
    );
  });
}
const readDemo = () => {
  try {
    return JSON.parse(localStorage.getItem("volunteeru.herwell.v1"));
  } catch {
    return null;
  }
};
export function publicOutreachMarkup(d, eventId, training = false) {
  const e = d?.events.find((e) => e.id === eventId);
  if (!e)
    return '<div class="cc"><h2>Demo event unavailable</h2><p>Open the event’s command center first.</p></div>';
  const c = campaign(d, eventId),
    params = new URLSearchParams(location.search),
    channel = params.get("channel") || "VolunteerU",
    signup = params.has("signup");
  if (!training && !signup)
    return `<div class="cc out-public"><div class="cc-eyebrow">${esc(channel.toUpperCase())} · DEMO POST</div><section class="cc-card"><span class="cc-pill">Simulated platform preview</span><h1>${esc(e.title)}</h1><p>Flowers for Women · ${esc(e.date)} · ${esc(e.venue)}</p><div class="out-public-message">${esc(c?.body || "Generate an invitation in the command center first.")}</div><a class="cc-primary" href="/?view=student&outreach=${encodeURIComponent(eventId)}&signup=1&channel=${encodeURIComponent(channel)}">Volunteer on VolunteerU →</a></section><p class="cc-field-help">This is a local demo post, not a real ${esc(channel)} account or external delivery.</p></div>`;
  const ids = training
    ? eventPeople(d, eventId).map((p) => p.profile.volunteer_id)
    : (c?.audience || []).map((a) => a.personId);
  return `<div class="cc out-public"><div class="cc-eyebrow">FLOWERS FOR WOMEN · VOLUNTEERU</div><h1>${training ? "Your next step starts here." : "A little time. A lot of good."}</h1><p>${esc(e.title)} · ${esc(e.date)} · ${esc(e.venue)}</p><section class="cc-card"><h2>${training ? "Complete your sample training" : "Will you volunteer with us?"}</h2><p class="cc-field-help">Choose a fictional volunteer for this demo. This does not authenticate a real person.</p>${training && eventWorkflow(d, eventId).trainingPlan?.deadline ? `<p class="out-deadline-public">Complete by ${esc(new Date(eventWorkflow(d, eventId).trainingPlan.deadline).toLocaleString("en-US", { timeZone: "America/New_York" }))} Eastern.</p>` : ""}<label>Demo volunteer<select id="out-public-person"><option value="">Choose your name</option>${ids
    .map((id) => {
      const p = d.profiles.find((p) => p.volunteer_id === id);
      return `<option value="${esc(id)}" ${params.get("person") === id ? "selected" : ""}>${esc(p?.name || id)}</option>`;
    })
    .join(
      "",
    )}</select></label>${training ? `<form id="out-training-complete" class="out-training-form"><p>Read the event date and location above, arrive with your coordinator’s instructions, and keep community members’ personal information private.</p><label class="out-inline-check"><input type="checkbox" name="schedule" required> I reviewed the event details.</label><label class="out-inline-check"><input type="checkbox" name="privacy" required> I will protect personal information and ask staff when I need help.</label><label>If someone asks a health question, what should you do?<select name="answer" required><option value="">Choose an answer</option><option value="staff">Refer them to an authorized staff member</option><option value="guess">Give my best guess</option></select></label><button class="cc-primary">Complete demo training</button></form>` : `<div class="out-rsvp-actions"><button class="cc-primary" id="out-yes">Yes, I’ll volunteer</button><button class="cc-secondary" id="out-no">Not this time</button></div>`}<p id="out-public-status" class="cc-status" role="status"></p><div id="out-public-next"></div></section><a class="cc-text-button" href="/?view=nonprofit&page=Command%20Center">Back to the coordinator workspace →</a><p class="cc-field-help">Demo only. Registration does not approve attendance or volunteer hours.</p></div>`;
}
export function bindPublicOutreach(eventId, training, save) {
  const note = (t) =>
    (document.querySelector("#out-public-status").textContent = t);
  const respond = (response) => {
    try {
      const d = readDemo(),
        personId = document.querySelector("#out-public-person").value;
      if (!personId) throw Error("Choose a demo volunteer first.");
      respondToDemoInvitation(d, eventId, personId, response);
      save(d);
      note(
        response === "yes"
          ? "You’re registered. The coordinator’s dashboard has updated."
          : "Your demo response has been recorded.",
      );
      if (response === "yes")
        document.querySelector("#out-public-next").innerHTML =
          `<a class="cc-primary" href="/?view=student&training=${encodeURIComponent(eventId)}&person=${encodeURIComponent(personId)}">Continue to training →</a>`;
    } catch (err) {
      note(err.message);
    }
  };
  const yes = document.querySelector("#out-yes");
  if (yes) yes.onclick = () => respond("yes");
  const no = document.querySelector("#out-no");
  if (no) no.onclick = () => respond("no");
  const form = document.querySelector("#out-training-complete");
  if (form)
    form.onsubmit = (ev) => {
      ev.preventDefault();
      try {
        const personId = document.querySelector("#out-public-person").value;
        if (!personId) throw Error("Choose a demo volunteer first.");
        if (new FormData(form).get("answer") !== "staff")
          throw Error("Please refer health questions to authorized staff.");
        const d = readDemo();
        markDemoTrainingComplete(d, eventId, personId);
        save(d);
        note(
          "Demo training complete. Your coordinator can now review your readiness.",
        );
      } catch (err) {
        note(err.message);
      }
    };
}
