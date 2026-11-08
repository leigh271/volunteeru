import { test, expect } from "@playwright/test";
const key = "volunteeru.shared.v1";
const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const list = [];
  errors.set(page, list);
  page.on("pageerror", (e) => list.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
const nav = (page) =>
  page
    .locator("aside:visible,.mobile-nav:visible")
    .getByRole("button", { name: "Event Day" })
    .first()
    .click();
async function seed(page, status = "approved") {
  await page.goto("/");
  await page.evaluate(
    async ({ key, status }) => {
      const { emptyStudent } = await import("/src/data.js");
      localStorage.setItem(
        "volunteeru.nonprofits.v1",
        JSON.stringify({
          version: 1,
          activeId: "org-event-day",
          organizations: [
            {
              id: "org-event-day",
              name: "Event Day Demo",
              coordinator: "Morgan",
              email: "morgan@example.org",
            },
          ],
          events: [
            {
              id: "event-day-test",
              organizationId: "org-event-day",
              title: "Community Care Day",
              date: "2026-12-19",
              time: "10:00",
              startsAt: "2026-12-19T10:00:00",
              hours: 2,
              location: "Broward",
              city: "Fort Lauderdale",
              cause: "Women’s health",
              skills: ["Events and hands-on help"],
              availability: "Weekends",
              minAge: 13,
              capacity: 80,
              volunteerTarget: 10,
              status: "published",
              description: "Help assemble community care kits.",
              requirements: "Orientation and guardian consent.",
              training: [],
              prepMeetings: [],
              updates: [],
            },
          ],
        }),
      );
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          student: {
            ...emptyStudent,
            id: "event-day-student",
            name: "Alex Student",
            school: "Demo School",
            age: 17,
            onboarded: true,
            interests: ["Women’s health"],
            womensHealth: ["Period Care & Menstrual Equity"],
            skills: ["Events and hands-on help"],
            availability: ["Weekends"],
            locations: ["Broward"],
          },
          saved: [],
          applications: [
            {
              id: "event-day-application",
              studentId: "event-day-student",
              opportunityId: "event-day-test",
              status,
              submittedAt: "2026-11-07T12:00:00Z",
              isDemo: true,
            },
          ],
          shifts: [
            {
              id: "event-day-shift",
              studentId: "event-day-student",
              applicationId: "event-day-application",
              status: "confirmed",
              startsAt: "2026-12-19T10:00:00",
              isDemo: true,
            },
          ],
          hours: [],
          eventDayRecords: [],
          trainingRecords: [],
          attendanceRecords: [],
          readNotificationIds: [],
        }),
      );
    },
    { key, status },
  );
  await page.reload();
  await nav(page);
}
test("event check-in, reflection, checkout and reload retain one pending submission", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-12-19T10:00:00"));
  await seed(page);
  await page.getByRole("button", { name: "Check in for event" }).click();
  await page
    .getByLabel("Activities completed", { exact: true })
    .fill("Assembled care kits and organized the supply table.");
  await page
    .getByLabel("Event notes", { exact: true })
    .fill("Learned how to sort supplies respectfully.");
  await page
    .getByLabel("Feedback for the coordinator", { exact: true })
    .fill("The setup instructions were helpful.");
  await page.getByRole("button", { name: "Save event reflection" }).click();
  await page.reload();
  await nav(page);
  await expect(
    page.getByLabel("Activities completed", { exact: true }),
  ).toHaveValue("Assembled care kits and organized the supply table.");
  await page.clock.setFixedTime(new Date("2026-12-19T11:30:00"));
  await page.getByRole("button", { name: "Check out & submit hours" }).click();
  await expect(page.locator(".event-day-state")).toContainText(
    "1.5 calculated hours",
  );
  const data = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    key,
  );
  expect(data.hours).toHaveLength(1);
  expect(data.hours[0].status).toBe("pending");
  expect(data.hours[0].hours).toBe(1.5);
  expect(data.attendanceRecords).toHaveLength(0);
  await page.reload();
  await nav(page);
  await expect(
    page.getByRole("button", { name: "Check out & submit hours" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Event notes", { exact: true })).toHaveValue(
    "Learned how to sort supplies respectfully.",
  );
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).hours.length,
      key,
    ),
  ).toBe(1);
});
test("check-in waits for the confirmed event and a pending application cannot check in", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-12-19T09:00:00"));
  await seed(page);
  await expect(
    page.getByRole("button", { name: "Check in for event" }),
  ).toBeDisabled();
  await seed(page, "pending");
  await expect(
    page.getByRole("button", { name: "Check in for event" }),
  ).toHaveCount(0);
});
test("checkout caps time to scheduled hours and reminds an open check-in", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-12-19T10:00:00"));
  await seed(page);
  await page.getByRole("button", { name: "Check in for event" }).click();
  await page.clock.setFixedTime(new Date("2026-12-19T13:00:00"));
  await page.reload();
  await nav(page);
  await page.getByRole("button", { name: /Notifications,/ }).click();
  await expect(page.locator(".notification-list")).toContainText(
    "Check-out reminder",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Check out & submit hours" }).click();
  await expect(page.locator(".event-day-state")).toContainText(
    "2 calculated hours",
  );
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).hours[0].status,
      key,
    ),
  ).toBe("pending");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
