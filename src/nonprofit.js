import { coordinatorDayMarkup } from "./coordinator-day.js";
import { state, persist, refresh } from "./store.js";
import { choices } from "./data.js";
import {
  readNonprofits,
  saveNonprofits,
  validPublishedEvent,
} from "./nonprofit-store.js";
import { plannerMarkup, bindPlanner } from "./planner.js";

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let selectedId = null;
let planDraft = null;
let renderPortal = () => {};
let listening = false;
const currentOrg = (data) =>
  data.organizations.find((o) => o.id === data.activeId);
const accepted = (a) => ["approved", "accepted"].includes(a.status);
const options = (items, value) =>
  items
    .map(
      (item) =>
        `<option ${item === value ? "selected" : ""}>${esc(item)}</option>`,
    )
    .join("");
const appsFor = (event) =>
  state.applications.filter((a) => a.opportunityId === event.id);
const eventRecords = (event) =>
  state.hours.filter((h) =>
    appsFor(event).some(
      (a) => a.id === h.applicationId && a.studentId === h.studentId,
    ),
  );
function message(text) {
  const target = document.querySelector("#nonprofit-feedback");
  if (target) target.textContent = text;
}
function eventForm(event = {}) {
  return `<form id="nonprofit-event-form" class="nonprofit-form"><h3>${event.id ? "Edit event" : "Create a volunteer opportunity"}</h3><div class="nonprofit-fields"><label>Event or role title<input name="title" required maxlength="120" value="${esc(event.title)}"></label><label>Event date<input type="date" name="date" required value="${esc(event.date)}"></label><label>Start time<input type="time" name="time" required value="${esc(event.time || "")}"></label><label>Volunteer hours<input name="hours" type="number" min="0.25" max="24" step="0.25" required value="${esc(event.hours || 3)}"></label><label>County or delivery<select name="location">${options(["Broward", "Miami-Dade", "Remote"], event.location)}</select></label><label>City or online venue<input name="city" required maxlength="100" value="${esc(event.city)}"></label><label>Cause<select name="cause">${options(
    choices.interests.filter((x) => x !== "Open to any cause"),
    event.cause || "Women’s health",
  )}</select></label><label>Schedule<select name="availability">${options(choices.availability, event.availability || "Weekends")}</select></label><label>Minimum age<input name="minAge" type="number" min="13" max="100" required value="${esc(event.minAge || 13)}"></label><label>Attendee venue capacity<input name="capacity" type="number" min="1" max="100000" required value="${esc(event.capacity || 100)}"></label><label>Volunteer recruitment target<input name="volunteerTarget" type="number" min="1" max="10000" required value="${esc(event.volunteerTarget || event.volunteers || 10)}"></label><label>Primary strength<select name="skill">${options(choices.skills, event.skills?.[0])}</select></label><label>Venue latitude (optional)<input name="latitude" type="number" min="24.9" max="26.5" step="any" value="${esc(event.latitude ?? "")}"></label><label>Venue longitude (optional)<input name="longitude" type="number" min="-80.9" max="-79.9" step="any" value="${esc(event.longitude ?? "")}"></label><label class="nonprofit-wide">What volunteers will do<textarea name="description" required minlength="10" maxlength="2000" rows="3">${esc(event.description || event.goals)}</textarea></label><label class="nonprofit-wide">Requirements and venue instructions<textarea name="requirements" required minlength="10" maxlength="2000" rows="3">${esc(event.requirements || (event.venue ? `Venue to confirm: ${event.venue}. Coordinator orientation required.` : "Coordinator orientation required. Guardian consent for students under 18."))}</textarea></label></div><p class="demo-notice">Save a draft first, then review and publish it. Published opportunities are visible only in this browser demo.</p><div class="nonprofit-actions"><button type="submit" class="primary">Save event draft</button>${event.id ? '<button type="button" class="secondary" data-new-nonprofit-event>Create another event</button>' : ""}</div></form>`;
}
function eventManagement(event) {
  const applications = appsFor(event),
    approved = applications.filter(accepted),
    pending = applications.filter((a) => a.status === "pending");
  const training = event.training || [],
    meetings = event.prepMeetings || [],
    updates = event.updates || [];
  const gap = Math.max(0, event.volunteerTarget - approved.length);
  return `<section class="nonprofit-panel"><div class="nonprofit-section-heading"><div><span class="chip">${event.status === "published" ? "Published · DEMO" : "Draft · not recruiting"}</span><h2>${esc(event.title)}</h2><p>${esc(event.date)} · ${esc(event.time)} · ${esc(event.city)}</p></div><button class="${event.status === "published" ? "secondary" : "primary"}" id="toggle-publication">${event.status === "published" ? "Unpublish opportunity" : "Publish opportunity"}</button></div><div class="nonprofit-stats"><article><strong>${approved.length} / ${esc(event.volunteerTarget)}</strong><span>Approved volunteers</span></article><article><strong>${pending.length}</strong><span>Pending registrations</span></article><article><strong>${gap}</strong><span>Remaining staffing gap</span></article></div>${eventForm(event)}</section>
  <section class="nonprofit-panel" id="nonprofit-registrations"><h2>Volunteer registrations</h2><p>Approval confirms a demo shift. Declining an application cancels its shift. Check required training before the event.</p>${
    applications.length
      ? applications
          .map((a) => {
            const records = (state.trainingRecords || []).filter(
              (r) => r.studentId === a.studentId && r.applicationId === a.id,
            );
            const shift = state.shifts.find(
              (s) => s.applicationId === a.id && s.studentId === a.studentId,
            );
            return `<article class="nonprofit-roster"><div><h3>${esc(a.studentSnapshot?.name || "Student")}</h3><p>${esc(a.studentSnapshot?.school)} · ${esc(a.status)}</p><p>${esc(a.interest)}</p><div class="nonprofit-actions">${!accepted(a) ? `<button class="primary" data-np-decision="${esc(a.id)}" data-status="approved" ${approved.length >= event.volunteerTarget ? "disabled" : ""}>Approve registration</button>` : `<span class="chip">Confirmed shift · DEMO</span><button class="secondary" data-np-attendance="${esc(a.id)}">${shift?.attendance === "present" ? "Attendance marked present" : "Mark attendance present"}</button>`}<button class="secondary" data-np-decision="${esc(a.id)}" data-status="rejected" ${a.status === "rejected" ? "disabled" : ""}>Decline registration</button></div>${
              training.length
                ? `<h4>Required training</h4>${training
                    .map((t) => {
                      const record = records.find((r) => r.trainingId === t.id);
                      return `<p>${esc(t.title)} · ${record?.status === "verified" ? "Coordinator verified" : record?.status === "read" ? "Student marked read" : "Not read yet"} ${record?.status === "read" ? `<button class="secondary" data-verify-training="${esc(record.id)}">Verify training</button>` : ""}</p>`;
                    })
                    .join("")}`
                : "<p>No required training assigned.</p>"
            }</div></article>`;
          })
          .join("")
      : '<div class="nonprofit-empty">No registrations yet. Publish this opportunity so students can apply.</div>'
  }</section>
  ${coordinatorDayMarkup(event)}<section class="nonprofit-panel" id="nonprofit-hour-review"><h2>Attendance and hour review</h2><p>Only approve submitted hours after checking actual participation. These are browser-local demo decisions.</p>${
    eventRecords(event).length
      ? eventRecords(event)
          .map((h) => {
            const a = applications.find((a) => a.id === h.applicationId);
            return `<article class="nonprofit-roster"><h3>${esc(a?.studentSnapshot?.name || "Student")} · ${esc(h.hours)} hours</h3><p>${esc(h.date)} · ${esc(h.description)} · ${esc(h.status)}</p>${h.status !== "approved" ? `<label>Correction or review note<input maxlength="500" data-hour-note="${esc(h.id)}" value="${esc(h.correctionNote)}"></label><div class="nonprofit-actions"><button class="primary" data-hour-review="${esc(h.id)}" data-status="approved">Approve hours</button><button class="secondary" data-hour-review="${esc(h.id)}" data-status="needs_corrections">Request corrections</button></div>` : ""}</article>`;
          })
          .join("")
      : '<div class="nonprofit-empty">Submitted hours will appear here for review.</div>'
  }</section>
  <div class="nonprofit-columns"><section class="nonprofit-panel"><h2>Required volunteer training</h2><p>Assigned to approved volunteers. Students mark instructions read; coordinators verify completion separately.</p>${training.map((t) => `<article class="nonprofit-roster"><h3>${esc(t.title)}</h3><p>${esc(t.instructions)}</p><small>Due ${esc(t.dueDate)}</small></article>`).join("")}<form id="nonprofit-training-form"><label>Training title<input name="title" required maxlength="120"></label><label>Training instructions<textarea name="instructions" required minlength="10" maxlength="3000" rows="3"></textarea></label><label>Training due date<input type="date" name="dueDate" required max="${esc(event.date)}"></label><button class="primary" type="submit">Assign required training</button></form></section>
  <section class="nonprofit-panel"><h2>Preparation meetings</h2><p>Schedule one or two preparation meetings before the event.</p>${meetings.map((m) => `<article class="nonprofit-roster"><h3>${esc(m.title)}</h3><p>${esc(m.startsAt.replace("T", " "))} · ${esc(m.location)}</p></article>`).join("")}${meetings.length < 2 ? `<form id="nonprofit-prep-form"><label>Meeting title<input name="title" required maxlength="120"></label><label>Preparation meeting time<input type="datetime-local" name="startsAt" required max="${esc(event.date)}T${esc(event.time)}"></label><label>Meeting location or link<input name="location" required maxlength="250"></label><button type="submit" class="primary">Schedule preparation meeting</button></form>` : "<p>Two preparation meetings scheduled.</p>"}</section></div>
  <section class="nonprofit-panel"><h2>Instructions, reminders & updates</h2><p>Post to registered students’ local event inbox. No email, SMS, or external message is sent.</p><form id="nonprofit-update-form"><label>Update type<select name="kind">${options(["Event instructions", "Training reminder", "Event update"], "Event instructions")}</select></label><label>Message for registered volunteers<textarea name="text" required minlength="10" maxlength="2000" rows="3"></textarea></label><button class="primary" type="submit">Post local update</button></form>${updates
    .slice()
    .reverse()
    .map(
      (u) =>
        `<article class="nonprofit-roster"><span class="chip">${esc(u.kind)}</span><p>${esc(u.text)}</p><small>${esc(new Date(u.createdAt).toLocaleString())} · Local demo inbox</small></article>`,
    )
    .join("")}</section>`;
}
export function nonprofitMarkup() {
  const data = readNonprofits(),
    org = currentOrg(data);
  const heading =
    '<section class="page-heading"><div><div class="eyebrow">PLAN THE GOOD. BRING PEOPLE TOGETHER.</div><h1>Your nonprofit <em>workspace.</em></h1><p>Turn a meeting into a plan, and a plan into community impact.</p></div></section><p class="demo-notice">Nonprofit prototype · local demo account, no identity verification or cross-device sharing. Use sample information only.</p>';
  if (!org)
    return `${heading}<section class="nonprofit-panel"><h2>Create a nonprofit demo account</h2><form id="nonprofit-account-form"><div class="nonprofit-fields"><label>Organization name<input name="name" required maxlength="120"></label><label>Coordinator name<input name="coordinator" required maxlength="80"></label><label>Coordinator email<input name="email" required type="email" maxlength="160"></label></div><label class="checkbox"><input type="checkbox" name="authorized" required> I am authorized to coordinate this nonprofit’s events.</label><button class="primary" type="submit">Create nonprofit workspace</button></form>${data.organizations.length ? `<label>Reopen a demo nonprofit<select id="nonprofit-select"><option value="">Choose organization</option>${data.organizations.map((o) => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join("")}</select></label>` : ""}<p id="nonprofit-feedback" role="status"></p></section>`;
  const events = data.events.filter((e) => e.organizationId === org.id);
  let selected = events.find((e) => e.id === selectedId);
  if (!selected && !planDraft) selected = events[0];
  if (selected) selectedId = selected.id;
  return `${heading}<section class="nonprofit-panel"><div class="nonprofit-section-heading"><div><h2>${esc(org.name)}</h2><p>${esc(org.coordinator)} · ${esc(org.email)}</p></div><button class="secondary" id="nonprofit-switch">Switch / register nonprofit</button></div><p id="nonprofit-feedback" role="status"></p><div class="nonprofit-actions"><label>Manage event<select id="nonprofit-event-select"><option value="">Create a new event</option>${events.map((e) => `<option value="${esc(e.id)}" ${selected?.id === e.id ? "selected" : ""}>${esc(e.title)} · ${esc(e.status)}</option>`).join("")}</select></label><button class="secondary" id="new-nonprofit-event">New event</button></div></section>${selected ? `<nav class="workflow-shortcuts" aria-label="Nonprofit quick actions"><a href="#nonprofit-registrations">Review registrations ↓</a><a href="#nonprofit-hour-review">Verify attendance & hours ↓</a><a href="#nonprofit-event-form">Edit event details ↓</a></nav>${eventManagement(selected)}` : `<section class="nonprofit-panel">${eventForm(planDraft || {})}</section>`}${plannerMarkup(org)}`;
}
function mutateEvent(change, rerender) {
  const data = readNonprofits(),
    org = currentOrg(data),
    event = data.events.find(
      (e) => e.id === selectedId && e.organizationId === org?.id,
    );
  if (!event) return;
  change(event);
  if (saveNonprofits(data)) rerender();
}
export function bindNonprofit(rerender) {
  renderPortal = rerender;
  if (!listening) {
    window.addEventListener("volunteeru:plan-event", (event) => {
      const active = currentOrg(readNonprofits());
      if (!active || event.detail?.organizationId !== active.id) return;
      planDraft = { ...event.detail, id: undefined };
      selectedId = null;
      renderPortal();
      document
        .querySelector("#nonprofit-event-form")
        ?.scrollIntoView({ behavior: "instant", block: "start" });
    });
    listening = true;
  }
  const data = readNonprofits(),
    org = currentOrg(data);
  document
    .querySelector("#nonprofit-account-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      const name = values.get("name").trim(),
        coordinator = values.get("coordinator").trim();
      if (!name || !coordinator)
        return message("Enter organization and coordinator names.");
      const next = readNonprofits();
      const account = {
        id: crypto.randomUUID(),
        name,
        coordinator,
        email: values.get("email").trim(),
        isDemo: true,
      };
      next.organizations.push(account);
      next.activeId = account.id;
      if (saveNonprofits(next)) {
        selectedId = null;
        planDraft = null;
        rerender();
      }
    });
  document
    .querySelector("#nonprofit-select")
    ?.addEventListener("change", (event) => {
      const next = readNonprofits();
      if (!next.organizations.some((o) => o.id === event.target.value)) return;
      next.activeId = event.target.value;
      if (saveNonprofits(next)) {
        selectedId = null;
        planDraft = null;
        rerender();
      }
    });
  document.querySelector("#nonprofit-switch")?.addEventListener("click", () => {
    const next = readNonprofits();
    next.activeId = null;
    if (saveNonprofits(next)) {
      selectedId = null;
      planDraft = null;
      rerender();
    }
  });
  document
    .querySelectorAll("#new-nonprofit-event,[data-new-nonprofit-event]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        selectedId = null;
        planDraft = {};
        rerender();
      }),
    );
  document
    .querySelector("#nonprofit-event-select")
    ?.addEventListener("change", (event) => {
      selectedId = event.target.value || null;
      planDraft = selectedId ? null : {};
      rerender();
    });
  document
    .querySelector("#nonprofit-event-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const values = new FormData(form),
        next = readNonprofits(),
        current = next.events.find(
          (e) => e.id === selectedId && e.organizationId === org?.id,
        );
      if (!org) return;
      const title = values.get("title").trim(),
        description = values.get("description").trim(),
        requirements = values.get("requirements").trim();
      const approved = current ? appsFor(current).filter(accepted).length : 0;
      const target = Number(values.get("volunteerTarget"));
      if (
        !title ||
        description.length < 10 ||
        requirements.length < 10 ||
        target < approved
      )
        return message(
          "Check the title, descriptions, and volunteer target. The target cannot be below approved registrations.",
        );
      const record = {
        ...(current || {}),
        id: current?.id || crypto.randomUUID(),
        organizationId: org.id,
        title,
        date: values.get("date"),
        time: values.get("time"),
        startsAt: new Date(
          `${values.get("date")}T${values.get("time")}`,
        ).toISOString(),
        hours: Number(values.get("hours")),
        location: values.get("location"),
        city: values.get("city").trim(),
        cause: values.get("cause"),
        skills: [values.get("skill")],
        availability: values.get("availability"),
        minAge: Number(values.get("minAge")),
        capacity: Number(values.get("capacity")),
        volunteerTarget: target,
        latitude: values.get("latitude")
          ? Number(values.get("latitude"))
          : null,
        longitude: values.get("longitude")
          ? Number(values.get("longitude"))
          : null,
        description,
        requirements,
        status: "draft",
        isDemo: true,
        training: current?.training || [],
        prepMeetings: current?.prepMeetings || [],
        updates: current?.updates || [],
      };
      if (
        current &&
        appsFor(current).some(accepted) &&
        (current.date !== record.date ||
          current.time !== record.time ||
          current.hours !== record.hours)
      )
        return message(
          "This event has approved volunteers. Keep its confirmed date and start time; post a schedule update before arranging changes with volunteers.",
        );
      if (
        record.training.some((t) => t.dueDate > record.date) ||
        record.prepMeetings.some(
          (m) => Date.parse(m.startsAt) >= Date.parse(record.startsAt),
        )
      )
        return message(
          "Move preparation meetings and training deadlines before the new event date first.",
        );
      if (current) Object.assign(current, record);
      else next.events.push(record);
      if (saveNonprofits(next)) {
        selectedId = record.id;
        planDraft = null;
        rerender();
        message("Event saved as a draft. Review and publish when ready.");
      }
    });
  document
    .querySelector("#toggle-publication")
    ?.addEventListener("click", () => {
      const current = readNonprofits().events.find(
        (e) => e.id === selectedId && e.organizationId === org?.id,
      );
      if (!current) return;
      if (
        current.status !== "published" &&
        (!validPublishedEvent(current) ||
          Date.parse(current.startsAt) <= Date.now())
      )
        return message(
          "Review all event details and choose a future date and start time before publishing.",
        );
      mutateEvent((e) => {
        e.status = e.status === "published" ? "draft" : "published";
      }, rerender);
    });
  document.querySelectorAll("[data-np-decision]").forEach((button) =>
    button.addEventListener("click", () => {
      refresh();
      const next = readNonprofits(),
        event = next.events.find(
          (e) => e.id === selectedId && e.organizationId === org?.id,
        ),
        application = state.applications.find(
          (a) =>
            a.id === button.dataset.npDecision && a.opportunityId === event?.id,
        );
      if (!application || !event) return;
      const approving = button.dataset.status === "approved";
      if (
        approving &&
        !accepted(application) &&
        appsFor(event).filter(accepted).length >= event.volunteerTarget
      )
        return message(
          "Volunteer target reached. Increase the target before approving another registration.",
        );
      if (approving && event.status !== "published")
        return message("Publish this event before approving registrations.");
      application.status = button.dataset.status;
      application.updatedAt = new Date().toISOString();
      let shift = state.shifts.find(
        (s) =>
          s.applicationId === application.id &&
          s.studentId === application.studentId,
      );
      if (approving) {
        if (!shift) {
          shift = {
            id: crypto.randomUUID(),
            studentId: application.studentId,
            applicationId: application.id,
            isDemo: true,
          };
          state.shifts.push(shift);
        }
        Object.assign(shift, { status: "confirmed", startsAt: event.startsAt });
      } else if (shift) shift.status = "cancelled";
      if (persist()) rerender();
    }),
  );
  document.querySelectorAll("[data-np-attendance]").forEach((button) =>
    button.addEventListener("click", () => {
      refresh();
      const app = state.applications.find(
        (a) =>
          a.id === button.dataset.npAttendance &&
          a.opportunityId === selectedId &&
          accepted(a),
      );
      const shift = state.shifts.find(
        (s) =>
          s.applicationId === app?.id &&
          s.studentId === app.studentId &&
          s.status === "confirmed",
      );
      if (!shift) return message("A confirmed approved shift is required.");
      if (Date.parse(shift.startsAt) > Date.now())
        return message("Attendance can only be marked after the event begins.");
      shift.attendance = "present";
      shift.attendanceMarkedAt = new Date().toISOString();
      state.attendanceRecords ||= [];
      let attendance = state.attendanceRecords.find(
        (r) => r.applicationId === app.id && r.studentId === app.studentId,
      );
      if (!attendance) {
        attendance = {
          id: crypto.randomUUID(),
          studentId: app.studentId,
          applicationId: app.id,
          eventId: selectedId,
        };
        state.attendanceRecords.push(attendance);
      }
      Object.assign(attendance, {
        status: "present",
        recordedAt: new Date().toISOString(),
      });
      if (persist()) rerender();
    }),
  );
  document.querySelectorAll("[data-verify-training]").forEach((button) =>
    button.addEventListener("click", () => {
      refresh();
      const applicationIds = new Set(
        state.applications
          .filter((a) => a.opportunityId === selectedId && accepted(a))
          .map((a) => a.id),
      );
      const record = (state.trainingRecords || []).find(
        (r) =>
          r.id === button.dataset.verifyTraining &&
          r.status === "read" &&
          applicationIds.has(r.applicationId) &&
          state.applications.some(
            (a) => a.id === r.applicationId && a.studentId === r.studentId,
          ) &&
          readNonprofits()
            .events.find((e) => e.id === selectedId)
            ?.training.some((t) => t.id === r.trainingId),
      );
      if (!record)
        return message(
          "Only training marked read by an approved volunteer can be verified.",
        );
      record.status = "verified";
      record.updatedAt = new Date().toISOString();
      if (persist()) rerender();
    }),
  );
  document.querySelectorAll("[data-hour-review]").forEach((button) =>
    button.addEventListener("click", () => {
      const note =
        document
          .querySelector(
            `[data-hour-note="${CSS.escape(button.dataset.hourReview)}"]`,
          )
          ?.value.trim() || "";
      refresh();
      const appIds = new Set(
        state.applications
          .filter((a) => a.opportunityId === selectedId && accepted(a))
          .map((a) => a.id),
      );
      const hours = state.hours.find(
        (h) =>
          h.id === button.dataset.hourReview &&
          appIds.has(h.applicationId) &&
          state.applications.some(
            (a) => a.id === h.applicationId && a.studentId === h.studentId,
          ),
      );
      if (!hours)
        return message(
          "Only hours for an approved event registration can be reviewed.",
        );
      if (button.dataset.status === "needs_corrections" && !note)
        return message("Add a correction note for the student.");
      if (
        button.dataset.status === "approved" &&
        !(state.attendanceRecords || []).some(
          (s) =>
            s.applicationId === hours.applicationId &&
            s.studentId === hours.studentId &&
            s.eventId === selectedId &&
            s.status === "present",
        )
      )
        return message(
          "Mark attendance present before approving volunteer hours.",
        );
      const currentEvent = readNonprofits().events.find(
        (e) => e.id === selectedId && e.organizationId === org?.id,
      );
      if (
        button.dataset.status === "approved" &&
        (!currentEvent ||
          !Number.isFinite(Number(hours.hours)) ||
          Number(hours.hours) <= 0 ||
          Number(hours.hours) > Number(currentEvent.hours) ||
          hours.date !== currentEvent.date ||
          Date.parse(currentEvent.startsAt) +
            Number(currentEvent.hours) * 3600000 >
            Date.now() ||
          !state.shifts.some(
            (s) =>
              s.applicationId === hours.applicationId &&
              s.studentId === hours.studentId &&
              s.status === "confirmed",
          ))
      )
        return message(
          "Approve only valid completed hours on this event’s date, within its duration, after the confirmed event ends. Request corrections for other entries.",
        );
      hours.status = button.dataset.status;
      hours.correctionNote = note;
      hours.updatedAt = new Date().toISOString();
      if (persist()) rerender();
    }),
  );
  document
    .querySelector("#nonprofit-training-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const v = new FormData(event.currentTarget);
      const current = readNonprofits().events.find((e) => e.id === selectedId);
      if (
        !current ||
        !v.get("title").trim() ||
        v.get("instructions").trim().length < 10 ||
        v.get("dueDate") > current.date
      )
        return message(
          "Check the training title, instructions, and deadline before the event.",
        );
      mutateEvent((e) => {
        e.training ||= [];
        e.training.push({
          id: crypto.randomUUID(),
          title: v.get("title").trim(),
          instructions: v.get("instructions").trim(),
          dueDate: v.get("dueDate"),
        });
      }, rerender);
    });
  document
    .querySelector("#nonprofit-prep-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const v = new FormData(event.currentTarget),
        current = readNonprofits().events.find((e) => e.id === selectedId);
      if (
        !current ||
        (current.prepMeetings || []).length >= 2 ||
        !v.get("title").trim() ||
        !v.get("location").trim() ||
        Number.isNaN(Date.parse(v.get("startsAt"))) ||
        Date.parse(v.get("startsAt")) >= Date.parse(current.startsAt)
      )
        return message(
          "Choose a meeting time before the event; at most two preparation meetings are allowed.",
        );
      mutateEvent((e) => {
        e.prepMeetings ||= [];
        e.prepMeetings.push({
          id: crypto.randomUUID(),
          title: v.get("title").trim(),
          startsAt: v.get("startsAt"),
          location: v.get("location").trim(),
        });
      }, rerender);
    });
  document
    .querySelector("#nonprofit-update-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const v = new FormData(event.currentTarget),
        text = v.get("text").trim();
      if (text.length < 10) return message("Write at least 10 characters.");
      mutateEvent((e) => {
        e.updates ||= [];
        e.updates.push({
          id: crypto.randomUUID(),
          text,
          kind: v.get("kind"),
          createdAt: new Date().toISOString(),
        });
      }, rerender);
      message(
        "Update posted to the local event inbox. No email or SMS was sent.",
      );
    });
  if (org) bindPlanner(org, rerender);
}
