export function calendarDays(year, month) {
  const first = new Date(Date.UTC(year, month, 1)),
    last = new Date(Date.UTC(year, month + 1, 0));
  const count = Math.ceil((first.getUTCDay() + last.getUTCDate()) / 7) * 7;
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(year, month, 1 - first.getUTCDay() + i));
    return {
      date: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month,
    };
  });
}
export function easternTime(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    throw Error("Choose a valid date and time.");
  const desired = Date.parse(date + "T" + time + ":00Z");
  if (!Number.isFinite(desired)) throw Error("Choose a valid date and time.");
  const parts = (t) =>
    Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(new Date(t))
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, p.value]),
    );
  let actual = desired;
  for (let i = 0; i < 3; i++) {
    const p = parts(actual),
      local = Date.parse(
        `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`,
      );
    actual += desired - local;
  }
  const p = parts(actual);
  if (
    `${p.year}-${p.month}-${p.day}` !== date ||
    `${p.hour}:${p.minute}` !== time
  )
    throw Error("That local time is not available. Choose another time.");
  return new Date(actual).toISOString();
}
export function eventDraft(input, organizationId, id) {
  const title = String(input.title || "").trim(),
    city = String(input.venue || "").trim();
  if (!title || title.length > 120 || !city || city.length > 100)
    throw Error("Enter an event name and location.");
  const startsAt = easternTime(input.date, input.start),
    endsAt = easternTime(input.date, input.end),
    hours = (Date.parse(endsAt) - Date.parse(startsAt)) / 3600000;
  if (hours <= 0 || hours > 24 || (hours * 4) % 1 !== 0)
    throw Error("End time must be later than start time, in 15-minute steps.");
  const volunteerTarget = Number(input.volunteers);
  if (
    !Number.isInteger(volunteerTarget) ||
    volunteerTarget < 1 ||
    volunteerTarget > 10000
  )
    throw Error("Enter how many volunteers you need.");
  if (!["Broward", "Miami-Dade", "Remote"].includes(input.county))
    throw Error("Choose a county or Remote.");
  const stamp = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
  return {
    id,
    organizationId,
    title,
    date: input.date,
    startsAt,
    endsAt,
    time:
      stamp.format(new Date(startsAt)) + " – " + stamp.format(new Date(endsAt)),
    hours,
    location: input.county,
    city,
    cause: "Women’s health",
    skills: ["Events and hands-on help"],
    availability:
      new Date(input.date + "T12:00:00Z").getUTCDay() === 0 ||
      new Date(input.date + "T12:00:00Z").getUTCDay() === 6
        ? "Weekends"
        : "Weekday daytime",
    minAge: 13,
    capacity: volunteerTarget,
    volunteerTarget,
    description: String(input.description || "").trim(),
    requirements: "",
    status: "draft",
    isDemo: true,
    source: "calendar",
    training: [],
    prepMeetings: [],
    updates: [],
  };
}
export function canonicalCalendarEvent(record) {
  return {
    id: record.id.replace(/^herwell:/, ""),
    title: record.title,
    date: record.date,
    county: record.location,
    venue: record.city,
    capacity: record.volunteerTarget,
    status: record.status,
    source: "calendar",
    description: record.description,
    shifts: [
      {
        id: record.id.replace(/^herwell:/, "") + "-S01",
        role: "Event support",
        category: "All categories",
        start: record.startsAt,
        end: record.endsAt,
        capacity: record.volunteerTarget,
      },
    ],
  };
}
