import {
  eventPeople,
  eventWorkflow,
  saveEventWorkflow,
  invitationText,
  outreachChannels,
} from "./command-center-model.js";
export function campaign(d, eventId) {
  return eventWorkflow(d, eventId).campaign || null;
}
export function createDemoInvitation(d, eventId, origin) {
  const e = d.events.find((e) => e.id === eventId);
  if (!e) throw Error("Event not found.");
  const old = campaign(d, eventId);
  const registered = eventPeople(d, eventId);
  const ids = new Set(registered.map((p) => p.profile.volunteer_id));
  const prospective = d.profiles
    .filter((p) => !ids.has(p.volunteer_id))
    .slice(0, 8);
  const audience = old?.audience || [
    ...registered.map((p) => ({
      personId: p.profile.volunteer_id,
      response: "yes",
      source: "existing registration",
    })),
    ...prospective.map((p) => ({
      personId: p.volunteer_id,
      response: "waiting",
      source: "simulated invitation",
    })),
  ];
  const url = `${origin}/?view=student&outreach=${encodeURIComponent(eventId)}&signup=1`;
  const text = invitationText(d, e);
  const next = {
    ...old,
    subject: text.subject,
    body: text.body + `\n\nRegister here: ${url}`,
    signupUrl: url,
    audience,
    generatedAt: new Date().toISOString(),
    generation: "simulated-template",
  };
  saveEventWorkflow(d, eventId, { campaign: next });
  return next;
}
export function responseCounts(d, eventId) {
  const c = campaign(d, eventId);
  if (!c)
    return {
      yes: eventPeople(d, eventId).length,
      waiting: 0,
      no: 0,
      remaining: Math.max(
        0,
        d.events.find((e) => e.id === eventId).capacity -
          eventPeople(d, eventId).length,
      ),
    };
  const yes = c.audience.filter((x) => x.response === "yes").length;
  return {
    yes,
    waiting: c.audience.filter((x) => x.response === "waiting").length,
    no: c.audience.filter((x) => x.response === "no").length,
    remaining: Math.max(
      0,
      d.events.find((e) => e.id === eventId).capacity - yes,
    ),
  };
}
function appendOutbox(d, record) {
  d.demoOutbox ||= [];
  d.demoOutbox.push({
    id: crypto.randomUUID(),
    simulated: true,
    createdAt: new Date().toISOString(),
    ...record,
  });
}
export function simulateBlast(d, eventId) {
  const c = campaign(d, eventId);
  if (!c) throw Error("Generate an invitation first.");
  const batch = crypto.randomUUID();
  for (const channel of outreachChannels)
    appendOutbox(d, {
      batch,
      eventId,
      kind: "invitation",
      channel,
      recipientIds: c.audience.map((x) => x.personId),
      subject: c.subject,
      body: c.body,
    });
  saveEventWorkflow(d, eventId, {
    campaign: {
      ...c,
      blastAt: new Date().toISOString(),
      channels: outreachChannels,
    },
  });
  return outreachChannels.length;
}
export function simulateInvitationReminder(d, eventId) {
  const c = campaign(d, eventId);
  if (!c?.blastAt) throw Error("Run the demo blast first.");
  const counts = responseCounts(d, eventId);
  if (!counts.remaining) throw Error("All volunteer places are filled.");
  const recipients = c.audience
    .filter((x) => x.response === "waiting")
    .map((x) => x.personId);
  if (!recipients.length) throw Error("Nobody is waiting to respond.");
  appendOutbox(d, {
    eventId,
    kind: "invitation-reminder",
    channel: "Email + text · simulated",
    recipientIds: recipients,
    subject: "There is still time to volunteer",
    body: c.body,
  });
  return recipients.length;
}
export function respondToDemoInvitation(d, eventId, personId, response) {
  if (!["yes", "no"].includes(response)) throw Error("Choose yes or no.");
  const c = campaign(d, eventId),
    recipient = c?.audience.find((x) => x.personId === personId),
    p = d.profiles.find((p) => p.volunteer_id === personId),
    e = d.events.find((e) => e.id === eventId);
  if (!recipient || !p || !e) throw Error("Choose an invited demo volunteer.");
  const existing = d.registrations.find(
    (r) => r.volunteer_id === personId && r.event_id === eventId,
  );
  if (existing && response === "no")
    throw Error(
      "This volunteer already has a registration. Contact the coordinator to change it.",
    );
  if (response === "yes" && !existing) {
    if (eventPeople(d, eventId).length >= e.capacity)
      throw Error("This event is full. Please contact the coordinator.");
    const shift = e.shifts[0];
    d.registrations.push({
      id: personId + ":" + eventId + ":" + shift.id,
      volunteer_id: personId,
      school_id: p.school_id,
      event_id: eventId,
      event_name: e.title,
      event_date: e.date,
      shift_id: shift.id,
      role: shift.role,
      program_category: shift.category,
      scheduled_start: shift.start,
      scheduled_end: shift.end,
      registration_status: "confirmed",
      signup_at: new Date().toISOString(),
      interest_categories: p.interests.join(";"),
      training_status: "pending",
      source: "interactive demo signup",
      submission_ids: [],
    });
    const w = eventWorkflow(d, eventId);
    saveEventWorkflow(d, eventId, {
      training: { ...w.training, [personId]: { status: "pending" } },
    });
  }
  recipient.response = response;
  recipient.respondedAt = new Date().toISOString();
  saveEventWorkflow(d, eventId, { campaign: c });
  return response;
}
export function createTrainingMessage(d, eventId, origin) {
  const e = d.events.find((e) => e.id === eventId),
    w = eventWorkflow(d, eventId),
    url = `${origin}/?view=student&training=${encodeURIComponent(eventId)}`;
  const deadline = w.trainingPlan?.deadline;
  const plan = {
    ...w.trainingPlan,
    subject: `Your next step for ${e.title}`,
    body: `Hello,\n\nThank you for accepting to volunteer at ${e.title} with Flowers for Women. Please complete the sample event orientation so our coordinator can review your readiness.\n\nStart training: ${url}${deadline ? "\nComplete it by: " + new Date(deadline).toLocaleString("en-US", { timeZone: "America/New_York" }) + " Eastern time." : ""}\n\nThank you for making time to help.\nFlowers for Women`,
    url,
    generation: "simulated-template",
    generatedAt: new Date().toISOString(),
  };
  saveEventWorkflow(d, eventId, { trainingPlan: plan });
  return plan;
}
export function simulateTrainingSend(d, eventId) {
  const w = eventWorkflow(d, eventId);
  if (!w.trainingPlan?.body) throw Error("Generate a training message first.");
  const ids = eventPeople(d, eventId)
    .filter((p) => !p.trained)
    .map((p) => p.profile.volunteer_id);
  appendOutbox(d, {
    eventId,
    kind: "training-welcome",
    channel: "Email · simulated",
    recipientIds: ids,
    subject: w.trainingPlan.subject,
    body: w.trainingPlan.body,
  });
  saveEventWorkflow(d, eventId, {
    trainingPlan: { ...w.trainingPlan, sentAt: new Date().toISOString() },
  });
  return ids.length;
}
export function markDemoTrainingComplete(d, eventId, personId) {
  if (!eventPeople(d, eventId).some((p) => p.profile.volunteer_id === personId))
    throw Error("Register for this event before training.");
  const w = eventWorkflow(d, eventId);
  saveEventWorkflow(d, eventId, {
    training: {
      ...w.training,
      [personId]: {
        status: "completed",
        completedAt: new Date().toISOString(),
        source: "sample orientation acknowledgment",
      },
    },
    finalized: false,
  });
  const r = d.registrations.find(
    (r) => r.event_id === eventId && r.volunteer_id === personId,
  );
  r.training_status = "completed";
}
export function processDemoTrainingReminder(d, eventId, now = Date.now()) {
  const w = eventWorkflow(d, eventId),
    plan = w.trainingPlan;
  if (
    !plan?.enabled ||
    !plan.sentAt ||
    !plan.reminderAt ||
    !plan.body ||
    now < Date.parse(plan.reminderAt) ||
    plan.reminderKey === plan.reminderAt
  )
    return 0;
  const ids = eventPeople(d, eventId)
    .filter((p) => !p.trained)
    .map((p) => p.profile.volunteer_id);
  if (ids.length)
    appendOutbox(d, {
      eventId,
      kind: "training-deadline-reminder",
      channel: "Email · simulated",
      recipientIds: ids,
      subject: "Reminder: your volunteer training is due",
      body: plan.body,
      dueAt: plan.reminderAt,
      processedAt: new Date(now).toISOString(),
    });
  saveEventWorkflow(d, eventId, {
    trainingPlan: {
      ...plan,
      reminderKey: plan.reminderAt,
      lastReminderCount: ids.length,
    },
  });
  return ids.length;
}
