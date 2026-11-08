import { test, expect } from "@playwright/test";
import { navigate } from "./navigation.js";

async function seed(page, hours) {
  await page.evaluate(async (hours) => {
    const { emptyStudent } = await import("/src/data.js");
    const { state, persist } = await import("/src/store.js");
    state.student = {
      ...emptyStudent,
      id: "bloom-student",
      name: "Sam Student",
      school: "Test High",
      age: 17,
      onboarded: true,
      interests: ["Women’s health"],
      skills: ["Events and hands-on help"],
      availability: ["Weekends"],
      locations: ["Broward"],
    };
    state.applications = [
      {
        id: "bloom-app",
        studentId: "bloom-student",
        opportunityId: "demo",
        submittedAt: new Date().toISOString(),
        status: "approved",
      },
    ];
    state.hours = [
      {
        id: "approved",
        studentId: "bloom-student",
        applicationId: "bloom-app",
        status: "approved",
        hours,
      },
      {
        id: "pending",
        studentId: "bloom-student",
        applicationId: "bloom-app",
        status: "pending",
        hours: 5,
      },
      {
        id: "rejected",
        studentId: "bloom-student",
        applicationId: "bloom-app",
        status: "rejected",
        hours: 100,
      },
      {
        id: "other",
        studentId: "other-student",
        applicationId: "bloom-app",
        status: "approved",
        hours: 100,
      },
      {
        id: "unlinked",
        studentId: "bloom-student",
        applicationId: "missing-app",
        status: "approved",
        hours: 100,
      },
    ];
    persist();
  }, hours);
  await page.reload();
}

test("flower follows all five 40-hour milestones and stays in Student space", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  for (const [hours, stage] of [
    [0, 0],
    [10, 1],
    [20, 2],
    [30, 3],
    [40, 4],
    [55, 4],
  ]) {
    await seed(page, hours);
    await navigate(page, "Discover");
    const compact = page.getByRole("region", { name: "Your growing impact" });
    await expect(compact).toHaveAttribute("data-bloom-stage", String(stage));
    await expect(compact).toContainText(`${hours} of 40 hours approved`);
    await compact.getByRole("button", { name: "View my progress" }).click();
    const full = page.getByRole("region", { name: "Your growing impact" });
    await expect(full.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      String(Math.min(hours, 40)),
    );
    await expect(full.getByRole("listitem")).toHaveCount(5);
    await expect(full).toContainText("5 hours awaiting coordinator review");
    await expect(full).toContainText(
      "Your school confirms whether hours meet its requirements.",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
  const imageStatus = await page.evaluate(async () => {
    const image = new Image();
    image.src = "/images/bloom-stages.png";
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  });
  expect(imageStatus.width).toBeGreaterThan(0);
  expect(imageStatus.height).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Nonprofit", exact: true }).click();
  await expect(page.locator(".bloom-card")).toHaveCount(0);
  await page.getByRole("button", { name: "School admin", exact: true }).click();
  await expect(page.locator(".bloom-card")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("fractional, invalid and duplicate records cannot prematurely bloom", async ({
  page,
}) => {
  await page.goto("/");
  await seed(page, 39.99);
  const result = await page.evaluate(async () => {
    const { bloomProgress } = await import("/src/bloom.js");
    const { state } = await import("/src/store.js");
    const approved = state.hours[0];
    const records = {
      ...state,
      hours: [
        ...state.hours,
        { ...approved },
        { ...approved, id: "negative", hours: -4 },
        { ...approved, id: "invalid", hours: "not a number" },
        {
          ...approved,
          id: "correction",
          status: "needs_corrections",
          hours: 30,
        },
      ],
    };
    return bloomProgress(records);
  });
  expect(result).toMatchObject({
    approved: 39.99,
    pending: 5,
    percentage: 99,
    stage: 3,
  });
});
