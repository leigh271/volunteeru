// Fictional fixture adapter. This module never writes authenticated server records.
export const DEMO_KEY = "volunteeru.herwell.v1";
export const prefixed = (id) => `herwell:${id}`;
export const programMap = {
  "Period health": "Period Care & Menstrual Equity",
  "Cancer support": "Cancer Support",
  "Maternal health": "Maternal & Postpartum Health",
  "Mental health": "Mental Health & Emotional Wellness",
};
export function metrics(d, eventId = "") {
  const a = d.attendance.filter((r) => !eventId || r.event_id === eventId);
  const regs = d.registrations.filter(
    (r) => !eventId || r.event_id === eventId,
  );
  return {
    students: new Set(regs.map((r) => r.volunteer_id)).size,
    submissions: d.submissions.filter((r) => !eventId || r.event_id === eventId)
      .length,
    attended: a.filter((r) => r.attendance_status === "attended").length,
    noShows: a.filter((r) => r.attendance_status === "no_show").length,
    missing: a.filter((r) => r.review_status === "pending_missing_checkout")
      .length,
    pending: a.filter((r) => r.review_status === "pending_coordinator_review")
      .length,
    approvedHours:
      Math.round(
        a
          .filter((r) => r.review_status === "approved")
          .reduce((s, r) => s + (r.approved_hours ?? 0), 0) * 100,
      ) / 100,
    planned: d.events
      .filter((e) => !eventId || e.id === eventId)
      .reduce((s, e) => s + e.capacity, 0),
  };
}
export function filterProfiles(d, f = {}) {
  return d.profiles.filter((p) => {
    const reg = d.registrations.find((r) => r.volunteer_id === p.volunteer_id),
      event = d.events.find((e) => e.id === reg?.event_id);
    return (
      (!f.q ||
        `${p.name} ${p.school_name}`
          .toLowerCase()
          .includes(f.q.toLowerCase())) &&
      (!f.school || p.school_id === f.school) &&
      (!f.education || p.education_level === f.education) &&
      (!f.county || event?.county === f.county) &&
      (!f.interest || p.interests.includes(f.interest)) &&
      (!f.skill || p.skills.includes(f.skill)) &&
      (!f.availability || p.availability.includes(f.availability)) &&
      (!f.age || (f.age === "Under 18" ? p.age < 18 : p.age >= 18)) &&
      (!f.event || reg?.event_id === f.event) &&
      (!f.start || p.signup_at.slice(0, 10) >= f.start) &&
      (!f.end || p.signup_at.slice(0, 10) <= f.end)
    );
  });
}
export function studentRecord(p, d) {
  const e = d.events.find((e) =>
    d.registrations.some(
      (r) => r.volunteer_id === p.volunteer_id && r.event_id === e.id,
    ),
  );
  const s = d.schools.find((s) => s.school_id === p.school_id);
  return {
    id: prefixed(p.volunteer_id),
    name: p.name,
    school: p.school_name,
    age: p.age,
    interests: ["Women’s health"],
    womensHealth: p.interests.map((x) => programMap[x]).filter(Boolean),
    skills: p.skills,
    availability: ["Weekends"],
    locations: [e?.county || "Either county"],
    onboarded: true,
    isDemo: true,
    educationLevel: p.education_level,
    locationSource: "assigned_event_demo_default",
    guardianConsentStatus: p.guardian_consent_status,
    schoolConnection: {
      schoolId: prefixed(s.school_id),
      schoolName: s.school_name,
      isDemo: true,
      targetHours: Number(s.required_hours),
      capstone:
        s.capstone_review_required === "yes"
          ? "Separate school approval required"
          : "",
      serviceLearning: "",
    },
  };
}
export function mergeById(existing, incoming) {
  const m = new Map(existing.map((x) => [x.id, x]));
  incoming.forEach((x) => m.set(x.id, x));
  return [...m.values()];
}
export function bridgeRecords(
  d,
  existing,
  nonprofits,
  schoolRegistry,
  archive = [],
) {
  const org = d.organization;
  const events = d.events.map((e) => ({
    id: prefixed(e.id),
    organizationId: org.id,
    title: e.title,
    date: e.date,
    startsAt: e.shifts.map((s) => s.start).sort()[0],
    time: `${new Date(e.shifts.map((s) => s.start).sort()[0]).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })} – ${new Date(
      e.shifts
        .map((s) => s.end)
        .sort()
        .at(-1),
    ).toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
    })}`,
    hours:
      (Math.max(...e.shifts.map((s) => Date.parse(s.end))) -
        Math.min(...e.shifts.map((s) => Date.parse(s.start)))) /
      3600000,
    location: e.county,
    city: e.venue,
    cause: "Women’s health",
    skills: ["Events and hands-on help"],
    availability: "Weekends",
    minAge: 13,
    requirements:
      "Nonclinical support only. Guardian consent and adult supervision for minors. Required role training.",
    description:
      "Fictional HerWell hackathon event. November attendance is simulated future data.",
    capacity: e.capacity,
    volunteerTarget: e.capacity,
    status: e.status || "published",
    source: e.source,
    endsAt: e.shifts
      .map((s) => s.end)
      .sort()
      .at(-1),
    isDemo: true,
    training: [],
    prepMeetings: [],
    updates: [],
  }));
  const applicationId = (r) =>
    prefixed(r.volunteer_id + ":" + r.event_id + ":" + r.shift_id);
  const applications = d.registrations.map((r) => ({
    id: applicationId(r),
    studentId: prefixed(r.volunteer_id),
    opportunityId: prefixed(r.event_id),
    status: "approved",
    submittedAt: r.signup_at,
    interest: r.interest_categories,
    isDemo: true,
    studentSnapshot: studentRecord(
      d.profiles.find((p) => p.volunteer_id === r.volunteer_id),
      d,
    ),
    sourceTrainingStatus: r.training_status,
  }));
  const shifts = d.registrations.map((r) => ({
    id: prefixed("shift:" + r.volunteer_id + ":" + r.shift_id),
    studentId: prefixed(r.volunteer_id),
    applicationId: applicationId(r),
    eventId: prefixed(r.event_id),
    role: r.role,
    date: r.event_date,
    startsAt: r.scheduled_start,
    endsAt: r.scheduled_end,
    status: "confirmed",
    isDemo: true,
  }));
  const hours = d.attendance
    .filter(
      (r) => r.calculated_hours !== null && r.attendance_status !== "no_show",
    )
    .map((r) => ({
      id: prefixed("hours:" + r.attendance_id),
      studentId: prefixed(r.volunteer_id),
      applicationId: applicationId(r),
      eventId: prefixed(r.event_id),
      hours:
        r.review_status === "approved" ? r.approved_hours : r.calculated_hours,
      status: r.review_status === "approved" ? "approved" : "pending",
      date: r.scheduled_start.slice(0, 10),
      description: "Simulated actual shift time, less unpaid breaks.",
      isDemo: true,
    }));
  const attendanceRecords = d.attendance.map((r) => ({
    id: prefixed(r.attendance_id),
    studentId: prefixed(r.volunteer_id),
    applicationId: applicationId(r),
    eventId: prefixed(r.event_id),
    status: r.attendance_status === "attended" ? "present" : "absent",
    isDemo: true,
  }));
  const eventDayRecords = d.attendance
    .filter((r) => r.actual_check_in)
    .map((r) => ({
      id: prefixed("day:" + r.attendance_id),
      studentId: prefixed(r.volunteer_id),
      applicationId: applicationId(r),
      eventId: prefixed(r.event_id),
      checkInAt: r.actual_check_in,
      checkOutAt: r.actual_check_out || null,
      calculatedHours: r.calculated_hours,
      unpaidBreakMinutes: r.unpaid_break_minutes,
      isDemo: true,
    }));
  const profiles = d.profiles.map((p) => ({
    student: studentRecord(p, d),
    saved: [],
  }));
  const schools = d.schools.map((s) => ({
    id: prefixed(s.school_id),
    name: s.school_name,
    adminName: s.school_contact_name,
    adminEmail: s.school_contact_email,
    requiredHours: Number(s.required_hours),
    verificationDeadline: s.verification_deadline,
    fixtureId: "herwell",
    invitationCode: s.invitation_code,
    capstone:
      s.capstone_review_required === "yes"
        ? "School review required; event attendance alone does not complete a capstone."
        : "",
    serviceLearning: "",
    isDemo: true,
    students: d.profiles
      .filter((p) => p.school_id === s.school_id)
      .map((p) => ({
        id: prefixed(p.volunteer_id),
        name: p.name,
        applications: 1,
        hours:
          Math.round(
            d.attendance
              .filter(
                (a) =>
                  a.volunteer_id === p.volunteer_id &&
                  a.review_status === "approved",
              )
              .reduce((n, a) => n + (a.approved_hours || 0), 0) * 100,
          ) / 100,
        updatedAt: p.signup_at,
      })),
  }));
  const shared = { ...existing };
  for (const [key, values] of Object.entries({
    applications,
    shifts,
    hours,
    attendanceRecords,
    eventDayRecords,
  }))
    shared[key] = mergeById(existing[key] || [], values);
  return {
    shared,
    nonprofits: {
      ...nonprofits,
      version: 1,
      activeId: org.id,
      organizations: mergeById(nonprofits.organizations || [], [
        { ...org, isDemo: true },
      ]),
      events: mergeById(nonprofits.events || [], events),
    },
    schools: {
      ...schoolRegistry,
      version: 1,
      activeId: schoolRegistry.activeId || schools[0].id,
      schools: mergeById(schoolRegistry.schools || [], schools),
    },
    archive: [
      ...archive.filter(
        (a) => !profiles.some((p) => p.student.id === a.student.id),
      ),
      ...profiles,
    ],
  };
}
export function csvText(headers, rows) {
  const cell = (v) => {
    let s = String(v ?? "");
    if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" + [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n")
  );
}
export function approveAttendance(
  d,
  id,
  checkout,
  breakMinutes,
  reason,
  reviewedAt = new Date().toISOString(),
) {
  const a = d.attendance.find((a) => a.attendance_id === id);
  if (!a || a.attendance_status !== "attended" || !a.actual_check_in)
    throw Error("Only attended records with a check-in can be reviewed.");
  const breaks = Number(breakMinutes),
    start = Date.parse(a.actual_check_in),
    end = Date.parse(checkout);
  if (
    !String(reason || "").trim() ||
    !Number.isInteger(breaks) ||
    breaks < 0 ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end < start ||
    end > Date.parse(a.scheduled_end) ||
    start < Date.parse(a.scheduled_start)
  )
    throw Error(
      "Verify the actual shift times, break minutes, and review reason.",
    );
  const minutes = (end - start) / 60000 - breaks;
  if (minutes < 0) throw Error("Unpaid breaks exceed the attendance interval.");
  const before = structuredClone(a);
  Object.assign(a, {
    actual_check_out: checkout,
    unpaid_break_minutes: breaks,
    calculated_hours: Math.round((minutes / 60) * 100) / 100,
    review_status: "approved",
    reviewed_by: "Local demo coordinator",
    reviewed_at: reviewedAt,
    follow_up_note: reason.trim(),
  });
  a.approved_hours = a.calculated_hours;
  d.audit = d.audit || [];
  d.audit.push({
    action: "hours.approved",
    id,
    reason: reason.trim(),
    note: reason.trim(),
    before,
    actor: "Local demo coordinator",
    reviewedAt,
  });
  return a;
}
