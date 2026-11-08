import { test, expect } from "@playwright/test";
const nav = (page) =>
  page
    .locator("aside:visible,.mobile-nav:visible")
    .getByRole("button", { name: "Nearby", exact: false })
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
  await page.evaluate(async () => {
    const { emptyStudent } = await import("/src/data.js");
    const base = {
      organizationId: "nearby-org",
      date: "2026-12-19",
      time: "10:00",
      startsAt: "2026-12-19T10:00:00",
      hours: 2,
      cause: "Women’s health",
      skills: ["Events and hands-on help"],
      availability: "Weekends",
      minAge: 13,
      capacity: 80,
      volunteerTarget: 8,
      status: "published",
      description: "Help with the local community care event.",
      requirements: "Orientation required with a coordinator.",
      training: [],
      prepMeetings: [],
      updates: [],
    };
    localStorage.setItem(
      "volunteeru.nonprofits.v1",
      JSON.stringify({
        version: 1,
        activeId: "nearby-org",
        organizations: [
          {
            id: "nearby-org",
            name: "Nearby Demo Studio",
            coordinator: "Morgan",
            email: "morgan@example.org",
          },
        ],
        events: [
          {
            ...base,
            id: "nearby-broward",
            title: "Fort Lauderdale care day",
            city: "Fort Lauderdale",
            location: "Broward",
          },
          {
            ...base,
            id: "nearby-miami",
            title: "Miami care day",
            city: "Miami",
            location: "Miami-Dade",
          },
          {
            ...base,
            id: "nearby-remote",
            title: "Remote campaign day",
            city: "Fort Lauderdale",
            location: "Remote",
          },
          {
            ...base,
            id: "nearby-unknown",
            title: "Ungeocoded care day",
            city: "Unknown place",
            location: "Broward",
          },
          {
            ...base,
            id: "nearby-xss",
            title: '<img src=x onerror="window.__nearbyXss=true">',
            city: "Fort Lauderdale",
            location: "Broward",
            latitude: 26.12,
            longitude: -80.14,
          },
        ],
      }),
    );
    localStorage.setItem(
      "volunteeru.shared.v1",
      JSON.stringify({
        version: 1,
        student: {
          ...emptyStudent,
          id: "nearby-student",
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
        applications: [],
        hours: [],
        shifts: [],
        readNotificationIds: [],
      }),
    );
  });
  await page.reload();
  await nav(page);
}
test("nearby radius and starting city filter in-person opportunities with approximate distances", async ({
  page,
}) => {
  await seed(page);
  await page.getByLabel("Starting city").selectOption("Fort Lauderdale");
  await page.getByLabel("Within", { exact: true }).selectOption("10");
  await expect(
    page
      .locator(".nearby-record")
      .filter({ hasText: "Fort Lauderdale care day" }),
  ).toBeVisible();
  await expect(
    page.locator(".nearby-record").filter({ hasText: "Miami care day" }),
  ).toHaveCount(0);
  await expect(
    page.locator(".nearby-record").filter({ hasText: "Remote campaign day" }),
  ).toHaveCount(0);
  await expect(
    page.locator(".nearby-record").filter({ hasText: "Ungeocoded care day" }),
  ).toHaveCount(0);
  const broward = page
    .locator(".nearby-record")
    .filter({ hasText: "Fort Lauderdale care day" });
  await expect(broward).toContainText("CITY CENTER");
  await expect(broward).toContainText("about 0.0 km");
  await expect(
    broward.getByRole("link", { name: "Open street map" }),
  ).toHaveAttribute(
    "href",
    /^https:\/\/www\.openstreetmap\.org\/\?mlat=26\.1224&mlon=-80\.1373#map=13\/26\.1224\/-80\.1373$/,
  );
  await page.getByLabel("Within", { exact: true }).selectOption("100");
  await expect(
    page.locator(".nearby-record").filter({ hasText: "Miami care day" }),
  ).toBeVisible();
  await page.getByLabel("Starting city").selectOption("Miami");
  await page.getByLabel("Within", { exact: true }).selectOption("10");
  await expect(
    page.locator(".nearby-record").filter({ hasText: "Miami care day" }),
  ).toBeVisible();
  await expect(
    page
      .locator(".nearby-record")
      .filter({ hasText: "Fort Lauderdale care day" }),
  ).toHaveCount(0);
});
test("nearby labels supplied coordinates and renders event titles as text", async ({
  page,
}) => {
  await seed(page);
  await page.getByLabel("Starting city").selectOption("Fort Lauderdale");
  await page.getByLabel("Within", { exact: true }).selectOption("10");
  const record = page
    .locator(".nearby-record")
    .filter({ hasText: '<img src=x onerror="window.__nearbyXss=true">' });
  await expect(record).toBeVisible();
  await expect(record).toContainText("VENUE COORDINATES");
  await expect(record.locator("img,script")).toHaveCount(0);
  expect(await page.evaluate(() => window.__nearbyXss)).toBeUndefined();
  await expect(
    record.getByRole("link", { name: "Open street map" }),
  ).toHaveAttribute(
    "href",
    /^https:\/\/www\.openstreetmap\.org\/\?mlat=26\.12&mlon=-80\.14/,
  );
  await expect(
    page.getByRole("img", {
      name: "Schematic opportunity locations in Broward and Miami-Dade",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Markers do not confirm exact venues, availability, or partnerships.",
      { exact: false },
    ),
  ).toBeVisible();
});
