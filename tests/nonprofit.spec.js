import { test, expect } from "@playwright/test";

const sharedKey = "volunteeru.shared.v1";
const nonprofitKey = "volunteeru.nonprofits.v1";
import { navigate as nav } from "./navigation.js";
const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const entries = [];
  errors.set(page, entries);
  page.on("pageerror", (error) => entries.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
async function seed(page, extra = {}) {
  await page.goto("/");
  await page.evaluate(
    async ({ sharedKey, nonprofitKey, extra }) => {
      const { emptyStudent } = await import("/src/data.js");
      const organization = {
        id: "org-integration",
        name: "Community Test Studio",
        coordinator: "Morgan",
        email: "morgan@example.org",
      };
      const event = {
        id: "event-integration",
        organizationId: organization.id,
        title: "Care Kit Community Day",
        date: "2026-12-19",
        startsAt: "2026-12-19T10:00:00",
        time: "10:00 AM – 12:00 PM",
        hours: 2,
        location: "Broward",
        city: "Fort Lauderdale",
        cause: "Women’s health",
        skills: ["Events and hands-on help"],
        availability: "Weekends",
        minAge: 13,
        requirements: "Orientation and guardian consent for minors.",
        description: "Help assemble care kits with coordinator supervision.",
        capacity: 80,
        volunteerTarget: 8,
        status: "published",
        isDemo: true,
        training: [
          {
            id: "orientation-integration",
            title: "Care kit orientation",
            instructions: "Read the kit assembly and privacy instructions.",
            dueDate: "2026-12-12",
          },
        ],
        prepMeetings: [
          {
            id: "prep-integration",
            title: "Kit assembly preparation",
            startsAt: "2026-12-16T17:00:00",
            location: "Community room A",
          },
        ],
        updates: [
          {
            id: "update-integration",
            kind: "Event instructions",
            text: "Bring water and closed-toe shoes.",
            createdAt: "2026-11-07T12:00:00Z",
          },
        ],
      };
      localStorage.setItem(
        nonprofitKey,
        JSON.stringify({
          version: 1,
          activeId: organization.id,
          organizations: [organization],
          events: [event],
        }),
      );
      localStorage.setItem(
        sharedKey,
        JSON.stringify({
          version: 1,
          student: {
            ...emptyStudent,
            id: "student-integration",
            name: "Sam Student",
            school: "Test High",
            age: 17,
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
          trainingRecords: [],
          ...extra,
        }),
      );
    },
    { sharedKey, nonprofitKey, extra },
  );
  await page.reload();
}

// The complete nonprofit registration/publishing/coordinator UI journey is below.

test("meeting drafts retain evidence, both mock months, and local file import", async ({
  page,
}) => {
  await seed(page);
  await nav(page, "Nonprofit Portal");
  await page
    .getByRole("button", { name: "October leadership meeting · MOCK" })
    .click();
  await page.getByRole("button", { name: /Extract planning draft/ }).click();
  await expect(page.locator(".planner-analysis")).toContainText(
    "Local rule-based draft",
  );
  await expect(page.locator(".planner-analysis")).toContainText("Source line");
  await expect(page.locator(".planner-analysis")).toContainText(
    "no agreement is confirmed",
  );
  await expect(page.locator("#planner-brief [name=capacity]")).toHaveValue(
    "80",
  );
  await page
    .getByRole("button", { name: "November leadership meeting · MOCK" })
    .click();
  await page.getByRole("button", { name: /Extract planning draft/ }).click();
  await expect(page.locator("#planner-brief [name=capacity]")).toHaveValue(
    "100",
  );
  await expect(page.locator(".planner-analysis")).toContainText(
    "Revised proposed budget of $1,500",
  );
  await page.locator("#planner-upload").setInputFiles({
    name: "team-notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "Event: Test Community Event\nDate: 2026-12-20\nGoal: Assemble 30 care kits\nCapacity: 30\nVenue: Proposed sample room\nAction: Morgan will check supplies by 2026-12-01.\n",
    ),
  });
  await expect(page.locator("#planner-transcript")).toHaveValue(
    /Test Community Event/,
  );
  await page.getByRole("button", { name: /Extract planning draft/ }).click();
  await expect(page.locator(".planner-analysis")).toContainText(
    "Not identified in the notes",
  );
  await expect(page.locator("#planner-brief [name=title]")).toHaveValue(
    "Test Community Event",
  );
  await expect(page.locator(".planner-recommendation")).toContainText(
    "9 volunteers",
  );
  await expect(page.locator(".planner-recommendation")).toContainText(
    "2026-11-22",
  );
  await page
    .getByRole("button", { name: /Save & review staffing plan/ })
    .click();
  await expect(page.locator(".planner-review")).toContainText(
    "unpublished event draft",
  );
});

test("student assigned training and event instructions respect application ownership and approval", async ({
  page,
}) => {
  const application = {
    id: "app-integration",
    studentId: "student-integration",
    opportunityId: "event-integration",
    status: "pending",
    submittedAt: "2026-11-07T12:00:00Z",
    isDemo: true,
  };
  await seed(page, { applications: [application] });
  await nav(page, "My Progress");
  await expect(page.locator(".event-student-panel")).toContainText(
    "Bring water and closed-toe shoes.",
  );
  await expect(
    page.getByRole("button", { name: "Mark training as read" }),
  ).toHaveCount(0);
  await expect(page.locator(".event-student-panel")).not.toContainText(
    "Kit assembly preparation",
  );
  await page.evaluate((key) => {
    const data = JSON.parse(localStorage.getItem(key));
    data.applications[0].status = "approved";
    localStorage.setItem(key, JSON.stringify(data));
  }, sharedKey);
  await page.reload();
  await nav(page, "My Progress");
  await expect(page.locator(".event-student-panel")).toContainText(
    "Kit assembly preparation",
  );
  await page.getByRole("button", { name: "Mark training as read" }).click();
  await expect(page.locator(".event-student-panel")).toContainText(
    "Read · awaiting coordinator verification",
  );
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).trainingRecords[0].status,
      sharedKey,
    ),
  ).toBe("read");
  await page.reload();
  await nav(page, "My Progress");
  await expect(page.locator(".event-student-panel")).toContainText(
    "Read · awaiting coordinator verification",
  );
  await page.evaluate((key) => {
    const data = JSON.parse(localStorage.getItem(key));
    data.applications[0].status = "rejected";
    localStorage.setItem(key, JSON.stringify(data));
  }, sharedKey);
  await page.reload();
  await nav(page, "My Progress");
  await expect(page.locator(".event-student-panel")).not.toContainText(
    "Bring water and closed-toe shoes.",
  );
  await page.getByRole("button", { name: /Notifications,/ }).click();
  await expect(page.locator(".notification-list")).not.toContainText(
    "Bring water and closed-toe shoes.",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
});

test("nonprofit publishes recruitment, confirms staffing, verifies training and approves attended hours", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-11-07T12:00:00Z") });
  await page.goto("/");
  await nav(page, "Nonprofit Portal");
  await page
    .getByLabel("Organization name", { exact: true })
    .fill("Care Team Demo");
  await page
    .getByLabel("Coordinator name", { exact: true })
    .fill("Morgan Coordinator");
  await page.getByLabel("Coordinator email").fill("morgan@example.org");
  await page
    .getByRole("checkbox", { name: /authorized to coordinate this nonprofit/ })
    .check();
  await page
    .getByRole("button", { name: "Create nonprofit workspace" })
    .click();
  const title = "Care Kit <img src=x onerror=alert(1)>";
  await page.getByLabel("Event or role title").fill(title);
  await page.getByLabel("Event date", { exact: true }).fill("2026-12-19");
  await page.getByLabel("Start time", { exact: true }).fill("10:00");
  await page.getByLabel("Volunteer hours", { exact: true }).fill("2");
  await page.getByLabel("City or online venue").fill("Fort Lauderdale");
  await page.getByLabel("Volunteer recruitment target").fill("1");
  await page
    .getByLabel("What volunteers will do")
    .fill("Help assemble community care kits with a coordinator.");
  await page.getByRole("button", { name: "Save event draft" }).click();
  await page
    .getByRole("button", { name: "Publish opportunity", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unpublish opportunity" }),
  ).toBeVisible();
  const eventId = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)).events[0].id,
    nonprofitKey,
  );
  await page
    .getByLabel("Training title", { exact: true })
    .fill("Event privacy orientation");
  await page
    .getByLabel("Training instructions")
    .fill("Read the kit assembly and participant privacy instructions.");
  await page.getByLabel("Training due date").fill("2026-12-12");
  await page.getByRole("button", { name: "Assign required training" }).click();
  for (const [index, date] of [
    [1, "2026-12-05T17:00"],
    [2, "2026-12-16T17:00"],
  ]) {
    await page
      .getByLabel("Meeting title", { exact: true })
      .fill(`Preparation ${index}`);
    await page.getByLabel("Preparation meeting time").fill(date);
    await page
      .getByLabel("Meeting location or link")
      .fill("Demo community room");
    await page
      .getByRole("button", { name: "Schedule preparation meeting" })
      .click();
  }
  await expect(
    page.getByRole("button", { name: "Schedule preparation meeting" }),
  ).toHaveCount(0);
  await page
    .getByLabel("Message for registered volunteers")
    .fill("Bring water and closed-toe shoes for this demo.");
  await page.getByRole("button", { name: "Post local update" }).click();
  await expect(page.locator("#nonprofit-feedback")).toContainText(
    "No email or SMS was sent",
  );
  await page.evaluate(async (key) => {
    const { emptyStudent } = await import("/src/data.js");
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        student: {
          ...emptyStudent,
          id: "student-integration",
          name: "Sam Student",
          school: "Test High",
          age: 17,
          onboarded: true,
          interests: ["Women’s health"],
          womensHealth: [],
          skills: ["Events and hands-on help"],
          availability: ["Weekends"],
          locations: ["Broward"],
        },
        applications: [],
        hours: [],
        shifts: [],
        trainingRecords: [],
        attendanceRecords: [],
        saved: [],
        readNotificationIds: [],
      }),
    );
  }, sharedKey);
  await page.reload();
  await nav(page, "Discover");
  for (
    let index = 0;
    index < 12 && !(await page.locator(`[data-card="${eventId}"]`).count());
    index++
  )
    await page.getByRole("button", { name: /Skip/ }).click();
  await expect(page.locator(`[data-card="${eventId}"]`)).toContainText(title);
  await expect(page.locator(`[data-card="${eventId}"] img`)).toHaveCount(0);
  await page.getByRole("button", { name: "Apply →", exact: true }).click();
  await page.getByLabel("I confirm I can attend").check();
  await page
    .getByLabel("What makes you interested?")
    .fill("I want to help assemble community care kits.");
  await page.getByRole("button", { name: /Send application/ }).click();
  await nav(page, "Nonprofit Portal");
  await page
    .getByRole("button", { name: "Approve registration", exact: true })
    .click();
  await expect(page.locator(".nonprofit-stats article").first()).toContainText(
    "1 / 1",
  );
  await page
    .getByRole("button", { name: "Mark attendance present", exact: true })
    .click();
  await expect(page.locator("#nonprofit-feedback")).toContainText(
    /start|begin|begun|before|future/i,
  );
  await page.evaluate(
    ({ key, eventId }) => {
      const data = JSON.parse(localStorage.getItem(key));
      data.applications.push({
        id: "other-pending",
        studentId: "other-student",
        opportunityId: eventId,
        status: "pending",
        submittedAt: "2026-11-07T12:00:00Z",
        studentSnapshot: { name: "Another Student", school: "Test High" },
        interest: "I want to volunteer too.",
        isDemo: true,
      });
      localStorage.setItem(key, JSON.stringify(data));
    },
    { key: sharedKey, eventId },
  );
  await page.reload();
  await nav(page, "Nonprofit Portal");
  await expect(
    page.getByRole("button", { name: "Approve registration", exact: true }),
  ).toBeDisabled();
  await nav(page, "My Progress");
  await expect(page.locator(".event-student-panel")).toContainText(
    "Preparation 1",
  );
  await expect(page.locator(".event-student-panel")).toContainText(
    "Preparation 2",
  );
  await expect(page.locator(".event-student-panel")).toContainText(
    "Bring water and closed-toe shoes",
  );
  await page.getByRole("button", { name: "Mark training as read" }).click();
  await nav(page, "Nonprofit Portal");
  await page
    .getByRole("button", { name: "Verify training", exact: true })
    .click();
  await nav(page, "My Progress");
  await expect(page.locator(".event-student-panel")).toContainText(
    "Coordinator verified",
  );
  await page.clock.setFixedTime(new Date("2026-12-20T12:00:00Z"));
  await nav(page, "Discover");
  await nav(page, "My Progress");
  await page.getByLabel("Date volunteered").fill("2026-12-19");
  await page.getByLabel("Hours completed").fill("2");
  await page
    .getByLabel("What did you do?")
    .fill("Helped assemble and distribute sample care kits.");
  await page.getByRole("button", { name: /Submit for review/ }).click();
  await nav(page, "Nonprofit Portal");
  await page
    .getByRole("button", { name: "Approve hours", exact: true })
    .click();
  await expect(page.locator("#nonprofit-feedback")).toContainText(
    "Mark attendance present",
  );
  await page
    .getByRole("button", { name: "Mark attendance present", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Approve hours", exact: true })
    .click();
  await nav(page, "My Progress");
  await expect(
    page.locator(".journey-stats article").first().locator("strong"),
  ).toHaveText("2");
  await page.reload();
  await nav(page, "My Progress");
  await expect(
    page.locator(".journey-stats article").first().locator("strong"),
  ).toHaveText("2");
});

test("configured AI rejects unsupported findings and discards stale responses", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__VOLUNTEERU_API__ = "/api";
  });
  await page.route("**/api/student/updates", (route) =>
    route.fulfill({ status: 503, json: { error: "Test offline" } }),
  );
  let mode = "invalid",
    releaseResponse;
  let postedNotes = "";
  await page.route("**/api/nonprofit/plans", async (route) => {
    const payload = route.request().postDataJSON();
    postedNotes = payload.transcript;
    if (mode === "delayed")
      await new Promise((resolve) => {
        releaseResponse = resolve;
      });
    const empty = {
      goals: [],
      actions: [],
      deadlines: [],
      partnerships: [],
      funding: [],
      responsibilities: [],
    };
    await route.fulfill({
      json: {
        organizationId: payload.organizationId,
        ...empty,
        goals: [
          {
            text: "Assemble care kits",
            evidence:
              mode === "invalid"
                ? "Fabricated evidence absent from meeting"
                : "Goal: Assemble 30 care kits",
          },
        ],
      },
    });
  });
  await seed(page);
  await nav(page, "Nonprofit Portal");
  await page
    .locator("#planner-transcript")
    .fill("Goal: Assemble 30 care kits\nAction: Morgan will check supplies.");
  await page.getByRole("button", { name: /Extract planning draft/ }).click();
  await page
    .getByRole("button", { name: "Generate AI draft", exact: true })
    .click();
  await expect(page.locator("#planner-status")).toContainText(
    "did not return a valid",
  );
  await expect(page.locator(".planner-analysis")).toContainText(
    "Local rule-based draft",
  );
  expect(postedNotes).toContain("Goal: Assemble 30 care kits");
  mode = "delayed";
  await page
    .getByRole("button", { name: "Generate AI draft", exact: true })
    .click();
  await expect(page.locator("#planner-status")).toContainText(
    "Requesting a draft",
  );
  await expect.poll(() => Boolean(releaseResponse)).toBe(true);
  await page
    .locator("#planner-transcript")
    .fill("Goal: Newer notes must survive the old response.");
  releaseResponse();
  await expect(page.locator("#planner-status")).toContainText(
    "old response was discarded",
  );
  await expect(page.locator("#planner-transcript")).toHaveValue(
    "Goal: Newer notes must survive the old response.",
  );
  await expect(page.locator(".planner-analysis")).toHaveCount(0);
});
