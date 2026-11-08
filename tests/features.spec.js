import { test, expect } from "@playwright/test";
const key = "volunteeru.shared.v1";
async function begin(page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Find my opportunities/ }).click();
  await page.getByLabel("Your name").fill("Sam Student");
  await page.getByLabel("School or university").fill("My School");
  await page.getByLabel("Your age").fill("17");
}
async function finish(page, women = false) {
  await page.getByRole("button", { name: /Next/ }).click();
  await page
    .getByRole("button", {
      name: women ? "♡ Women’s health +" : "☀ Children and youth +",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: /Next/ }).click();
  if (women) {
    await page
      .getByRole("button", { name: /Period Care & Menstrual Equity/ })
      .click();
    await page
      .getByRole("button", { name: /Mental Health & Emotional Wellness/ })
      .click();
    await page.getByRole("button", { name: /Next/ }).click();
  }
  for (const name of ["Events and hands-on help", "Weekends", "Broward"]) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page
      .getByRole("button", { name: /Next|Let’s find your fit/ })
      .click();
  }
}
const nav = (page, name) =>
  page
    .locator("aside:visible,.mobile-nav:visible")
    .getByRole("button", { name, exact: false })
    .first()
    .click();
test("exactly four women’s health cards in two columns, editable and persistent", async ({
  page,
}) => {
  await begin(page);
  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByRole("button", { name: /Women’s health/ }).click();
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page.locator(".choice-grid .choice")).toHaveCount(4);
  for (const label of [
    "Period Care & Menstrual Equity",
    "Cancer Support",
    "Maternal & Postpartum Health",
    "Mental Health & Emotional Wellness",
  ])
    await expect(
      page.getByRole("button", { name: new RegExp(label) }),
    ).toBeVisible();
  const columns = await page
    .locator(".choice-grid")
    .evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
    );
  expect(columns).toBe(2);
  await page
    .getByRole("button", { name: /Period Care & Menstrual Equity/ })
    .click();
  await page.getByRole("button", { name: /Cancer Support/ }).click();
  await page.getByRole("button", { name: /Next/ }).click();
  for (const label of ["Events and hands-on help", "Weekends", "Broward"]) {
    await page.getByRole("button", { name: new RegExp(label) }).click();
    await page
      .getByRole("button", { name: /Next|Let’s find your fit/ })
      .click();
  }
  await nav(page, "Profile");
  await expect(page.locator(".profile-card")).toContainText(
    "Period Care & Menstrual Equity",
  );
  await page.getByRole("button", { name: "Edit profile" }).click();
  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(
    page.getByRole("button", { name: /Cancer Support/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Cancer Support/ }).click();
  await page
    .getByRole("button", { name: /Maternal & Postpartum Health/ })
    .click();
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: /Next/ }).click();
  await page.getByRole("button", { name: "Save profile" }).click();
  await page.reload();
  await nav(page, "Profile");
  await expect(page.locator(".profile-card")).toContainText(
    "Maternal & Postpartum Health",
  );
  await expect(
    page.locator(".profile-card .chip").filter({ hasText: "Cancer Support" }),
  ).toHaveCount(0);
});
test("potential organization profiles keep official links without apply actions", async ({
  page,
}) => {
  await begin(page);
  await finish(page);
  await expect(page.locator(".organization-card")).toHaveCount(4);
  const urls = [
    "https://period.org/chapters",
    "https://gildasclubsouthflorida.org/",
    "https://www.hmhbbroward.org/",
    "https://www.lotushouse.org/",
  ];
  for (let i = 0; i < 4; i++) {
    await page.locator("[data-organization]").nth(i).click();
    await expect(page.locator("dialog")).toContainText(
      "not a confirmed partner",
    );
    await expect(page.locator("dialog a")).toHaveAttribute("href", urls[i]);
    await expect(
      page.locator("dialog button").filter({ hasText: "Apply" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Close dialog" }).click();
  }
});
test("optional school invitation validates then confirms and can be added in Profile", async ({
  page,
}) => {
  await begin(page);
  await page
    .getByRole("button", { name: "Add school invitation code" })
    .click();
  await page.getByLabel("School invitation code").fill("INVALID");
  await page.getByRole("button", { name: "Validate code" }).click();
  await expect(page.getByRole("alert")).toContainText("Code not recognized");
  await page.getByLabel("School invitation code").fill("demo-broward");
  await page.getByRole("button", { name: "Validate code" }).click();
  await expect(page.locator(".school-preview")).toContainText(
    "VolunteerU Demo School — Broward",
  );
  expect(
    await page.evaluate(
      (key) =>
        JSON.parse(localStorage.getItem(key))?.student.schoolConnection ?? null,
      key,
    ),
  ).toBeNull();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByLabel("Your name")).toHaveValue("Sam Student");
  await finish(page);
  await nav(page, "Profile");
  await page
    .getByRole("button", { name: "Add school invitation code" })
    .click();
  await page.getByLabel("School invitation code").fill("DEMO-BROWARD");
  await page.getByRole("button", { name: "Validate code" }).click();
  await page.getByRole("button", { name: "Confirm school connection" }).click();
  await expect(page.locator(".school-invitation")).toContainText(
    "Demo connection",
  );
  await page.reload();
  await nav(page, "Profile");
  await expect(page.locator(".school-invitation")).toContainText(
    "VolunteerU Demo School — Broward",
  );
});
test("unconnected coordinator contact never reports success", async ({
  page,
}) => {
  await begin(page);
  await finish(page);
  await page.getByRole("button", { name: "View details" }).click();
  await page.getByText("Contact coordinator", { exact: true }).click();
  await page.getByLabel("Your email").fill("sam@example.org");
  await page
    .getByLabel("Message to coordinator")
    .fill("Can you explain the orientation requirements?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".message-result")).toContainText(
    "Nothing has been sent",
  );
  await expect(page.locator(".form-success")).toHaveCount(0);
  await expect(page.getByLabel("Message to coordinator")).toHaveValue(
    "Can you explain the orientation requirements?",
  );
});
test("coordinator submission requires designated contact and server acknowledgment", async ({
  page,
}) => {
  await page.addInitScript(() => (window.__VOLUNTEERU_API__ = "/api"));
  await page.route("**/src/data.js*", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      "publicContact: null",
      'publicContact: null, designatedContact: {id:"coordinator-1",name:"Designated Coordinator"}',
    );
    await route.fulfill({ response, body });
  });
  let result = { submitted: false };
  let submittedBody;
  await page.route("**/api/opportunities/demo-1/messages", async (route) => {
    submittedBody = route.request().postDataJSON();
    await route.fulfill({ json: result });
  });
  await begin(page);
  await finish(page);
  await page.getByRole("button", { name: "View details" }).click();
  await page.getByText("Contact coordinator", { exact: true }).click();
  await page.getByLabel("Your email").fill("sam@example.org");
  await page
    .getByLabel("Message to coordinator")
    .fill("Can you explain the orientation requirements?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".message-result")).toContainText(
    "did not confirm",
  );
  await expect(page.locator(".form-success")).toHaveCount(0);
  result = { submitted: true, messageId: "message-123" };
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".form-success")).toContainText(
    "Message submitted",
  );
  expect(submittedBody.replyTo).toBe("sam@example.org");
  expect(submittedBody).not.toHaveProperty("recipient");
});
test("notifications persist read state and follow application, shifts and hours records", async ({
  page,
  context,
}) => {
  await begin(page);
  await finish(page);
  await page.getByRole("button", { name: /Notifications,/ }).click();
  await expect(page.locator(".notification-list")).toContainText(
    "DEMO · Recommendation · not a placement",
  );
  await expect(page.locator(".notification-list")).not.toContainText(
    "Application accepted",
  );
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(
    page.getByRole("button", { name: "Mark all as read" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Notifications, 0 unread" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Apply →", exact: true }).click();
  await page.getByLabel("I confirm I can attend").check();
  await page
    .getByLabel("What makes you interested?")
    .fill("I want to make a difference in my community.");
  await page.getByRole("button", { name: "Send application" }).click();
  const teammate = await context.newPage();
  await teammate.goto("/");
  await teammate.evaluate((key) => {
    const data = JSON.parse(localStorage.getItem(key)),
      a = data.applications[0];
    a.status = "approved";
    a.updatedAt = new Date().toISOString();
    data.hours = [
      {
        id: "hours-1",
        applicationId: a.id,
        studentId: a.studentId,
        status: "needs_corrections",
        correctionNote: "Please correct your end time.",
      },
    ];
    data.shifts = [
      {
        id: "shift-1",
        applicationId: a.id,
        studentId: a.studentId,
        status: "confirmed",
        startsAt: new Date(Date.now() + 3600000).toISOString(),
      },
    ];
    localStorage.setItem(key, JSON.stringify(data));
  }, key);
  await expect(
    page.getByRole("button", { name: "Notifications, 3 unread" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Notifications,/ }).click();
  await expect(page.locator(".notification-list")).toContainText(
    "DEMO · Application accepted",
  );
  await expect(page.locator(".notification-list")).toContainText(
    "not a real placement",
  );
  await expect(page.locator(".notification-list")).toContainText(
    "Hours need corrections",
  );
  await expect(page.locator(".notification-list")).toContainText(
    "Upcoming confirmed shift",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await teammate.evaluate((key) => {
    const data = JSON.parse(localStorage.getItem(key));
    data.applications[0].status = "rejected";
    data.hours[0].status = "approved";
    localStorage.setItem(key, JSON.stringify(data));
  }, key);
  await page.getByRole("button", { name: /Notifications,/ }).click();
  await expect(page.locator(".notification-list")).toContainText(
    "Application declined",
  );
  await expect(page.locator(".notification-list")).toContainText(
    "Hours approved",
  );
  await expect(page.locator(".notification-list")).not.toContainText(
    "Upcoming confirmed shift",
  );
  await teammate.close();
});

test("real school service must validate and confirm the same school", async ({
  page,
}) => {
  await page.addInitScript(() => (window.__VOLUNTEERU_API__ = "/api"));
  let confirmed = false,
    payload = null;
  await page.route("**/api/school-invitations/validate", (route) =>
    route.fulfill({
      json: {
        valid: true,
        validationToken: "single-use-token",
        schoolId: "school-123",
        schoolName: "Connected Test School",
      },
    }),
  );
  await page.route("**/api/school-invitations/confirm", (route) => {
    confirmed = true;
    payload = route.request().postDataJSON();
    return route.fulfill({
      json: {
        connected: true,
        schoolId: "school-123",
        schoolName: "Connected Test School",
      },
    });
  });
  await begin(page);
  await page
    .getByRole("button", { name: "Add school invitation code" })
    .click();
  await page.getByLabel("School invitation code").fill("INVITE-123");
  await page.getByRole("button", { name: "Validate code" }).click();
  await expect(page.locator(".school-preview")).toContainText(
    "Connected Test School",
  );
  expect(confirmed).toBe(false);
  await page.getByRole("button", { name: "Confirm school connection" }).click();
  await expect(page.locator(".school-invitation")).toContainText(
    "School connected",
  );
  expect(confirmed).toBe(true);
  expect(payload).toEqual({ validationToken: "single-use-token" });
  await expect(page.getByLabel("Your name")).toHaveValue("Sam Student");
});

test("authenticated backend changes drive notifications without fabricated events", async ({
  page,
}) => {
  await page.addInitScript(() => (window.__VOLUNTEERU_API__ = "/api"));
  await page.route("**/api/student/updates", async (route) => {
    const studentId = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key))?.student.id,
      key,
    );
    await route.fulfill({
      json: {
        studentId,
        applications: [
          {
            id: "backend-application",
            studentId,
            opportunityId: "demo-1",
            status: "approved",
            submittedAt: "2026-11-01T10:00:00Z",
            updatedAt: "2026-11-07T10:00:00Z",
          },
        ],
        hours: [
          {
            id: "backend-hours",
            studentId,
            applicationId: "backend-application",
            status: "approved",
            hours: 3,
          },
        ],
        shifts: [],
      },
    });
  });
  await begin(page);
  await finish(page);
  await expect(
    page.getByRole("button", { name: "Notifications, 2 unread" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Notifications, 2 unread" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Notifications,/ }).click();
  await expect(page.locator(".notification-list")).toContainText(
    "Hours approved",
  );
  await expect(page.locator(".notification-list")).toContainText(
    "Application accepted",
  );
  await expect(page.locator(".notification-list")).not.toContainText(
    "Upcoming confirmed shift",
  );
});
