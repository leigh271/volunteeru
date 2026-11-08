import test from "node:test";
import assert from "node:assert/strict";
import {
  calendarDays,
  easternTime,
  eventDraft,
  canonicalCalendarEvent,
} from "../src/events-calendar-model.js";
test("November calendar includes every date in aligned Sunday-first weeks", () => {
  const days = calendarDays(2026, 10);
  assert.equal(days.length, 35);
  assert.equal(days[0].date, "2026-11-01");
  assert.equal(days.filter((d) => d.inMonth).length, 30);
  assert.equal(new Set(days.map((d) => d.date)).size, 35);
});
test("Eastern event times respect seasonal offsets and reject nonexistent local times", () => {
  assert.equal(easternTime("2026-11-21", "10:00"), "2026-11-21T15:00:00.000Z");
  assert.equal(easternTime("2026-07-21", "10:00"), "2026-07-21T14:00:00.000Z");
  assert.throws(() => easternTime("2026-03-08", "02:30"));
});
test("calendar draft retains the exact two-hour schedule and stays unpublished", () => {
  const d = eventDraft(
    {
      title: "Calendar test",
      date: "2026-11-21",
      start: "10:00",
      end: "12:00",
      venue: "Sample venue",
      county: "Broward",
      volunteers: "8",
    },
    "org",
    "herwell:calendar-test",
  );
  assert.equal(d.status, "draft");
  assert.equal(d.hours, 2);
  assert.equal(canonicalCalendarEvent(d).id, "calendar-test");
  assert.equal(canonicalCalendarEvent(d).shifts[0].end, d.endsAt);
  assert.throws(() =>
    eventDraft(
      {
        title: "Bad time",
        date: "2026-11-21",
        start: "12:00",
        end: "10:00",
        venue: "Place",
        county: "Broward",
        volunteers: "8",
      },
      "org",
      "bad",
    ),
  );
});
