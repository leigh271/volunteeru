import {
  emptyStudent,
  choices,
  opportunities,
  refreshOpportunities,
} from "./data.js";
export const STORAGE_KEY = "volunteeru.shared.v1";
const freshState = () => ({
  version: 1,
  student: structuredClone(emptyStudent),
  saved: [],
  applications: [],
  hours: [],
  trainingRecords: [],
  attendanceRecords: [],
  eventDayRecords: [],
  requirementSubmissions: [],
  shifts: [],
  readNotificationIds: [],
});

// A malformed or older browser record must not break the entire student app.
export function read() {
  const fallback = freshState();
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (
      !raw ||
      raw.version !== 1 ||
      !raw.student ||
      typeof raw.student !== "object"
    )
      return fallback;
    const student = { ...fallback.student, ...raw.student };
    for (const field of ["id", "name", "school"]) {
      if (typeof student[field] !== "string")
        student[field] = fallback.student[field];
    }
    for (const [field, options] of Object.entries(choices)) {
      student[field] = Array.isArray(student[field])
        ? [...new Set(student[field].filter((x) => options.includes(x)))]
        : [];
    }
    if (
      !student.schoolConnection ||
      typeof student.schoolConnection.schoolId !== "string" ||
      typeof student.schoolConnection.schoolName !== "string" ||
      typeof student.schoolConnection.isDemo !== "boolean"
    )
      student.schoolConnection = null;
    student.age =
      Number.isInteger(Number(student.age)) &&
      Number(student.age) >= 13 &&
      Number(student.age) <= 100
        ? Number(student.age)
        : "";
    student.onboarded = Boolean(
      student.onboarded &&
      student.name.trim() &&
      student.school.trim() &&
      student.age &&
      ["interests", "skills", "availability", "locations"].every(
        (field) => student[field].length,
      ),
    );
    return {
      version: 1,
      student,
      requirementSubmissions: Array.isArray(raw.requirementSubmissions)
        ? raw.requirementSubmissions.filter(
            (r) =>
              r &&
              typeof r.id === "string" &&
              typeof r.schoolId === "string" &&
              typeof r.studentId === "string" &&
              ["capstone", "serviceLearning"].includes(r.kind) &&
              typeof r.evidence === "string" &&
              ["pending", "approved", "needs_corrections"].includes(r.status),
          )
        : [],
      eventDayRecords: Array.isArray(raw.eventDayRecords)
        ? raw.eventDayRecords.filter(
            (r) =>
              r &&
              typeof r.id === "string" &&
              typeof r.studentId === "string" &&
              typeof r.applicationId === "string" &&
              typeof r.eventId === "string" &&
              Number.isFinite(Date.parse(r.checkInAt)),
          )
        : [],
      trainingRecords: Array.isArray(raw.trainingRecords)
        ? raw.trainingRecords.filter(
            (r) =>
              r &&
              typeof r.id === "string" &&
              typeof r.studentId === "string" &&
              typeof r.applicationId === "string" &&
              typeof r.trainingId === "string" &&
              ["read", "verified"].includes(r.status),
          )
        : [],
      attendanceRecords: Array.isArray(raw.attendanceRecords)
        ? raw.attendanceRecords.filter(
            (r) =>
              r &&
              typeof r.id === "string" &&
              typeof r.studentId === "string" &&
              typeof r.applicationId === "string" &&
              typeof r.eventId === "string" &&
              ["present", "absent"].includes(r.status),
          )
        : [],
      hours: Array.isArray(raw.hours)
        ? raw.hours.filter(
            (h) =>
              h && typeof h.id === "string" && typeof h.studentId === "string",
          )
        : [],
      shifts: Array.isArray(raw.shifts)
        ? raw.shifts.filter(
            (h) =>
              h && typeof h.id === "string" && typeof h.studentId === "string",
          )
        : [],
      readNotificationIds: Array.isArray(raw.readNotificationIds)
        ? raw.readNotificationIds.filter((id) => typeof id === "string")
        : [],
      saved: Array.isArray(raw.saved)
        ? [...new Set(raw.saved.filter((x) => typeof x === "string"))]
        : [],
      applications: Array.isArray(raw.applications)
        ? raw.applications.filter(
            (a) =>
              a &&
              typeof a.id === "string" &&
              typeof a.studentId === "string" &&
              typeof a.opportunityId === "string" &&
              typeof a.status === "string" &&
              !Number.isNaN(Date.parse(a.submittedAt)),
          )
        : [],
    };
  } catch {
    return fallback;
  }
}
export let state = read();
let lastSaved = structuredClone(state);
export function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    lastSaved = structuredClone(state);
    return true;
  } catch {
    state = structuredClone(lastSaved);
    alert(
      "Your browser could not save changes. Please enable local storage before continuing. Your last saved information is unchanged.",
    );
    return false;
  }
}
export function refresh() {
  state = read();
  lastSaved = structuredClone(state);
}
export function apply(opportunityId, interest) {
  // Re-read before writing so another tab's application is not duplicated.
  refresh();
  refreshOpportunities();
  const opportunity = opportunities.find((o) => o.id === opportunityId);
  if (
    !opportunity ||
    !state.student.onboarded ||
    state.student.age < opportunity.minAge ||
    (opportunity.publishedByNonprofit &&
      Date.parse(opportunity.startsAt) + Number(opportunity.hours) * 3600000 <=
        Date.now()) ||
    typeof interest !== "string" ||
    interest.trim().length < 10 ||
    interest.trim().length > 1000 ||
    state.applications.some(
      (a) =>
        a.studentId === state.student.id && a.opportunityId === opportunityId,
    )
  )
    return false;
  state.applications.push({
    id: crypto.randomUUID(),
    studentId: state.student.id,
    opportunityId,
    status: "pending",
    isDemo: opportunity.isDemo === true,
    opportunitySnapshot: structuredClone(opportunity),
    interest: interest.trim(),
    availabilityConfirmed: true,
    submittedAt: new Date().toISOString(),
    studentSnapshot: {
      name: state.student.name,
      school: state.student.school,
      age: state.student.age,
      schoolConnection: state.student.schoolConnection
        ? structuredClone(state.student.schoolConnection)
        : null,
    },
  });
  return persist();
}
