import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

const role = (page, name) =>
  page
    .getByRole("group", { name: "Demo account" })
    .getByRole("button", { name, exact: true });
const tab = (page, name) =>
  page
    .locator(".vu-sidebar:visible,.vu-mobile-tabs:visible")
    .getByRole("button", { name, exact: true });

test("photo homepage opens pre-filled demo accounts without modifying personal records", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?home=1");
  await expect(
    page.getByRole("heading", { name: "Good grows with you.", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#vu-source-volunteers")).toBeVisible();
  expect(
    await page
      .locator("#vu-source-volunteers")
      .evaluate((img) => img.naturalWidth),
  ).toBeGreaterThan(0);
  const original = await page.evaluate(() => {
    const keys = [
      "volunteeru.shared.v1",
      "volunteeru.nonprofits.v1",
      "volunteeru.schools.v1",
    ];
    keys.forEach((key, i) =>
      localStorage.setItem(key, JSON.stringify({ preserved: i })),
    );
    return keys.map((key) => localStorage.getItem(key));
  });
  await page
    .getByRole("button", { name: "Explore Student →", exact: true })
    .click();
  await expect(page).toHaveURL(/demo.html\?role=student/);
  await expect(
    page.getByText("26 of 40 hours accepted", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Submit hours", exact: true }).click();
  await role(page, "School Admin").click();
  await expect(
    page.getByRole("button", { name: "Accept verified hours", exact: true }),
  ).toBeDisabled();
  await role(page, "Nonprofit").click();
  await page
    .getByRole("button", { name: "Verify 4 hours →", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Verified ✓", exact: true }),
  ).toBeDisabled();
  await role(page, "School Admin").click();
  await page
    .getByRole("button", { name: "Accept verified hours", exact: true })
    .click();
  await expect(page.locator(".vu-kpis article").nth(1)).toContainText("110");
  await role(page, "Student").click();
  await expect(
    page.getByText("30 of 40 hours accepted", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: /Budding plant/ })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "30",
  );
  await page.reload();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "30",
  );
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "26",
  );
  expect(
    await page.evaluate(() =>
      [
        "volunteeru.shared.v1",
        "volunteeru.nonprofits.v1",
        "volunteeru.schools.v1",
      ].map((key) => localStorage.getItem(key)),
    ),
  ).toEqual(original);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Good grows with you.", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("all presentation pages are pre-filled, usable, and export consistent sample data", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/demo.html?role=student");
  await page.getByRole("button", { name: "Submit hours", exact: true }).click();
  await tab(page, "Find opportunities").click();
  await page
    .getByRole("button", { name: "Save opportunity", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved ✓", exact: true }),
  ).toBeVisible();
  await tab(page, "My volunteering").click();
  await expect(
    page.getByText("9:50 AM · check in with Taylor", { exact: true }),
  ).toBeVisible();
  await tab(page, "My progress").click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "26",
  );
  await role(page, "Nonprofit").click();
  await tab(page, "Events & volunteers").click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await tab(page, "Verify hours").click();
  await page
    .getByRole("button", { name: "Verify 4 hours →", exact: true })
    .click();
  await tab(page, "Impact reports").click();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download sample report CSV →", exact: true })
    .click();
  const csv = await fs.readFile(await (await downloading).path(), "utf8");
  expect(csv).toContain(
    "Maya Chen,Period-kit packing,4,4,0,Nonprofit verified",
  );
  await role(page, "School Admin").click();
  await tab(page, "Students").click();
  await page.getByLabel("Find a student", { exact: true }).fill("Maya");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await tab(page, "Review hours").click();
  await page
    .getByRole("button", { name: "Accept verified hours", exact: true })
    .click();
  await tab(page, "School settings").click();
  await expect(page.getByLabel("School name", { exact: true })).toHaveValue(
    "Broward Community High",
  );
  await expect(
    page.getByLabel("Service hours goal", { exact: true }),
  ).toHaveValue("40 hours");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("editable hours follow submission, verification and acceptance without double counting", async ({
  page,
}) => {
  await page.goto("/demo.html?role=nonprofit");
  await expect(
    page.getByRole("button", { name: "Verify 0 hours →", exact: true }),
  ).toBeDisabled();
  await role(page, "Student").click();
  const hours = page.getByLabel("Hours completed", { exact: true });
  await hours.fill("5");
  await page.getByRole("button", { name: "Submit hours", exact: true }).click();
  await expect(hours).toBeEnabled();
  await hours.fill("2.5");
  await page.getByRole("button", { name: "Submit hours", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "26",
  );
  await expect(
    page.getByRole("button", { name: "Hours submitted ✓", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(hours).toHaveValue("2.5");
  await role(page, "School Admin").click();
  await expect(
    page.getByRole("button", { name: "Accept verified hours", exact: true }),
  ).toBeDisabled();
  await role(page, "Nonprofit").click();
  await page
    .getByRole("button", { name: "Verify 2.5 hours →", exact: true })
    .click();
  await role(page, "School Admin").click();
  await page
    .getByRole("button", { name: "Accept verified hours", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Accepted ✓", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".vu-kpis article").nth(1)).toContainText("108.5");
  await role(page, "Student").click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "28.5",
  );
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await expect(hours).toBeEnabled();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "26",
  );
});
