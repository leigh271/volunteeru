export async function navigate(page, name) {
  const workspace =
    name === "School Portal"
      ? "school"
      : ["Nonprofit Portal", "Impact Reports"].includes(name)
        ? "nonprofit"
        : "student";
  const switcher = page.locator(`[data-workspace="${workspace}"]`);
  if ((await switcher.getAttribute("aria-pressed")) !== "true")
    await switcher.click();
  await page
    .locator("aside:visible,.mobile-nav:visible")
    .getByRole("button", { name, exact: false })
    .first()
    .click();
}
