import { publicHomeMarkup } from "./presentation-home.js";
document.querySelector("#app").innerHTML = publicHomeMarkup();

(function () {
  const root = document.getElementById("vu-photo-preview");
  const main = root.querySelector("#vu-preview-main");
  const toolbar = root.querySelector("#vu-demo-toolbar");
  const announcement = root.querySelector("#vu-preview-announcement");
  const homeMarkup = main.innerHTML;
  const escape = (value) =>
    String(value).replace(
      /[&<>"\']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "\'": "&#39;",
        })[c],
    );
  const photos = {
    volunteers: root.querySelector("#vu-source-volunteers").src,
    students: root.querySelector("#vu-source-students").src,
  };
  root.style.setProperty("--vu-plant-image", 'url("/images/bloom-stages.png")');
  let screen = "home",
    verified = false,
    accepted = false,
    joined = false,
    message = "",
    activeTab = 0,
    rosterQuery = "";
  const students = () => [
    { name: "Maya Chen", hours: accepted ? 30 : 26 },
    { name: "Jordan James", hours: 40 },
    { name: "Ana Ramirez", hours: 10 },
    { name: "Kai Thompson", hours: 30 },
  ];
  const roles = {
    student: "Student",
    nonprofit: "Nonprofit",
    school: "School Admin",
  };
  function pill(t) {
    return '<span class="vu-pill">' + t + "</span>";
  }
  function controls() {
    return (
      '<span>DEMO MODE · sample accounts are ready to explore</span><div class="vu-role-switch" role="group" aria-label="Demo account">' +
      Object.entries(roles)
        .map(
          ([id, name]) =>
            '<button data-vu="' +
            id +
            '" aria-pressed="' +
            (screen === id) +
            '">' +
            name +
            "</button>",
        )
        .join("") +
      '<button data-vu="reset">Reset demo</button></div>'
    );
  }
  function sidebar() {
    const titles =
      screen === "student"
        ? [
            "My dashboard",
            "Find opportunities",
            "My volunteering",
            "My progress",
          ]
        : screen === "nonprofit"
          ? [
              "Overview",
              "Events & volunteers",
              "Verify hours",
              "Impact reports",
            ]
          : ["Overview", "Students", "Review hours", "School settings"];
    return (
      '<aside class="vu-sidebar">' +
      titles
        .map(
          (t, i) =>
            '<button class="vu-navitem ' +
            (i === activeTab ? "active" : "") +
            '" data-vu="' +
            "tab-" +
            i +
            '">' +
            t +
            "</button>",
        )
        .join("") +
      '<div class="vu-account"><strong>' +
      (screen === "student"
        ? "Maya Chen"
        : screen === "nonprofit"
          ? "Flowers for Women"
          : "Broward Community High") +
      '</strong><span class="vu-muted">Sample ' +
      roles[screen].toLowerCase() +
      " account</span></div></aside>"
    );
  }
  function student() {
    const hours = accepted ? 30 : 26,
      percent = Math.floor((hours / 40) * 100);
    return (
      '<div class="vu-greeting"><div><span class="vu-small vu-muted">YOUR STUDENT SPACE</span><h2>Good things grow with you, Maya.</h2><p>Your next meaningful moment starts here.</p></div><button class="vu-button" data-vu="home">Sign out</button></div><div class="vu-toast">' +
      message +
      '</div><section class="vu-panel vu-bloom"><div class="vu-plant" style="--vu-stage:' +
      (accepted ? 75 : 50) +
      '%" role="img" aria-label="' +
      (accepted ? "Budding plant" : "Leafy plant") +
      ": " +
      percent +
      '% of the 40-hour goal"></div><div class="vu-bloom-info"><span class="vu-small">YOUR IMPACT, IN BLOOM</span><h3>A little good. A little growth.</h3><div class="vu-statusline"><strong>' +
      hours +
      " of 40 hours accepted</strong><strong>" +
      percent +
      '%</strong></div><div class="vu-progress" role="progressbar" aria-label="School-accepted service hours" aria-valuenow="' +
      hours +
      '" aria-valuemin="0" aria-valuemax="40"><span style="width:' +
      percent +
      '%"></span></div><p class="vu-small vu-muted">' +
      (40 - hours) +
      ' more hours to full bloom.</p><p class="vu-context">' +
      (accepted
        ? "Your school accepted your latest 4 hours."
        : verified
          ? "4 verified hours awaiting school acceptance."
          : "4 submitted hours awaiting nonprofit verification.") +
      '</p></div></section><div class="vu-two"><section class="vu-panel vu-event"><img class="vu-event-photo" src="' +
      photos.students +
      '" alt="Two women students collaborating outdoors">' +
      pill("YOUR NEXT SHIFT") +
      '<h3>Community wellness day</h3><p class="vu-small vu-muted">Flowers for Women · Fort Lauderdale<br>Nov 21 · 10 AM–12 PM · 2 hours</p><div class="vu-bottom-link"><span class="vu-small">✓ You’re registered</span><button data-vu="student-detail">View instructions →</button></div></section><section class="vu-panel"><h3>Your latest service record</h3><div class="vu-record"><div><strong>Period-kit packing</strong><p>Nov 7 · Flowers for Women · 4 hours</p></div></div><div style="margin-top:15px">' +
      pill(
        accepted
          ? "School accepted"
          : verified
            ? "Nonprofit verified"
            : "Submitted",
      ) +
      '</div><p class="vu-context">' +
      (accepted
        ? "Your plant and school progress have both updated."
        : verified
          ? "Your nonprofit confirmed attendance. Your school reviews it next."
          : "Your coordinator will confirm attendance before school review.") +
      '</p><div class="vu-record"><div><strong>Food pantry packing</strong><p>Nov 28 · 2 hours · Ages 16+</p></div><button class="vu-button" data-vu="join">' +
      (joined ? "Saved ✓" : "Save opportunity") +
      "</button></div></section></div>"
    );
  }
  function nonprofit() {
    return (
      '<div class="vu-greeting"><div><span class="vu-small vu-muted">NONPROFIT WORKSPACE · SAMPLE ACCOUNT</span><h2>Good work starts with good people.</h2><p>Flowers for Women · Coordinator: Taylor</p></div><button class="vu-button" data-vu="home">Sign out</button></div><div class="vu-toast">' +
      message +
      '</div><div class="vu-kpis"><article><strong>2</strong><span>Sample events</span></article><article><strong>4 / 8</strong><span>Next event registrations</span></article><article><strong>' +
      (verified ? "0" : "1") +
      '</strong><span>Hour records to verify</span></article></div><section class="vu-panel vu-queue"><div><span class="vu-small vu-muted">' +
      (verified ? "VERIFICATION COMPLETE" : "NEEDS YOUR REVIEW") +
      "</span><h3>Maya Chen · 4 service hours</h3><p>Period-kit packing · Nov 7<br>Attendance confirmed by the sample coordinator.</p>" +
      pill(
        accepted
          ? "School accepted"
          : verified
            ? "Verified · sent for school review"
            : "Submitted · ready to verify",
      ) +
      '</div><button class="vu-button primary" data-vu="verify" ' +
      (verified ? "disabled" : "") +
      ">" +
      (verified ? "Verified ✓" : "Verify 4 hours →") +
      '</button></section><div class="vu-two"><section class="vu-panel vu-event"><img class="vu-event-photo" src="' +
      photos.volunteers +
      '" alt="Volunteers sorting donated clothing">' +
      pill("UPCOMING EVENT") +
      '<h3>Community wellness day</h3><p class="vu-small vu-muted">Nov 21 · Fort Lauderdale · 10 AM–12 PM</p><div class="vu-record"><span>4 registered volunteers</span><strong>4 spaces left</strong></div><button class="vu-button" data-vu="nonprofit-detail">View event & roster →</button></section><section class="vu-panel"><h3>Ready for the day</h3><div class="vu-record"><span>Volunteer instructions</span><strong>Ready ✓</strong></div><div class="vu-record"><span>Coordinator assigned</span><strong>Taylor</strong></div><div class="vu-record"><span>Check-in list</span><strong>4 people</strong></div><p class="vu-context">Each verified record goes to the student’s school for acceptance.</p></section></div>'
    );
  }
  function school() {
    const roster = students(),
      total = roster.reduce((s, r) => s + r.hours, 0);
    return (
      '<div class="vu-greeting"><div><span class="vu-small vu-muted">SCHOOL ADMIN · SAMPLE ACCOUNT</span><h2>Every student. Every step forward.</h2><p>Broward Community High · 40-hour service goal</p></div><button class="vu-button" data-vu="home">Sign out</button></div><div class="vu-toast">' +
      message +
      '</div><div class="vu-kpis"><article><strong>4</strong><span>Connected students</span></article><article><strong>' +
      total +
      "</strong><span>School-accepted hours</span></article><article><strong>" +
      (verified && !accepted ? "1" : "0") +
      '</strong><span>Verified records to review</span></article></div><div class="vu-two"><section class="vu-panel"><h3>Progress toward 40 hours</h3><div class="vu-ring-layout"><div class="vu-ring" role="img" aria-label="Four students: one below halfway, two halfway or more, one met the goal"><span><strong>25%</strong>hours goal met</span></div><div class="vu-key"><span>Below halfway <strong>1</strong></span><span>Halfway or more <strong>2</strong></span><span>Hours goal met <strong>1</strong></span></div></div></section><section class="vu-panel"><h3>Accepted hours by student</h3><p class="vu-context">0–40 hours · target: 40</p><div class="vu-bars" role="img" aria-label="' +
      roster.map((s) => s.name + ": " + s.hours + " hours").join("; ") +
      '">' +
      roster
        .map(
          (s) =>
            "<div><span>" +
            s.hours +
            '</span><i style="height:' +
            (s.hours / 40) * 100 +
            'px"></i><span>' +
            s.name.split(" ")[0] +
            "</span></div>",
        )
        .join("") +
      '</div></section></div><section class="vu-panel" style="margin-top:18px"><div class="vu-section-heading" style="margin-bottom:0"><h3>Student service records</h3>' +
      pill("Pre-filled sample roster") +
      '</div><div class="vu-table-wrap"><table><thead><tr><th>Student</th><th>Accepted hours</th><th>Progress</th><th>Latest record</th></tr></thead><tbody>' +
      roster
        .map(
          (s, i) =>
            "<tr><td>" +
            s.name +
            "</td><td>" +
            s.hours +
            " / 40</td><td>" +
            Math.floor((s.hours / 40) * 100) +
            "%</td><td>" +
            (i === 0
              ? accepted
                ? "Accepted"
                : verified
                  ? "Ready for review"
                  : "Awaiting verification"
              : s.hours === 40
                ? "Goal met"
                : "Up to date") +
            "</td></tr>",
        )
        .join("") +
      '</tbody></table></div><div class="vu-record"><div><strong>Maya Chen · Period-kit packing · 4 hours</strong><p>' +
      (accepted
        ? "Accepted. The student’s progress is updated."
        : verified
          ? "Nonprofit verification complete. Ready for school acceptance."
          : "Waiting for nonprofit verification before school acceptance.") +
      '</p></div><button class="vu-button primary" data-vu="accept" ' +
      (!verified || accepted ? "disabled" : "") +
      ">" +
      (accepted ? "Accepted ✓" : "Accept verified hours") +
      "</button></div></section>"
    );
  }
  function heading(title, subtitle) {
    return `<div class="vu-greeting"><div><span class="vu-small vu-muted">${roles[screen].toUpperCase()} · PRE-FILLED DEMO</span><h2>${title}</h2><p>${subtitle}</p></div><button class="vu-button" data-vu="home">Sign out</button></div><div class="vu-toast">${message}</div>`;
  }
  function progressCard() {
    const hours = accepted ? 30 : 26;
    return `<section class="vu-panel vu-bloom"><div class="vu-plant" style="--vu-stage:${accepted ? 75 : 50}%" role="img" aria-label="${accepted ? "Budding" : "Growing"} plant, ${Math.floor((hours / 40) * 100)}% of the service goal"></div><div class="vu-bloom-info"><span class="vu-small">YOUR IMPACT, IN BLOOM</span><h3>${hours} of 40 hours accepted</h3><div class="vu-progress" role="progressbar" aria-label="School-accepted service hours" aria-valuenow="${hours}" aria-valuemin="0" aria-valuemax="40"><span style="width:${(hours / 40) * 100}%"></span></div><p>${40 - hours} hours to full bloom.</p><p class="vu-context">${accepted ? "Your school accepted the latest 4 hours." : verified ? "4 verified hours await school acceptance." : "4 submitted hours await nonprofit verification."}</p></div></section>`;
  }
  function rosterRows() {
    return (
      students()
        .filter((s) => s.name.toLowerCase().includes(rosterQuery.toLowerCase()))
        .map(
          (s, i) =>
            `<tr><td>${s.name}</td><td>${s.hours} / 40</td><td>${Math.floor((s.hours / 40) * 100)}%</td><td>${s.name === "Maya Chen" ? (accepted ? "Accepted" : verified ? "Ready for review" : "Awaiting verification") : s.hours >= 40 ? "Goal met" : "Up to date"}</td></tr>`,
        )
        .join("") || '<tr><td colspan="4">No matching students.</td></tr>'
    );
  }
  function detailPage() {
    if (screen === "student" && activeTab === 1)
      return (
        heading(
          "Find your next good thing.",
          "Pre-filled opportunities near Fort Lauderdale.",
        ) +
        `<div class="vu-two"><section class="vu-panel vu-event"><img class="vu-event-photo" src="${photos.volunteers}" alt="Volunteers packing donations"><h3>Food pantry packing</h3><p class="vu-small vu-muted">Nov 28 · 10 AM–12 PM · 2 hours · Ages 16+</p><p class="vu-context">Pack groceries and help prepare donation boxes with a community team.</p><button class="vu-button primary" data-vu="join">${joined ? "Saved ✓" : "Save opportunity"}</button></section><section class="vu-panel vu-event"><img class="vu-event-photo" src="${photos.students}" alt="Students working together"><h3>Community wellness day</h3><p class="vu-small vu-muted">Nov 21 · Fort Lauderdale · 2 hours</p><p class="vu-context">Welcome guests, prepare resource tables, and help with event check-in.</p>${pill("Already registered")}<button class="vu-button" data-vu="student-detail">View shift instructions →</button></section></div>`
      );
    if (screen === "student" && activeTab === 2)
      return (
        heading(
          "Your volunteering, in one place.",
          "Your registration, shift details, and latest service record are ready.",
        ) +
        `<section class="vu-panel"><h3>Community wellness day</h3><p class="vu-context">Nov 21 · 10 AM–12 PM · Fort Lauderdale · Coordinator: Taylor</p><div class="vu-record"><span>Registration</span>${pill("Confirmed")}</div><div class="vu-record"><span>Preparation</span><span>Read the instructions · bring water</span></div><div class="vu-record"><span>Arrival</span><span>9:50 AM · check in with Taylor</span></div><p class="vu-context">Sample venue: Community Center front desk. Help set up the resource tables, welcome guests, and support cleanup.</p></section><section class="vu-panel" style="margin-top:18px"><h3>Completed: period-kit packing</h3><p class="vu-context">Nov 7 · 4 submitted hours · Flowers for Women</p>${pill(accepted ? "School accepted" : verified ? "Nonprofit verified · awaiting school" : "Awaiting nonprofit verification")}</section>`
      );
    if (screen === "student" && activeTab === 3)
      return (
        heading(
          "Watch your impact grow.",
          "Maya Chen · 40-hour school service goal",
        ) +
        progressCard() +
        `<section class="vu-panel"><h3>Your service history</h3><div class="vu-table-wrap"><table><thead><tr><th>Activity</th><th>Hours</th><th>Status</th></tr></thead><tbody><tr><td>Community food drive · Sep 12</td><td>10</td><td>School accepted</td></tr><tr><td>Wellness outreach · Oct 10</td><td>8</td><td>School accepted</td></tr><tr><td>Period-care preparation · Oct 24</td><td>8</td><td>School accepted</td></tr><tr><td>Period-kit packing · Nov 7</td><td>4</td><td>${accepted ? "School accepted" : verified ? "Awaiting school acceptance" : "Awaiting nonprofit verification"}</td></tr></tbody></table></div></section>`
      );
    if (screen === "nonprofit" && activeTab === 1)
      return (
        heading(
          "Events & volunteers",
          "Flowers for Women · two sample events, with the next roster ready.",
        ) +
        `<section class="vu-panel vu-event"><img class="vu-event-photo" src="${photos.volunteers}" alt="Volunteers organizing donations"><h3>Community wellness day</h3><p class="vu-context">Nov 21 · 10 AM–12 PM · Fort Lauderdale · 4 of 8 places filled</p><div class="vu-table-wrap"><table><thead><tr><th>Volunteer</th><th>Registration</th><th>Shift</th></tr></thead><tbody>${students()
          .map(
            (s) =>
              `<tr><td>${s.name}</td><td>Confirmed</td><td>10 AM–12 PM</td></tr>`,
          )
          .join(
            "",
          )}</tbody></table></div></section><section class="vu-panel" style="margin-top:18px"><h3>Period-kit packing · completed Nov 7</h3><p class="vu-context">Maya Chen submitted a 4-hour service record.</p><button class="vu-button" data-vu="tab-2">Open hour verification →</button></section>`
      );
    if (screen === "nonprofit" && activeTab === 2)
      return (
        heading(
          "Verify completed service.",
          "Attendance is already confirmed in this sample record.",
        ) +
        `<section class="vu-panel vu-queue"><div><h3>Maya Chen · 4 hours</h3><p>Period-kit packing · Nov 7 · Attendance: present</p><p>Packed menstrual care kits and organized supplies for distribution.</p>${pill(verified ? "Verified" : "Submitted")}</div><button class="vu-button primary" data-vu="verify" ${verified ? "disabled" : ""}>${verified ? "Verified ✓" : "Verify 4 hours →"}</button></section>`
      );
    if (screen === "nonprofit" && activeTab === 3)
      return (
        heading(
          "See your event’s impact.",
          "Period-kit packing · Nov 7 · sample service record only",
        ) +
        `<div class="vu-kpis"><article><strong>${verified ? 4 : 0}</strong><span>Coordinator-verified hours</span></article><article><strong>${accepted ? 4 : 0}</strong><span>School-accepted hours</span></article><article><strong>${verified && !accepted ? 1 : 0}</strong><span>Records awaiting school review</span></article></div><section class="vu-panel"><h3>Service record</h3><div class="vu-table-wrap"><table><thead><tr><th>Student</th><th>Hours</th><th>Status</th></tr></thead><tbody><tr><td>Maya Chen</td><td>4</td><td>${accepted ? "School accepted" : verified ? "Nonprofit verified" : "Submitted"}</td></tr></tbody></table></div><div class="vu-bottom-link"><button data-vu="export">Download sample report CSV →</button></div></section>`
      );
    if (screen === "school" && activeTab === 1)
      return (
        heading(
          "Every student’s progress.",
          "Four pre-filled students · 40-hour goal",
        ) +
        `<section class="vu-panel"><label class="vu-field">Find a student<input id="vu-roster-search" type="search" placeholder="Search by name" value="${escape(rosterQuery)}" maxlength="80"></label><div class="vu-table-wrap"><table><thead><tr><th>Student</th><th>Accepted hours</th><th>Progress</th><th>Latest record</th></tr></thead><tbody id="vu-roster-rows">${rosterRows()}</tbody></table></div></section>`
      );
    if (screen === "school" && activeTab === 2)
      return (
        heading(
          "Review verified service.",
          "Nonprofit verification must come before school acceptance.",
        ) +
        `<section class="vu-panel vu-queue"><div><h3>Maya Chen · 4 hours</h3><p>Flowers for Women · Period-kit packing · Nov 7</p><p>${accepted ? "Accepted. Maya’s progress is now 30 of 40 hours." : verified ? "Attendance and hours verified by the nonprofit coordinator." : "Waiting for nonprofit verification. Switch to Nonprofit first."}</p>${pill(accepted ? "School accepted" : verified ? "Ready for school review" : "Awaiting verification")}</div><button class="vu-button primary" data-vu="accept" ${!verified || accepted ? "disabled" : ""}>${accepted ? "Accepted ✓" : "Accept verified hours"}</button></section>`
      );
    return (
      heading(
        "Your school, ready to explore.",
        "Read-only sample settings · no setup is needed for this demo.",
      ) +
      `<section class="vu-panel"><h3>School information</h3><div class="vu-two"><label class="vu-field">School name<input value="Broward Community High" readonly></label><label class="vu-field">School administrator<input value="Alex Morgan" readonly></label><label class="vu-field">Service hours goal<input value="40 hours" readonly></label><label class="vu-field">Coordinator email<input value="school-demo@example.org" readonly></label></div><p class="vu-context">This is a fictional demonstration school. No invitations or emails are sent.</p></section>`
    );
  }
  const storageKey = "volunteeru.presentation-demo.v1";
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey));
    if (saved) {
      screen = roles[saved.screen] ? saved.screen : "home";
      verified = saved.verified === true;
      accepted = verified && saved.accepted === true;
      joined = saved.joined === true;
      activeTab =
        Number.isInteger(saved.activeTab) &&
        saved.activeTab >= 0 &&
        saved.activeTab <= 3
          ? saved.activeTab
          : 0;
    }
  } catch {
    /* A fresh demo remains usable without session storage. */
  }
  const entryRole = new URLSearchParams(location.search).get("role");
  if (roles[entryRole]) {
    screen = entryRole;
    activeTab = 0;
  }
  function walkthrough() {
    const next =
      screen === "student"
        ? accepted
          ? "student"
          : "nonprofit"
        : screen === "nonprofit"
          ? "school"
          : "student";
    const label =
      screen === "student"
        ? accepted
          ? "View my progress"
          : "Next: verify as Nonprofit →"
        : screen === "nonprofit"
          ? "Next: review as School Admin →"
          : "Next: see Student progress →";
    return `<nav class="vu-walkthrough" aria-label="Presentation walkthrough"><span>Demo story: submit → verify → school acceptance → plant growth</span><button class="vu-button" data-vu="${next}">${label}</button></nav><nav class="vu-mobile-tabs" aria-label="Demo pages">${(screen === "student" ? ["My dashboard", "Find opportunities", "My volunteering", "My progress"] : screen === "nonprofit" ? ["Overview", "Events & volunteers", "Verify hours", "Impact reports"] : ["Overview", "Students", "Review hours", "School settings"]).map((t, i) => `<button class="vu-button" data-vu="tab-${i}" aria-pressed="${activeTab === i}">${t}</button>`).join("")}</nav>`;
  }
  function render() {
    toolbar.hidden = screen === "home";
    toolbar.className = screen === "home" ? "" : "vu-demo-top";
    toolbar.innerHTML = screen === "home" ? "" : controls();
    main.innerHTML =
      screen === "home"
        ? homeMarkup
        : '<div class="vu-app">' +
          sidebar() +
          '<section class="vu-main">' +
          walkthrough() +
          (activeTab !== 0
            ? detailPage()
            : screen === "student"
              ? student()
              : screen === "nonprofit"
                ? nonprofit()
                : school()) +
          "</section></div>";
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ screen, verified, accepted, joined, activeTab }),
      );
    } catch {
      /* Demo works in memory if storage is blocked. */
    }
    const url = new URL(location.href);
    if (screen === "home") url.searchParams.delete("role");
    else url.searchParams.set("role", screen);
    history.replaceState(null, "", url);
    announcement.textContent =
      screen === "home"
        ? "VolunteerU main homepage"
        : roles[screen] + " demo account loaded. " + message;
  }
  root.addEventListener("click", (e) => {
    const button = e.target.closest("[data-vu]");
    if (!button || !root.contains(button)) return;
    const action = button.dataset.vu;
    if (action === "home") {
      screen = "home";
      activeTab = 0;
      message = "";
      render();
    } else if (action === "accounts" || action === "how") {
      if (screen !== "home") {
        screen = "home";
        message = "";
        render();
      }
      root
        .querySelector(action === "accounts" ? "#vu-accounts" : "#vu-how")
        .scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else if (roles[action]) {
      screen = action;
      activeTab = 0;
      message = "";
      render();
    } else if (action === "verify") {
      verified = true;
      message =
        "Maya’s 4 hours are verified. Switch to School Admin to accept them.";
      render();
    } else if (action === "accept") {
      if (verified) {
        accepted = true;
        message =
          "4 hours accepted. Switch to Student to see Maya’s plant and progress update.";
        render();
      }
    } else if (action === "reset") {
      verified = false;
      accepted = false;
      joined = false;
      activeTab = 0;
      rosterQuery = "";
      message =
        "Demo reset. All sample accounts are ready for the next walkthrough.";
      render();
    } else if (action === "join") {
      joined = !joined;
      message = joined
        ? "Food pantry packing saved to Maya’s opportunities."
        : "Opportunity removed from saved items.";
      render();
    } else if (/^tab-[0-3]$/.test(action)) {
      activeTab = Number(action.slice(-1));
      message = "";
      render();
    } else if (action === "student-detail") {
      activeTab = 2;
      message = "";
      render();
    } else if (action === "nonprofit-detail") {
      activeTab = 1;
      message = "";
      render();
    } else if (action === "school-detail") {
      activeTab = 1;
      message = "";
      render();
    } else if (action === "overview") {
      activeTab = 0;
      message = "";
      render();
    } else if (action === "export") {
      const status = accepted
        ? "School accepted"
        : verified
          ? "Nonprofit verified"
          : "Submitted";
      const csv = `Student,Event,Submitted hours,Nonprofit verified hours,School accepted hours,Status\r\nMaya Chen,Period-kit packing,4,${verified ? 4 : 0},${accepted ? 4 : 0},${status}\r\n`;
      const href = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
      const a = document.createElement("a");
      a.href = href;
      a.download = "volunteeru-sample-impact.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    }
  });
  root.addEventListener("input", (event) => {
    if (event.target.id !== "vu-roster-search") return;
    rosterQuery = event.target.value;
    root.querySelector("#vu-roster-rows").innerHTML = rosterRows();
  });
  render();
})();
