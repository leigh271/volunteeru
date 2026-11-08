// Only database-derived aggregate records reach the optional report provider.
export function scopedImpactReport(
  db,
  organizationId,
  { month = "", eventId = "" } = {},
) {
  const bad = (message) => {
    throw Object.assign(new Error(message), { status: 400 });
  };
  if (
    typeof month !== "string" ||
    (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
  )
    bad("Choose a valid report month.");
  if (typeof eventId !== "string" || eventId.length > 100)
    bad("Choose a valid report event.");
  const events = db
    .prepare(
      "SELECT id,title,date,status FROM events WHERE organization_id=? AND (?='' OR substr(date,1,7)=?) AND (?='' OR id=?)",
    )
    .all(organizationId, month, month, eventId, eventId);
  if (eventId && !events.length)
    bad("The selected event is not available in this organization and month.");
  const eventIds = new Set(events.map((e) => e.id));
  const applications = db
    .prepare(
      "SELECT applications.id,applications.event_id,applications.status FROM applications JOIN events ON events.id=applications.event_id WHERE events.organization_id=?",
    )
    .all(organizationId)
    .filter((a) => eventIds.has(a.event_id));
  const approvedIds = new Set(
    applications.filter((a) => a.status === "approved").map((a) => a.id),
  );
  const hours = db
    .prepare(
      "SELECT hours.id,hours.application_id,hours.hours FROM hours JOIN applications ON applications.id=hours.application_id JOIN events ON events.id=applications.event_id WHERE events.organization_id=? AND hours.status='approved' AND applications.status='approved'",
    )
    .all(organizationId)
    .filter((h) => approvedIds.has(h.application_id));
  return {
    filters: { month, eventId },
    sourceRecordIds: [
      ...eventIds,
      ...applications.map((a) => a.id),
      ...hours.map((h) => h.id),
    ],
    events,
    totals: {
      events: events.length,
      applications: applications.length,
      approvedRegistrations: approvedIds.size,
      approvedHours: hours.reduce((sum, h) => sum + h.hours, 0),
    },
    approvedHours: hours.reduce((sum, h) => sum + h.hours, 0),
  };
}
