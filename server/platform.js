import { scopedImpactReport } from "./report-scope.js";
import {
  generateMeetingPlan,
  generateImpactSummary,
  nearbyEvents,
} from "./providers.js";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  randomUUID,
  scrypt as derive,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
const scrypt = promisify(derive),
  hash = (value) => createHash("sha256").update(value).digest("hex");
const token = () => randomBytes(32).toString("hex");
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const text = (value, max = 2000) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const finite = (n, min, max) =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
export function createPlatform({
  databasePath = "server/data/volunteeru.sqlite",
  clock = () => Date.now(),
  secureCookie = process.env.NODE_ENV === "production",
  publicOrigin = process.env.PUBLIC_ORIGIN || "http://localhost:5173",
} = {}) {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
    chmodSync(dirname(databasePath), 0o700);
  }
  const db = new DatabaseSync(databasePath);
  if (databasePath !== ":memory:") chmodSync(databasePath, 0o600);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE;
 CREATE TABLE IF NOT EXISTS schools(id TEXT PRIMARY KEY,name TEXT NOT NULL,required_hours REAL NOT NULL);
 CREATE TABLE IF NOT EXISTS organizations(id TEXT PRIMARY KEY,name TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,salt TEXT NOT NULL,role TEXT NOT NULL,school_id TEXT REFERENCES schools(id),organization_id TEXT REFERENCES organizations(id),age INTEGER);
 CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),csrf TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS invitations(id TEXT PRIMARY KEY,school_id TEXT REFERENCES schools(id),expires INTEGER NOT NULL,max_uses INTEGER NOT NULL,uses INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,organization_id TEXT REFERENCES organizations(id),title TEXT NOT NULL,date TEXT NOT NULL,starts_at TEXT NOT NULL,hours REAL NOT NULL,location TEXT NOT NULL,city TEXT NOT NULL,min_age INTEGER NOT NULL,target INTEGER NOT NULL,description TEXT NOT NULL,requirements TEXT NOT NULL,lat REAL,lon REAL,status TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS applications(id TEXT PRIMARY KEY,student_id TEXT REFERENCES users(id),event_id TEXT REFERENCES events(id),status TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(student_id,event_id));
 CREATE TABLE IF NOT EXISTS attendance(id TEXT PRIMARY KEY,application_id TEXT UNIQUE REFERENCES applications(id),checked_in INTEGER NOT NULL,checked_out INTEGER,status TEXT NOT NULL DEFAULT 'unverified');
 CREATE TABLE IF NOT EXISTS hours(id TEXT PRIMARY KEY,application_id TEXT UNIQUE REFERENCES applications(id),hours REAL NOT NULL,status TEXT NOT NULL,correction_note TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,student_id TEXT REFERENCES users(id),event_id TEXT REFERENCES events(id),message TEXT NOT NULL,created_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'queued');`);
  const q = (sql, ...args) => db.prepare(sql).all(...args),
    one = (sql, ...args) => db.prepare(sql).get(...args),
    run = (sql, ...args) => db.prepare(sql).run(...args);
  const userView = (u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    schoolId: u.school_id,
    organizationId: u.organization_id,
    age: u.age,
  });
  const eventView = (e) => ({
    id: e.id,
    organizationId: e.organization_id,
    title: e.title,
    date: e.date,
    startsAt: e.starts_at,
    hours: e.hours,
    location: e.location,
    city: e.city,
    minAge: e.min_age,
    volunteerTarget: e.target,
    description: e.description,
    requirements: e.requirements,
    lat: e.lat,
    lon: e.lon,
    status: e.status,
  });
  const limits = new Map();
  function rate(key, max = 10, windowMs = 900000) {
    const now = clock(),
      r = limits.get(key);
    if (!r || now - r.start > windowMs) {
      limits.set(key, { start: now, count: 1 });
      return;
    }
    if (++r.count > max) fail(429, "Too many attempts. Try again later.");
  }
  const session = (req) => {
    const cookie = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("volunteeru_session="))
      ?.slice(19);
    if (!cookie) return null;
    return one(
      "SELECT sessions.*,users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.id=? AND sessions.expires>?",
      hash(cookie),
      clock(),
    );
  };
  function requireRole(user, ...roles) {
    if (!roles.includes(user.role))
      fail(403, "This action is not available for your role.");
  }
  function ownedEvent(user, id) {
    const e = one(
      "SELECT * FROM events WHERE id=? AND organization_id=?",
      id,
      user.organization_id,
    );
    if (!e) fail(404, "Event not found.");
    return e;
  }
  function ownedApplication(user, id) {
    const a = one(
      "SELECT applications.*,events.organization_id,events.starts_at,events.hours AS event_hours,events.target,events.date AS event_date,events.status AS event_status,events.min_age AS min_age FROM applications JOIN events ON events.id=applications.event_id WHERE applications.id=?",
      id,
    );
    if (
      !a ||
      (user.role === "student"
        ? a.student_id !== user.id
        : a.organization_id !== user.organization_id)
    )
      fail(404, "Application not found.");
    return a;
  }
  async function body(req) {
    if (!req.headers["content-type"]?.startsWith("application/json"))
      fail(415, "Use application/json.");
    let size = 0,
      parts = [];
    for await (const part of req) {
      size += part.length;
      if (size > 32768) fail(413, "Request is too large.");
      parts.push(part);
    }
    try {
      const value = JSON.parse(Buffer.concat(parts).toString() || "{}");
      if (!value || typeof value !== "object" || Array.isArray(value))
        fail(400, "Use a JSON object.");
      return value;
    } catch {
      fail(400, "Invalid JSON.");
    }
  }
  function issueSession(res, user) {
    const raw = token(),
      csrf = token();
    run(
      "INSERT INTO sessions VALUES(?,?,?,?)",
      hash(raw),
      user.id,
      csrf,
      clock() + 12 * 3600000,
    );
    res.setHeader(
      "Set-Cookie",
      `volunteeru_session=${raw}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=43200${secureCookie ? "; Secure" : ""}`,
    );
    return { user: userView(user), csrfToken: csrf };
  }
  function eventValues(b) {
    if (
      !text(b.title, 120) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(b.date || "") ||
      !Number.isFinite(Date.parse(`${b.date}T00:00:00Z`)) ||
      (Number.isFinite(Date.parse(`${b.date}T00:00:00Z`)) &&
        new Date(`${b.date}T00:00:00Z`).toISOString().slice(0, 10) !==
          b.date) ||
      typeof b.startsAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        b.startsAt,
      ) ||
      !Number.isFinite(Date.parse(b.startsAt)) ||
      !finite(b.hours, 0.25, 24) ||
      !text(b.city, 100) ||
      !["Broward", "Miami-Dade", "Remote"].includes(b.location) ||
      !Number.isInteger(b.minAge) ||
      b.minAge < 13 ||
      b.minAge > 100 ||
      !Number.isInteger(b.volunteerTarget) ||
      b.volunteerTarget < 1 ||
      b.volunteerTarget > 10000 ||
      !text(b.description) ||
      !text(b.requirements) ||
      !["draft", "published"].includes(b.status || "draft") ||
      (b.lat != null && !finite(b.lat, -90, 90)) ||
      (b.lon != null && !finite(b.lon, -180, 180))
    )
      fail(
        400,
        "Review the event fields, schedule and eligibility requirements.",
      );
    const eventDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(b.startsAt));
    if (eventDay !== b.date)
      fail(
        400,
        "The event date must match its start in America/New_York time.",
      );
    if (b.status === "published" && Date.parse(b.startsAt) <= clock())
      fail(400, "Publish an event with a future start.");
    return [
      b.title.trim(),
      b.date,
      b.startsAt,
      b.hours,
      b.location,
      b.city.trim(),
      b.minAge,
      b.volunteerTarget,
      b.description.trim(),
      b.requirements.trim(),
      b.lat ?? null,
      b.lon ?? null,
      b.status || "draft",
    ];
  }
  const server = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const send = (value, status = 200) => {
      res.writeHead(status);
      res.end(JSON.stringify(value));
    };
    try {
      const path = new URL(req.url, "http://local").pathname,
        method = req.method;
      if (!path.startsWith("/api/")) fail(404, "Route not found.");
      const mutation = !["GET", "HEAD"].includes(method);
      if (
        mutation &&
        ((req.headers.origin && req.headers.origin !== publicOrigin) ||
          req.headers["sec-fetch-site"] === "cross-site")
      )
        fail(403, "Request origin is not allowed.");
      if (method === "GET" && path === "/api/health")
        return send({ ok: true, mode: "authenticated-sqlite" });
      if (method === "POST" && path === "/api/auth/register") {
        rate(`register:${req.socket.remoteAddress}`, 20, 3600000);
        const b = await body(req);
        if (
          !["student", "school_admin", "nonprofit"].includes(b.role) ||
          !text(b.name, 80) ||
          !text(b.email, 160) ||
          !/^\S+@\S+\.\S+$/.test(b.email) ||
          !text(b.password, 128) ||
          b.password.length < 12
        )
          fail(
            400,
            "Enter a name, valid email, and password of at least 12 characters.",
          );
        if (b.role !== "student" && b.authorized !== true)
          fail(
            400,
            "Confirm that you are authorized to coordinate this organization.",
          );
        const email = b.email.toLowerCase().trim();
        if (one("SELECT id FROM users WHERE email=?", email))
          fail(409, "An account could not be created with those details.");
        let invite;
        if (b.role === "student") {
          if (
            !Number.isInteger(b.age) ||
            b.age < 13 ||
            b.age > 100 ||
            !text(b.invitationToken, 200)
          )
            fail(400, "Students ages 13+ need a valid school invitation.");
          invite = one(
            "SELECT * FROM invitations WHERE id=? AND expires>? AND uses<max_uses",
            hash(b.invitationToken),
            clock(),
          );
          if (!invite)
            fail(400, "School invitation is unavailable or expired.");
        } else if (
          !text(
            b.role === "school_admin" ? b.schoolName : b.organizationName,
            120,
          )
        )
          fail(400, "Enter your school or nonprofit name.");
        const salt = token(),
          password = (await scrypt(b.password, salt, 64)).toString("hex"),
          id = randomUUID();
        let schoolId = invite?.school_id || null,
          orgId = null;
        db.exec("BEGIN IMMEDIATE");
        try {
          if (b.role === "school_admin") {
            schoolId = randomUUID();
            run(
              "INSERT INTO schools VALUES(?,?,?)",
              schoolId,
              b.schoolName.trim(),
              finite(b.requiredHours, 0, 10000) ? b.requiredHours : 40,
            );
          }
          if (b.role === "nonprofit") {
            orgId = randomUUID();
            run(
              "INSERT INTO organizations VALUES(?,?)",
              orgId,
              b.organizationName.trim(),
            );
          }
          if (invite) {
            const result = run(
              "UPDATE invitations SET uses=uses+1 WHERE id=? AND expires>? AND uses<max_uses",
              invite.id,
              clock(),
            );
            if (!result.changes)
              fail(400, "School invitation is unavailable or expired.");
          }
          run(
            "INSERT INTO users VALUES(?,?,?,?,?,?,?,?,?)",
            id,
            b.name.trim(),
            email,
            password,
            salt,
            b.role,
            schoolId,
            orgId,
            b.role === "student" ? b.age : null,
          );
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
        return send(
          issueSession(res, one("SELECT * FROM users WHERE id=?", id)),
          201,
        );
      }
      if (method === "POST" && path === "/api/auth/login") {
        const b = await body(req);
        rate(`login-ip:${req.socket.remoteAddress}`, 40);
        rate(
          `login:${req.socket.remoteAddress}:${String(b.email).toLowerCase()}`,
        );
        const u = one(
          "SELECT * FROM users WHERE email=?",
          String(b.email).toLowerCase().trim(),
        );
        const salt = u?.salt || "invalid-login-salt";
        const attempt = await scrypt(
          String(b.password || "").slice(0, 128),
          salt,
          64,
        );
        if (!u || !timingSafeEqual(Buffer.from(u.password, "hex"), attempt))
          fail(401, "Email or password is incorrect.");
        return send(issueSession(res, u));
      }
      const user = session(req);
      if (!user) fail(401, "Sign in to continue.");
      if (method === "GET" && path === "/api/auth/session")
        return send({ user: userView(user), csrfToken: user.csrf });
      if (mutation && req.headers["x-csrf-token"] !== user.csrf)
        fail(403, "Refresh your session before making changes.");
      if (method === "POST" && path === "/api/auth/logout") {
        run(
          "DELETE FROM sessions WHERE id=?",
          hash(
            req.headers.cookie
              .split(";")
              .map((x) => x.trim())
              .find((x) => x.startsWith("volunteeru_session="))
              .slice(19),
          ),
        );
        res.setHeader(
          "Set-Cookie",
          "volunteeru_session=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0",
        );
        return send({ signedOut: true });
      }
      if (path === "/api/schools/invitations" && method === "POST") {
        requireRole(user, "school_admin");
        const b = await body(req),
          raw = token();
        const max =
          Number.isInteger(b.maxUses) && b.maxUses >= 1 && b.maxUses <= 1000
            ? b.maxUses
            : 100;
        run(
          "INSERT INTO invitations(id,school_id,expires,max_uses) VALUES(?,?,?,?)",
          hash(raw),
          user.school_id,
          clock() + 7 * 86400000,
          max,
        );
        return send(
          {
            invitationToken: raw,
            registrationLink: `${publicOrigin}/?invite=${raw}`,
            expiresAt: new Date(clock() + 7 * 86400000).toISOString(),
            maxUses: max,
          },
          201,
        );
      }
      if (path === "/api/events" && method === "GET") {
        const rows =
          user.role === "nonprofit"
            ? q(
                "SELECT * FROM events WHERE organization_id=?",
                user.organization_id,
              )
            : q("SELECT * FROM events WHERE status='published'");
        return send({ events: rows.map(eventView) });
      }
      if (path === "/api/events" && method === "POST") {
        requireRole(user, "nonprofit");
        const b = await body(req),
          values = eventValues(b),
          id = randomUUID();
        run(
          "INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          id,
          user.organization_id,
          ...values,
        );
        return send(
          { event: eventView(one("SELECT * FROM events WHERE id=?", id)) },
          201,
        );
      }
      const eventRoute = path.match(/^\/api\/events\/([^/]+)$/);
      if (eventRoute && method === "PATCH") {
        requireRole(user, "nonprofit");
        const e = ownedEvent(user, eventRoute[1]),
          b = { ...eventView(e), ...(await body(req)) },
          values = eventValues(b);
        const n = one(
          "SELECT count(*) AS n FROM applications WHERE event_id=? AND status='approved'",
          e.id,
        ).n;
        if (
          b.volunteerTarget < n ||
          (n &&
            (b.startsAt !== e.starts_at ||
              b.hours !== e.hours ||
              b.date !== e.date))
        )
          fail(
            409,
            "Approved registrations prevent that schedule or staffing change.",
          );
        run(
          "UPDATE events SET title=?,date=?,starts_at=?,hours=?,location=?,city=?,min_age=?,target=?,description=?,requirements=?,lat=?,lon=?,status=? WHERE id=?",
          ...values,
          e.id,
        );
        return send({
          event: eventView(one("SELECT * FROM events WHERE id=?", e.id)),
        });
      }
      if (path === "/api/applications" && method === "GET") {
        requireRole(user, "student", "nonprofit");
        return send({
          applications:
            user.role === "student"
              ? q(
                  "SELECT applications.*,events.title FROM applications JOIN events ON events.id=applications.event_id WHERE student_id=?",
                  user.id,
                )
              : q(
                  "SELECT applications.*,events.title,users.name AS student_name FROM applications JOIN events ON events.id=applications.event_id JOIN users ON users.id=applications.student_id WHERE events.organization_id=?",
                  user.organization_id,
                ),
        });
      }
      if (path === "/api/applications" && method === "POST") {
        requireRole(user, "student");
        const b = await body(req),
          e = one(
            "SELECT * FROM events WHERE id=? AND status='published'",
            b.eventId,
          );
        if (!e || Date.parse(e.starts_at) <= clock() || user.age < e.min_age)
          fail(
            400,
            "This event is unavailable or you do not meet its age requirement.",
          );
        if (
          one(
            "SELECT id FROM applications WHERE student_id=? AND event_id=?",
            user.id,
            e.id,
          )
        )
          fail(409, "You already applied to this event.");
        const id = randomUUID();
        run(
          "INSERT INTO applications VALUES(?,?,?,'pending',?)",
          id,
          user.id,
          e.id,
          new Date(clock()).toISOString(),
        );
        return send({ id, status: "pending" }, 201);
      }
      const appRoute = path.match(/^\/api\/applications\/([^/]+)$/);
      if (appRoute && method === "PATCH") {
        requireRole(user, "nonprofit");
        const a = ownedApplication(user, appRoute[1]),
          b = await body(req);
        if (!["approved", "rejected"].includes(b.status))
          fail(400, "Choose approved or rejected.");
        if (
          b.status === "approved" &&
          (a.event_status !== "published" || Date.parse(a.starts_at) <= clock())
        )
          fail(400, "Approve registrations for an upcoming published event.");
        if (
          b.status === "approved" &&
          a.status !== "approved" &&
          one(
            "SELECT count(*) AS n FROM applications WHERE event_id=? AND status='approved'",
            a.event_id,
          ).n >= a.target
        )
          fail(409, "Volunteer target is full.");
        if (
          b.status === "approved" &&
          one("SELECT age FROM users WHERE id=?", a.student_id).age < a.min_age
        )
          fail(
            400,
            "The student no longer meets this event’s age requirement.",
          );
        if (
          b.status === "rejected" &&
          (one(
            "SELECT id FROM attendance WHERE application_id=? AND status='present'",
            a.id,
          ) ||
            one(
              "SELECT id FROM hours WHERE application_id=? AND status='approved'",
              a.id,
            ))
        )
          fail(
            409,
            "Verified participation cannot be declined. Review the approved records through your coordinator workflow.",
          );
        run("UPDATE applications SET status=? WHERE id=?", b.status, a.id);
        return send({ id: a.id, status: b.status });
      }
      if (path === "/api/attendance" && method === "GET") {
        requireRole(user, "student", "nonprofit");
        const clause =
          user.role === "student"
            ? "applications.student_id=?"
            : "events.organization_id=?";
        return send({
          attendance: q(
            `SELECT attendance.* FROM attendance JOIN applications ON applications.id=attendance.application_id JOIN events ON events.id=applications.event_id WHERE ${clause}`,
            user.role === "student" ? user.id : user.organization_id,
          ),
        });
      }
      if (
        ["/api/attendance/check-in", "/api/attendance/check-out"].includes(
          path,
        ) &&
        method === "POST"
      ) {
        requireRole(user, "student");
        const b = await body(req),
          a = ownedApplication(user, b.applicationId);
        if (a.status !== "approved")
          fail(400, "An approved registration is required.");
        const now = clock(),
          start = Date.parse(a.starts_at),
          end = start + a.event_hours * 3600000;
        let r = one("SELECT * FROM attendance WHERE application_id=?", a.id);
        if (path.endsWith("check-in")) {
          if (now < start - 1800000 || now >= end)
            fail(
              400,
              "Check in within 30 minutes before the event or while it is running.",
            );
          if (r) fail(409, "You already checked in.");
          run(
            "INSERT INTO attendance(id,application_id,checked_in) VALUES(?,?,?)",
            randomUUID(),
            a.id,
            Math.max(now, start),
          );
          return send({ checkedIn: true }, 201);
        }
        if (!r || r.checked_out)
          fail(409, "Check in first, or this session is already checked out.");
        const out = Math.min(now, end);
        if (out <= r.checked_in)
          fail(400, "Volunteer time has not elapsed yet.");
        const elapsed = Math.min(a.event_hours, (out - r.checked_in) / 3600000);
        db.exec("BEGIN IMMEDIATE");
        try {
          run("UPDATE attendance SET checked_out=? WHERE id=?", out, r.id);
          run(
            "INSERT INTO hours VALUES(?,?,?,'pending','')",
            randomUUID(),
            a.id,
            elapsed,
          );
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
        return send({ checkedOut: true, hours: elapsed, status: "pending" });
      }
      const attendRoute = path.match(/^\/api\/attendance\/([^/]+)$/);
      if (attendRoute && method === "PATCH") {
        requireRole(user, "nonprofit");
        const r = one("SELECT * FROM attendance WHERE id=?", attendRoute[1]);
        if (!r) fail(404, "Attendance not found.");
        const a = ownedApplication(user, r.application_id),
          b = await body(req);
        if (
          b.status !== "present" ||
          !r.checked_out ||
          a.status !== "approved" ||
          clock() < Date.parse(a.starts_at) + a.event_hours * 3600000
        )
          fail(
            400,
            "Verify attendance after the approved event and check-out are complete.",
          );
        run("UPDATE attendance SET status='present' WHERE id=?", r.id);
        return send({ id: r.id, status: "present" });
      }
      if (path === "/api/hours" && method === "GET") {
        requireRole(user, "student", "nonprofit");
        const clause =
          user.role === "student"
            ? "applications.student_id=?"
            : "events.organization_id=?";
        return send({
          hours: q(
            `SELECT hours.*,events.title,applications.student_id FROM hours JOIN applications ON applications.id=hours.application_id JOIN events ON events.id=applications.event_id WHERE ${clause}`,
            user.role === "student" ? user.id : user.organization_id,
          ),
        });
      }
      if (path === "/api/hours" && method === "POST") {
        requireRole(user, "student");
        const b = await body(req),
          a = ownedApplication(user, b.applicationId);
        const existing = one(
          "SELECT * FROM hours WHERE application_id=?",
          a.id,
        );
        if (existing) return send({ hours: existing });
        fail(
          400,
          "Check out of your event to create a server-timed hours submission.",
        );
      }
      const hoursRoute = path.match(/^\/api\/hours\/([^/]+)$/);
      if (hoursRoute && method === "PATCH") {
        requireRole(user, "nonprofit");
        const h = one("SELECT * FROM hours WHERE id=?", hoursRoute[1]);
        if (!h) fail(404, "Hours not found.");
        const a = ownedApplication(user, h.application_id),
          r = one("SELECT * FROM attendance WHERE application_id=?", a.id),
          b = await body(req);
        if (!["approved", "needs_corrections"].includes(b.status))
          fail(400, "Choose approved or needs_corrections.");
        if (
          b.status === "approved" &&
          (a.status !== "approved" ||
            r?.status !== "present" ||
            !r.checked_out ||
            clock() < Date.parse(a.starts_at) + a.event_hours * 3600000 ||
            h.hours > (r.checked_out - r.checked_in) / 3600000)
        )
          fail(
            400,
            "Completed, verified attendance is required before approving timed hours.",
          );
        if (b.status === "needs_corrections" && !text(b.correctionNote, 500))
          fail(400, "Provide a correction note.");
        run(
          "UPDATE hours SET status=?,correction_note=? WHERE id=?",
          b.status,
          b.correctionNote || "",
          h.id,
        );
        return send({ id: h.id, status: b.status });
      }
      if (path === "/api/reports/school" && method === "GET") {
        requireRole(user, "school_admin");
        const school = one("SELECT * FROM schools WHERE id=?", user.school_id);
        return send({
          school,
          students: q(
            "SELECT users.id,users.name,COALESCE(SUM(CASE WHEN hours.status='approved' THEN hours.hours ELSE 0 END),0) AS approvedHours FROM users LEFT JOIN applications ON applications.student_id=users.id LEFT JOIN hours ON hours.application_id=applications.id WHERE users.school_id=? AND users.role='student' GROUP BY users.id",
            user.school_id,
          ),
        });
      }
      if (path === "/api/notifications" && method === "GET") {
        requireRole(user, "student");
        return send({
          notifications: q(
            "SELECT id,message,created_at,status FROM outbox WHERE student_id=?",
            user.id,
          ),
        });
      }
      if (path === "/api/notifications" && method === "POST") {
        requireRole(user, "nonprofit");
        const b = await body(req),
          e = ownedEvent(user, b.eventId);
        if (!text(b.message, 2000)) fail(400, "Enter an update.");
        const apps = q(
          "SELECT student_id FROM applications WHERE event_id=? AND status IN ('pending','approved')",
          e.id,
        );
        for (const a of apps)
          run(
            "INSERT INTO outbox VALUES(?,?,?,?,?,?)",
            randomUUID(),
            a.student_id,
            e.id,
            b.message.trim(),
            new Date(clock()).toISOString(),
            "queued",
          );
        return send(
          {
            queued: apps.length,
            delivery: "in-app outbox only; no email or SMS sent",
          },
          201,
        );
      }

      if (path === "/api/nonprofit/plans" && method === "POST") {
        requireRole(user, "nonprofit");
        const b = await body(req);
        if (
          (b.organizationId && b.organizationId !== user.organization_id) ||
          !text(b.transcript, 25000)
        )
          fail(400, "Provide meeting notes for your organization.");
        return send(
          await generateMeetingPlan({
            organizationId: user.organization_id,
            transcript: b.transcript,
          }),
        );
      }
      if (path === "/api/nonprofit/reports" && method === "POST") {
        requireRole(user, "nonprofit");
        const b = await body(req);
        if (b.organizationId && b.organizationId !== user.organization_id)
          fail(403, "Organization does not match your account.");
        const report = scopedImpactReport(db, user.organization_id, {
          month: b.month ?? "",
          eventId: b.eventId ?? "",
        });
        return send(
          await generateImpactSummary({
            organizationId: user.organization_id,
            report,
          }),
        );
      }
      if (path === "/api/maps/nearby" && method === "GET") {
        const u = new URL(req.url, "http://local"),
          lat = Number(u.searchParams.get("lat")),
          lon = Number(u.searchParams.get("lon")),
          radius = Number(u.searchParams.get("radius") || 25);
        if (
          !u.searchParams.has("lat") ||
          !u.searchParams.has("lon") ||
          !finite(lat, -90, 90) ||
          !finite(lon, -180, 180) ||
          !finite(radius, 1, 500)
        )
          fail(
            400,
            "Provide latitude, longitude and a radius between 1 and 500 km.",
          );
        const events = nearbyEvents(
          q(
            "SELECT * FROM events WHERE status='published' AND lat IS NOT NULL AND lon IS NOT NULL",
          ).map((e) => ({
            ...eventView(e),
            latitude: e.lat,
            longitude: e.lon,
          })),
          { latitude: lat, longitude: lon, radiusKm: radius },
        );
        return send({ events, radiusKm: radius });
      }
      fail(404, "Route not found.");
    } catch (e) {
      if (!res.headersSent)
        send(
          {
            error: e.status ? e.message : "The request could not be completed.",
          },
          e.status || 500,
        );
      else res.end();
    }
  });
  return {
    server,
    db,
    close: () =>
      new Promise((resolve) =>
        server.close(() => {
          db.close();
          resolve();
        }),
      ),
  };
}
