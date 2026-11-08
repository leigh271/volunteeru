import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linkFlowersEvent, MAYA_EVENT } from "../src/flowers-event.js";
import {
  eventPeople,
  eventWorkflow,
  saveEventWorkflow,
} from "../src/command-center-model.js";
import {
  createDemoInvitation,
  responseCounts,
  simulateBlast,
  respondToDemoInvitation,
  simulateInvitationReminder,
  createTrainingMessage,
  simulateTrainingSend,
  markDemoTrainingComplete,
  processDemoTrainingReminder,
} from "../src/outreach-demo-model.js";
const load = () => {
  const d = JSON.parse(
    readFileSync(
      new URL("../public/herwell-demo/dataset.json", import.meta.url),
    ),
  );
  linkFlowersEvent(d);
  return d;
};
const id = MAYA_EVENT.id;
test("demo generation and five-channel blast preserve counts without inventing replies", () => {
  const d = load();
  createDemoInvitation(d, id, "http://localhost:5173");
  const before = responseCounts(d, id);
  assert.equal(before.yes, 4);
  assert.equal(before.waiting, 8);
  assert.equal(simulateBlast(d, id), 5);
  assert.deepEqual(responseCounts(d, id), before);
  assert.ok(d.demoOutbox.every((m) => m.simulated));
  assert.equal(new Set(d.demoOutbox.map((m) => m.channel)).size, 5);
});
test("a demo yes registers once and requires event-specific training", () => {
  const d = load();
  const c = createDemoInvitation(d, id, "http://localhost");
  const person = c.audience.find((p) => p.response === "waiting").personId;
  respondToDemoInvitation(d, id, person, "yes");
  respondToDemoInvitation(d, id, person, "yes");
  assert.equal(responseCounts(d, id).yes, 5);
  assert.equal(responseCounts(d, id).waiting, 7);
  assert.equal(
    d.registrations.filter(
      (r) => r.event_id === id && r.volunteer_id === person,
    ).length,
    1,
  );
  assert.equal(
    eventPeople(d, id).find((p) => p.profile.volunteer_id === person).trained,
    false,
  );
  assert.equal(d.attendance.filter((a) => a.event_id === id).length, 0);
});
test("invitation reminders target only unanswered people while places remain", () => {
  const d = load();
  const c = createDemoInvitation(d, id, "http://localhost");
  simulateBlast(d, id);
  respondToDemoInvitation(
    d,
    id,
    c.audience.find((p) => p.response === "waiting").personId,
    "yes",
  );
  assert.equal(simulateInvitationReminder(d, id), 7);
  assert.equal(d.demoOutbox.at(-1).kind, "invitation-reminder");
  assert.equal(d.demoOutbox.at(-1).recipientIds.length, 7);
});
test("deadline reminders exclude completed training and do not queue twice", () => {
  const d = load();
  createTrainingMessage(d, id, "http://localhost");
  const due = "2026-11-19T15:00:00.000Z";
  saveEventWorkflow(d, id, {
    trainingPlan: {
      ...eventWorkflow(d, id).trainingPlan,
      enabled: true,
      deadline: "2026-11-20T15:00:00.000Z",
      reminderAt: due,
    },
  });
  assert.equal(simulateTrainingSend(d, id), 4);
  markDemoTrainingComplete(d, id, "MAYA-CHEN");
  assert.equal(processDemoTrainingReminder(d, id, Date.parse(due) - 1), 0);
  assert.equal(processDemoTrainingReminder(d, id, Date.parse(due)), 3);
  assert.equal(processDemoTrainingReminder(d, id, Date.parse(due)), 0);
  const reminders = d.demoOutbox.filter(
    (m) => m.kind === "training-deadline-reminder",
  );
  assert.equal(reminders.length, 1);
  assert.ok(!reminders[0].recipientIds.includes("MAYA-CHEN"));
  assert.equal(
    eventPeople(d, id).find((p) => p.profile.volunteer_id === "MAYA-CHEN")
      .decision,
    "pending",
  );
});
test("uninvited responses and unregistered training cannot create records", () => {
  const d = load();
  createDemoInvitation(d, id, "http://localhost");
  assert.throws(() => respondToDemoInvitation(d, id, "unknown", "yes"));
  assert.throws(() => markDemoTrainingComplete(d, id, "unknown"));
  assert.equal(eventPeople(d, id).length, 4);
});
