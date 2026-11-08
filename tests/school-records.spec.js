import { test, expect } from "@playwright/test";
const key = "volunteeru.shared.v1";
const nav = (page, name) =>
  page
    .locator("aside:visible,.mobile-nav:visible")
    .getByRole("button", { name, exact: false })
    .first()
    .click();
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
async function seed(page) {
  await page.goto("/");
  await page.evaluate(async (key) => {
    const { emptyStudent } = await import("/src/data.js");
    const connection = {
      schoolId: "school-records-test",
      schoolName: "Community Demo School",
      isDemo: true,
      targetHours: 40,
      capstone: "Present a community impact project.",
      serviceLearning: "Reflect on your service experience.",
    };
    localStorage.setItem(
      "volunteeru.schools.v1",
      JSON.stringify({
        version: 1,
        activeId: "school-records-test",
        schools: [
          {
            id: "school-records-test",
            name: "Community Demo School",
            adminName: "Morgan",
            adminEmail: "morgan@example.org",
            requiredHours: 40,
            capstone: connection.capstone,
            serviceLearning: connection.serviceLearning,
            isDemo: true,
            students: [],
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
          id: "student-school-test",
          name: "Alex Student",
          school: "Community Demo School",
          schoolConnection: connection,
          age: 17,
          onboarded: true,
          interests: ["Children and youth"],
          skills: ["Events and hands-on help"],
          availability: ["Weekends"],
          locations: ["Broward"],
        },
        saved: [],
        applications: [
          {
            id: "school-app-own",
            studentId: "student-school-test",
            opportunityId: "demo-1",
            status: "approved",
            submittedAt: "2026-11-07T12:00:00Z",
            studentSnapshot: {
              name: "Alex Student",
              schoolConnection: connection,
            },
            isDemo: true,
          },
          {
            id: "school-app-other",
            studentId: "foreign-student",
            opportunityId: "demo-1",
            status: "approved",
            submittedAt: "2026-11-07T12:00:00Z",
            studentSnapshot: {
              name: "Foreign Student",
              schoolConnection: {
                schoolId: "different-school",
                schoolName: "Other School",
                isDemo: true,
              },
            },
            isDemo: true,
          },
        ],
        hours: [
          {
            id: "school-hours-own",
            studentId: "student-school-test",
            applicationId: "school-app-own",
            status: "approved",
            hours: 3,
            date: "2026-12-12",
            isDemo: true,
          },
          {
            id: "school-hours-foreign",
            studentId: "foreign-student",
            applicationId: "school-app-other",
            status: "approved",
            hours: 999,
            date: "2026-12-12",
            isDemo: true,
          },
          {
            id: "school-hours-forged",
            studentId: "foreign-student",
            applicationId: "school-app-own",
            status: "approved",
            hours: 888,
            date: "2026-12-12",
            isDemo: true,
          },
        ],
        attendanceRecords: [
          {
            id: "school-attendance-own",
            studentId: "student-school-test",
            applicationId: "school-app-own",
            eventId: "demo-1",
            status: "present",
            recordedAt: "2026-12-12T12:00:00Z",
          },
          {
            id: "school-attendance-foreign",
            studentId: "foreign-student",
            applicationId: "school-app-other",
            eventId: "demo-1",
            status: "present",
            recordedAt: "2026-12-12T12:00:00Z",
          },
          {
            id: "school-attendance-forged",
            studentId: "foreign-student",
            applicationId: "school-app-own",
            eventId: "demo-1",
            status: "present",
            recordedAt: "2026-12-12T12:00:00Z",
          },
        ],
        shifts: [],
        trainingRecords: [],
        eventDayRecords: [],
        requirementSubmissions: [],
        readNotificationIds: [],
      }),
    );
  }, key);
  await page.reload();
}
test("school attendance and approved hours exclude other schools and mismatched students", async ({
  page,
}) => {
  await seed(page);
  await nav(page, "School Portal");
  const section = page.locator(".school-portal").filter({
    has: page.getByRole("heading", {
      name: "Verified attendance & school review",
    }),
  });
  await expect(
    section.locator(".school-stats article").nth(0).locator("strong"),
  ).toHaveText("1");
  await expect(
    section.locator(".school-stats article").nth(1).locator("strong"),
  ).toHaveText("3.00");
  await expect(section.locator("table")).toContainText("Alex Student");
  await expect(section).not.toContainText("Foreign Student");
  await expect(section).not.toContainText("999");
  await expect(section).not.toContainText("888");
  await nav(page, "My Progress");
  await expect(
    page.locator(".journey-stats article").first().locator("strong"),
  ).toHaveText("3");
  await expect(
    page.getByRole("progressbar", { name: "School service hours" }),
  ).toHaveAttribute("aria-valuenow", "3");
});
test("school reviews project evidence and preserves approval and correction feedback", async ({
  page,
}) => {
  await seed(page);
  await nav(page, "My Progress");
  const capstone =
    "I presented an impact project explaining what our volunteer team achieved.";
  const learning =
    "I reflected on supporting the community and listening to other volunteers.";
  await page
    .getByLabel("Capstone project summary or reflection")
    .fill(capstone);
  await page
    .locator('[data-requirement-form="capstone"]')
    .getByRole("button", { name: "Submit for school review" })
    .click();
  await page
    .getByLabel("Service learning summary or reflection")
    .fill(learning);
  await page
    .locator('[data-requirement-form="serviceLearning"]')
    .getByRole("button", { name: "Submit for school review" })
    .click();
  await expect(
    page.locator(".journey-record").filter({ hasText: capstone }),
  ).toContainText("Awaiting school review");
  await nav(page, "School Portal");
  const capstoneReview = page
    .locator(".journey-record")
    .filter({ hasText: capstone });
  await capstoneReview
    .getByLabel("School review note")
    .fill("Clear evidence of the project outcome.");
  await capstoneReview
    .getByRole("button", { name: "Approve submission" })
    .click();
  const learningReview = page
    .locator(".journey-record")
    .filter({ hasText: learning });
  await learningReview
    .getByRole("button", { name: "Request corrections" })
    .click();
  await expect(page.locator("#school-review-status")).toContainText(
    "Add feedback",
  );
  await learningReview
    .getByLabel("School review note")
    .fill("Please add one specific example of what you learned.");
  await learningReview
    .getByRole("button", { name: "Request corrections" })
    .click();
  await page.reload();
  await nav(page, "My Progress");
  await expect(
    page.locator(".journey-record").filter({ hasText: capstone }),
  ).toContainText("School approved · DEMO");
  await expect(
    page.locator(".journey-record").filter({ hasText: capstone }),
  ).toContainText("Clear evidence of the project outcome.");
  await expect(
    page.locator(".journey-record").filter({ hasText: learning }),
  ).toContainText("Corrections requested");
  await expect(
    page.locator(".journey-record").filter({ hasText: learning }),
  ).toContainText("Please add one specific example");
  await page
    .getByLabel("Service learning summary or reflection")
    .fill(
      "I learned to explain supply sorting clearly when a new volunteer joined our team.",
    );
  await page
    .locator('[data-requirement-form="serviceLearning"]')
    .getByRole("button", { name: "Submit for school review" })
    .click();
  await expect(
    page
      .locator(".journey-record")
      .filter({ hasText: "I learned to explain supply sorting clearly" }),
  ).toContainText("Awaiting school review");
  expect(
    await page.evaluate(
      (key) =>
        JSON.parse(localStorage.getItem(key)).requirementSubmissions.length,
      key,
    ),
  ).toBe(3);
});
