import { connected, apiBase } from "./services.js";
const KEY = "volunteeru.plans.v1";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const mockMeetings = [
  {
    title: "October leadership meeting · MOCK",
    text: `MOCK MONTHLY LEADERSHIP MEETING — October 8, 2026
All organizations, people, budgets, and commitments below are fictional prototype examples.
Event: Community Care Kit Day
Date: 2026-12-19
Goal: Assemble 200 period-care kits and welcome 80 community participants.
Capacity: 80
Venue: Proposed room at the fictional Sunflower Community Center; reservation is not confirmed.
Action: Maya will request the venue reservation by 2026-10-22.
Action: Jordan will draft the supply budget by 2026-10-25.
Partnership: Invite the fictional Neighborhood Care Circle to discuss donated packaging; no agreement is confirmed.
Funding: Proposed budget of $1,200; $400 in donations pledged in this mock scenario, with $800 still to raise.
Responsibilities: Maya — venue; Jordan — funding; Riley — volunteer recruitment.
Supplies: 200 kit bags, period-care products, printed information sheets, tables, gloves, and reusable signs.
Setup: Arrival at 9:00 AM; set up assembly tables, accessible walkways, and a welcome desk.
Staffing: Two welcome stations and two supply stations need coverage; verify staffing with the coordinator.
Logistics: Confirm accessible entry, transport of supplies, waste collection, and emergency contact instructions.
Deadline: Recruitment materials should be reviewed by 2026-11-10.`,
  },
  {
    title: "November leadership meeting · MOCK",
    text: `MOCK MONTHLY LEADERSHIP MEETING — November 5, 2026
All organizations, people, budgets, and commitments below are fictional prototype examples.
Event: Community Care Kit Day
Date: 2026-12-19
Goal: Prepare 200 kits and provide a welcoming, nonclinical service experience for 100 participants.
Capacity: 100
Venue: Sunflower Community Center remains a proposed venue; confirm the room limit and accessible facilities before publishing.
Action: Maya will obtain the venue decision by 2026-11-12.
Action: Riley will publish approved volunteer roles by 2026-11-15.
Action: Jordan will inventory donated supplies by 2026-11-20.
Partnership: Fictional Neighborhood Care Circle is reviewing a packaging donation; this is still a proposal.
Funding: Revised proposed budget of $1,500; the team must verify pledges and close the remaining funding gap.
Responsibilities: Maya — venue and safety; Riley — staffing and training; Jordan — purchasing and donor follow-up.
Supplies: Check 200 kit bags, period-care products, printed instructions, tables, and labeled supply bins.
Setup: Reserve one hour before the event for setup and one hour after for cleanup, pending venue approval.
Staffing: Plan four staffed stations and two setup helpers. The coordinator must review adult supervision and role eligibility.
Logistics: Plan a supply delivery window, accessible routes, check-in, coordinator contact, and a weather contingency.
Deadline: Complete volunteer orientation by 2026-12-12.
Deadline: Hold preparation meetings on 2026-12-05 and 2026-12-16; times are not yet confirmed.`,
  },
];
const defaults = () => ({
  title: "",
  date: "",
  venue: "",
  capacity: 80,
  ratio: 10,
  stations: 4,
  setupHelpers: 2,
  leadDays: 28,
  goals: "",
  supplies: "",
  setup: "",
  staffing: "",
  logistics: "",
});
const fields = ["goals", "supplies", "setup", "staffing", "logistics"];
const categories = {
  goals: /^(goal|objective)s?\s*:/i,
  actions: /^(action|action item)s?\s*:|\b(will|must|should)\b/i,
  deadlines: /^(deadline|due|date)\s*:|\bby\s+\d{4}-\d{2}-\d{2}\b/i,
  partnerships: /^(partnership|partner)s?\s*:/i,
  funding: /^(funding|budget|donation)s?\s*:|\$\d/i,
  responsibilities: /^(responsibilit(?:y|ies)|owner|staffing|team)\s*:/i,
};
const labels = {
  goals: "Event goals",
  actions: "Action items",
  deadlines: "Dates & deadlines",
  partnerships: "Partnerships",
  funding: "Funding",
  responsibilities: "Team responsibilities",
};
let reviews = new Set();
function load(org) {
  let all;
  try {
    all = JSON.parse(localStorage.getItem(KEY));
  } catch {
    all = null;
  }
  const saved =
    all?.version === 1 &&
    all.organizations &&
    typeof all.organizations === "object"
      ? all.organizations[org.id]
      : null;
  return saved && typeof saved === "object"
    ? {
        transcript:
          typeof saved.transcript === "string"
            ? saved.transcript.slice(0, 100000)
            : "",
        brief: {
          ...defaults(),
          ...(saved.brief && typeof saved.brief === "object"
            ? saved.brief
            : {}),
        },
        analysis:
          saved.analysis && typeof saved.analysis === "object"
            ? saved.analysis
            : null,
        analysisMode: saved.analysisMode === "ai" ? "ai" : "local",
      }
    : { transcript: "", brief: defaults(), analysis: null };
}
function save(org, record) {
  try {
    let all;
    try {
      all = JSON.parse(localStorage.getItem(KEY));
    } catch {}
    if (
      all?.version !== 1 ||
      !all.organizations ||
      typeof all.organizations !== "object"
    )
      all = { version: 1, organizations: {} };
    all.organizations[org.id] = record;
    localStorage.setItem(KEY, JSON.stringify(all));
    return true;
  } catch {
    const status = document.querySelector("#planner-status");
    if (status)
      status.textContent =
        "The browser could not save this plan. Enable local storage and try again.";
    return false;
  }
}
export function extractMeeting(text) {
  const lines = text
    .split(/\r?\n/)
    .map((quote, index) => ({ line: index + 1, quote: quote.trim() }))
    .filter((x) => x.quote);
  return Object.fromEntries(
    Object.entries(categories).map(([key, pattern]) => [
      key,
      lines.filter((x) => pattern.test(x.quote)).slice(0, 20),
    ]),
  );
}
function valueFrom(text, field) {
  return (
    text
      .split(/\r?\n/)
      .find((line) => new RegExp(`^${field}:`, "i").test(line))
      ?.replace(/^[^:]+:\s*/, "") || ""
  );
}
function bounded(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n)
    ? Math.min(max, Math.max(min, Math.floor(n)))
    : fallback;
}
export function planningRecommendation(brief) {
  const capacity = bounded(brief.capacity, 1, 100000, 80),
    ratio = bounded(brief.ratio, 1, 1000, 10),
    stations = bounded(brief.stations, 0, 1000, 4),
    setup = bounded(brief.setupHelpers, 0, 1000, 2),
    lead = bounded(brief.leadDays, 1, 365, 28);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(brief.date)
    ? new Date(`${brief.date}T12:00:00Z`)
    : null;
  let recruitment = "Set an event date to calculate recruitment timing.";
  if (date && !Number.isNaN(date.getTime())) {
    date.setUTCDate(date.getUTCDate() - lead);
    recruitment = date.toISOString().slice(0, 10);
  }
  return {
    volunteers: Math.ceil(capacity / ratio) + stations + setup,
    explanation: `ceil(${capacity} participants ÷ ${ratio} per helper) + ${stations} station helpers + ${setup} setup helpers`,
    recruitment,
    lead,
  };
}
function briefFromForm(form, previous) {
  const data = new FormData(form),
    brief = { ...previous };
  for (const key of ["title", "date", "venue", ...fields])
    brief[key] = String(data.get(key) ?? "").trim();
  for (const key of [
    "capacity",
    "ratio",
    "stations",
    "setupHelpers",
    "leadDays",
  ])
    brief[key] = Number(data.get(key));
  return brief;
}
export function plannerMarkup(org) {
  const record = load(org),
    brief = record.brief,
    recommendation = planningRecommendation(brief);
  return `<section class="planner-panel"><div class="planner-title"><div><span class="eyebrow">TURN A CONVERSATION INTO A PLAN</span><h2>Meeting notes, meaningful next steps.</h2></div><span class="chip">Planning assistant prototype</span></div><p>Start with a mock meeting or bring a text transcript. ${connected ? "Files are read locally. You can explicitly send notes to your team’s configured AI service using Generate AI draft. Audio transcription is not connected." : "Files stay in this browser; audio transcription and an AI service are not connected."}</p><div class="planner-samples">${mockMeetings.map((m, i) => `<button type="button" class="secondary" data-mock-meeting="${i}">${m.title}</button>`).join("")}</div><label>Meeting notes or transcript<textarea id="planner-transcript" rows="10" maxlength="100000" placeholder="Paste meeting notes. Labels such as Goal:, Action:, Deadline:, Funding:, and Responsibilities: help the local extractor.">${esc(record.transcript)}</textarea></label><label class="planner-upload">Upload a text transcript (.txt or .md, up to 100 KB)<input id="planner-upload" type="file" accept=".txt,.md,text/plain,text/markdown"></label><div class="planner-actions"><button type="button" class="primary" id="analyze-meeting">Extract planning draft ✧</button><button type="button" class="secondary" id="save-transcript">Save transcript</button>${connected ? `<button type="button" class="secondary" id="generate-ai-plan">Generate AI draft</button>` : ""}</div>${connected ? `<p>Generate AI draft sends these notes and the organization ID to your team’s configured API for AI processing. Use only notes you are authorized to share. Local extraction keeps notes on this device.</p>` : ""}<p id="planner-status" role="status"></p>${
    record.analysis
      ? `<section class="planner-analysis"><h3>${record.analysisMode === "ai" ? "Team AI draft" : "Local rule-based draft"} · review required</h3><p>${record.analysisMode === "ai" ? "AI output may be incomplete or incorrect. Every finding below includes an exact excerpt from your notes. Confirm conclusions with the team." : "This prototype groups matching source lines. It does not infer unstated owners, dates, funding, or confirmed partnerships."} Review the evidence before making decisions.</p><div class="planner-evidence-grid">${Object.entries(
          labels,
        )
          .map(
            ([key, label]) =>
              `<article><h4>${label}</h4>${Array.isArray(record.analysis[key]) && record.analysis[key].length ? `<ul>${record.analysis[key].map((x) => `<li>${x.text ? `<strong>${esc(x.text)}</strong><br>` : ""}<q>${esc(x.quote)}</q><small>Source line ${esc(x.line)}</small></li>`).join("")}</ul>` : `<p>Not identified in the notes. Confirm with the team.</p>`}</article>`,
          )
          .join("")}</div></section>`
      : ""
  }</section><section class="planner-panel"><h2>Shape your event brief</h2><p>These are editable planning assumptions. Confirm venue capacity, role requirements, supervision, supplies, and budget with your team.</p><form id="planner-brief"><div class="planner-form-grid"><label>Planned event name<input name="title" required maxlength="120" value="${esc(brief.title)}"></label><label>Planned event date<input name="date" type="date" required value="${esc(brief.date)}"></label><label class="planner-wide">Proposed venue<input name="venue" required maxlength="240" value="${esc(brief.venue)}"></label><label>Expected participants<input name="capacity" type="number" required min="1" max="100000" step="1" value="${esc(brief.capacity)}"></label><label>Participants per helper<input name="ratio" type="number" required min="1" max="1000" step="1" value="${esc(brief.ratio)}"></label><label>Station helpers<input name="stations" type="number" required min="0" max="1000" step="1" value="${esc(brief.stations)}"></label><label>Setup / cleanup helpers<input name="setupHelpers" type="number" required min="0" max="1000" step="1" value="${esc(brief.setupHelpers)}"></label><label>Recruitment lead time (days)<input name="leadDays" type="number" required min="1" max="365" step="1" value="${esc(brief.leadDays)}"></label>${fields.map((key) => `<label class="planner-wide">${{ goals: "Event goals", supplies: "Supplies checklist", setup: "Setup & cleanup plan", staffing: "Staffing & supervision", logistics: "Event logistics" }[key]}<textarea name="${key}" maxlength="2000" rows="3">${esc(brief[key])}</textarea></label>`).join("")}</div><button class="primary" type="submit">Save & review staffing plan →</button></form><section class="planner-recommendation" aria-label="Volunteer planning estimate"><h3>${recommendation.volunteers} volunteers · planning estimate</h3><p>${esc(recommendation.explanation)}</p><p>Begin recruitment: <strong>${esc(recommendation.recruitment)}</strong> (${recommendation.lead} days before the event).</p><p>This estimate assumes separate participant, station, and setup coverage. Adjust the inputs for overlapping shifts and confirm the staffing plan. It is not a safety or supervision assessment.</p></section>${reviews.has(org.id) ? `<section class="planner-review"><h3>Review before creating an event draft</h3><p><strong>${esc(brief.title)}</strong><br>${esc(brief.date)} · ${esc(brief.venue)}<br>${recommendation.volunteers} recommended volunteer places; ${esc(brief.capacity)} expected participants.</p><p>The next step creates an editable, unpublished event draft. No recruitment or messages are sent.</p><button type="button" class="primary" id="use-event-brief">Use reviewed brief for event draft →</button></section>` : ""}</section>`;
}
export function bindPlanner(org, rerender) {
  const transcript = document.querySelector("#planner-transcript");
  if (!transcript) return;
  const status = () => document.querySelector("#planner-status");
  const current = () => {
    const r = load(org);
    if (r.transcript !== transcript.value) r.analysis = null;
    r.transcript = transcript.value;
    return r;
  };
  document.querySelectorAll("[data-mock-meeting]").forEach((button) =>
    button.addEventListener("click", () => {
      const r = current();
      r.transcript = mockMeetings[Number(button.dataset.mockMeeting)].text;
      r.analysis = null;
      if (save(org, r)) {
        reviews.delete(org.id);
        rerender();
      }
    }),
  );
  transcript.addEventListener("input", () => {
    document.querySelector(".planner-analysis")?.remove();
    document.querySelector(".planner-review")?.remove();
    reviews.delete(org.id);
    status().textContent =
      "Notes changed. Save or extract a new draft to update the source evidence.";
  });
  document.querySelector("#save-transcript").addEventListener("click", () => {
    if (save(org, current())) {
      reviews.delete(org.id);
      rerender();
      status().textContent =
        "Transcript saved on this device. Changed notes require a new extraction.";
    }
  });
  document
    .querySelector("#planner-upload")
    .addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!/\.(txt|md)$/i.test(file.name) || file.size > 100000) {
        status().textContent = "Choose a .txt or .md text file up to 100 KB.";
        event.target.value = "";
        return;
      }
      try {
        const text = await file.text();
        if (text.includes("\0")) throw new Error();
        const r = current();
        r.transcript = text;
        r.analysis = null;
        if (save(org, r)) {
          reviews.delete(org.id);
          rerender();
          document.querySelector("#planner-status").textContent =
            "Text loaded locally. Review it, then extract a planning draft.";
        }
      } catch {
        status().textContent =
          "This file could not be read as a text transcript.";
      }
    });
  document.querySelector("#analyze-meeting").addEventListener("click", () => {
    const r = current();
    if (!r.transcript.trim()) {
      status().textContent = "Add meeting notes before extracting a draft.";
      return;
    }
    r.analysis = extractMeeting(r.transcript);
    r.analysisMode = "local";
    const brief = { ...r.brief };
    for (const [key, label] of Object.entries({
      title: "Event",
      date: "Date",
      venue: "Venue",
      goals: "Goal",
      supplies: "Supplies",
      setup: "Setup",
      staffing: "Staffing",
      logistics: "Logistics",
    })) {
      const v = valueFrom(r.transcript, label);
      if (v) brief[key] = v;
    }
    const capacity = valueFrom(r.transcript, "Capacity");
    if (/^\d+$/.test(capacity))
      brief.capacity = bounded(capacity, 1, 100000, 80);
    r.brief = brief;
    if (save(org, r)) {
      reviews.delete(org.id);
      rerender();
      document.querySelector("#planner-status").textContent =
        "Local extraction complete. Review source lines and edit the event brief.";
    }
  });
  document
    .querySelector("#generate-ai-plan")
    ?.addEventListener("click", async (event) => {
      const button = event.currentTarget,
        savedFingerprint = JSON.stringify(load(org)),
        briefForm = document.querySelector("#planner-brief"),
        r = current(),
        notes = r.transcript.trim();
      r.brief = briefFromForm(briefForm, r.brief);
      const briefFingerprint = JSON.stringify(r.brief);
      const stillCurrent = () =>
        transcript.isConnected &&
        document.querySelector("#planner-transcript") === transcript &&
        briefForm.isConnected &&
        transcript.value === r.transcript &&
        JSON.stringify(briefFromForm(briefForm, r.brief)) ===
          briefFingerprint &&
        JSON.stringify(load(org)) === savedFingerprint;
      if (!notes) {
        status().textContent =
          "Add meeting notes before generating an AI draft.";
        return;
      }
      button.disabled = true;
      status().textContent = "Requesting a draft from your team’s AI service…";
      try {
        const response = await fetch(`${apiBase}/nonprofit/plans`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: org.id,
            transcript: r.transcript,
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) throw new Error();
        const result = await response.json(),
          analysis = {};
        if (!result || result.organizationId !== org.id) throw new Error();
        for (const key of Object.keys(categories)) {
          const findings = result[key];
          if (!Array.isArray(findings) || findings.length > 20)
            throw new Error();
          analysis[key] = findings.map((finding) => {
            if (
              !finding ||
              typeof finding.text !== "string" ||
              !finding.text.trim() ||
              finding.text.length > 2000 ||
              typeof finding.evidence !== "string" ||
              !finding.evidence.trim() ||
              finding.evidence.length > 3000 ||
              !r.transcript.includes(finding.evidence)
            )
              throw new Error();
            return {
              text: finding.text,
              quote: finding.evidence,
              line: r.transcript
                .slice(0, r.transcript.indexOf(finding.evidence))
                .split(/\r?\n/).length,
            };
          });
        }
        if (!stillCurrent()) {
          if (
            transcript.isConnected &&
            document.querySelector("#planner-transcript") === transcript
          )
            status().textContent =
              "The notes or plan changed while AI was working. The old response was discarded; your newer work is preserved.";
          return;
        }
        r.analysis = analysis;
        r.analysisMode = "ai";
        if (save(org, r)) {
          reviews.delete(org.id);
          rerender();
          if (status())
            status().textContent =
              "AI draft received. Review each finding against the quoted notes.";
        }
      } catch {
        if (
          transcript.isConnected &&
          document.querySelector("#planner-transcript") === transcript &&
          status()
        )
          status().textContent =
            "The AI service did not return a valid, source-supported draft. Your previous saved plan is unchanged. Try local extraction or contact your coordinator.";
      } finally {
        if (button.isConnected) button.disabled = false;
      }
    });
  document
    .querySelector("#planner-brief")
    .addEventListener("submit", (event) => {
      event.preventDefault();
      if (!event.currentTarget.reportValidity()) return;
      const r = current();
      r.brief = briefFromForm(event.currentTarget, r.brief);
      if (!r.brief.title || !r.brief.venue) {
        status().textContent = "Enter an event name and proposed venue.";
        return;
      }
      if (save(org, r)) {
        reviews.add(org.id);
        rerender();
        document
          .querySelector(".planner-review")
          ?.scrollIntoView({ block: "nearest" });
      }
    });
  document.querySelector("#planner-brief").addEventListener("input", () => {
    reviews.delete(org.id);
    document.querySelector(".planner-review")?.remove();
  });
  document.querySelector("#use-event-brief")?.addEventListener("click", () => {
    if (!reviews.has(org.id)) return;
    const { brief } = load(org),
      recommendation = planningRecommendation(brief);
    reviews.delete(org.id);
    window.dispatchEvent(
      new CustomEvent("volunteeru:plan-event", {
        detail: {
          title: brief.title,
          date: brief.date,
          venue: brief.venue,
          capacity: Number(brief.capacity),
          volunteers: recommendation.volunteers,
          description: brief.goals,
          supplies: brief.supplies,
          setup: brief.setup,
          staffing: brief.staffing,
          logistics: brief.logistics,
          recruitmentStart: recommendation.recruitment,
          organizationId: org.id,
        },
      }),
    );
  });
}
