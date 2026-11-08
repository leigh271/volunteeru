const PREFERENCE = "volunteeru.guide.hidden.v1";
let guideHidden = false;
try {
  guideHidden = localStorage.getItem(PREFERENCE) === "true";
} catch {}
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const sprout = `<svg viewBox="0 0 100 100" role="img" aria-label="Sunny, your sprout guide"><path d="M50 36C26 35 22 16 26 11c19 0 29 10 24 25Z" fill="#a8c7a0"/><path d="M51 36C48 18 64 10 77 14c1 15-10 25-26 22Z" fill="#c4d9ab"/><path d="M51 26v19" stroke="#557b5a" stroke-width="4" stroke-linecap="round"/><path d="M49 31C17 31 10 60 26 82c10 14 43 15 55-3 15-23-1-48-32-48Z" fill="#d9d0ff" stroke="#7258e8" stroke-width="2"/><ellipse cx="37" cy="57" rx="3" ry="5" fill="#423264"/><ellipse cx="63" cy="57" rx="3" ry="5" fill="#423264"/><path d="M42 68q9 9 18-1" fill="none" stroke="#423264" stroke-width="3" stroke-linecap="round"/><ellipse cx="28" cy="66" rx="6" ry="3" fill="#edb9c6"/><ellipse cx="73" cy="66" rx="6" ry="3" fill="#edb9c6"/></svg>`;
export function mascotMarkup(context = {}) {
  const hours = Number.isFinite(context.approvedHours)
    ? Math.max(0, context.approvedHours)
    : 0;
  const milestone = [100, 50, 25, 10, 1].find((value) => hours >= value);
  let message = context.onboarding
    ? context.step === 0
      ? "Hi, I’m Sunny! Let’s start with a little about you. Your school link can connect your requirements."
      : "Pick what feels like you. Your interests, strengths, and schedule help us find your fit."
    : milestone
      ? `You’ve reached ${milestone} verified volunteer ${milestone === 1 ? "hour" : "hours"}! Every hour is a little more good in your community.`
      : "A little time can do a lot of good. Explore a match, check the requirements, and take your next step.";
  return `<section class="sunny-guide ${guideHidden ? "sunny-collapsed" : ""}" aria-label="Student guide"><button class="sunny-reopen secondary" type="button" aria-label="Open Sunny student guide">${sprout}<span>Ask Sunny for a little guidance</span></button><div class="sunny-body">${sprout}<div><span class="mini-label">${milestone && !context.onboarding ? "A MOMENT TO CELEBRATE" : "YOUR LITTLE GUIDE"}</span><strong>Good grows with you.</strong><p>${escape(message)}</p></div><button class="sunny-dismiss" type="button" aria-label="Hide Sunny student guide">×</button></div></section>`;
}
export function bindMascot() {
  const section = document.querySelector(".sunny-guide");
  if (!section) return;
  const toggle = (hidden) => {
    guideHidden = hidden;
    section.classList.toggle("sunny-collapsed", hidden);
    try {
      localStorage.setItem(PREFERENCE, String(hidden));
    } catch {}
    section.querySelector(hidden ? ".sunny-reopen" : ".sunny-dismiss")?.focus();
  };
  section.querySelector(".sunny-dismiss").onclick = () => toggle(true);
  section.querySelector(".sunny-reopen").onclick = () => toggle(false);
}
