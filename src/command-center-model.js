export const workflowSteps = [
  "Prepare",
  "Invite",
  "Registration & training",
  "Check in",
  "Check out",
];
export const outreachChannels = [
  "LinkedIn",
  "Eventbrite",
  "Blueboard",
  "Email",
  "Text",
];
export const eventTitle = (e) => e.title;
export function eventWorkflow(d, id) {
  return (
    d.commandWorkflow?.[id] || {
      stage: 0,
      finalized: false,
      decisions: {},
      channels: {},
      tasksReviewed: false,
    }
  );
}
export function saveEventWorkflow(d, id, patch) {
  d.commandWorkflow ||= {};
  d.commandWorkflow[id] = { ...eventWorkflow(d, id), ...patch };
  return d.commandWorkflow[id];
}
export function eventPeople(d, id) {
  const w = eventWorkflow(d, id);
  return d.registrations
    .filter((r) => r.event_id === id)
    .map((r) => {
      const profile = d.profiles.find((p) => p.volunteer_id === r.volunteer_id);
      const decision = w.decisions?.[profile.volunteer_id]?.status || "pending";
      const trained = w.training?.[profile.volunteer_id]?.status
        ? w.training[profile.volunteer_id].status === "completed"
        : profile.training_status === "completed";
      const consent =
        profile.age >= 18 || profile.guardian_consent_status === "recorded";
      return {
        profile,
        registration: r,
        decision,
        trained,
        eligible: trained && consent,
        consent,
      };
    });
}
export function preparationTasks(d, id) {
  return d.tasks.filter(
    (t) =>
      (!t.event_id || t.event_id === id) &&
      !/campaign|confirmations|onboarding information|reminders|publish.*shifts|feedback|school verification/i.test(
        t.title,
      ),
  );
}
export function reviewVolunteer(d, eventId, id, status, note = "") {
  const p = eventPeople(d, eventId).find((p) => p.profile.volunteer_id === id);
  if (!p) throw Error("Volunteer is not registered for this event.");
  if (!["approved", "not_selected"].includes(status))
    throw Error("Invalid review decision.");
  if (status === "approved" && !p.eligible)
    throw Error(
      "Training and required guardian consent must be complete before approval.",
    );
  const w = eventWorkflow(d, eventId);
  saveEventWorkflow(d, eventId, {
    finalized: false,
    decisions: {
      ...w.decisions,
      [id]: { status, note, reviewedAt: new Date().toISOString() },
    },
  });
  d.audit ||= [];
  d.audit.push({
    action: "roster." + status,
    id,
    eventId,
    note,
    actor: "Local demo coordinator",
    reviewedAt: new Date().toISOString(),
  });
}
export function recruitmentSummary(d, eventId) {
  const submissions = d.submissions.filter((s) => s.event_id === eventId);
  const identities = new Set(
    submissions.map((s) => s.email?.trim().toLowerCase() || s.volunteer_id),
  );
  return {
    submissions: submissions.length,
    people: new Set(
      d.registrations
        .filter((r) => r.event_id === eventId)
        .map((r) => r.volunteer_id),
    ).size,
    duplicates: Math.max(0, submissions.length - identities.size),
    confirmed: d.registrations.filter(
      (r) => r.event_id === eventId && r.registration_status === "confirmed",
    ).length,
  };
}
export function completion(d, eventId) {
  const e = d.events.find((e) => e.id === eventId),
    w = eventWorkflow(d, eventId),
    tasks = preparationTasks(d, eventId),
    people = eventPeople(d, eventId);
  const a = d.attendance.filter(
    (a) => a.event_id === eventId && a.actual_check_in,
  );
  return [
    tasks.length > 0 && tasks.every((t) => t.status === "completed"),
    outreachChannels.every(
      (c) =>
        w.channels?.[c]?.status === "recorded_shared" ||
        Boolean(w.campaign?.blastAt),
    ),
    Boolean(w.finalized) && people.some((p) => p.decision === "approved"),
    Boolean(w.checkinClosed),
    Boolean(w.checkoutClosed) && a.every((a) => Boolean(a.actual_check_out)),
  ];
}
export function invitationText(d, e, channel = "Email") {
  return {
    subject: `Volunteer with Flowers for Women · ${e.date}`,
    body: `Hello,\n\nJoin Flowers for Women for ${eventTitle(e)} on ${e.date} at ${e.venue} in ${e.county}. We are looking for ${e.capacity} volunteers to help with ${e.shifts.map((s) => s.role.toLowerCase()).join(", ")}.\n\nPlease register, choose your available shift, and complete the required training. We will review your registration and confirm your place.\n\nVolunteerU keeps your event details and check-in information in one place.\n\nThank you,\nFlowers for Women`,
    channel,
  };
}
export function followupText(kind, p, e) {
  const first = p.name.split(" ")[0];
  if (kind === "not_selected")
    return {
      subject: "Thank you for your interest in volunteering",
      body: `Hi ${first},\n\nThank you for your interest in ${eventTitle(e)}. We have decided to move forward with our confirmed team for this event. We appreciate your willingness to help and hope to stay in touch about future opportunities.\n\nFlowers for Women`,
    };
  if (kind === "checkout")
    return {
      subject: "Help us confirm your volunteer check-out time",
      body: `Hi ${first},\n\nThank you for helping at ${eventTitle(e)}. We have your check-in, but your check-out time is missing. Please reply with the time you believe you left and any unpaid breaks. A coordinator will review your reply before updating or approving your hours.\n\nFlowers for Women`,
    };
  return {
    subject: "One more step before your volunteer event",
    body: `Hi ${first},\n\nThank you for registering for ${eventTitle(e)}. Please complete your required training and confirm your attendance so we can finish reviewing your place on the team.\n\nFlowers for Women`,
  };
}
