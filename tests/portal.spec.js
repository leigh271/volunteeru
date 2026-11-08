import { test, expect } from "@playwright/test";
const key = "volunteeru.shared.v1";
const errorsByPage = new WeakMap();
test.beforeEach(async ({ page }) => {
  const errors = [];
  errorsByPage.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(errorsByPage.get(page)).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
});

import { navigate as nav } from "./navigation.js";
async function seedStudent(page, records = {}) {
  await page.goto("/");
  await page.evaluate(
    async ({ key, records }) => {
      const { emptyStudent } = await import("/src/data.js");
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          student: {
            ...emptyStudent,
            id: "student-test",
            name: "Sam Student",
            age: 17,
            school: "Test School",
            onboarded: true,
            interests: ["Women’s health"],
            womensHealth: ["Period Care & Menstrual Equity"],
            skills: ["Events and hands-on help"],
            availability: ["Weekends"],
            locations: ["Broward"],
          },
          saved: [],
          applications: [],
          hours: [],
          shifts: [],
          readNotificationIds: [],
          ...records,
        }),
      );
    },
    { key, records },
  );
  await page.reload();
}

test("school registration creates an invitation that explicitly links a student and live requirements", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "School Portal");
  await page.getByLabel("School name", { exact: true }).fill("Community High");
  await page
    .getByLabel("Administrator or coordinator name")
    .fill("Morgan Coordinator");
  await page.getByLabel("Work email").fill("morgan@example.org");
  await page.getByLabel("Graduation volunteer hours").fill("60");
  await page
    .getByLabel("Capstone project requirement")
    .fill("Present an impact project");
  await page
    .getByLabel("Service learning requirement")
    .fill("Write an event reflection");
  await page.getByRole("checkbox", { name: /authorized/ }).check();
  await page.getByRole("button", { name: /Create demo school/ }).click();
  const link = await page.getByLabel("Unique school link").inputValue();
  expect(new URL(link).searchParams.get("school")).toBeTruthy();
  await page.goto(link);
  await expect(page.locator(".school-link-invitation")).toContainText(
    "Community High",
  );
  await page.getByRole("button", { name: /Find my opportunities/ }).click();
  await page.getByLabel("Your name").fill("Sam Student");
  await page.getByLabel("Your age").fill("17");
  await page.getByRole("button", { name: "Join this school" }).click();
  await expect(page.locator(".school-link-invitation")).toContainText(
    "School connected",
  );
  await expect(page.getByLabel("School or university")).toHaveValue(
    "Community High",
  );
  await expect(page.getByLabel("Your name")).toHaveValue("Sam Student");
  await expect(page.getByLabel("Your age")).toHaveValue("17");
  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByRole("button", { name: /Women’s health/ }).click();
  await page.getByRole("button", { name: /Next/ }).click();
  await page
    .getByRole("button", { name: /Period Care & Menstrual Equity/ })
    .click();
  await page.getByRole("button", { name: /Next/ }).click();
  for (const option of ["Events and hands-on help", "Weekends", "Broward"]) {
    await page.getByRole("button", { name: new RegExp(option) }).click();
    await page
      .getByRole("button", { name: /Next|Let’s find your fit/ })
      .click();
  }
  await nav(page, "My Progress");
  await expect(
    page.getByRole("progressbar", { name: "School service hours" }),
  ).toHaveAttribute("aria-valuemax", "60");
  await expect(page.locator(".journey-requirements")).toContainText(
    "Present an impact project",
  );
  await nav(page, "School Portal");
  await expect(page.locator(".school-table")).toContainText("Sam Student");
  await page.getByLabel("Graduation volunteer hours").fill("80");
  await page.getByRole("button", { name: "Save requirements" }).click();
  await nav(page, "My Progress");
  await expect(
    page.getByRole("progressbar", { name: "School service hours" }),
  ).toHaveAttribute("aria-valuemax", "80");
});

test("hours wait for review and unrelated approved records do not inflate progress", async ({
  page,
}) => {
  await seedStudent(page, {
    applications: [
      {
        id: "app-test",
        studentId: "student-test",
        opportunityId: "demo-1",
        status: "approved",
        submittedAt: "2026-10-01T12:00:00Z",
        isDemo: true,
      },
    ],
    hours: [
      {
        id: "unrelated",
        studentId: "student-test",
        applicationId: "not-my-application",
        status: "approved",
        hours: 100,
      },
      {
        id: "other-student",
        studentId: "other",
        applicationId: "app-test",
        status: "approved",
        hours: 100,
      },
    ],
  });
  await nav(page, "My Progress");
  await expect(page.locator(".journey-stats article").first()).toContainText(
    "0",
  );
  await page.getByLabel("Date volunteered").fill("2026-10-01");
  await page.getByLabel("Hours completed").fill("3");
  await page
    .getByLabel("What did you do?")
    .fill("Helped set up community activities.");
  await page.getByRole("button", { name: /Submit for review/ }).click();
  await expect(page.locator(".journey-hours-list")).toContainText(
    "Awaiting coordinator review",
  );
  await expect(
    page.locator(".journey-stats article").nth(0).locator("strong"),
  ).toHaveText("0");
  await expect(
    page.locator(".journey-stats article").nth(1).locator("strong"),
  ).toHaveText("3");
  await page.getByLabel("Date volunteered").fill("2026-10-01");
  await page.getByLabel("Hours completed").fill("3");
  await page
    .getByLabel("What did you do?")
    .fill("Helped set up community activities.");
  await page.getByRole("button", { name: /Submit for review/ }).click();
  await expect(page.locator("#hours-status")).toContainText(
    "already submitted",
  );
  await page.evaluate((key) => {
    const record = JSON.parse(localStorage.getItem(key));
    record.hours.find((h) => h.status === "pending").status = "approved";
    localStorage.setItem(key, JSON.stringify(record));
  }, key);
  await page.reload();
  await nav(page, "My Progress");
  await expect(
    page.locator(".journey-stats article").nth(0).locator("strong"),
  ).toHaveText("3");
  await expect(
    page.locator(".journey-stats article").nth(1).locator("strong"),
  ).toHaveText("0");
});

test("training read state and mascot visibility persist independently of verified hours", async ({
  page,
}) => {
  await seedStudent(page);
  await nav(page, "My Progress");
  await page
    .getByRole("button", { name: "Mark as read", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "✓ Read · self-reported" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hide Sunny student guide" }).click();
  await expect(
    page.getByRole("button", { name: "Open Sunny student guide" }),
  ).toBeVisible();
  await page.reload();
  await nav(page, "My Progress");
  await expect(
    page.getByRole("button", { name: "✓ Read · self-reported" }),
  ).toBeVisible();
  await expect(
    page.locator(".journey-stats article").first().locator("strong"),
  ).toHaveText("0");
  await expect(
    page.getByRole("button", { name: "Open Sunny student guide" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open Sunny student guide" }).click();
  await expect(
    page.getByRole("button", { name: "Hide Sunny student guide" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Hide Sunny student guide" }),
  ).toBeVisible();
});

test("unknown invitations do not attach a school and only approved confirmed shifts count", async ({
  page,
}) => {
  await page.goto("/?school=unknown-school");
  await expect(
    page.getByRole("heading", { name: "School invitation unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Join this school" }),
  ).toHaveCount(0);
  await seedStudent(page, {
    applications: [
      {
        id: "approved",
        studentId: "student-test",
        opportunityId: "demo-1",
        status: "approved",
        submittedAt: "2026-10-01T12:00:00Z",
        isDemo: true,
      },
      {
        id: "pending",
        studentId: "student-test",
        opportunityId: "demo-2",
        status: "pending",
        submittedAt: "2026-10-01T12:00:00Z",
        isDemo: true,
      },
    ],
    shifts: [
      {
        id: "valid",
        studentId: "student-test",
        applicationId: "approved",
        status: "confirmed",
        startsAt: "2026-12-12T12:00:00Z",
        isDemo: true,
      },
      {
        id: "not-approved",
        studentId: "student-test",
        applicationId: "pending",
        status: "confirmed",
        startsAt: "2026-12-12T12:00:00Z",
        isDemo: true,
      },
      {
        id: "not-confirmed",
        studentId: "student-test",
        applicationId: "approved",
        status: "pending",
        startsAt: "2026-12-12T12:00:00Z",
        isDemo: true,
      },
      {
        id: "not-my-shift",
        studentId: "other",
        applicationId: "approved",
        status: "confirmed",
        startsAt: "2026-12-12T12:00:00Z",
        isDemo: true,
      },
    ],
  });
  await nav(page, "My Progress");
  await expect(
    page.locator(".journey-stats article").nth(2).locator("strong"),
  ).toHaveText("1");
});
