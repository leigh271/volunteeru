import { bloomMarkup } from "./bloom.js";
import { schoolRecordsMarkup, bindSchoolRecords } from "./school-records.js";
import { eventDayMarkup, bindEventDay } from "./event-day.js";
import { reportsMarkup, bindReports } from "./reports.js";
import { integrationsMarkup, bindIntegrations } from "./integrations.js";
import { nearbyMarkup, bindNearby } from "./nearby.js";
import { nonprofitMarkup, bindNonprofit } from "./nonprofit.js";
import {
  schoolPortalMarkup,
  bindSchoolPortal,
  invitationMarkup,
  bindInvitation,
  syncSchoolStudent,
} from "./school.js";
import { progressMarkup, bindProgress } from "./progress.js";
import { mascotMarkup, bindMascot } from "./mascot.js";
import { startStudentUpdates } from "./updates.js";
import {
  schoolMarkup,
  bindSchoolButtons,
  organizationMarkup,
  bindOrganizationButtons,
  coordinatorMarkup,
  bindCoordinatorForm,
  bellMarkup,
  bindBell,
} from "./features.js";
import { contactMarkup } from "./contact.js";
import { choices, opportunities, refreshOpportunities } from "./data.js";
import { state, persist, apply, refresh, STORAGE_KEY } from "./store.js";
const app = document.querySelector("#app");
const initialView = new URLSearchParams(location.search).get("view");
let workspace = ["nonprofit", "school"].includes(initialView)
  ? initialView
  : "student";
const workspacePages = {
  student: [
    "Discover",
    "Saved",
    "My Applications",
    "My Progress",
    "Nearby",
    "Event Day",
    "Profile",
    "Integrations",
  ],
  nonprofit: ["Nonprofit Portal", "Impact Reports", "Integrations"],
  school: ["School Portal", "Integrations"],
};
const workspaceHome = {
  student: "Discover",
  nonprofit: "Nonprofit Portal",
  school: "School Portal",
};
const workspaceLabels = {
  student: "Student",
  nonprofit: "Nonprofit",
  school: "School",
};
const navigationEntries = () =>
  workspacePages[workspace].map((name) => [name, icons[name]]);
function workspaceSwitcher() {
  return `<section class="workspace-bar" aria-label="Workspace switcher"><div><strong>Choose your space</strong><p>${workspace === "student" ? "For high school and college students" : workspace === "nonprofit" ? "For nonprofit organizers and coordinators" : "For school administrators and coordinators"}</p></div><div class="workspace-options"><div class="workspace-tabs" role="group" aria-label="View as"><button type="button" data-workspace="student" aria-pressed="${workspace === "student"}">Student</button><button type="button" data-workspace="nonprofit" aria-pressed="${workspace === "nonprofit"}">Nonprofit</button></div><button type="button" class="workspace-school" data-workspace="school" aria-pressed="${workspace === "school"}">School admin</button></div></section>`;
}
function changeWorkspace(next) {
  if (!workspacePages[next]) return;
  workspace = next;
  page = workspaceHome[next];
  step = -1;
  editing = false;
  modal?.remove();
  modal = null;
  const url = new URL(location.href);
  url.searchParams.set("view", next);
  history.replaceState(null, "", url);
  render();
  window.scrollTo(0, 0);
  document.querySelector(`[data-workspace="${next}"]`)?.focus();
}
let page = new URLSearchParams(location.search).has("invite")
    ? "Integrations"
    : workspaceHome[workspace],
  step = -1,
  editing = false,
  filter = "All causes",
  county = "All locations",
  skipped = new Set(),
  modal = null,
  toastTimer;
const icons = {
  Discover: "◈",
  Saved: "♡",
  "My Applications": "▤",
  "My Progress": "◴",
  Profile: "☺",
  "School Portal": "⌂",
  "Nonprofit Portal": "✳",
  "Event Day": "◷",
  "Impact Reports": "▥",
  Nearby: "⌖",
  Integrations: "⌘",
};
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const applied = (o) =>
  state.applications.some(
    (a) => a.opportunityId === o.id && a.studentId === state.student.id,
  );
const eligible = (o) =>
  Number(state.student.age) >= o.minAge &&
  (!o.publishedByNonprofit ||
    Date.parse(o.startsAt) + Number(o.hours) * 3600000 > Date.now());
const saved = (o) => state.saved.includes(o.id);
function reasons(o) {
  let s = state.student,
    r = [];
  if (
    s.interests.includes(o.cause) ||
    s.interests.includes("Open to any cause")
  )
    r.push("Matches your interests");
  if (
    s.availability.includes(o.availability) ||
    s.availability.includes("Flexible")
  )
    r.push("Fits your schedule");
  if (
    s.locations.includes(o.location) ||
    (s.locations.includes("Either county") && o.location !== "Remote")
  )
    r.push("In your preferred location");
  if (s.skills.some((x) => o.skills.includes(x))) r.push("Uses your skills");
  if (o.womensHealthCategory && s.womensHealth.includes(o.womensHealthCategory))
    r.push("Matches your women’s health interests");
  return r;
}
function notify(t) {
  document.querySelector(".toast")?.remove();
  let el = document.createElement("div");
  el.className = "toast";
  el.role = "status";
  el.textContent = t;
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 4000);
}
function nav() {
  return `<aside><a class="brand" href="#" aria-label="VolunteerU home"><span class="brandmark">v<span>✦</span></span>Volunteer<span class="purple">U</span></a><div class="workspace">${workspaceLabels[workspace].toUpperCase()} SPACE</div><nav>${navigationEntries()
    .map(
      ([n, i]) =>
        `<button data-page="${n}" class="nav-item ${page === n ? "active" : ""}"><span>${i}</span>${n}${n === "Saved" && state.saved.length ? `<b>${state.saved.length}</b>` : ""}</button>`,
    )
    .join(
      "",
    )}</nav><div class="sidebar-note"><span>✳︎</span><strong>Small acts.<br>Real impact.</strong><p>Your next chapter starts with showing up.</p></div><div class="user"><div class="avatar">${workspace === "student" ? esc(state.student.name[0] || "Y") : icons[workspaceHome[workspace]]}</div><div><strong>${workspace === "student" ? esc(state.student.name || "Your student space") : `${workspaceLabels[workspace]} workspace`}</strong><small>${workspace === "student" ? esc(state.student.school || "Let’s get started") : "Coordinate your community"}</small></div></div></aside>`;
}
function shell(body) {
  const approvedHours = state.hours
    .filter(
      (h) =>
        h.studentId === state.student.id &&
        h.status === "approved" &&
        state.applications.some(
          (a) => a.id === h.applicationId && a.studentId === state.student.id,
        ),
    )
    .reduce(
      (sum, h) =>
        sum +
        (Number.isFinite(Number(h.hours)) && Number(h.hours) > 0
          ? Number(h.hours)
          : 0),
      0,
    );
  app.innerHTML = `${nav()}<main><header><span>GOOD THINGS START WITH YOU <span class="tiny-star">✦</span></span><div class="header-right">${workspace === "student" ? bellMarkup() : ""}<span class="demo-pill">${page === "Integrations" ? "Prototype workspace" : "Demo experience"}</span>${workspace === "student" ? `<button class="avatar" data-page="Profile" aria-label="Open profile">${esc(state.student.name[0] || "Y")}</button>` : ""}</div></header>${workspaceSwitcher()}${workspace === "student" && state.student.onboarded && step < 0 ? invitationMarkup() : ""}${body}<footer>Made for your next meaningful moment. <span>Broward & Miami-Dade ♡</span></footer></main><div class="mobile-nav">${navigationEntries()
    .map(
      ([n, i]) =>
        `<button data-page="${n}" class="${page === n ? "active" : ""}">${i}<small>${n}</small></button>`,
    )
    .join("")}</div>`;
  if (workspace === "student")
    document.querySelector("main footer").insertAdjacentHTML(
      "beforebegin",
      mascotMarkup({
        onboarding: step >= 0,
        step,
        student: state.student,
        approvedHours,
      }),
    );
  bind();
}
function welcome() {
  shell(
    `<section class="welcome">${invitationMarkup()}<div class="eyebrow">YOUR TIME. YOUR COMMUNITY. YOUR IMPACT.</div><h1>Find your cause.<br><em>Make your impact.</em></h1><p>Big change starts with a little of your time. Find volunteer opportunities that feel like you.</p><button class="primary" id="start">Find my opportunities <span>↗</span></button><div class="welcome-tags"><span>♡ Causes you care about</span><span>✧ A fit for your schedule</span></div><div class="welcome-art"><span>✦</span><div>YOU +<br> A LITTLE TIME<br><b>= A BIG DIFFERENCE</b></div><span>♡</span></div><p class="demo-notice">Explore demo listings and a separate directory of real potential organizations. No partnerships or placements are confirmed. Applications stay on this device.</p></section>`,
  );
  document.querySelector("#start").onclick = () => {
    step = 0;
    render();
  };
}
const questions = [
  [
    "interests",
    "What matters to you?",
    "Choose the causes you’d love to show up for.",
    ["♡", "♧", "☀", "✦"],
  ],
  [
    "skills",
    "What’s your superpower?",
    "There’s more than one way to make a difference.",
    ["⚑", "✎", "⌘", "♧"],
  ],
  [
    "availability",
    "When can you lend a hand?",
    "Find a little time for something meaningful.",
    ["☀", "☾", "▦", "✦"],
  ],
  [
    "locations",
    "Where do you want to help?",
    "Good things happen close to home. Or online.",
    ["⌖", "⌖", "↔", "⌂"],
  ],
];
function onboarding() {
  const activeQuestions = state.student.interests.includes("Women’s health")
    ? [
        questions[0],
        [
          "womensHealth",
          "What part of women’s health speaks to you?",
          "Choose one or more interests. Potential organizations are research leads, not placements.",
          ["🌸", "🎗️", "🤱", "💛"],
        ],
        ...questions.slice(1),
      ]
    : questions;
  const lastStep = activeQuestions.length;
  let q = activeQuestions[step - 1];
  shell(
    `<section class="onboarding"><button class="text-button" id="back">← Back</button><div class="step-label">YOUR QUICK PROFILE <span>${step + 1} OF ${lastStep + 1}</span></div><div class="progress" role="progressbar" aria-label="Profile progress" aria-valuemin="1" aria-valuemax="${lastStep + 1}" aria-valuenow="${step + 1}">${Array.from(
      { length: lastStep + 1 },
      (_, i) => i,
    )
      .map((i) => `<span class="${i <= step ? "filled" : ""}"></span>`)
      .join(
        "",
      )}</div><h1>${step === 0 ? "Let’s start with you." : q[1]}</h1><p>${step === 0 ? "A few details help us find your kind of opportunity." : "Select all that feel like you. " + q[2]}</p><form id="profile-form">${step === 0 ? `<label>Your name<input name="name" required maxlength="80" autocomplete="name" value="${esc(state.student.name)}" placeholder="First and last name"></label><label>School or university<input name="school" required maxlength="120" value="${esc(state.student.school)}" placeholder="Where do you study?"></label><label>Your age<input name="age" type="number" min="13" max="100" required value="${esc(state.student.age)}" placeholder="Age in years"></label><small>For students ages 13+. We use your age to check listing eligibility. Some roles require guardian consent.</small>${invitationMarkup()}${schoolMarkup()}` : `<div class="choice-grid">${choices[q[0]].map((c, i) => `<button type="button" class="choice ${state.student[q[0]].includes(c) ? "selected" : ""}" data-choice="${i}" aria-pressed="${state.student[q[0]].includes(c)}"><span>${q[3][i] || "✦"}</span><strong>${c}</strong><b>${state.student[q[0]].includes(c) ? "✓" : "+"}</b></button>`).join("")}</div>`}<div class="onboarding-bottom"><span>You can always edit this later.</span><button class="primary" type="submit">${step === lastStep ? (editing ? "Save profile" : "Let’s find your fit") : "Next"} →</button></div></form></section>`,
  );
  document.querySelector("#back").onclick = () => {
    if (step === 0) {
      step = -1;
      editing = false;
    } else step--;
    render();
  };
  document.querySelectorAll("[data-choice]").forEach(
    (b) =>
      (b.onclick = () => {
        let c = choices[q[0]][b.dataset.choice],
          a = state.student[q[0]];
        state.student[q[0]] = a.includes(c)
          ? a.filter((x) => x !== c)
          : [...a, c];
        persist();
        render();
        document.querySelector(`[data-choice="${b.dataset.choice}"]`)?.focus();
      }),
  );
  document.querySelector("#profile-form").onsubmit = (e) => {
    e.preventDefault();
    if (step === 0) {
      let d = new FormData(e.target);
      if (!d.get("name").trim() || !d.get("school").trim())
        return notify("Please enter your name and school.");
      Object.assign(state.student, {
        name: d.get("name").trim(),
        school: d.get("school").trim(),
        age: Number(d.get("age")),
      });
    } else if (!state.student[q[0]].length)
      return notify("Choose at least one option to continue.");
    if (step === lastStep) state.student.onboarded = true;
    if (!persist()) return;
    if (step === lastStep) {
      step = -1;
      page = editing ? "Profile" : "Discover";
      editing = false;
    } else step++;
    render();
    if (step < 0 && state.student.onboarded)
      window.dispatchEvent(new Event("volunteeru:student-ready"));
    window.scrollTo(0, 0);
  };
}
function art(o) {
  return `<div class="art ${esc(o.art)}"><span class="art-tag">${esc(o.cause)}</span><div class="art-orbit"></div><span class="art-star">✦</span><div class="art-message">${o.art === "youth" ? "a little time.<br><b>a brighter future.</b>" : o.art === "animals" ? "more paws.<br><b>more possibility.</b>" : o.art === "creative" ? "create something<br><b>that matters.</b>" : "together looks<br><b>good on you.</b>"}</div><span class="art-heart">${esc(o.emoji)}</span><span class="art-caption">THE GOOD STARTS WITH YOU ↗</span></div>`;
}
function card(o, compact = false) {
  return `<article class="op-card ${compact ? "compact" : ""}" data-card="${esc(o.id)}">${art(o)}<div class="card-body"><div class="card-top"><span class="nonprofit">${esc(o.nonprofit)} <span class="demo-label">DEMO</span></span><button class="save-icon ${saved(o) ? "is-saved" : ""}" data-save="${esc(o.id)}" aria-label="${saved(o) ? "Remove saved" : "Save"} ${esc(o.role)}">${saved(o) ? "♥" : "♡"}</button></div><h2>${esc(o.role)}</h2><p class="location">⌖ ${esc(o.city)}, ${esc(o.location)}</p><div class="metadata"><span>▦ ${new Date(o.date + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span><span>◷ ${esc(o.hours)} hours</span><span>☺ Ages ${esc(o.minAge)}+</span></div><p class="schedule">${esc(o.time)} · ${esc(o.availability)}</p><p class="skill-line">${o.skills.map(esc).join(" · ")}</p><div class="fit">✧ ${reasons(o).join(" · ") || "A new cause to explore"}</div><div class="card-actions"><button class="secondary" data-details="${esc(o.id)}">View details ↗</button><button class="primary" data-apply="${esc(o.id)}" ${!eligible(o) || applied(o) ? "disabled" : ""}>${applied(o) ? "Applied ✓" : !eligible(o) ? "Age requirement" : "Apply →"}</button></div>${!compact ? `<div class="swipe-actions"><button data-skip="${esc(o.id)}">× <span>Skip</span></button><button data-save="${esc(o.id)}">♡ <span>${saved(o) ? "Remove saved" : "Save for later"}</span></button></div>` : ""}</div></article>`;
}
function discover() {
  let list = opportunities
    .filter(
      (o) =>
        eligible(o) &&
        !skipped.has(o.id) &&
        (filter === "All causes" || o.cause === filter) &&
        (county === "All locations" || o.location === county),
    )
    .sort((a, b) => reasons(b).length - reasons(a).length);
  shell(
    `<section class="page-heading"><div><div class="eyebrow">A LITTLE TIME. A LOT OF GOOD.</div><h1>Find your next <em>good thing.</em></h1><p>Opportunities that fit your passions, your schedule, and you.</p></div><div class="heading-doodle">✳︎<span>your impact<br>starts here</span></div></section><nav class="workflow-shortcuts" aria-label="Student quick actions"><button data-page="My Applications">My upcoming volunteering →</button><button data-page="My Progress">My hours & progress →</button><a href="#student-matches">Find an opportunity ↓</a></nav>${bloomMarkup({ compact: true })}<div class="demo-notice">✧ Demo listings only — fictional organizations, no live openings. Applications are saved on this device.</div><div class="discovery-layout"><div><div class="filter-bar" id="student-matches"><span class="filter-title">✧ Your matches <b>${list.length}</b></span><div><select id="cause" aria-label="Filter by cause">${["All causes", ...choices.interests.filter((c) => c !== "Open to any cause")].map((x) => `<option ${filter === x ? "selected" : ""}>${x}</option>`).join("")}</select><select id="county" aria-label="Filter by location">${["All locations", "Broward", "Miami-Dade", "Remote"].map((x) => `<option ${county === x ? "selected" : ""}>${x}</option>`).join("")}</select></div></div>${list.length ? card(list[0]) : `<div class="empty"><span>✧</span><h2>A fresh start?</h2><p>No matches with these filters. Adjust your profile or reset your discovery.</p><button class="primary" id="reset">Reset discovery</button></div>`}<p class="swipe-hint">← Swipe to skip <span>or use the buttons</span> Swipe to save →</p></div><div class="right-column"><div class="good-card"><span class="mini-label">YOUR NEXT CHAPTER</span><h2>You bring the heart.<br>We’ll help you<br><em>find the place.</em></h2><div class="flower">✳︎</div><p>Whether you have two hours or a whole Saturday, there’s a way to give back.</p></div><div class="how-card"><h3>A little guide to doing good</h3><p><b>01</b><span><strong>Find your fit</strong>Explore causes that speak to you.</span></p><p><b>02</b><span><strong>Save your favorites</strong>Keep the possibilities in one place.</span></p><p><b>03</b><span><strong>Take the first step</strong>Apply and await nonprofit approval.</span></p></div><div class="local-note">⌖ Rooted in South Florida.<br><span>Made for a world of difference.</span></div></div></div>${organizationMarkup()}`,
  );
  document.querySelector("#cause").onchange = (e) => {
    filter = e.target.value;
    render();
  };
  document.querySelector("#county").onchange = (e) => {
    county = e.target.value;
    render();
  };
  document.querySelector("#reset")?.addEventListener("click", () => {
    skipped.clear();
    filter = "All causes";
    county = "All locations";
    render();
  });
  document.querySelectorAll("[data-card]").forEach((el) => {
    let x, y;
    el.onpointerdown = (e) => {
      x = e.clientX;
      y = e.clientY;
    };
    el.onpointerup = (e) => {
      if (e.target.closest("button")) return;
      let dx = e.clientX - x;
      if (Math.abs(dx) > 90 && Math.abs(e.clientY - y) < 70) {
        if (dx > 0) {
          if (!state.saved.includes(el.dataset.card))
            state.saved.push(el.dataset.card);
          if (!persist()) return;
          notify("Saved for later ♡");
        }
        skipped.add(el.dataset.card);
        render();
      }
    };
  });
}
function render() {
  refreshOpportunities();
  if (page === "Integrations") {
    shell(integrationsMarkup());
    bindIntegrations(render);
    return;
  }
  if (page === "Impact Reports") {
    shell(reportsMarkup());
    bindReports(render);
    return;
  }
  if (page === "Nearby") {
    shell(nearbyMarkup());
    bindNearby(render);
    return;
  }
  if (page === "Event Day" && state.student.onboarded) {
    shell(eventDayMarkup());
    bindEventDay(render);
    return;
  }
  if (page === "Nonprofit Portal") {
    shell(nonprofitMarkup());
    bindNonprofit(render);
    return;
  }
  syncSchoolStudent();
  if (page === "School Portal") {
    shell(schoolPortalMarkup() + schoolRecordsMarkup());
    bindSchoolPortal(render);
    bindSchoolRecords(render);
    return;
  }
  if (!state.student.onboarded && step < 0) return welcome();
  if (step >= 0) return onboarding();
  if (page === "My Progress") {
    shell(progressMarkup());
    bindProgress(render);
    return;
  }
  if (page === "Discover") return discover();
  if (page === "Saved") {
    let list = opportunities.filter(saved);
    shell(
      `<section class="page-heading"><div><div class="eyebrow">KEEP THE GOOD CLOSE</div><h1>Your saved <em>possibilities.</em></h1><p>Come back when you’re ready to take the next step.</p></div></section><div class="card-grid">${list.length ? list.map((o) => card(o, true)).join("") : '<div class="empty"><h2>No saved opportunities yet.</h2><p>Tap a heart in Discover to keep something you love.</p><button class="primary" data-page="Discover">Explore opportunities →</button></div>'}</div>`,
    );
  } else if (page === "My Applications") {
    let list = state.applications.filter(
      (a) => a.studentId === state.student.id,
    );
    shell(
      `<section class="page-heading"><div><div class="eyebrow">YOU TOOK THE FIRST STEP</div><h1>My <em>applications.</em></h1><p>Follow your next chapter here. Demo submissions are not sent to organizations.</p></div></section><div class="application-list">${
        list.length
          ? list
              .map((a) => {
                let o =
                  opportunities.find((o) => o.id === a.opportunityId) ||
                  a.opportunitySnapshot;
                return `<article class="application"><div class="app-emoji">${esc(o?.emoji || "✦")}</div><div><span class="nonprofit">${esc(o?.nonprofit || "Opportunity unavailable")} · DEMO</span><h2>${esc(o?.role || a.opportunityId)}</h2><p>Submitted ${new Date(a.submittedAt).toLocaleDateString()} · ${esc(o?.hours || "—")} expected hours</p><span class="status">${esc({ pending: "◷ Waiting for nonprofit approval", approved: "✓ Approved", rejected: "Application declined" }[a.status] || a.status)}</span></div>${o ? `<button class="secondary" data-details="${esc(o.id)}">View details ↗</button>` : ""}</article>`;
              })
              .join("")
          : '<div class="empty"><h2>Your next chapter is waiting.</h2><p>Explore a match and apply when it feels right.</p><button class="primary" data-page="Discover">Find an opportunity →</button></div>'
      }</div>`,
    );
  } else {
    shell(
      `<section class="page-heading"><div><div class="eyebrow">UNIQUELY YOU</div><h1>Your student <em>profile.</em></h1><p>Your preferences help us find a better fit. Approved volunteer hours: <strong>${state.hours
        .filter(
          (h) =>
            h.studentId === state.student.id &&
            h.status === "approved" &&
            state.applications.some(
              (a) =>
                a.id === h.applicationId && a.studentId === state.student.id,
            ) &&
            Number.isFinite(Number(h.hours)) &&
            Number(h.hours) > 0,
        )
        .reduce((n, h) => n + Number(h.hours), 0)
        .toFixed(
          2,
        )}</strong>.</p></div></section><section class="profile-card"><div class="profile-intro"><div class="avatar">${esc(state.student.name[0])}</div><div><h2>${esc(state.student.name)}</h2><p>${esc(state.student.school)} · Age ${esc(state.student.age)}</p></div><button class="primary" id="edit">Edit profile ↗</button></div>${Object.entries(
        choices,
      )
        .map(
          ([key]) =>
            `<div class="profile-row"><h3>${key === "locations" ? "Location" : key === "womensHealth" ? "Women’s health interests" : key[0].toUpperCase() + key.slice(1)}</h3><div>${state.student[key].map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div></div>`,
        )
        .join(
          "",
        )}${schoolMarkup()}<p class="demo-notice">Your profile, saves, and applications are stored in this browser. Demo school connections do not share data with a real school.</p></section>`,
    );
    document.querySelector("#edit").onclick = () => {
      editing = true;
      step = 0;
      render();
    };
  }
}
function bind() {
  document.querySelectorAll("[data-workspace]").forEach((button) => {
    button.onclick = () => changeWorkspace(button.dataset.workspace);
  });
  bindMascot();
  bindInvitation(render);
  bindSchoolButtons();
  bindOrganizationButtons();
  bindBell(render, (id) => openModal(id, false));
  document.querySelectorAll("[data-page]").forEach(
    (b) =>
      (b.onclick = () => {
        page = b.dataset.page;
        step = -1;
        editing = false;
        render();
        window.scrollTo(0, 0);
      }),
  );
  document.querySelector(".brand").onclick = (e) => {
    e.preventDefault();
    page = workspaceHome[workspace];
    step = -1;
    editing = false;
    render();
  };
  document.querySelectorAll("[data-save]").forEach(
    (b) =>
      (b.onclick = () => {
        let id = b.dataset.save;
        state.saved = state.saved.includes(id)
          ? state.saved.filter((x) => x !== id)
          : [...state.saved, id];
        if (!persist()) return render();
        render();
        notify(
          state.saved.includes(id) ? "Saved for later ♡" : "Removed from saved",
        );
      }),
  );
  document.querySelectorAll("[data-skip]").forEach(
    (b) =>
      (b.onclick = () => {
        skipped.add(b.dataset.skip);
        render();
      }),
  );
  document
    .querySelectorAll("[data-details]")
    .forEach((b) => (b.onclick = () => openModal(b.dataset.details, false)));
  document
    .querySelectorAll("[data-apply]")
    .forEach((b) => (b.onclick = () => openModal(b.dataset.apply, true)));
}
function openModal(id, isApply) {
  let o =
    opportunities.find((o) => o.id === id) ||
    state.applications.find(
      (a) => a.studentId === state.student.id && a.opportunityId === id,
    )?.opportunitySnapshot;
  if (!o) return;
  const opener = modal?.opener || document.activeElement;
  modal?.remove();
  modal = document.createElement("dialog");
  modal.className = "detail-modal";
  modal.setAttribute("aria-labelledby", "dialog-title");
  modal.innerHTML = `<button class="close" aria-label="Close dialog">×</button><div class="eyebrow">${isApply ? "YOUR NEXT STEP" : "GET TO KNOW THE OPPORTUNITY"} · DEMO</div><h2 id="dialog-title">${isApply ? "Make your first move." : esc(o.role)}</h2><p>${esc(o.nonprofit)} · ${esc(o.location)}</p>${isApply ? `<form id="application-form"><div class="prefilled"><strong>${esc(state.student.name)}</strong><br>${esc(state.student.school)} · Age ${state.student.age}<br><small>From your student profile</small></div><p>${esc(o.role)}<br>${esc(o.date)} · ${esc(o.time)} · ${esc(o.hours)} hours</p><label class="checkbox"><input type="checkbox" name="available" required> I confirm I can attend this schedule and meet the requirements.</label><label>What makes you interested?<textarea name="interest" required minlength="10" maxlength="1000" rows="4" placeholder="A few words about why you’d love to help…"></textarea></label><p class="demo-notice">Demo application only. Nothing is sent to a nonprofit.</p><button class="primary" type="submit" ${applied(o) || !eligible(o) ? "disabled" : ""}>${applied(o) ? "Already applied" : "Send application →"}</button></form>` : `<h3>What you’ll do</h3><p>${esc(o.description)}</p><h3>When & where</h3><p>${esc(o.date)} · ${esc(o.time)}<br>${esc(o.city)} · ${esc(o.location)} · ${esc(o.hours)} expected hours</p><h3>Requirements</h3><p>${esc(o.requirements)}<br>Skills: ${o.skills.map(esc).join(", ")}</p><h3>Website & public contact</h3>${contactMarkup(o)}${coordinatorMarkup(o)}<div class="fit">✧ ${reasons(o).join(" · ") || "Explore a new cause"}</div><button class="primary" id="modal-apply" ${applied(o) || !eligible(o) ? "disabled" : ""}>${applied(o) ? "Already applied ✓" : !eligible(o) ? "You do not meet the age requirement" : "Apply →"}</button>`}`;
  document.body.append(modal);
  modal.opener = opener;
  modal.showModal();
  modal.querySelector(".close").onclick = () => modal.close();
  const currentDialog = modal;
  modal.addEventListener("close", () => {
    currentDialog.remove();
    if (opener?.isConnected) opener.focus();
  });
  modal
    .querySelector("#modal-apply")
    ?.addEventListener("click", () => openModal(id, true));
  bindCoordinatorForm(modal, o);
  modal.querySelector("#application-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!eligible(o) || applied(o)) return;
    let interest = new FormData(e.target).get("interest").trim();
    if (interest.length < 10)
      return notify("Please share at least 10 characters about your interest.");
    if (apply(id, interest)) {
      modal.close();
      page = "My Applications";
      render();
      notify("Demo application saved. Waiting for nonprofit approval.");
    }
  });
}
window.addEventListener("storage", (event) => {
  if (
    event.key !== STORAGE_KEY &&
    event.key !== null &&
    !event.key?.startsWith("volunteeru.")
  )
    return;
  refresh();
  render();
});
render();

window.addEventListener("volunteeru:nonprofit-change", refreshOpportunities);
startStudentUpdates(render);
