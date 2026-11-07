import { state, persist } from "./store.js";
import { potentialOrganizations } from "./data.js";
import {
  connected,
  validateSchoolCode,
  confirmSchool,
  submitCoordinatorMessage,
} from "./services.js";
import { notificationItems, unreadCount } from "./notifications.js";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function dialog(title, body) {
  const opener = document.activeElement;
  const el = document.createElement("dialog");
  el.className = "detail-modal feature-modal";
  el.setAttribute("aria-labelledby", "feature-title");
  el.innerHTML = `<button class="close" aria-label="Close dialog">×</button><h2 id="feature-title">${title}</h2>${body}`;
  document.body.append(el);
  el.showModal();
  el.querySelector(".close").onclick = () => el.close();
  el.addEventListener("close", () => {
    el.remove();
    if (opener?.isConnected) opener.focus();
  });
  return el;
}
export function schoolMarkup() {
  const c = state.student.schoolConnection;
  return `<section class="school-invitation"><h3>Connect your school <span class="demo-label">OPTIONAL</span></h3>${c ? `<p>${esc(c.schoolName)}</p><span class="chip">${c.isDemo ? "Demo connection · no school data shared" : "School connected"}</span>` : "<p>Have an invitation code? Check the school name before you connect. You can skip this and add it later in Profile.</p>"}<button type="button" class="secondary" data-school>${c ? "Change school connection" : "Add school invitation code"}</button>${!connected ? "<small>Demo code: <strong>DEMO-BROWARD</strong>. Real school codes are not connected yet.</small>" : ""}</section>`;
}
export function bindSchoolButtons(onChange) {
  document
    .querySelectorAll("[data-school]")
    .forEach((b) => (b.onclick = () => openSchool(onChange)));
}
function openSchool(onChange) {
  const el = dialog(
    "Your school, your choice.",
    `<p class="feature-intro">An invitation is optional. Nothing connects until you confirm the school.</p>${!connected ? '<p class="demo-notice">Demo validation only. Try DEMO-BROWARD. No real school membership or data sharing will be created.</p>' : ""}<form id="school-code-form"><label>School invitation code<input name="code" required minlength="4" maxlength="40" autocomplete="off" placeholder="Enter your invitation code"></label><button class="primary" type="submit">Validate code</button></form><div id="school-result" aria-live="polite"></div><button class="text-button" id="skip-school">Skip for now</button>`,
  );
  let invitation = null;
  const form = el.querySelector("form"),
    result = el.querySelector("#school-result"),
    button = form.querySelector("button");
  form.code.addEventListener("input", () => {
    invitation = null;
    result.innerHTML = "";
  });
  el.querySelector("#skip-school").onclick = () => el.close();
  form.onsubmit = async (e) => {
    e.preventDefault();
    invitation = null;
    result.innerHTML = "";
    button.disabled = true;
    button.textContent = "Checking…";
    const code = form.code.value;
    try {
      const checked = await validateSchoolCode(code);
      if (code !== form.code.value) return;
      invitation = checked;
      result.innerHTML = `<div class="school-preview"><span class="eyebrow">${invitation.isDemo ? "DEMO SCHOOL FOUND" : "SCHOOL FOUND"}</span><h3>${esc(invitation.schoolName)}</h3><p>Confirm that this is the school you intend to connect.</p><button type="button" class="primary" id="confirm-school">Confirm school connection</button></div>`;
      result.querySelector("button").onclick = async () => {
        if (!invitation) return;
        const confirmButton = result.querySelector("button");
        confirmButton.disabled = true;
        try {
          const connection = await confirmSchool(invitation);
          state.student.schoolConnection = connection;
          if (!persist()) {
            confirmButton.disabled = false;
            return;
          }
          el.close();
          document
            .querySelectorAll(".school-invitation")
            .forEach((section) => (section.outerHTML = schoolMarkup()));
          bindSchoolButtons(onChange);
          onChange?.(connection);
        } catch (error) {
          result.innerHTML = `<p class="form-error" role="alert">${esc(error.message)}</p>`;
        }
      };
    } catch (error) {
      result.innerHTML = `<p class="form-error" role="alert">${esc(error.message)}</p>`;
    } finally {
      button.disabled = false;
      button.textContent = "Validate code";
    }
  };
}
export function organizationMarkup() {
  return `<section class="organization-section"><div class="eyebrow">EXPLORE WOMEN’S HEALTH</div><h2>Potential organizations</h2><p>Research starting points, not confirmed partners or available volunteer placements.</p><div class="organization-grid">${potentialOrganizations.map((o) => `<article class="organization-card"><span class="org-emoji">${o.emoji}</span><h3>${o.category}</h3><strong>${esc(o.name)}</strong><span class="potential-label">Potential organization</span><button type="button" class="text-button" data-organization="${o.id}">View organization profile ↗</button></article>`).join("")}</div></section>`;
}
export function bindOrganizationButtons() {
  document.querySelectorAll("[data-organization]").forEach(
    (b) =>
      (b.onclick = () => {
        const o = potentialOrganizations.find(
          (o) => o.id === b.dataset.organization,
        );
        dialog(
          esc(o.name),
          `<span class="potential-label">Potential organization · not a confirmed partner</span><h3>${o.emoji} ${o.category}</h3><p class="feature-intro">${esc(o.description)}</p><p class="demo-notice">No volunteer placement or opportunity has been confirmed with this organization. Please review its official information directly.</p><a class="public-link" href="${o.website}" target="_blank" rel="noopener noreferrer">${o.websiteLabel} ↗</a>`,
        );
      }),
  );
}
export function coordinatorMarkup(o) {
  return `<details class="coordinator-section"><summary>Contact coordinator</summary><p>${o.designatedContact?.id ? `Designated contact: ${esc(o.designatedContact.name || "Nonprofit coordinator")}` : "No designated nonprofit coordinator is connected to this demo listing."}</p><form id="coordinator-form"><label>Your name<input name="senderName" required maxlength="80" value="${esc(state.student.name)}" autocomplete="name"></label><label>Your email<input name="replyTo" type="email" required maxlength="254" autocomplete="email" placeholder="you@example.com"></label><label>Message to coordinator<textarea name="message" required minlength="10" maxlength="2000" rows="4" placeholder="Ask a question about this opportunity…"></textarea></label><p class="demo-notice">${connected && o.designatedContact?.id ? "Your message goes to the nonprofit’s designated contact for this opportunity. Sending a message does not apply or confirm a placement." : "Messaging is not connected. You can draft a question, but nothing will be sent."}</p><button class="primary" type="submit">Send message</button><div class="message-result" aria-live="polite"></div></form></details>`;
}
export function bindCoordinatorForm(el, o) {
  const form = el.querySelector("#coordinator-form");
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    values.senderName = values.senderName.trim();
    values.message = values.message.trim();
    const status = form.querySelector(".message-result"),
      button = form.querySelector("button");
    status.innerHTML = "";
    if (!values.senderName || values.message.length < 10) {
      status.innerHTML =
        '<p class="form-error" role="alert">Please enter your name and at least 10 characters for your message.</p>';
      return;
    }
    button.disabled = true;
    button.textContent = "Submitting…";
    try {
      await submitCoordinatorMessage(o, values);
      status.innerHTML =
        '<p class="form-success" role="status">Message submitted to the designated nonprofit coordinator.</p>';
      form.message.value = "";
    } catch (error) {
      status.innerHTML = `<p class="form-error" role="alert">${esc(error.message)} Your draft is still here.</p>`;
    } finally {
      button.disabled = false;
      button.textContent = "Send message";
    }
  };
}
export function bellMarkup() {
  const count = unreadCount();
  return `<button class="notification-bell" id="notification-bell" aria-label="Notifications, ${count} unread"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>${count ? `<span class="unread-count">${count}</span>` : ""}</button>`;
}
export function bindBell(onChange, onOpportunity) {
  document
    .querySelector("#notification-bell")
    ?.addEventListener("click", () => {
      const items = notificationItems(),
        unread = unreadCount();
      const el = dialog(
        "Your notifications",
        `<p class="feature-intro">Recommendations are ideas to explore. Only an accepted application and a confirmed shift indicate a placement. Demo events never confirm a real placement.</p><p class="demo-notice">Current listings are demo data. Application and hours notices appear only when their records change; shift reminders need an accepted application and a confirmed shift within 48 hours.</p>${unread ? '<button class="secondary" id="mark-all-read">Mark all as read</button>' : ""}<div class="notification-list">${items.length ? items.map((n) => `<article class="notification-item ${state.readNotificationIds.includes(n.id) ? "read" : "unread"}" data-notification="${esc(n.id)}"><span class="notification-kind">${n.isDemo ? "DEMO · " : ""}${esc(n.kind)}</span><p>${esc(n.text)}</p><div>${n.opportunityId ? `<button class="text-button" data-notification-opportunity="${n.opportunityId}" data-notification-id="${esc(n.id)}">View opportunity ↗</button>` : ""}${!state.readNotificationIds.includes(n.id) ? `<button class="text-button" data-read="${esc(n.id)}">Mark as read</button>` : ""}</div></article>`).join("") : "<p>You’re all caught up. No new notifications.</p>"}</div>`,
      );
      function mark(ids) {
        state.readNotificationIds = [
          ...new Set([...state.readNotificationIds, ...ids]),
        ];
        if (!persist()) return;
        onChange();
        el.close();
        document.querySelector("#notification-bell")?.click();
      }
      el.querySelector("#mark-all-read")?.addEventListener("click", () =>
        mark(items.map((n) => n.id)),
      );
      el.querySelectorAll("[data-read]").forEach(
        (b) => (b.onclick = () => mark([b.dataset.read])),
      );
      el.querySelectorAll("[data-notification-opportunity]").forEach(
        (b) =>
          (b.onclick = () => {
            const n = items.find((n) => n.id === b.dataset.notificationId);
            if (n) {
              state.readNotificationIds = [
                ...new Set([...state.readNotificationIds, n.id]),
              ];
              persist();
            }
            el.close();
            onChange();
            onOpportunity(b.dataset.notificationOpportunity);
          }),
      );
    });
}
