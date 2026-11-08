import {
  outreachMarkup,
  trainingMarkup,
  bindOutreachDemo,
} from "./outreach-demo.js";
import {
  workflowSteps,
  outreachChannels,
  eventTitle,
  eventWorkflow,
  saveEventWorkflow,
  eventPeople,
  preparationTasks,
  reviewVolunteer,
  recruitmentSummary,
  completion,
  invitationText,
  followupText,
} from "./command-center-model.js";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let selectedEvent = "E001",
  viewStage = null,
  expandedRows = 6;
const fmt = (v) =>
  v
    ? new Date(v).toLocaleTimeString("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
const displayDate = (v) =>
  new Date(v + "T12:00:00-05:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
const pill = (text, type = "") =>
  `<span class="cc-pill ${type}">${esc(text)}</span>`;
const fold = (title, count, body, extra = "", open = false) =>
  `<details class="cc-fold" ${open ? "open" : ""}><summary><span>${title}<small>${extra}</small></span><span class="cc-fold-end"><b>${count}</b><i>⌄</i></span></summary><div class="cc-fold-body">${body}</div></details>`;
const stat = (value, text) =>
  `<div class="cc-number"><strong>${esc(value)}</strong><span>${esc(text)}</span></div>`;
function header(e) {
  return `<div class="cc-top"><div><div class="cc-eyebrow">FLOWERS FOR WOMEN</div><h1>Command center<span>✳</span></h1><p>A little planning. A whole lot of good.</p></div><label class="cc-event-label">YOUR EVENT<select id="cc-event" aria-label="Choose event">${e.options}</select></label></div>`;
}
export function commandCenterMarkup(d) {
  const e = d.events.find((e) => e.id === selectedEvent) || d.events[0];
  selectedEvent = e.id;
  const w = eventWorkflow(d, e.id),
    stage = viewStage ?? w.stage ?? 0,
    done = completion(d, e.id);
  const headings = [
    [
      "Let’s get everything ready.",
      "Gather your tasks, organize the essentials, and decide how many people you need.",
    ],
    [
      "Bring your community together.",
      "One invitation. Every place you reach volunteers.",
    ],
    [
      "From yes to ready.",
      "Welcome registered volunteers, guide their training, and follow their progress.",
    ],
    [
      "Welcome your volunteers.",
      "A simple check-in page for students. A clear list for you.",
    ],
    [
      "Make every hour count.",
      "See who checked out and follow up on missing times.",
    ],
  ];
  return `<div class="cc">${header({ ...e, options: d.events.map((x) => `<option value="${x.id}" ${x.id === e.id ? "selected" : ""}>${esc(eventTitle(x))} · ${displayDate(x.date)}</option>`).join("") })}<div class="cc-modebar"><div class="cc-mode-tabs" role="tablist" aria-label="Event phase"><button role="tab" data-cc-stage="0" aria-selected="${stage < 3}">Before the event</button><button role="tab" data-cc-stage="3" aria-selected="${stage >= 3}">Event day</button></div><span class="cc-demo">◉ &nbsp; Demo workspace <span>· no messages sent</span></span></div><div class="cc-stage-heading"><div><span class="cc-step-label">STEP ${stage + 1} OF 5 &nbsp; / &nbsp; ${workflowSteps[stage].toUpperCase()}</span><h2>${headings[stage][0]}</h2><p>${headings[stage][1]}</p></div><div class="cc-date"><span>▦</span><div><strong>${displayDate(e.date)}</strong><small>${esc(e.county)}</small></div></div></div><div id="cc-content">${[prepare, invite, volunteers, checkin, checkout][stage](d, e, w)}</div><div class="cc-progress"><div class="cc-progress-top"><span>${done.filter(Boolean).length} of 5 stages complete</span><span>Explore each stage at your pace</span></div><div class="cc-steps">${workflowSteps.map((s, i) => `<button data-cc-stage="${i}" class="${i === stage ? "current" : ""} ${done[i] ? "complete" : ""}" ${i === stage ? 'aria-current="step"' : ""}><span>${done[i] ? "✓" : i + 1}</span><strong>${s}</strong></button>`).join("")}</div><div class="cc-progress-actions"><button class="cc-back" data-cc-stage="${Math.max(0, stage - 1)}" ${stage === 0 ? "disabled" : ""}>← Back</button><span>Progress is saved as you work.</span>${stage < 4 ? `<button class="cc-primary" data-cc-stage="${stage + 1}">Next: ${workflowSteps[stage + 1]} <span>→</span></button>` : `<button class="cc-primary" id="cc-finish">Finish event-day review ✓</button>`}</div></div><p class="cc-status" id="cc-status" role="status"></p><details class="cc-demo-details"><summary>About this demo</summary><p>Flowers for Women is the fictional nonprofit in the supplied dataset. November attendance is a future-data simulation. Live AI and email, text, and social delivery are not connected.</p></details></div>`;
}
function prepare(d, e, w) {
  const tasks = preparationTasks(d, e.id),
    completed = tasks.filter((t) => t.status === "completed").length,
    people = eventPeople(d, e.id);
  const groups = [
    [
      "Venue & supplies",
      tasks.filter((t) =>
        /suppl|indoor|weather|canop|rain|food|decoration/i.test(t.title),
      ),
    ],
    [
      "Team & school requirements",
      tasks.filter(
        (t) =>
          !/suppl|indoor|weather|canop|rain|food|decoration/i.test(t.title),
      ),
    ],
  ];
  return `<div class="cc-prepare-grid"><section class="cc-card cc-main-card"><div class="cc-card-heading"><div><span class="cc-card-icon">☷</span><h3>Your preparation checklist</h3></div><span class="cc-muted">${completed} of ${tasks.length} done</span></div><p class="cc-card-description">Everything that needs to happen before the invitations go out.</p><div class="cc-thin-meter"><i style="width:${tasks.length ? (completed / tasks.length) * 100 : 0}%"></i></div>${groups.map(([name, tt]) => fold(name, tt.length, tt.map((t) => `<div class="cc-task-row"><span class="cc-task-check ${t.status === "completed" ? "done" : ""}">${t.status === "completed" ? "✓" : "○"}</span><div><strong>${esc(t.title)}</strong><small>${esc(t.owner || "Needs an owner")}${t.due ? " · " + displayDate(t.due) : " · Choose a due date"}</small></div><button class="cc-text-button" data-cc-task="${t.id}">${t.status === "completed" ? "View" : "Review"}</button></div>`).join(""), `${tt.filter((t) => t.status === "completed").length} completed`)).join("")}<div class="cc-source-note">✧ Tasks are linked to your September meeting notes. <button class="cc-text-button" id="cc-notes">View notes</button></div></section><div class="cc-side-stack"><section class="cc-card cc-team-card"><span class="cc-card-icon">♧</span><h3>How many volunteers?</h3><div class="cc-need-number">${e.capacity}<span>people needed</span></div><p>${people.length} people have registered so far.</p>${fold("View roles", e.shifts.length, e.shifts.map((s) => `<div class="cc-mini-row"><span>${esc(s.role)}</span><strong>${s.capacity}</strong></div>`).join(""))}</section><section class="cc-tip"><span>✧</span><div><strong>Your next step</strong><p>Once your essentials are organized, bring your invitation to the platforms your volunteers already use.</p></div></section></div></div>`;
}
function invite(d, e, w) {
  return outreachMarkup(d, e, w);
}
function volunteers(d, e, w) {
  return trainingMarkup(d, e, w);
}
function attendanceRows(d, e, predicate, kind) {
  const rows = d.attendance.filter((a) => a.event_id === e.id && predicate(a));
  return rows.length
    ? rows
        .slice(0, expandedRows)
        .map((a) => {
          const p = d.profiles.find((p) => p.volunteer_id === a.volunteer_id);
          return `<div class="cc-person-row"><button class="cc-person-name" data-cc-profile="${esc(p.volunteer_id)}"><span class="cc-avatar">${esc(
            p.name
              .split(" ")
              .map((n) => n[0])
              .join(""),
          )}</span><span><strong>${esc(p.name)}</strong><small>${esc(a.role)} · ${a.actual_check_in ? "In " + fmt(a.actual_check_in) : "Not checked in"}${a.actual_check_out ? " · Out " + fmt(a.actual_check_out) : ""}</small></span></button><div class="cc-person-actions">${kind === "missing" ? `<button class="cc-secondary" data-cc-message="checkout" data-person="${esc(p.volunteer_id)}">Request time</button><button class="cc-text-button" data-cc-hours="${esc(a.attendance_id)}">Review hours</button>` : kind === "checked-out" ? pill(a.review_status === "approved" ? "Hours approved" : "Awaiting hours review", a.review_status === "approved" ? "green" : "amber") : pill("Expected")}</div></div>`;
        })
        .join("") +
        (rows.length > expandedRows
          ? '<button class="cc-text-button" data-cc-more>Show more volunteers ↓</button>'
          : "")
    : '<p class="cc-empty">No volunteers in this group.</p>';
}
function studentLink(e) {
  return `${location.origin}/?view=student&eventAccess=${encodeURIComponent(e.id)}`;
}
function checkin(d, e, w) {
  const a = d.attendance.filter((a) => a.event_id === e.id),
    checked = a.filter((a) => a.actual_check_in);
  return `<div class="cc-simple-summary">${stat(eventPeople(d, e.id).filter((p) => p.decision === "approved").length, "approved for today")}${stat(checked.length, "checked in")}${stat(a.filter((a) => !a.actual_check_in).length, "not checked in")}</div><section class="cc-card cc-access-card"><div><span class="cc-card-icon">⌁</span><h3>A simple arrival page for students</h3><p>Share this link so volunteers can open their event check-in page.</p></div><div class="cc-access-actions"><button class="cc-primary" id="cc-student-access">Preview student page ↗</button><button class="cc-secondary" id="cc-copy-access">Copy check-in link</button></div></section><section class="cc-card"><h3>Who has arrived?</h3><p class="cc-card-description">Expand a group when you need it. Attendance below comes from the supplied future-data demo.</p>${fold(
    "Checked in",
    checked.length,
    attendanceRows(d, e, (a) => Boolean(a.actual_check_in), "checked-in"),
  )}${fold(
    "Not checked in",
    a.length - checked.length,
    attendanceRows(d, e, (a) => !a.actual_check_in, "expected"),
  )}<div class="cc-roster-finish"><p>Close arrival check-in when your event team has arrived.</p><button class="cc-secondary" id="cc-close-checkin">${w.checkinClosed ? "Check-in closed ✓" : "Mark check-in complete"}</button></div></section>`;
}
function checkout(d, e, w) {
  const a = d.attendance.filter((a) => a.event_id === e.id),
    out = a.filter((a) => a.actual_check_out),
    missing = a.filter((a) => a.actual_check_in && !a.actual_check_out);
  return `<div class="cc-simple-summary">${stat(out.length, "checked out")}${stat(missing.length, "need a check-out time")}${stat(a.filter((a) => a.review_status === "pending_coordinator_review").length, "ready for hour review")}</div><section class="cc-card"><h3>Finish the day with clear records.</h3><p class="cc-card-description">A missing check-out stays open until a coordinator reviews the volunteer’s reply. Estimated times never become approved hours automatically.</p>${fold(
    "Missing check-out",
    missing.length,
    attendanceRows(
      d,
      e,
      (a) => a.actual_check_in && !a.actual_check_out,
      "missing",
    ),
    "Ask volunteers what time they left",
  )}${fold(
    "Checked out",
    out.length,
    attendanceRows(d, e, (a) => Boolean(a.actual_check_out), "checked-out"),
    "Review completed visits",
  )}${fold(
    "Complete times awaiting approval",
    a.filter((a) => a.review_status === "pending_coordinator_review").length,
    a
      .filter((a) => a.review_status === "pending_coordinator_review")
      .map((a) => {
        const p = d.profiles.find((p) => p.volunteer_id === a.volunteer_id);
        return `<div class="cc-mini-row"><span>${esc(p.name)} · ${a.calculated_hours} calculated hours</span><button class="cc-text-button" data-cc-hours="${a.attendance_id}">Review</button></div>`;
      })
      .join("") || '<p class="cc-empty">No hours awaiting approval.</p>',
  )}<div class="cc-roster-finish"><p>${missing.length ? "Resolve missing check-outs before completing this stage." : "All check-out times have been recorded."}</p>${pill(w.checkoutClosed ? "Review complete" : "Review in progress")}</div></section>`;
}
function modal(html) {
  document.querySelector("#cc-modal")?.remove();
  const el = document.createElement("dialog");
  el.id = "cc-modal";
  el.className = "cc cc-modal";
  el.innerHTML = `<button class="cc-close" aria-label="Close dialog">×</button>${html}`;
  document.body.append(el);
  el.querySelector(".cc-close").onclick = () => el.close();
  el.onclose = () => el.remove();
  el.showModal();
  return el;
}
export function bindCommandCenter(
  d,
  { render, save, bridge, profile, reviewHours },
) {
  const originalRender = render;
  render = () => {
    const openTitles = [...document.querySelectorAll(".cc-fold[open]")].map(
      (el) => el.querySelector("summary>span:first-child")?.textContent,
    );
    originalRender();
    document.querySelectorAll(".cc-fold").forEach((el) => {
      if (
        openTitles.includes(
          el.querySelector("summary>span:first-child")?.textContent,
        )
      )
        el.open = true;
    });
  };
  const e = d.events.find((e) => e.id === selectedEvent),
    w = eventWorkflow(d, e.id);
  const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.onclick = fn;
    },
    all = (selector, fn) => document.querySelectorAll(selector).forEach(fn),
    notify = (t) => {
      document.querySelector("#cc-status").textContent = t;
    },
    commit = () => save(d);
  bindOutreachDemo(d, e, { render, save });
  document.querySelector("#cc-event").onchange = (ev) => {
    selectedEvent = ev.target.value;
    viewStage = null;
    expandedRows = 6;
    render();
  };
  all(
    "[data-cc-stage]",
    (b) =>
      (b.onclick = () => {
        viewStage = Number(b.dataset.ccStage);
        saveEventWorkflow(d, e.id, { stage: viewStage });
        commit();
        expandedRows = 6;
        render();
        document
          .querySelector(".cc-stage-heading")
          ?.scrollIntoView({ block: "start", behavior: "smooth" });
      }),
  );
  all(
    "[data-cc-profile]",
    (b) => (b.onclick = () => profile(d, b.dataset.ccProfile)),
  );
  all(
    "[data-cc-task]",
    (b) =>
      (b.onclick = () => {
        const t = d.tasks.find((t) => t.id === b.dataset.ccTask);
        const el = modal(
          `<div class="cc-eyebrow">PREPARATION TASK</div><h2>${esc(t.title)}</h2><form><label>Owner<input name="owner" value="${esc(t.owner || "")}" required maxlength="100"></label><label>Due date<input name="due" type="date" value="${esc(t.due || "")}" required></label><label>Status<select name="status"><option value="approved" ${t.status === "approved" ? "selected" : ""}>Assigned</option><option value="completed" ${t.status === "completed" ? "selected" : ""}>Done</option></select></label><details><summary>Meeting source</summary><blockquote>${esc(t.evidence.excerpt)}</blockquote></details><button class="cc-primary">Save task</button></form>`,
        );
        el.querySelector("form").onsubmit = (ev) => {
          ev.preventDefault();
          const f = new FormData(ev.target);
          t.owner = f.get("owner").trim();
          t.due = f.get("due");
          t.status = f.get("status");
          if (!t.owner) return;
          d.audit ||= [];
          d.audit.push({
            action: "task." + t.status,
            id: t.id,
            actor: "Local demo coordinator",
            reviewedAt: new Date().toISOString(),
          });
          commit();
          el.close();
          render();
        };
      }),
  );
  on("cc-notes", () =>
    modal(
      `<div class="cc-eyebrow">YOUR MEETING NOTES</div><h2>The plan behind the checklist</h2>${d.meetings.map((m) => `<details class="cc-fold"><summary>${esc(m.id.replaceAll("_", " "))}</summary><blockquote>${esc(m.text)}</blockquote></details>`).join("")}`,
    ),
  );
  all(
    "[data-cc-channel]",
    (form) =>
      (form.onsubmit = (ev) => {
        ev.preventDefault();
        const f = new FormData(form),
          channel = form.dataset.ccChannel;
        const current = eventWorkflow(d, e.id);
        saveEventWorkflow(d, e.id, {
          channels: {
            ...current.channels,
            [channel]: {
              ...current.channels?.[channel],
              url: f.get("url") || "",
              notes: f.get("notes") || "",
            },
          },
        });
        commit();
        notify("Outreach details saved. Nothing was sent.");
      }),
  );
  all(
    "[data-cc-shared]",
    (input) =>
      (input.onchange = () => {
        const current = eventWorkflow(d, e.id),
          channel = input.dataset.ccShared;
        saveEventWorkflow(d, e.id, {
          channels: {
            ...current.channels,
            [channel]: {
              ...current.channels?.[channel],
              status: input.checked ? "recorded_shared" : "planned",
              recordedAt: new Date().toISOString(),
            },
          },
        });
        commit();
        render();
        notify(
          input.checked
            ? "External sharing recorded. VolunteerU did not send this message."
            : "Channel returned to planned.",
        );
      }),
  );
  function messagePreview(message, kind, personId) {
    const el = modal(
      `<div class="cc-eyebrow">${kind === "invitation" ? "OUTREACH ASSISTANT" : "FOLLOW-UP DRAFT"} · TEMPLATE PREVIEW</div><h2>Make it sound like you.</h2><p>Review and save this draft. Live AI and delivery are not connected.</p><form><label>Subject<input name="subject" value="${esc(message.subject)}" required maxlength="200"></label><label>Message<textarea name="body" rows="10" required maxlength="5000">${esc(message.body)}</textarea></label><div class="cc-form-actions"><button class="cc-primary">Save draft</button><button type="button" class="cc-secondary" id="cc-copy-draft">Copy message</button></div><p class="cc-status" id="cc-draft-status" role="status"></p></form>`,
    );
    el.querySelector("form").onsubmit = (ev) => {
      ev.preventDefault();
      const f = new FormData(ev.target);
      d.outreachDrafts ||= [];
      d.outreachDrafts.push({
        id: crypto.randomUUID(),
        eventId: e.id,
        kind,
        personId,
        channel: message.channel || "Email",
        subject: f.get("subject"),
        body: f.get("body"),
        status: "draft",
        createdAt: new Date().toISOString(),
      });
      commit();
      el.querySelector("#cc-draft-status").textContent =
        "Draft saved. Nothing was sent.";
    };
    el.querySelector("#cc-copy-draft").onclick = async () => {
      try {
        await navigator.clipboard.writeText(el.querySelector("textarea").value);
        el.querySelector("#cc-draft-status").textContent = "Message copied.";
      } catch {
        el.querySelector("#cc-draft-status").textContent =
          "Select and copy the message above.";
      }
    };
  }
  all(
    "[data-cc-invitation]",
    (b) =>
      (b.onclick = () =>
        messagePreview(
          invitationText(d, e, b.dataset.ccInvitation),
          "invitation",
        )),
  );
  all(
    "[data-cc-message]",
    (b) =>
      (b.onclick = () =>
        messagePreview(
          followupText(
            b.dataset.ccMessage,
            d.profiles.find((p) => p.volunteer_id === b.dataset.person),
            e,
          ),
          b.dataset.ccMessage,
          b.dataset.person,
        )),
  );
  all(
    "[data-cc-approve]",
    (b) =>
      (b.onclick = () => {
        try {
          reviewVolunteer(d, e.id, b.dataset.ccApprove, "approved");
          commit();
          render();
        } catch (err) {
          notify(err.message);
        }
      }),
  );
  all(
    "[data-cc-not-selected]",
    (b) =>
      (b.onclick = () => {
        const p = d.profiles.find(
          (p) => p.volunteer_id === b.dataset.ccNotSelected,
        );
        const el = modal(
          `<div class="cc-eyebrow">ROSTER REVIEW</div><h2>Keep ${esc(p.name.split(" ")[0])} in mind for next time.</h2><p>This records your decision for this event. It does not send an email or remove the volunteer’s profile.</p><button class="cc-primary" id="cc-confirm-not-selected">Record decision & review thank-you</button>`,
        );
        el.querySelector("#cc-confirm-not-selected").onclick = () => {
          reviewVolunteer(d, e.id, p.volunteer_id, "not_selected");
          commit();
          el.close();
          render();
          messagePreview(
            followupText("not_selected", p, e),
            "not_selected",
            p.volunteer_id,
          );
        };
      }),
  );
  all(
    "[data-cc-more]",
    (b) =>
      (b.onclick = () => {
        const opened = [...document.querySelectorAll(".cc-fold")].map(
          (x) => x.open,
        );
        expandedRows += 6;
        render();
        document
          .querySelectorAll(".cc-fold")
          .forEach((x, i) => (x.open = opened[i]));
      }),
  );
  on("cc-registration-check", () => {
    const s = recruitmentSummary(d, e.id);
    modal(
      `<div class="cc-eyebrow">REGISTRATION ASSISTANT · RECORD CHECK</div><h2>Every volunteer, counted once.</h2><div class="cc-simple-summary">${stat(s.submissions, "submissions")}${stat(s.people, "unique people")}${stat(s.duplicates, "repeat submissions")}</div><p>Repeated submissions are matched by normalized email and stable profile ID. Referral channels remain attached. All ${s.confirmed} registrations for this event are marked confirmed in the source fixture.</p><p>Message delivery, nonresponses, and reply tracking are not included in the source dataset. The app will not invent them or automatically decline anyone.</p>`,
    );
  });
  on("cc-finalize", () => {
    const approved = eventPeople(d, e.id).filter(
      (p) => p.decision === "approved",
    ).length;
    const el = modal(
      `<h2>Confirm your event-day team</h2><p>${approved} of ${e.capacity} places are approved.${approved < e.capacity ? " Your team is below the planned staffing need." : ""}</p><form><label>Coordinator note<textarea name="note" required placeholder="Confirm the roster and note how any staffing gap will be handled."></textarea></label><button class="cc-primary">Finalize roster</button></form>`,
    );
    el.querySelector("form").onsubmit = (ev) => {
      ev.preventDefault();
      const note = new FormData(ev.target).get("note").trim();
      if (!note) return;
      saveEventWorkflow(d, e.id, { finalized: true, rosterNote: note });
      commit();
      el.close();
      render();
    };
  });
  on("cc-close-checkin", () => {
    saveEventWorkflow(d, e.id, { checkinClosed: true });
    commit();
    render();
  });
  on("cc-copy-access", async () => {
    try {
      await navigator.clipboard.writeText(studentLink(e));
      notify("Student check-in link copied.");
    } catch {
      notify(studentLink(e));
    }
  });
  on("cc-student-access", () => {
    location.href = studentLink(e);
  });
  all(
    "[data-cc-hours]",
    (b) => (b.onclick = () => reviewHours(d, b.dataset.ccHours, render)),
  );
  on("cc-finish", () => {
    const missing = d.attendance.filter(
      (a) => a.event_id === e.id && a.actual_check_in && !a.actual_check_out,
    ).length;
    if (missing) {
      notify(
        `${missing} check-out times still need review. Open “Missing check-out” to follow up.`,
      );
      return;
    }
    saveEventWorkflow(d, e.id, { checkoutClosed: true });
    commit();
    render();
    notify(
      "Event-day review complete. Approved hours remain subject to coordinator verification.",
    );
  });
}
export function studentEventAccessMarkup(d, id) {
  const e = d?.events.find((e) => e.id === id);
  if (!e)
    return '<section class="cc-card"><h2>Event unavailable</h2><p>Load the fictional demo dataset from the coordinator workspace first.</p></section>';
  const people = eventPeople(d, id).filter((p) => p.decision === "approved");
  return `<div class="cc cc-student-access"><div class="cc-eyebrow">FLOWERS FOR WOMEN</div><h1>You’re here.<br>Let’s do some good.</h1><p>${esc(eventTitle(e))} · ${displayDate(e.date)}</p><section class="cc-card"><h2>Your event check-in</h2><p>Choose an approved demo volunteer to see their attendance record. This preview does not verify identity or create live attendance.</p><label>Demo volunteer<select id="cc-access-person"><option value="">Choose your name</option>${people.map((p) => `<option value="${esc(p.profile.volunteer_id)}">${esc(p.profile.name)} · ${esc(p.registration.role)}</option>`).join("")}</select></label>${!people.length ? '<p class="cc-field-help">The coordinator has not approved the event-day roster yet.</p>' : ""}<div id="cc-access-record"></div></section><a class="cc-text-button" href="/?view=nonprofit&page=Command%20Center">← Back to the coordinator workspace</a><p class="cc-demo-details">Fictional event preview. Live student authentication and attendance are available separately in Integrations.</p></div>`;
}
export function bindStudentEventAccess(d, id) {
  const select = document.querySelector("#cc-access-person");
  if (!select) return;
  select.onchange = () => {
    const a = d.attendance.find(
      (a) => a.event_id === id && a.volunteer_id === select.value,
    );
    const target = document.querySelector("#cc-access-record");
    if (!a) {
      target.innerHTML = "";
      return;
    }
    target.innerHTML = `<div class="cc-access-status"><div class="cc-mini-row"><span>Check-in</span><strong>${a.actual_check_in ? fmt(a.actual_check_in) : "Not recorded"}</strong></div><div class="cc-mini-row"><span>Check-out</span><strong>${a.actual_check_out ? fmt(a.actual_check_out) : "Not recorded"}</strong></div><p>${a.actual_check_in && !a.actual_check_out ? "A coordinator can request and review your estimated departure time." : "Attendance shown is from the fictional demonstration dataset."}</p></div>`;
  };
}

export function selectCommandEvent(id) {
  selectedEvent = id;
  viewStage = null;
  expandedRows = 6;
}
