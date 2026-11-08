import { test, expect } from "@playwright/test";
const nav = (page) =>
  page
    .locator("aside:visible,.mobile-nav:visible")
    .getByRole("button", { name: "Integrations", exact: false })
    .first()
    .click();
const account = {
  user: {
    id: "server-student",
    name: "Server Student",
    role: "student",
    schoolId: "school-server",
    age: 17,
  },
  csrfToken: "test-server-csrf",
};
async function mockApi(page) {
  let active = false,
    applied = false,
    mutations = [];
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname,
      method = req.method();
    let status = 200,
      data = {};
    if (path === "/api/auth/session") {
      status = active ? 200 : 401;
      data = active ? account : { error: "Sign in to continue." };
    } else if (path === "/api/auth/login" || path === "/api/auth/register") {
      active = true;
      data = account;
      mutations.push({
        path,
        body: req.postDataJSON(),
        csrf: req.headers()["x-csrf-token"],
      });
    } else if (!active) {
      status = 401;
      data = { error: "Sign in to continue." };
    } else if (path === "/api/auth/logout") {
      mutations.push({ path, csrf: req.headers()["x-csrf-token"] });
      active = false;
      data = { signedOut: true };
    } else if (path === "/api/events")
      data = {
        events: [
          {
            id: "server-event",
            title: "Server care kit event",
            date: "2026-12-19",
            city: "Fort Lauderdale",
            location: "Broward",
            hours: 2,
            status: "published",
            description: "Help assemble community care kits.",
          },
        ],
      };
    else if (path === "/api/applications" && method === "POST") {
      mutations.push({
        path,
        body: req.postDataJSON(),
        csrf: req.headers()["x-csrf-token"],
      });
      applied = true;
      data = { id: "server-app", status: "pending" };
    } else if (path === "/api/applications")
      data = {
        applications: applied
          ? [
              {
                id: "server-app",
                title: "Server care kit event",
                status: "pending",
              },
            ]
          : [],
      };
    else if (path === "/api/hours") data = { hours: [] };
    else if (path === "/api/attendance") data = { attendance: [] };
    else if (path === "/api/notifications") data = { notifications: [] };
    else {
      status = 404;
      data = { error: "Not found" };
    }
    await route.fulfill({ status, json: data });
  });
  return { mutations };
}
test("server workspace sign-in applies with CSRF, restores and signs out without demo migration", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const api = await mockApi(page);
  await page.goto("/");
  await nav(page);
  const form = page.locator("#server-login");
  await form.getByLabel("Email", { exact: true }).fill("student@example.org");
  await form
    .getByLabel("Password", { exact: true })
    .fill("a-long-sample-password");
  await form.getByRole("button", { name: "Sign in to server" }).click();
  await expect(
    page.getByText("Connected · authenticated workspace", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".integration-panel")).toContainText(
    "Server care kit event",
  );
  await page.getByRole("button", { name: "Apply to event" }).click();
  await expect(page.locator(".integration-panel")).toContainText("pending");
  const mutation = api.mutations.find((r) => r.path === "/api/applications");
  expect(mutation.csrf).toBe("test-server-csrf");
  expect(mutation.body).toEqual({ eventId: "server-event" });
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "a-long-sample-password",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("volunteeru.shared.v1") || "null")
          ?.applications || [],
    ),
  ).toHaveLength(0);
  await page.reload();
  await nav(page);
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.locator("#server-login")).toBeVisible();
  expect(api.mutations.find((r) => r.path === "/api/auth/logout").csrf).toBe(
    "test-server-csrf",
  );
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
test("opaque school link opens server student registration with the invitation token", async ({
  page,
}) => {
  const api = await mockApi(page);
  await page.goto("/?invite=opaque-school-token");
  const form = page.locator("#server-register");
  await expect(
    form.getByLabel("School invitation token (students)", { exact: true }),
  ).toHaveValue("opaque-school-token");
  await form.getByLabel("Your name", { exact: true }).fill("Invited Student");
  await form.getByLabel("Email", { exact: true }).fill("invited@example.org");
  await form
    .getByLabel("Password (12+ characters)", { exact: true })
    .fill("a-long-sample-password");
  await form.getByLabel("Age (students only)", { exact: true }).fill("17");
  await form
    .getByRole("button", { name: "Create server account", exact: true })
    .click();
  await expect(
    page.getByText("Connected · authenticated workspace", { exact: true }),
  ).toBeVisible();
  const request = api.mutations.find((r) => r.path === "/api/auth/register");
  expect(request.body.role).toBe("student");
  expect(request.body.invitationToken).toBe("opaque-school-token");
  expect(request.body.age).toBe(17);
});
