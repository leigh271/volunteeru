import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { navigate } from "./navigation.js";
const nav = (page) => navigate(page, "Impact Reports");
const errors = new WeakMap();
test.beforeEach(({ page }) => {
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
  await page.evaluate(async () => {
    const { emptyStudent } = await import("/src/data.js");
    const org = {
      id: "report-org",
      name: "Care Demo Collective",
      coordinator: "Sample Coordinator",
      email: "private@example.org",
    };
    const event = (id, organizationId, date, title) => ({
      id,
      organizationId,
      date,
      title,
      status: "published",
      isDemo: true,
      training: [],
      prepMeetings: [],
      updates: [],
    });
    localStorage.setItem(
      "volunteeru.nonprofits.v1",
      JSON.stringify({
        version: 1,
        activeId: org.id,
        organizations: [
          org,
          { ...org, id: "unrelated-org", name: "Unrelated Nonprofit" },
        ],
        events: [
          {
            ...event("report-event", org.id, "2026-10-15", "=SUM(1,2)"),
            impact: {
              reach: 50,
              suppliesDistributed: 80,
              outcomes: "Assembled sample kits.",
            },
          },
          event("november-event", org.id, "2026-11-01", "November event"),
          event(
            "other-event",
            "unrelated-org",
            "2026-10-15",
            "Secret other event",
          ),
        ],
      }),
    );
    const app = (id, studentId, opportunityId, status = "approved") => ({
      id,
      studentId,
      opportunityId,
      status,
      submittedAt: "2026-10-01T12:00:00Z",
      studentSnapshot: {
        name: "Private Student Name",
        school: "Self Reported High",
        age: 17,
      },
    });
    localStorage.setItem(
      "volunteeru.shared.v1",
      JSON.stringify({
        version: 1,
        student: { ...emptyStudent, id: "report-student" },
        saved: [],
        applications: [
          app("report-app", "report-student", "report-event"),
          app("pending-app", "pending-student", "report-event", "pending"),
          app("other-app", "other-student", "other-event"),
          app("nov-app", "report-student", "november-event"),
        ],
        hours: [
          {
            id: "verified-hour",
            studentId: "report-student",
            applicationId: "report-app",
            status: "approved",
            hours: 3,
          },
          {
            id: "pending-hour",
            studentId: "report-student",
            applicationId: "report-app",
            status: "pending",
            hours: 20,
          },
          {
            id: "foreign-hour",
            studentId: "other-student",
            applicationId: "other-app",
            status: "approved",
            hours: 24,
          },
          {
            id: "spoof-hour",
            studentId: "other-student",
            applicationId: "report-app",
            status: "approved",
            hours: 24,
          },
          {
            id: "nov-hour",
            studentId: "report-student",
            applicationId: "nov-app",
            status: "approved",
            hours: 2,
          },
        ],
        attendanceRecords: [
          {
            id: "attendance-1",
            studentId: "report-student",
            applicationId: "report-app",
            eventId: "report-event",
            status: "present",
          },
          {
            id: "attendance-dupe",
            studentId: "report-student",
            applicationId: "report-app",
            eventId: "report-event",
            status: "present",
          },
          {
            id: "attendance-spoof",
            studentId: "other-student",
            applicationId: "report-app",
            eventId: "report-event",
            status: "present",
          },
        ],
        eventDayRecords: [
          {
            id: "day-1",
            studentId: "report-student",
            applicationId: "report-app",
            eventId: "report-event",
            checkInAt: "2026-10-15T10:00:00Z",
            checkOutAt: "2026-10-15T12:00:00Z",
            activities: "Private activity",
            notes: "Private notes",
            feedback: "Private feedback",
          },
        ],
        shifts: [],
        trainingRecords: [],
        readNotificationIds: [],
      }),
    );
  });
  await page.reload();
  await nav(page);
}
async function selectOctober(page) {
  await page.getByLabel("Event month", { exact: true }).fill("2026-10");
}

test("monthly nonprofit reports scope approved records and distinguish reported outcomes", async ({
  page,
}) => {
  await seed(page);
  await selectOctober(page);
  const stats = page.locator(".report-stats article strong");
  await expect(stats.nth(0)).toHaveText("1");
  await expect(stats.nth(1)).toHaveText("1");
  await expect(stats.nth(2)).toHaveText("3");
  await expect(stats.nth(3)).toHaveText("1");
  await expect(page.locator(".report-table").first()).not.toContainText(
    "Secret other event",
  );
  await expect(page.locator(".report-table").nth(1)).toContainText(
    "Self-reported school",
  );
  await page.getByLabel("People reached", { exact: true }).fill("60");
  await page.getByLabel("Supplies distributed", { exact: true }).fill("90");
  await page
    .getByLabel("Community outcomes", { exact: true })
    .fill("Distributed demo kits; coordinator counted recipients.");
  await page
    .getByRole("button", { name: "Save coordinator-reported outcomes" })
    .click();
  await expect(page.locator("#report-impact-status")).toContainText(
    "not independently verified",
  );
  await expect(page.locator(".report-narrative")).toContainText("reach of 60");
  await page
    .getByLabel("Report event", { exact: true })
    .selectOption("november-event");
  await expect(page.locator(".report-empty")).toContainText("No events match");
  await expect(stats.nth(2)).toHaveText("0");
});

test("aggregate exports preserve evidence, omit private fields and escape spreadsheet formulas", async ({
  page,
}) => {
  await seed(page);
  await selectOctober(page);
  let pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download aggregate CSV" }).click();
  let download = await pending;
  const csv = await fs.readFile(await download.path(), "utf8");
  expect(csv).toContain("'=SUM(1,2)");
  expect(csv).not.toContain("Private Student Name");
  expect(csv).not.toContain("private@example.org");
  expect(csv).not.toContain("Secret other event");
  pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download JSON + provenance" })
    .click();
  download = await pending;
  const json = JSON.parse(await fs.readFile(await download.path(), "utf8"));
  expect(json.totals.approvedHours).toBe(3);
  expect(json.evidence.approvedHours.map((h) => h.id)).toEqual([
    "verified-hour",
  ]);
  expect(json.evidence.completedEventDays.map((r) => r.id)).toEqual(["day-1"]);
  expect(JSON.stringify(json)).not.toContain("Private notes");
  expect(JSON.stringify(json)).not.toContain("Private feedback");
  expect(JSON.stringify(json)).not.toContain("Private Student Name");
  pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download printable report" }).click();
  download = await pending;
  expect(download.suggestedFilename()).toMatch(/\.html$/);
  const html = await fs.readFile(await download.path(), "utf8");
  expect(html).toContain("DEMO impact report");
  expect(html).toContain("verified-hour");
  expect(html).not.toContain("private@example.org");
});

test("AI reports reject out-of-scope evidence and accept a reviewed scoped draft", async ({
  page,
}) => {
  await page.addInitScript(() => (window.__VOLUNTEERU_API__ = "/api"));
  await page.route("**/api/student/updates", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  let valid = false;
  await page.route("**/api/nonprofit/reports", (route) => {
    const request = route.request().postDataJSON();
    expect(Object.keys(request).sort()).toEqual([
      "eventId",
      "month",
      "organizationId",
    ]);
    return route.fulfill({
      json: {
        organizationId: "report-org",
        summary: "A draft based on the selected approved hours.",
        evidenceRecordIds: [valid ? "verified-hour" : "foreign-hour"],
      },
    });
  });
  await seed(page);
  await selectOctober(page);
  await page.getByRole("button", { name: "Request team AI summary" }).click();
  await expect(page.locator("#report-ai-status")).toContainText(
    "did not return a valid report",
  );
  await expect(page.locator(".report-ai-draft")).toHaveCount(0);
  valid = true;
  await page.getByRole("button", { name: "Request team AI summary" }).click();
  await expect(page.locator(".report-ai-draft")).toContainText("verified-hour");
  await expect(page.locator(".report-ai-draft")).toContainText(
    "review required",
  );
});

test("school grouping preserves application-time connection after a student changes schools", async ({
  page,
}) => {
  await seed(page);
  await page.evaluate(() => {
    const key = "volunteeru.shared.v1",
      record = JSON.parse(localStorage.getItem(key));
    record.student.schoolConnection = {
      schoolId: "new-school",
      schoolName: "New School",
      isDemo: true,
    };
    record.applications.find(
      (a) => a.id === "report-app",
    ).studentSnapshot.schoolConnection = {
      schoolId: "original-school",
      schoolName: "Original School",
      isDemo: true,
    };
    localStorage.setItem(key, JSON.stringify(record));
  });
  await page.reload();
  await nav(page);
  await selectOctober(page);
  const schools = page.locator(".report-table").nth(1);
  await expect(schools).toContainText("Original School");
  await expect(schools).toContainText("recorded at application");
  await expect(schools).not.toContainText("New School");
});

test("reports require an explicitly selected nonprofit workspace", async ({
  page,
}) => {
  await seed(page);
  await page.evaluate(() => {
    const key = "volunteeru.nonprofits.v1",
      record = JSON.parse(localStorage.getItem(key));
    record.activeId = null;
    localStorage.setItem(key, JSON.stringify(record));
  });
  await page.reload();
  await nav(page);
  await expect(
    page.getByRole("heading", { name: "Community impact reports." }),
  ).toBeVisible();
  await expect(page.locator(".report-stats")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Download aggregate CSV" }),
  ).toHaveCount(0);
});
