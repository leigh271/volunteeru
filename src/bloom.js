import { state } from "./store.js";
import "./bloom.css";

export const BLOOM_GOAL = 40;
const stages = ["Seed", "Sprout", "Growing", "Budding", "In bloom"];
const format = (value) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

export function bloomProgress(records = state) {
  const applications = new Set(
    records.applications
      .filter((a) => a.studentId === records.student.id)
      .map((a) => a.id),
  );
  const seen = new Set();
  let approved = 0,
    pending = 0;
  for (const record of records.hours) {
    if (
      record.studentId !== records.student.id ||
      !applications.has(record.applicationId) ||
      seen.has(record.id)
    )
      continue;
    seen.add(record.id);
    const hours = Number(record.hours);
    if (!Number.isFinite(hours) || hours <= 0) continue;
    if (record.status === "approved") approved += hours;
    if (record.status === "pending") pending += hours;
  }
  let goal = Number(records.student.schoolConnection?.targetHours);
  try {
    const registry = JSON.parse(localStorage.getItem("volunteeru.schools.v1"));
    const school = registry?.schools?.find(
      (s) => s.id === records.student.schoolConnection?.schoolId,
    );
    if (school) goal = Number(school.requiredHours);
  } catch {
    /* Keep a supplied target or the personal milestone fallback. */
  }
  goal = Number.isFinite(goal) && goal > 0 ? goal : BLOOM_GOAL;
  return {
    goal,
    approved,
    pending,
    percentage: Math.min(100, Math.floor((approved / goal) * 100)),
    stage: Math.min(4, Math.floor(approved / (goal / 4))),
    remaining: Math.max(0, goal - approved),
  };
}

export function bloomMarkup({ compact = false } = {}) {
  const { approved, pending, percentage, stage, remaining, goal } =
    bloomProgress();
  const next = Math.min(goal, ((stage + 1) * goal) / 4);
  return `<section class="bloom-card ${compact ? "bloom-compact" : "bloom-full"}" aria-label="Your growing impact" data-bloom-stage="${stage}">
    <div class="bloom-art" role="img" aria-label="${stages[stage]}: ${percentage}% of your ${format(goal)}-hour service goal" style="--bloom-position:${stage * 25}%"></div>
    <div class="bloom-content"><span class="mini-label">YOUR IMPACT, IN BLOOM</span><h2>${remaining === 0 ? "Look how much you’ve grown." : "A little good. A little growth."}</h2>
    <p class="bloom-total"><strong>${format(approved)} of ${format(goal)} hours approved</strong><span>${percentage}%</span></p>
    <div class="bloom-meter" role="progressbar" aria-label="${format(goal)}-hour service goal" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.min(goal, approved)}" aria-valuetext="${format(approved)} of ${format(goal)} approved hours, ${percentage}%"><span style="width:${percentage}%"></span></div>
    <p class="bloom-message">${remaining === 0 ? "Your flower is in full bloom. Every extra hour keeps making a difference." : `${format(remaining)} hours to bloom${compact ? "." : ` · Your next growth milestone is ${next} approved hours.`}`}</p>
    ${pending > 0 ? `<p class="bloom-pending">${format(pending)} hours awaiting coordinator review</p>` : ""}
    ${compact ? '<button class="text-button" data-page="My Progress">View my progress →</button>' : `<ol class="bloom-milestones" aria-label="Flower growth milestones">${stages.map((name, i) => `<li class="${i <= stage ? "reached" : ""}" ${i === stage ? 'aria-current="step"' : ""}><span class="bloom-dot" aria-hidden="true">${i < stage ? "✓" : ""}</span><strong>${i * 25}%</strong><span>${format((i * goal) / 4)} hours</span><small>${name}</small></li>`).join("")}</ol>`}
    <p class="bloom-note">${compact ? "Grows with coordinator-approved hours." : `${format(goal)}-hour service goal · Only coordinator-approved hours grow your plant. Pending, rejected, and correction-requested hours do not count. Your school confirms whether hours meet its requirements.`}</p>
    </div></section>`;
}
