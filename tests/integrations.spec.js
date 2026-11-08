import { test, expect } from "@playwright/test";
const nav = (page) =>
  page
    .locator("aside:visible,.mobile-nav:visible")
    .getByRole("button", { name: "Integrations", exact: false })
    .first()
    .click();
test("late session restoration cannot replace a newer signed-in account", async ({
  page,
}) => {
  let release,
    restoring = false;
  await page.route("**/api/auth/session", async (route) => {
    restoring = true;
    await new Promise((resolve) => (release = resolve));
    await route.fulfill({
      json: {
        user: { id: "old", name: "Old School Admin", role: "school_admin" },
        csrfToken: "old-csrf",
      },
    });
  });
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      json: {
        user: { id: "new", name: "New Coordinator", role: "nonprofit" },
        csrfToken: "new-csrf",
      },
    }),
  );
  for (const name of ["events", "applications", "hours", "attendance"])
    await page.route(`**/api/${name}`, (route) =>
      route.fulfill({ json: { [name]: [] } }),
    );
  await page.goto("/");
  await nav(page);
  await expect.poll(() => restoring).toBe(true);
  await page
    .locator("#server-login")
    .getByLabel("Email", { exact: true })
    .fill("new@example.org");
  await page
    .locator("#server-login")
    .getByLabel("Password", { exact: true })
    .fill("a-long-test-password");
  await page.getByRole("button", { name: "Sign in to server" }).click();
  await expect(
    page.getByRole("heading", { name: "New Coordinator · nonprofit" }),
  ).toBeVisible();
  release();
  await expect(page.locator(".integration-panel")).not.toContainText(
    "Old School Admin",
  );
  await page.getByRole("button", { name: "Refresh server records" }).click();
  await expect(
    page.getByRole("heading", { name: "New Coordinator · nonprofit" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
