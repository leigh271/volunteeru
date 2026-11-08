import { MAYA_EVENT } from "./flowers-event.js";
import { readNonprofits } from "./nonprofit-store.js";
import { state } from "./store.js";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function eventsHubMarkup() {
  const d = readNonprofits(),
    org = d.organizations.find((o) => o.id === d.activeId),
    events = d.events
      .filter((e) => e.organizationId === org?.id)
      .sort(
        (a, b) =>
          Number(b.id.endsWith(MAYA_EVENT.id)) -
          Number(a.id.endsWith(MAYA_EVENT.id)),
      );
  return `<div class="co-hub"><section class="co-heading"><div><div class="co-eyebrow">${esc(org?.name || "YOUR NONPROFIT WORKSPACE")}</div><h1>Your events.</h1><p>Choose an event, bring your team together, and keep the day on track.</p></div><button class="co-button primary" data-page="Nonprofit Portal">+ Create or manage events</button></section><div class="co-event-grid">${
    events
      .map((e) => {
        const assigned = state.applications.filter(
          (a) =>
            a.opportunityId === e.id &&
            ["approved", "accepted"].includes(a.status),
        ).length;
        return `<article class="co-event-card"><div class="co-event-card-top"><span class="co-date-icon">${e.date.slice(8)}<small>${new Date(e.date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short" })}</small></span><span class="co-badge">${e.isDemo ? "Demo event" : esc(e.status)}</span></div><h2>${esc(e.title)}</h2><p>${esc(e.city)} · ${esc(e.location)}</p><p>${esc(e.time)} · ${esc(e.hours)} hours</p><div class="co-event-meta"><span>${assigned} registrations</span><span>${esc(e.volunteerTarget)} volunteers needed</span></div>${
          e.id.endsWith(MAYA_EVENT.id)
            ? `<details class="co-linked-roster" ${new URLSearchParams(location.search).get("event") === MAYA_EVENT.id ? "open" : ""}><summary>Registered volunteers · ${assigned}</summary>${state.applications
                .filter((a) => a.opportunityId === e.id)
                .map(
                  (a) =>
                    `<div class="co-roster-person"><span>${esc(a.studentSnapshot?.name || "Volunteer")}</span><span>Confirmed · ${esc(e.time)}</span>${a.studentId.endsWith("MAYA-CHEN") ? '<a href="/demo.html?role=student">View Maya’s page ↗</a>' : ""}</div>`,
                )
                .join("")}</details>`
            : ""
        }<div class="co-event-actions">${e.id.startsWith("herwell:") ? `<button class="co-button primary" data-co-command="${esc(e.id.slice(8))}">Open command center →</button>` : ""}<button class="co-text-button" data-co-manage="${esc(e.id)}">Event details ↗</button></div></article>`;
      })
      .join("") ||
    `<section class="co-event-card"><h2>Your next event starts here.</h2><p>Create an event or load the HerWell example to explore the workflow.</p><button class="co-button primary" data-page="Nonprofit Portal">Set up an event →</button><button class="co-text-button" data-page="Demo Tour">Explore HerWell example</button></section>`
  }</div><section class="co-hub-note"><span>✧</span><div><strong>Planning happens in your command center.</strong><p>Events holds your event list and details. Use Command Center for preparation, invitations, approvals, and event-day steps.</p></div></section></div>`;
}
export function reportingTabs(view) {
  return `<div class="co-report-tabs" role="tablist" aria-label="Report type"><button role="tab" data-co-report="impact" aria-selected="${view === "impact"}">Event impact</button><button role="tab" data-co-report="schools" aria-selected="${view === "schools"}">School participation</button></div>`;
}
