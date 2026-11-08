// Browser-local prototype registry. These records are never an authorization boundary.
export const NONPROFIT_KEY = "volunteeru.nonprofits.v1";
const empty = () => ({
  version: 1,
  activeId: null,
  organizations: [],
  events: [],
});
const text = (value, max = 2000) =>
  typeof value === "string" && value.length <= max;
export function readNonprofits() {
  try {
    const data = JSON.parse(localStorage.getItem(NONPROFIT_KEY));
    if (
      data?.version !== 1 ||
      !Array.isArray(data.organizations) ||
      !Array.isArray(data.events)
    )
      return empty();
    data.organizations = data.organizations.filter(
      (o) =>
        o &&
        text(o.id, 100) &&
        text(o.name, 120) &&
        text(o.coordinator, 120) &&
        text(o.email, 200),
    );
    const ids = new Set(data.organizations.map((o) => o.id));
    data.events = data.events
      .filter(
        (e) =>
          e &&
          text(e.id, 100) &&
          ids.has(e.organizationId) &&
          text(e.title, 120) &&
          ["draft", "published"].includes(e.status),
      )
      .map((e) => ({
        ...e,
        isDemo: true,
        training: Array.isArray(e.training)
          ? e.training.filter(
              (t) =>
                t &&
                text(t.id, 100) &&
                text(t.title, 160) &&
                text(t.instructions, 4000),
            )
          : [],
        prepMeetings: Array.isArray(e.prepMeetings)
          ? e.prepMeetings.filter(
              (m) =>
                m &&
                text(m.id, 100) &&
                text(m.title, 160) &&
                !Number.isNaN(Date.parse(m.startsAt)),
            )
          : [],
        updates: Array.isArray(e.updates)
          ? e.updates.filter(
              (u) =>
                u &&
                text(u.id, 100) &&
                text(u.text, 4000) &&
                !Number.isNaN(Date.parse(u.createdAt)),
            )
          : [],
      }));
    if (!ids.has(data.activeId)) data.activeId = null;
    return data;
  } catch {
    return empty();
  }
}
export function saveNonprofits(data) {
  try {
    localStorage.setItem(NONPROFIT_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event("volunteeru:nonprofit-change"));
    return true;
  } catch {
    alert(
      "Your browser could not save nonprofit changes. Please enable local storage and try again.",
    );
    return false;
  }
}
export function getPublishedOpportunities() {
  const data = readNonprofits();
  return data.events
    .filter((e) => e.status === "published" && validPublishedEvent(e))
    .map((e) => ({
      ...e,
      role: e.title,
      nonprofit: data.organizations.find((o) => o.id === e.organizationId).name,
      isDemo: true,
      website: null,
      publicContact: null,
      art: "community",
      emoji: "✦",
      publishedByNonprofit: true,
      designatedContact: {
        id: e.organizationId,
        name: data.organizations.find((o) => o.id === e.organizationId)
          .coordinator,
      },
    }));
}
export function validPublishedEvent(e) {
  if (
    !e ||
    ![
      "title",
      "date",
      "startsAt",
      "time",
      "city",
      "requirements",
      "description",
    ].every((key) => typeof e[key] === "string" && e[key].trim())
  )
    return false;
  const date = new Date(`${e.date}T12:00:00Z`);
  return Boolean(
    /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === e.date &&
    Number.isFinite(Date.parse(e.startsAt)) &&
    ["Broward", "Miami-Dade", "Remote"].includes(e.location) &&
    [
      "Women’s health",
      "Animals",
      "Children and youth",
      "Open to any cause",
    ].includes(e.cause) &&
    Array.isArray(e.skills) &&
    e.skills.length &&
    e.skills.every((s) => typeof s === "string") &&
    ["Weekday daytime", "Weekday evenings", "Weekends", "Flexible"].includes(
      e.availability,
    ) &&
    Number.isInteger(Number(e.minAge)) &&
    Number(e.minAge) >= 13 &&
    Number(e.minAge) <= 100 &&
    Number(e.hours) > 0 &&
    Number(e.hours) <= 24 &&
    (Number(e.hours) * 4) % 1 === 0 &&
    Number.isInteger(Number(e.capacity)) &&
    Number(e.capacity) > 0 &&
    Number(e.capacity) <= 100000 &&
    Number.isInteger(Number(e.volunteerTarget)) &&
    Number(e.volunteerTarget) > 0 &&
    Number(e.volunteerTarget) <= 10000,
  );
}
