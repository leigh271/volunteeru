import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

async function seedDashboard(page) {
  await page.goto("/?view=school");
  await page.evaluate(async () => {
    const { emptyStudent } = await import("/src/data.js");
    const { state, persist } = await import("/src/store.js");
    state.student = { ...emptyStudent, id: "dashboard-viewer" };
    const schoolConnection = {
      schoolId: "dashboard-school",
      schoolName: "Dashboard School",
      isDemo: true,
      targetHours: 40,
    };
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(
      "volunteeru.schools.v1",
      JSON.stringify({
        version: 1,
        activeId: "dashboard-school",
        schools: [
          {
            id: "dashboard-school",
            name: "Dashboard School",
            adminName: "Taylor",
            requiredHours: 40,
            students: [
              { id: "a", name: "Alya", hours: 0, applications: 0 },
              { id: "b", name: "Ben", hours: 20, applications: 1 },
              { id: "c", name: "Cara", hours: 40, applications: 2 },
              ...Array.from({ length: 22 }, (_, i) => ({
                id: `extra-${i}`,
                name: `Student ${i}`,
                hours: 0,
                applications: 0,
              })),
            ],
          },
        ],
      }),
    );
    state.applications = [
      {
        id: "app-b",
        studentId: "b",
        opportunityId: "event",
        status: "approved",
        submittedAt: new Date().toISOString(),
        studentSnapshot: { name: "Ben", schoolConnection },
      },
      {
        id: "foreign-app",
        studentId: "b",
        opportunityId: "event",
        status: "approved",
        submittedAt: new Date().toISOString(),
        studentSnapshot: { schoolConnection: { schoolId: "another-school" } },
      },
    ];
    state.hours = [
      {
        id: "hours-b",
        studentId: "b",
        applicationId: "app-b",
        hours: 20,
        date: today,
        status: "approved",
      },
      {
        id: "hours-b",
        studentId: "b",
        applicationId: "app-b",
        hours: 20,
        date: today,
        status: "approved",
      },
      {
        id: "no-date",
        studentId: "b",
        applicationId: "app-b",
        hours: 3,
        status: "approved",
      },
      {
        id: "foreign-hours",
        studentId: "b",
        applicationId: "foreign-app",
        hours: 100,
        date: today,
        status: "approved",
      },
      {
        id: "wrong-student",
        studentId: "c",
        applicationId: "app-b",
        hours: 100,
        date: today,
        status: "approved",
      },
      {
        id: "pending-hours",
        studentId: "b",
        applicationId: "app-b",
        hours: 100,
        date: today,
        status: "pending",
      },
    ];
    state.requirementSubmissions = [
      "pending",
      "approved",
      "needs_corrections",
    ].map((status, i) => ({
      id: `review-${i}`,
      schoolId: "dashboard-school",
      studentId: "b",
      studentName: "Ben",
      kind: "capstone",
      evidence: "A sample impact project reflection.",
      status,
    }));
    state.requirementSubmissions.push({
      id: "foreign-review",
      schoolId: "another-school",
      studentId: "foreign",
      studentName: "Foreign",
      kind: "capstone",
      evidence: "A different school record.",
      status: "pending",
    });
    persist();
  });
  await page.reload();
}

test("school charts reconcile, filter students, paginate and export the selected population", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seedDashboard(page);
  const dashboard = page.getByRole("region", {
    name: "School analytics dashboard",
  });
  await expect(dashboard).toBeVisible();
  await expect(dashboard.locator(".school-kpis article").nth(0)).toContainText(
    "25",
  );
  await expect(dashboard.locator(".school-kpis article").nth(1)).toContainText(
    "4%",
  );
  await expect(
    dashboard.locator(".school-kpis article").nth(2).locator("strong"),
  ).toHaveText("60");
  await expect(
    dashboard.locator(".school-kpis article").nth(3).locator("strong"),
  ).toHaveText("1");
  await expect(
    dashboard.getByRole("img", { name: /Student goal progress/ }),
  ).toBeVisible();
  await expect(dashboard.getByRole("listitem").last()).toHaveAttribute(
    "aria-label",
    /20 approved hours/,
  );
  await expect(dashboard).toContainText(
    "3 approved hours have no valid service date",
  );
  await expect(dashboard.locator(".school-review-bars strong")).toHaveText([
    "1",
    "1",
    "1",
  ]);
  const roster = page.locator("#school-student-list");
  await expect(roster.locator("tbody tr")).toHaveCount(20);
  await roster.getByRole("button", { name: "Next students" }).click();
  await expect(roster.locator("tbody tr")).toHaveCount(5);
  await dashboard.getByRole("button", { name: /Halfway or more/ }).click();
  await expect(roster.locator("tbody tr")).toHaveCount(1);
  await expect(roster.locator("tbody")).toContainText("Ben");
  const download = page.waitForEvent("download");
  await roster
    .getByRole("button", { name: "Export filtered students" })
    .click();
  const csv = await fs.readFile(await (await download).path(), "utf8");
  expect(csv).toContain('"Ben","1","20","40","50"');
  expect(csv).not.toContain("Cara");
  await roster.getByRole("button", { name: "Clear filters" }).click();
  await page
    .getByLabel("Find a student", { exact: true })
    .fill("no such student");
  await expect(roster).toContainText("No students match these filters.");
  await expect(dashboard.locator(".school-kpis article").nth(0)).toContainText(
    "25",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("empty schools and unset goals show honest empty states", async ({
  page,
}) => {
  await seedDashboard(page);
  const model = await page.evaluate(async () => {
    const { schoolDashboardModel } = await import("/src/school-dashboard.js");
    return schoolDashboardModel(
      {
        id: "empty",
        requiredHours: 0,
        students: [
          { id: "student", name: "Student", hours: 20, applications: 1 },
        ],
      },
      { student: {}, applications: [], hours: [], requirementSubmissions: [] },
    );
  });
  expect(model.goal).toBe(0);
  expect(model.completed).toBe(0);
  expect(model.students[0]).toMatchObject({ progress: null, band: "no-goal" });
  await page.evaluate(() => {
    localStorage.setItem(
      "volunteeru.schools.v1",
      JSON.stringify({
        version: 1,
        activeId: "empty",
        schools: [
          {
            id: "empty",
            name: "Empty School",
            requiredHours: 40,
            students: [],
          },
        ],
      }),
    );
  });
  await page.reload();
  await expect(
    page.getByRole("region", { name: "School analytics dashboard" }),
  ).toContainText("Connect students to see their progress distribution.");
  await expect(page.locator(".school-donut")).toHaveCount(0);
  await expect(page.locator(".school-month-bar")).toHaveCount(0);
  await expect(
    page.getByText(
      "No dated approved service records in the last six months.",
      { exact: true },
    ),
  ).toBeVisible();
});
