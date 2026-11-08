import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPlatform } from "./platform.js";

test("authenticated roles, school invitation scope, timed attendance, reporting and persistence", async () => {
  const dir = mkdtempSync(join(tmpdir(), "volunteeru-api-")),
    databasePath = join(dir, "data", "test.sqlite");
  let now = Date.parse("2026-11-07T12:00:00Z");
  let platform = createPlatform({ databasePath, clock: () => now });
  async function start() {
    await new Promise((resolve) =>
      platform.server.listen(0, "127.0.0.1", resolve),
    );
    return `http://127.0.0.1:${platform.server.address().port}`;
  }
  let base = await start();
  async function call(path, method = "GET", body, auth, headers = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(auth
          ? { Cookie: auth.cookie, "X-CSRF-Token": auth.csrfToken }
          : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  async function register(data) {
    const r = await call("/api/auth/register", "POST", {
      name: "Test User",
      password: "a-long-test-password",
      authorized: true,
      ...data,
    });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    return { ...r.data, cookie: r.cookie };
  }
  try {
    assert.equal((await call("/api/events")).status, 401);
    const school = await register({
      role: "school_admin",
      email: "school@example.org",
      schoolName: "School A",
      requiredHours: 40,
    });
    const schoolB = await register({
      role: "school_admin",
      email: "schoolb@example.org",
      schoolName: "School B",
    });
    assert.equal(
      (
        await call("/api/schools/invitations", "POST", {}, school, {
          "X-CSRF-Token": "bad",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call("/api/schools/invitations", "POST", {}, school, {
          Origin: "https://unrelated.example",
        })
      ).status,
      403,
    );
    const invite = await call(
      "/api/schools/invitations",
      "POST",
      { maxUses: 1 },
      school,
    );
    assert.equal(invite.status, 201);
    assert.ok(
      !JSON.stringify(
        platform.db.prepare("SELECT * FROM invitations").all(),
      ).includes(invite.data.invitationToken),
    );
    const student = await register({
      role: "student",
      email: "student@example.org",
      age: 17,
      invitationToken: invite.data.invitationToken,
    });
    assert.equal(
      (
        await call("/api/auth/register", "POST", {
          role: "student",
          email: "reuse@example.org",
          name: "Student",
          password: "a-long-test-password",
          age: 17,
          invitationToken: invite.data.invitationToken,
        })
      ).status,
      400,
    );
    const inviteB = await call("/api/schools/invitations", "POST", {}, schoolB);
    const studentB = await register({
      role: "student",
      email: "studentb@example.org",
      age: 17,
      invitationToken: inviteB.data.invitationToken,
    });
    const nonprofit = await register({
      role: "nonprofit",
      email: "nonprofit@example.org",
      organizationName: "Nonprofit A",
    });
    const nonprofitB = await register({
      role: "nonprofit",
      email: "nonprofitb@example.org",
      organizationName: "Nonprofit B",
    });
    assert.equal(
      (await call("/api/schools/invitations", "POST", {}, nonprofit)).status,
      403,
    );
    const created = await call(
      "/api/events",
      "POST",
      {
        title: "Community event",
        date: "2026-12-19",
        startsAt: "2026-12-19T10:00:00Z",
        hours: 2,
        location: "Broward",
        city: "Fort Lauderdale",
        minAge: 16,
        volunteerTarget: 1,
        description: "Help with community projects.",
        requirements: "Coordinator orientation required.",
        status: "published",
        lat: 26.12,
        lon: -80.14,
      },
      nonprofit,
    );
    assert.equal(created.status, 201, JSON.stringify(created.data));
    const event = created.data.event;
    assert.equal(
      (
        await call(
          `/api/events/${event.id}`,
          "PATCH",
          { title: "Unauthorized edit" },
          nonprofitB,
        )
      ).status,
      404,
    );
    const applied = await call(
      "/api/applications",
      "POST",
      { eventId: event.id, studentId: studentB.user.id },
      student,
    );
    assert.equal(applied.status, 201);
    const applicationId = applied.data.id;
    assert.equal(
      (await call("/api/applications", "POST", { eventId: event.id }, student))
        .status,
      409,
    );
    assert.equal(
      (await call("/api/applications", "GET", null, studentB)).data.applications
        .length,
      0,
    );
    assert.equal(
      (
        await call(
          `/api/applications/${applicationId}`,
          "PATCH",
          { status: "approved" },
          nonprofitB,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await call(
          `/api/applications/${applicationId}`,
          "PATCH",
          { status: "approved" },
          nonprofit,
        )
      ).status,
      200,
    );
    const second = await call(
      "/api/applications",
      "POST",
      { eventId: event.id },
      studentB,
    );
    assert.equal(
      (
        await call(
          `/api/applications/${second.data.id}`,
          "PATCH",
          { status: "approved" },
          nonprofit,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await call(
          "/api/attendance/check-in",
          "POST",
          { applicationId },
          student,
        )
      ).status,
      400,
    );
    now = Date.parse("2026-12-19T10:00:00Z");
    for (const account of [
      school,
      schoolB,
      student,
      studentB,
      nonprofit,
      nonprofitB,
    ]) {
      const logged = await call("/api/auth/login", "POST", {
        email: account.user.email,
        password: "a-long-test-password",
      });
      Object.assign(account, logged.data, { cookie: logged.cookie });
    }
    assert.equal(
      (
        await call(
          "/api/attendance/check-in",
          "POST",
          { applicationId },
          student,
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await call(
          "/api/attendance/check-in",
          "POST",
          { applicationId },
          student,
        )
      ).status,
      409,
    );
    now += 3600000;
    const out = await call(
      "/api/attendance/check-out",
      "POST",
      { applicationId, hours: 500 },
      student,
    );
    assert.equal(out.status, 200);
    assert.equal(out.data.hours, 1);
    const hours = (await call("/api/hours", "GET", null, nonprofit)).data
      .hours[0];
    assert.equal(
      (
        await call(
          `/api/hours/${hours.id}`,
          "PATCH",
          { status: "approved" },
          nonprofit,
        )
      ).status,
      400,
    );
    const attendance = (await call("/api/attendance", "GET", null, nonprofit))
      .data.attendance[0];
    now += 3600000;
    assert.equal(
      (
        await call(
          `/api/attendance/${attendance.id}`,
          "PATCH",
          { status: "present" },
          nonprofit,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await call(
          `/api/hours/${hours.id}`,
          "PATCH",
          { status: "approved" },
          student,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          `/api/hours/${hours.id}`,
          "PATCH",
          { status: "approved" },
          nonprofit,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await call(
          `/api/applications/${applicationId}`,
          "PATCH",
          { status: "rejected" },
          nonprofit,
        )
      ).status,
      409,
    );
    const map = await call(
      "/api/maps/nearby?lat=26.12&lon=-80.14&radius=10",
      "GET",
      null,
      student,
    );
    assert.equal(map.status, 200);
    assert.equal(map.data.events.length, 1);
    assert.equal(
      (
        await call(
          "/api/nonprofit/plans",
          "POST",
          { transcript: "Goal: Test sample" },
          nonprofit,
        )
      ).status,
      503,
    );
    const report = (await call("/api/reports/school", "GET", null, school))
      .data;
    assert.equal(report.students.length, 1);
    assert.equal(report.students[0].approvedHours, 1);
    assert.equal(
      (await call("/api/reports/school", "GET", null, schoolB)).data.students[0]
        .approvedHours,
      0,
    );
    assert.equal(
      (await call("/api/reports/school", "GET", null, nonprofit)).status,
      403,
    );
    assert.equal(statSync(databasePath).mode & 0o777, 0o600);
    await platform.close();
    platform = createPlatform({ databasePath, clock: () => now });
    base = await start();
    const login = await call("/api/auth/login", "POST", {
      email: "school@example.org",
      password: "a-long-test-password",
    });
    assert.equal(login.status, 200);
    const resumed = { ...login.data, cookie: login.cookie };
    assert.equal(
      (await call("/api/reports/school", "GET", null, resumed)).data.students[0]
        .approvedHours,
      1,
    );
    assert.equal(
      (await call("/api/auth/logout", "POST", {}, resumed)).status,
      200,
    );
    assert.equal(
      (await call("/api/auth/session", "GET", null, resumed)).status,
      401,
    );
  } finally {
    await platform.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
