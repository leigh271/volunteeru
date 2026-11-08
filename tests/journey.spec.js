import { test, expect } from "@playwright/test";
async function onboard(page, age = 17) {
  await page.goto("/");
  await page.getByRole("button", { name: /Find my opportunities/ }).click();
  await page.getByLabel("Your name").fill("Alex Rivera");
  await page.getByLabel("School or university").fill("Broward High");
  await page.getByLabel("Your age").fill(String(age));
  await page.getByRole("button", { name: "Next", exact: false }).click();
  for (const name of [
    "Children and youth",
    "Events and hands-on help",
    "Weekends",
    "Broward",
  ]) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page
      .getByRole("button", { name: /Next|Let’s find your fit/ })
      .click();
  }
}
const nav = (page, name) =>
  page
    .locator("aside:visible, .mobile-nav:visible")
    .getByRole("button", { name, exact: false })
    .first()
    .click();
test("complete student journey persists and prevents duplicates", async ({
  page,
}) => {
  let errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await onboard(page);
  await expect(
    page.getByRole("heading", { name: "Youth activity day volunteer" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Save Youth activity day volunteer",
      exact: true,
    })
    .click();
  await nav(page, "Saved");
  await expect(
    page.getByRole("heading", { name: "Youth activity day volunteer" }),
  ).toBeVisible();
  await page.reload();
  await nav(page, "Saved");
  await page.getByRole("button", { name: "View details" }).click();
  await expect(page.getByText("What you’ll do")).toBeVisible();
  await page
    .locator("dialog")
    .getByRole("button", { name: "Apply →", exact: true })
    .click();
  await expect(page.locator(".prefilled")).toContainText("Alex Rivera");
  await page.getByLabel("I confirm I can attend").check();
  await page
    .getByLabel("What makes you interested?")
    .fill("I love helping children explore new creative activities.");
  await page.getByRole("button", { name: "Send application" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Demo application saved. Waiting for nonprofit approval.",
  );
  await expect(page.locator(".application")).toContainText(
    "Waiting for nonprofit approval",
  );
  await page.reload();
  await nav(page, "My Applications");
  await expect(page.locator(".application")).toHaveCount(1);
  await page.getByRole("button", { name: "View details" }).click();
  await expect(
    page.getByRole("button", { name: "Already applied" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await nav(page, "Profile");
  await page.getByRole("button", { name: "Edit profile" }).click();
  await page.getByLabel("Your name").fill("Alex Updated");
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Next", exact: false }).click();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Alex Updated" }),
  ).toBeVisible();
  await nav(page, "Saved");
  await page
    .getByRole("button", { name: "Remove saved Youth activity day volunteer" })
    .click();
  await expect(page.getByText("No saved opportunities yet.")).toBeVisible();
  await page.reload();
  await nav(page, "Saved");
  await expect(page.getByText("No saved opportunities yet.")).toBeVisible();
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("age eligibility and filters", async ({ page }) => {
  await onboard(page, 14);
  await expect(
    page.getByRole("heading", { name: "Period care kit event support" }),
  ).toBeVisible();
  await page.getByLabel("Filter by cause").selectOption("Animals");
  await expect(page.getByText("No matches with these filters.")).toBeVisible();
  await page.getByRole("button", { name: "Reset discovery" }).click();
  await expect(
    page.getByRole("heading", { name: "Period care kit event support" }),
  ).toBeVisible();
});
test("right swipe saves without applying and skip advances", async ({
  page,
}) => {
  await onboard(page);
  let c = page.locator("[data-card]").first();
  let box = await c.boundingBox();
  await c.dispatchEvent("pointerdown", {
    clientX: box.x + 30,
    clientY: box.y + 100,
  });
  await c.dispatchEvent("pointerup", {
    clientX: box.x + 180,
    clientY: box.y + 100,
  });
  await nav(page, "Saved");
  await expect(
    page.getByRole("heading", { name: "Youth activity day volunteer" }),
  ).toBeVisible();
  await nav(page, "My Applications");
  await expect(page.locator(".application")).toHaveCount(0);
  await nav(page, "Discover");
  let id = await page.locator("[data-card]").getAttribute("data-card");
  await page.getByRole("button", { name: "Skip", exact: false }).click();
  await expect(page.locator("[data-card]")).not.toHaveAttribute(
    "data-card",
    id,
  );
});

test("malformed browser data recovers to welcome", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "volunteeru.shared.v1",
      JSON.stringify({
        version: 1,
        student: { name: null, onboarded: true, skills: "broken" },
        saved: {},
        applications: [null],
      }),
    ),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Find your cause. Make your impact." }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Find my opportunities/ }).click();
  await expect(page.getByLabel("Your name")).toHaveValue("");
});

test("storage failure does not create a phantom save", async ({ page }) => {
  await onboard(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
  });
  let message = "";
  page.once("dialog", async (dialog) => {
    message = dialog.message();
    await dialog.accept();
  });
  await page
    .getByRole("button", {
      name: "Save Youth activity day volunteer",
      exact: true,
    })
    .click();
  await nav(page, "Saved");
  await expect(page.getByText("No saved opportunities yet.")).toBeVisible();
  expect(message).toContain("could not save");
});

test("shared decision updates appear without reload", async ({
  page,
  context,
}) => {
  await onboard(page);
  await page.getByRole("button", { name: "Apply →", exact: true }).click();
  await page.getByLabel("I confirm I can attend").check();
  await page
    .getByLabel("What makes you interested?")
    .fill("I want to support children in my community.");
  await page.getByRole("button", { name: "Send application" }).click();
  const teammate = await context.newPage();
  await teammate.goto("/");
  await teammate.evaluate(() => {
    const key = "volunteeru.shared.v1";
    const record = JSON.parse(localStorage.getItem(key));
    record.applications[0].status = "approved";
    localStorage.setItem(key, JSON.stringify(record));
  });
  await expect(page.locator(".status")).toHaveText("✓ Approved");
  await teammate.close();
});

test("details render supplied public contacts safely", async ({ page }) => {
  let website = "https://example.org/";
  let publicContact = "Public coordinator: volunteer@example.org";
  await page.route("**/src/data.js*", async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    body = body
      .replace("website: null", `website: ${JSON.stringify(website)}`)
      .replace(
        "publicContact: null",
        `publicContact: ${JSON.stringify(publicContact)}`,
      );
    await route.fulfill({ response, body });
  });
  await onboard(page);
  await page.getByRole("button", { name: "View details" }).click();
  await expect(
    page.getByRole("link", { name: "Visit nonprofit website" }),
  ).toHaveAttribute("href", "https://example.org/");
  await expect(page.locator("dialog")).toContainText(publicContact);
  website = "javascript:alert(1)";
  publicContact = "<script>alert(1)</script>";
  await page.reload();
  await page.getByRole("button", { name: "View details" }).click();
  await expect(page.locator("dialog a")).toHaveCount(0);
  await expect(page.locator("dialog script")).toHaveCount(0);
  await expect(page.locator("dialog")).toContainText(publicContact);
});
