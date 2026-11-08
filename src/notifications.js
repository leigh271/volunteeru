import { eventDayNotifications } from "./event-day.js";
import { eventNotificationItems } from "./event-student.js";
import { state } from "./store.js";
import { opportunities } from "./data.js";
export function notificationItems(now = Date.now()) {
  const student = state.student;
  if (!student.onboarded) return [];
  const items = [];
  const apps = state.applications.filter((a) => a.studentId === student.id);
  for (const o of opportunities) {
    if (student.age < o.minAge || apps.some((a) => a.opportunityId === o.id))
      continue;
    const relevant =
      student.interests.includes(o.cause) ||
      student.interests.includes("Open to any cause");
    if (!relevant) continue;
    items.push({
      id: `recommendation:${o.id}`,
      kind: "Recommendation · not a placement",
      text: `Explore ${o.role}. Applying does not confirm a placement.`,
      isDemo: o.isDemo === true,
      opportunityId: o.id,
    });
  }
  for (const a of apps) {
    const o = opportunities.find((o) => o.id === a.opportunityId);
    const isDemo = a.isDemo === true || o?.isDemo === true;
    if (["approved", "accepted", "rejected", "declined"].includes(a.status)) {
      const accepted = ["approved", "accepted"].includes(a.status);
      items.push({
        id: `application:${a.id}:${a.status}:${a.updatedAt || a.submittedAt}`,
        kind: accepted ? "Application accepted" : "Application declined",
        text: `${o?.role || "Your opportunity"}: ${accepted ? "the nonprofit accepted your application." : "the nonprofit declined your application."}${isDemo ? " This is a demo decision, not a real placement." : ""}`,
        isDemo,
        opportunityId: o?.id,
      });
    }
  }
  for (const shift of state.shifts) {
    const a = apps.find((a) => a.id === shift.applicationId);
    const start = Date.parse(shift.startsAt);
    if (
      shift.studentId !== student.id ||
      shift.status !== "confirmed" ||
      !a ||
      !["approved", "accepted"].includes(a.status) ||
      !(start > now && start <= now + 48 * 60 * 60 * 1000)
    )
      continue;
    const o = opportunities.find((o) => o.id === a.opportunityId);
    items.push({
      id: `shift:${shift.id}:${shift.startsAt}`,
      kind: "Upcoming confirmed shift",
      text: `${o?.role || "Your volunteer shift"} starts ${new Date(start).toLocaleString()}.`,
      isDemo: shift.isDemo === true || a.isDemo === true || o?.isDemo === true,
      opportunityId: o?.id,
    });
  }
  for (const h of state.hours) {
    if (
      h.studentId !== student.id ||
      !apps.some((a) => a.id === h.applicationId) ||
      !["approved", "needs_corrections"].includes(h.status)
    )
      continue;
    const a = apps.find((a) => a.id === h.applicationId),
      o = opportunities.find((o) => o.id === a.opportunityId);
    items.push({
      id: `hours:${h.id}:${h.status}:${h.updatedAt || ""}`,
      kind:
        h.status === "approved" ? "Hours approved" : "Hours need corrections",
      text:
        h.status === "approved"
          ? `${h.hours ?? "Your"} volunteer hours were approved.`
          : `Please review your hours submission.${h.correctionNote ? " " + h.correctionNote : ""}`,
      isDemo: h.isDemo === true || a.isDemo === true || o?.isDemo === true,
      opportunityId: o?.id,
    });
  }
  return [
    ...items,
    ...eventNotificationItems(),
    ...eventDayNotifications(now),
  ].reverse();
}
export function unreadCount() {
  return notificationItems().filter(
    (n) => !state.readNotificationIds.includes(n.id),
  ).length;
}
