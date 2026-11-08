import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  workflowSteps,
  eventPeople,
  eventWorkflow,
  saveEventWorkflow,
  preparationTasks,
  reviewVolunteer,
  recruitmentSummary,
  completion,
  invitationText,
  followupText,
  outreachChannels,
} from "../src/command-center-model.js";
const source = JSON.parse(
  readFileSync(new URL("../public/herwell-demo/dataset.json", import.meta.url)),
);
test("guided workflow separates preparation, invitations, roster, arrival and departure", () => {
  assert.deepEqual(workflowSteps, [
    "Prepare",
    "Invite",
    "Registration & training",
    "Check in",
    "Check out",
  ]);
  assert.equal(preparationTasks(source, "E001").length, 7);
  assert.equal(eventPeople(source, "E001").length, 60);
});
test("source confirmation does not invent training clearance or coordinator approval", () => {
  const people = eventPeople(source, "E001");
  assert.equal(people.filter((p) => p.trained).length, 20);
  assert.equal(people.filter((p) => p.decision === "approved").length, 0);
  assert.equal(people.filter((p) => p.decision === "pending").length, 60);
});
test("approval requires completed training and guardian consent", () => {
  const d = structuredClone(source);
  assert.throws(
    () => reviewVolunteer(d, "E001", "VOL005", "approved"),
    /Training/,
  );
  reviewVolunteer(d, "E001", "VOL001", "approved");
  assert.equal(
    eventPeople(d, "E001").find((p) => p.profile.volunteer_id === "VOL001")
      .decision,
    "approved",
  );
  d.profiles.find((p) => p.volunteer_id === "VOL002").guardian_consent_status =
    "pending";
  assert.throws(
    () => reviewVolunteer(d, "E001", "VOL002", "approved"),
    /consent/,
  );
  assert.throws(
    () => reviewVolunteer(d, "E001", "VOL100", "approved"),
    /not registered/,
  );
});
test("step navigation never marks incomplete preparation or outreach complete", () => {
  const d = structuredClone(source);
  saveEventWorkflow(d, "E001", { stage: 3 });
  assert.equal(eventWorkflow(d, "E001").stage, 3);
  assert.deepEqual(completion(d, "E001"), [false, false, false, false, false]);
  assert.equal(eventWorkflow(d, "E002").stage, 0);
});
test("completion is based on tasks, sharing confirmations and reviewed roster", () => {
  const d = structuredClone(source);
  preparationTasks(d, "E001").forEach((t) => (t.status = "completed"));
  saveEventWorkflow(d, "E001", {
    channels: Object.fromEntries(
      outreachChannels.map((c) => [c, { status: "recorded_shared" }]),
    ),
  });
  reviewVolunteer(d, "E001", "VOL001", "approved");
  saveEventWorkflow(d, "E001", { finalized: true });
  assert.deepEqual(completion(d, "E001").slice(0, 3), [true, true, true]);
  saveEventWorkflow(d, "E001", { checkoutClosed: true });
  assert.equal(completion(d, "E001")[4], false);
});
test("registration assistant counts records and duplicate emails without inventing replies", () => {
  assert.deepEqual(recruitmentSummary(source, "E001"), {
    submissions: 69,
    people: 60,
    duplicates: 9,
    confirmed: 60,
  });
  assert.deepEqual(recruitmentSummary(source, "E002"), {
    submissions: 43,
    people: 40,
    duplicates: 3,
    confirmed: 40,
  });
});
test("outreach and followup drafts preserve human review and correct branding", () => {
  const e = source.events[0],
    p = source.profiles[0];
  assert.match(invitationText(source, e).body, /Flowers for Women/);
  assert.match(followupText("checkout", p, e).body, /coordinator will review/);
  assert.match(followupText("not_selected", p, e).body, /future opportunities/);
  assert.equal(source.outreachDrafts, undefined);
});

test("a roster change requires finalization to be reviewed again", () => {
  const d = structuredClone(source);
  reviewVolunteer(d, "E001", "VOL001", "approved");
  saveEventWorkflow(d, "E001", { finalized: true });
  reviewVolunteer(d, "E001", "VOL002", "approved");
  assert.equal(eventWorkflow(d, "E001").finalized, false);
});
