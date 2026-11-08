import {
  readNonprofits,
  getPublishedOpportunities,
} from "./nonprofit-store.js";
import { state, persist, refresh } from "./store.js";

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const approved = (application) =>
  ["approved", "accepted"].includes(application.status);
const visibleApplication = (application) =>
  approved(application) || application.status === "pending";
const records = () =>
  Array.isArray(state.trainingRecords) ? state.trainingRecords : [];
function assignments() {
  const events = readNonprofits().events || [];
  return state.applications
    .filter(
      (application) =>
        application.studentId === state.student.id &&
        visibleApplication(application),
    )
    .map((application) => ({
      application,
      event: events.find((event) => event.id === application.opportunityId),
    }))
    .filter(({ event }) => event);
}
function trainingRecord(application, training) {
  return records().find(
    (record) =>
      record.studentId === state.student.id &&
      record.applicationId === application.id &&
      record.trainingId === training.id,
  );
}
function dateLabel(value) {
  if (!value) return "To be confirmed";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime())
    ? "To be confirmed"
    : date.toLocaleString(
        "en-US",
        value.length === 10
          ? { year: "numeric", month: "short", day: "numeric" }
          : {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            },
      );
}

export function eventStudentMarkup() {
  const assigned = assignments();
  const published = getPublishedOpportunities();
  return `<section class="journey-panel event-student-panel" aria-labelledby="event-preparation-title"><div class="event-student-heading"><div><span class="eyebrow">GET READY TO SHOW UP</span><h2 id="event-preparation-title">Your event preparation</h2></div><span class="demo-label">DEMO</span></div><p>Event-specific instructions, training, and preparation meetings from your nonprofit coordinator. Updates stay in this browser; no email or text message is sent.</p>${
    assigned.length
      ? assigned
          .map(({ application, event }) => {
            if (event.id.startsWith("herwell:")) {
              const shift = state.shifts.find(
                (s) => s.applicationId === application.id,
              );
              return `<article class="event-student-event"><h3>${esc(event.title)}</h3><p class="demo-notice">HerWell future-data simulation · imported shift and readiness facts.</p><p>${esc(shift?.role)} · ${esc(dateLabel(shift?.startsAt))} – ${esc(dateLabel(shift?.endsAt))}</p><p>${esc(event.city)} · ${esc(event.location)}</p><p>Source training status: ${esc(application.sourceTrainingStatus || "Not supplied")}. Module content and assessment evidence were not supplied.</p><p>Nonclinical support only. Guardian consent and adult supervision are required for minors.</p></article>`;
            }
            const title =
              event.title ||
              published.find((opportunity) => opportunity.id === event.id)
                ?.role ||
              "Volunteer event";
            const training = Array.isArray(event.training)
              ? event.training
              : [];
            const meetings = Array.isArray(event.prepMeetings)
              ? event.prepMeetings
              : [];
            const updates = Array.isArray(event.updates) ? event.updates : [];
            return `<article class="event-student-event"><div class="event-student-heading"><h3>${esc(title)}</h3><span class="chip">${approved(application) ? "Approved application" : "Application pending"} · DEMO</span></div><p>${esc(dateLabel(event.date))}${event.time ? ` · ${esc(event.time)}` : ""}<br>${esc(event.city || "")}${event.city && event.location ? " · " : ""}${esc(event.location || "Location to be confirmed")}</p>${
              approved(application)
                ? `<h4>Required volunteer training</h4>${
                    training.length
                      ? training
                          .map((item) => {
                            const record = trainingRecord(application, item);
                            const status = record?.status;
                            return `<div class="event-student-training"><h5>${esc(item.title)}</h5><p class="event-preserve-lines">${esc(item.instructions || "Ask your coordinator for the training instructions.")}</p><p class="event-student-meta">${item.dueDate ? `Due ${esc(dateLabel(item.dueDate))}` : "No deadline set"}</p>${status === "verified" ? `<span class="chip">✓ Coordinator verified · DEMO</span>` : status === "read" ? `<span class="chip">✓ Read · awaiting coordinator verification</span>` : `<button type="button" class="secondary" data-event-training="${esc(item.id)}" data-event-application="${esc(application.id)}">Mark training as read</button>`}</div>`;
                          })
                          .join("")
                      : `<p class="event-student-empty">No required training has been assigned yet.</p>`
                  }<h4>Preparation meetings</h4>${meetings.length ? `<ul class="event-student-meetings">${meetings.map((meeting) => `<li><strong>${esc(meeting.title || "Event preparation")}</strong><span>${esc(dateLabel(meeting.startsAt))}</span><span>${esc(meeting.location || "Ask your coordinator for the meeting location.")}</span></li>`).join("")}</ul>` : `<p class="event-student-empty">Your coordinator has not scheduled a preparation meeting yet.</p>`}`
                : `<p class="event-student-empty">Assigned training and preparation meetings appear after your application is approved. Applying does not confirm a place.</p>`
            }<h4>Instructions & updates</h4>${
              updates.length
                ? `<div class="event-student-updates">${[...updates]
                    .reverse()
                    .map(
                      (update) =>
                        `<article><span class="event-student-meta">${esc(update.kind || "Event update")} · ${esc(dateLabel(update.createdAt))} · DEMO</span><p class="event-preserve-lines">${esc(update.text)}</p></article>`,
                    )
                    .join("")}</div>`
                : `<p class="event-student-empty">No event instructions or updates have been posted yet.</p>`
            }</article>`;
          })
          .join("")
      : `<div class="journey-empty">Apply for a published nonprofit event to see its coordinator updates here. Training and preparation meetings appear after approval.</div>`
  }<p id="event-training-status" role="status"></p></section>`;
}

export function bindEventStudent(rerender) {
  document.querySelectorAll("[data-event-training]").forEach((button) => {
    button.addEventListener("click", () => {
      refresh();
      const application = state.applications.find(
        (item) =>
          item.id === button.dataset.eventApplication &&
          item.studentId === state.student.id &&
          approved(item),
      );
      const event = readNonprofits().events.find(
        (item) => item.id === application?.opportunityId,
      );
      const training = event?.training?.find(
        (item) => item.id === button.dataset.eventTraining,
      );
      if (!application || !training) {
        const status = document.querySelector("#event-training-status");
        if (status)
          status.textContent =
            "This training assignment is no longer available. Refresh your event preparation.";
        return;
      }
      state.trainingRecords = records();
      const existing = trainingRecord(application, training);
      if (existing?.status === "verified" || existing?.status === "read")
        return rerender();
      state.trainingRecords.push({
        id: crypto.randomUUID(),
        studentId: state.student.id,
        applicationId: application.id,
        trainingId: training.id,
        status: "read",
        updatedAt: new Date().toISOString(),
      });
      if (persist()) rerender();
    });
  });
}

export function eventNotificationItems(now = Date.now()) {
  if (!state.student.onboarded) return [];
  const items = [];
  for (const { application, event } of assignments()) {
    for (const update of Array.isArray(event.updates) ? event.updates : []) {
      if (!update.id || !update.text) continue;
      items.push({
        id: `event-update:${event.id}:${application.id}:${update.id}`,
        kind: update.kind || "Event update",
        text: `${event.title}: ${update.text} This demo update was posted in the app; no email or text was sent.`,
        isDemo: true,
        opportunityId: event.id,
      });
    }
    if (!approved(application)) continue;
    for (const training of Array.isArray(event.training)
      ? event.training
      : []) {
      const record = trainingRecord(application, training);
      const due = Date.parse(`${training.dueDate}T23:59:59`);
      if (
        ["read", "verified"].includes(record?.status) ||
        !Number.isFinite(due) ||
        due > now + 7 * 24 * 60 * 60 * 1000
      )
        continue;
      items.push({
        id: `event-training:${application.id}:${training.id}:${training.dueDate}`,
        kind:
          due < now ? "Training deadline passed" : "Required training reminder",
        text: `${event.title}: ${training.title} ${due < now ? "was due" : "is due"} ${dateLabel(training.dueDate)}. Read the assigned instructions and contact your coordinator if you need help.`,
        isDemo: true,
        opportunityId: event.id,
      });
    }
    for (const meeting of Array.isArray(event.prepMeetings)
      ? event.prepMeetings
      : []) {
      const startsAt = Date.parse(meeting.startsAt);
      if (
        !Number.isFinite(startsAt) ||
        startsAt <= now ||
        startsAt > now + 48 * 60 * 60 * 1000
      )
        continue;
      items.push({
        id: `event-preparation:${application.id}:${meeting.id}:${meeting.startsAt}`,
        kind: "Preparation meeting reminder",
        text: `${event.title}: ${meeting.title || "Event preparation"} starts ${dateLabel(meeting.startsAt)}. ${meeting.location || "Ask your coordinator for the meeting location."}`,
        isDemo: true,
        opportunityId: event.id,
      });
    }
  }
  return items;
}
