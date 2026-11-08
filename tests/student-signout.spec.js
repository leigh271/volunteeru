import { test, expect } from "@playwright/test";

async function seed(page) {
  await page.goto("/");
  await page.evaluate(async () => {
    const { emptyStudent } = await import("/src/data.js");
    localStorage.setItem(
      "volunteeru.shared.v1",
      JSON.stringify({
        version: 1,
        student: {
          ...emptyStudent,
          id: "signout-student",
          name: "Sam Student",
          school: "Community High",
          age: 17,
          onboarded: true,
          interests: ["Women’s health"],
          skills: ["Events and hands-on help"],
          availability: ["Weekends"],
          locations: ["Broward"],
        },
        saved: ["demo-1"],
        applications: [
          {
            id: "signout-app",
            studentId: "signout-student",
            opportunityId: "demo-1",
            status: "approved",
            submittedAt: new Date().toISOString(),
          },
        ],
        hours: [
          {
            id: "signout-hour",
            studentId: "signout-student",
            applicationId: "signout-app",
            status: "approved",
            hours: 10,
          },
        ],
        shifts: [],
      }),
    );
    localStorage.setItem(
      "volunteeru.nonprofits.v1",
      JSON.stringify({
        version: 1,
        organizations: [],
        events: [],
        activeId: null,
      }),
    );
    localStorage.setItem(
      "volunteeru.schools.v1",
      JSON.stringify({ version: 1, schools: [], activeId: null }),
    );
  });
  await page.reload();
}

test("visible student sign out returns to welcome and preserves records for resume", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seed(page);
  const signOut = page.getByRole("button", { name: "Sign out", exact: true });
  await expect(signOut).toBeVisible();
  const registries = await page.evaluate(() => [
    localStorage.getItem("volunteeru.schools.v1"),
    localStorage.getItem("volunteeru.nonprofits.v1"),
  ]);
  await signOut.click();
  await expect(
    page.getByRole("button", { name: /Find my opportunities/ }),
  ).toBeVisible();
  await expect(signOut).toHaveCount(0);
  const guest = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("volunteeru.shared.v1")),
  );
  expect(guest.student.name).toBe("");
  expect(guest.student.onboarded).toBe(false);
  expect(guest.student.id).not.toBe("signout-student");
  expect(guest.saved).toEqual([]);
  expect(guest.applications).toHaveLength(1);
  expect(guest.hours[0].hours).toBe(10);
  expect(
    await page.evaluate(() => [
      localStorage.getItem("volunteeru.schools.v1"),
      localStorage.getItem("volunteeru.nonprofits.v1"),
    ]),
  ).toEqual(registries);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Find my opportunities/ }),
  ).toBeVisible();
  await page.getByText("Resume a saved demo profile", { exact: true }).click();
  await page
    .getByRole("button", { name: "Resume Sam Student", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Your growing impact" }),
  ).toContainText("10 of 40 hours approved");
  const restored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("volunteeru.shared.v1")),
  );
  expect(restored.student.id).toBe("signout-student");
  expect(restored.saved).toEqual(["demo-1"]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("sign out stays student-only and a fresh profile starts blank", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Nonprofit", exact: true }).click();
  await expect(page.locator("#student-signout")).toHaveCount(0);
  await page.getByRole("button", { name: "Student", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: /Find my opportunities/ }).click();
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("");
  await expect(
    page.getByLabel("School or university", { exact: true }),
  ).toHaveValue("");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("volunteeru.student-profiles.v1"))[0]
          .student.name,
    ),
  ).toBe("Sam Student");
});
