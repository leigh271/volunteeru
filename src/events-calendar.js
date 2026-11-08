import { readNonprofits, saveNonprofits } from "./nonprofit-store.js";
import { state } from "./store.js";
import { DEMO_KEY } from "./herwell-model.js";
import { MAYA_EVENT } from "./flowers-event.js";
import {
  calendarDays,
  eventDraft,
  canonicalCalendarEvent,
} from "./events-calendar-model.js";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let month = 10,
  year = 2026;
let focusEvent = new URLSearchParams(location.search).get("event");
const shortTime = (value) =>
  new Date(value).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
export function eventsCalendarMarkup() {
  const d = readNonprofits(),
    org = d.organizations.find((o) => o.id === d.activeId),
    events = d.events.filter((e) => e.organizationId === org?.id),
    title = new Date(Date.UTC(year, month, 15)).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });
  return `<div class="ev-calendar"><div class="ev-heading"><div><div class="ev-eyebrow">${esc(org?.name || "YOUR ORGANIZATION")}</div><h1>Events</h1><p>Make room for your next good thing.</p></div><button class="ev-create" id="ev-create"><span>+</span> Create event</button></div><div class="ev-calendar-toolbar"><div class="ev-month"><h2>${title}</h2><div class="ev-month-controls"><button id="ev-prev" aria-label="Previous month">‹</button><button id="ev-next" aria-label="Next month">›</button></div><button class="ev-today" id="ev-today">Today</button></div><span class="ev-timezone">America/New_York <span>· Month view</span></span></div><div class="ev-calendar-frame"><div class="ev-weekdays">${["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((n) => `<span>${n}</span>`).join("")}</div><div class="ev-grid">${calendarDays(
    year,
    month,
  )
    .map(
      (day) =>
        `<div class="ev-day ${!day.inMonth ? "outside" : ""}" ${day.date === today ? 'data-today="true"' : ""}><div class="ev-day-top"><button class="ev-day-number" data-ev-new="${day.date}" aria-label="Create event on ${day.date}">${day.day}</button><button class="ev-day-plus" data-ev-new="${day.date}" aria-label="Add event on ${day.date}">+</button></div><div class="ev-day-events">${events
          .filter((e) => e.date === day.date)
          .map(
            (e) =>
              `<button class="ev-event ${e.status === "draft" ? "draft" : ""}" data-ev-open="${esc(e.id)}" aria-label="${esc(e.title)}, ${esc(e.time || "Time to be confirmed")}"><span class="ev-event-dot"></span><span><strong>${esc(e.title)}</strong><small>${esc(shortTime(e.startsAt))}${e.status === "draft" ? " · Draft" : ""}</small></span></button>`,
          )
          .join("")}</div></div>`,
    )
    .join(
      "",
    )}</div></div><div class="ev-calendar-footer"><span><i></i> Your organization’s events</span><span>Click a day to add an event. Click an event to see its details.</span></div><p class="ev-status" id="ev-status" role="status"></p></div>`;
}
function popup(html) {
  document.querySelector("#ev-dialog")?.remove();
  const el = document.createElement("dialog");
  el.id = "ev-dialog";
  el.className = "ev-dialog";
  el.innerHTML = `<button class="ev-close" aria-label="Close event dialog">×</button>${html}`;
  document.body.append(el);
  el.querySelector(".ev-close").onclick = () => el.close();
  el.onclose = () => el.remove();
  el.showModal();
  return el;
}
function form(date, render, record = null) {
  const d = readNonprofits(),
    org = d.organizations.find((o) => o.id === d.activeId);
  if (!org) {
    popup(
      "<h2>Set up your organization first</h2><p>Choose an organization workspace before creating an event.</p>",
    );
    return;
  }
  const localTime = (v) =>
    v
      ? new Date(v).toLocaleTimeString("en-GB", {
          timeZone: "America/New_York",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
  const el = popup(
    `<div class="ev-eyebrow">${esc(org.name)}</div><h2>${record ? "Edit event" : "A new moment to do good."}</h2><p class="ev-form-intro">Start with the essentials. You can plan the rest in your command center.</p><form id="ev-event-form"><label>Event name<input name="title" placeholder="e.g. Community Wellness Day" value="${esc(record?.title || "")}" required maxlength="120" autofocus></label><label>Date<input name="date" type="date" value="${record?.date || date}" required></label><div class="ev-form-row"><label>Starts<input name="start" type="time" step="900" value="${localTime(record?.startsAt) || "10:00"}" required></label><label>Ends<input name="end" type="time" step="900" value="${localTime(record?.endsAt) || "12:00"}" required></label></div><span class="ev-form-timezone">All times are Eastern time · America/New_York</span><label>Location<input name="venue" placeholder="Venue, address, or online meeting" value="${esc(record?.city || "")}" required maxlength="100"></label><div class="ev-form-row"><label>County<select name="county">${["Broward", "Miami-Dade", "Remote"].map((v) => `<option ${record?.location === v ? "selected" : ""}>${v}</option>`).join("")}</select></label><label>Volunteers needed<input name="volunteers" type="number" min="1" max="10000" placeholder="e.g. 10" value="${record?.volunteerTarget || ""}" required></label></div><details class="ev-more"><summary>Add a description <span>Optional</span></summary><textarea name="description" rows="3" maxlength="2000" placeholder="What will volunteers help with?">${esc(record?.description || "")}</textarea></details><p class="ev-error" id="ev-error" role="status"></p><div class="ev-form-footer"><span>Saved as a draft · no invitations sent</span><button class="ev-create" type="submit">${record ? "Save changes" : "Create event"}</button></div></form>`,
  );
  el.querySelector("form").onsubmit = (ev) => {
    ev.preventDefault();
    try {
      const input = Object.fromEntries(new FormData(ev.target)),
        next = readNonprofits(),
        current = next.organizations.find((o) => o.id === next.activeId);
      if (current?.id !== org.id)
        throw Error("Your organization changed. Reopen the event form.");
      let demo;
      try {
        demo = JSON.parse(localStorage.getItem(DEMO_KEY));
      } catch {
        demo = null;
      }
      const id =
        record?.id ||
        (demo?.organization.id === org.id ? "herwell:" : "") +
          crypto.randomUUID();
      const entry = eventDraft(input, org.id, id);
      if (record) {
        const idx = next.events.findIndex(
          (e) => e.id === record.id && e.organizationId === org.id,
        );
        if (idx < 0) throw Error("Event is no longer available.");
        next.events[idx] = { ...record, ...entry };
      } else next.events.push(entry);
      const beforeDemo = localStorage.getItem(DEMO_KEY);
      if (demo?.organization.id === org.id) {
        const canonical = canonicalCalendarEvent(entry),
          index = demo.events.findIndex((e) => e.id === canonical.id);
        if (index >= 0) demo.events[index] = canonical;
        else demo.events.push(canonical);
        localStorage.setItem(DEMO_KEY, JSON.stringify(demo));
      }
      if (!saveNonprofits(next)) {
        if (beforeDemo === null) localStorage.removeItem(DEMO_KEY);
        else localStorage.setItem(DEMO_KEY, beforeDemo);
        throw Error("Could not save your event. Please try again.");
      }
      [year, month] = input.date.split("-").slice(0, 2).map(Number);
      month--;
      el.close();
      render();
      document.querySelector("#ev-status").textContent = record
        ? "Event updated."
        : "Event created. Click it on your calendar to open its command center.";
    } catch (err) {
      el.querySelector("#ev-error").textContent = err.message;
    }
  };
}
export function bindEventsCalendar(render, openCommand) {
  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.onclick = fn;
  };
  const today = () =>
    new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  on("ev-create", () =>
    form(
      today().startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)
        ? today()
        : `${year}-${String(month + 1).padStart(2, "0")}-01`,
      render,
    ),
  );
  on("ev-prev", () => {
    month--;
    if (month < 0) {
      month = 11;
      year--;
    }
    render();
  });
  on("ev-next", () => {
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
    render();
  });
  on("ev-today", () => {
    [year, month] = today().split("-").slice(0, 2).map(Number);
    month--;
    render();
  });
  document
    .querySelectorAll("[data-ev-new]")
    .forEach((b) => (b.onclick = () => form(b.dataset.evNew, render)));
  document.querySelectorAll("[data-ev-open]").forEach(
    (b) =>
      (b.onclick = () => {
        const d = readNonprofits(),
          e = d.events.find(
            (e) => e.id === b.dataset.evOpen && e.organizationId === d.activeId,
          );
        if (!e) return;
        const apps = state.applications.filter((a) => a.opportunityId === e.id);
        const el = popup(
          `<div class="ev-eyebrow">${esc(d.organizations.find((o) => o.id === e.organizationId)?.name)}</div><h2>${esc(e.title)}</h2><p class="ev-detail-date">${new Date(e.date + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}<br>${esc(e.time)} · ${e.hours} hours</p><div class="ev-detail-line"><span>⌖</span><span>${esc(e.city)} · ${esc(e.location)}</span></div><div class="ev-detail-line"><span>♧</span><span>${apps.length} registrations · ${e.volunteerTarget} volunteers needed</span></div>${e.description ? `<p class="ev-detail-description">${esc(e.description)}</p>` : ""}<details class="ev-roster"><summary>Registered volunteers <span>${apps.length}</span></summary>${apps.map((a) => `<div><span>${esc(a.studentSnapshot?.name || "Volunteer")}</span><small>${esc(a.status === "approved" ? "Confirmed" : a.status)}</small>${a.studentId.endsWith("MAYA-CHEN") ? '<a href="/demo.html?role=student">View Maya’s page ↗</a>' : ""}</div>`).join("") || "<p>No registrations yet.</p>"}</details><div class="ev-detail-actions">${e.id.startsWith("herwell:") ? '<button class="ev-create" id="ev-open-command">Open command center →</button>' : ""}${e.source === "calendar" ? '<button class="ev-edit" id="ev-edit">Edit event</button>' : ""}${e.id.endsWith(MAYA_EVENT.id) ? '<a class="ev-edit" href="/demo.html?role=student">View student experience ↗</a>' : ""}</div><p class="ev-demo-note">Demo event · no messages or invitations are sent from this page.</p>`,
        );
        el.querySelector("#ev-open-command")?.addEventListener("click", () => {
          el.close();
          openCommand(e.id.replace(/^herwell:/, ""));
        });
        el.querySelector("#ev-edit")?.addEventListener("click", () => {
          el.close();
          form(e.date, render, e);
        });
      }),
  );
  if (focusEvent) {
    const id = focusEvent;
    focusEvent = null;
    const btn = [...document.querySelectorAll("[data-ev-open]")].find((b) =>
      b.dataset.evOpen.endsWith(id),
    );
    btn?.click();
  }
}
