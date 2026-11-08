import { test, expect } from "@playwright/test";

for (const initial of ["student", "nonprofit"]) {
  test(`${initial} entry keeps student and nonprofit tools separate`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/?view=${initial}`);
    const view = (name) => page.getByRole("button", { name, exact: true });
    await expect(
      view(initial === "student" ? "Student" : "Nonprofit"),
    ).toHaveAttribute("aria-pressed", "true");
    await view("Nonprofit").click();
    await expect(
      page.getByLabel("Organization name", { exact: true }),
    ).toBeVisible();
    await expect(page.locator('[data-page="Profile"]')).toHaveCount(0);
    await expect(page.locator('[data-page="Saved"]')).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Student guide" }),
    ).toHaveCount(0);
    await page
      .getByLabel("Organization name", { exact: true })
      .fill("Community Helpers");
    await page
      .getByLabel("Coordinator name", { exact: true })
      .fill("Taylor Coordinator");
    await page
      .getByLabel("Coordinator email", { exact: true })
      .fill("taylor@example.org");
    await page.getByRole("checkbox", { name: /authorized/ }).check();
    await page
      .getByRole("button", { name: "Create nonprofit workspace", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Community Helpers", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(view("Nonprofit")).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("heading", { name: "Community Helpers", exact: true }),
    ).toBeVisible();
    await view("Student").click();
    await expect(page.locator('[data-page="Nonprofit Portal"]')).toHaveCount(0);
    await expect(
      page.getByLabel("Organization name", { exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: /Find my opportunities/ }).click();
    await page.getByLabel("Your name", { exact: true }).fill("Sam Student");
    await view("Nonprofit").click();
    await expect(
      page.getByRole("heading", { name: "Community Helpers", exact: true }),
    ).toBeVisible();
    await view("Student").click();
    await expect(
      page.getByRole("button", { name: /Find my opportunities/ }),
    ).toBeVisible();
    await view("School admin").click();
    await expect(page.getByLabel("School name", { exact: true })).toBeVisible();
    await expect(page.locator('[data-page="Saved"]')).toHaveCount(0);
    await expect(page.locator('[data-page="Nonprofit Portal"]')).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}
