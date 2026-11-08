// One shared definition for Maya's upcoming shift and the coordinator workspace.
export const FLOWERS_NAME = "Flowers for Women";
export const MAYA_EVENT = {
  id: "FFW-CWD-2026-11-21",
  title: "Community Wellness Day",
  date: "2026-11-21",
  start: "2026-11-21T10:00:00-05:00",
  end: "2026-11-21T12:00:00-05:00",
  hours: 2,
  time: "10 AM–12 PM",
  city: "Fort Lauderdale",
  county: "Broward",
  capacity: 8,
  volunteers: [
    { id: "MAYA-CHEN", name: "Maya Chen" },
    { id: "JORDAN-JAMES", name: "Jordan James" },
    { id: "ANA-RAMIREZ", name: "Ana Ramirez" },
    { id: "KAI-THOMPSON", name: "Kai Thompson" },
  ],
};
export function linkFlowersEvent(d) {
  if (d.flowersEventVersion === 2 && d.organization.name === FLOWERS_NAME)
    return false;
  d.organization.name = FLOWERS_NAME;
  const e = MAYA_EVENT,
    schoolId = "FFW-BROWARD-HIGH",
    shiftId = e.id + "-S01";
  if (!d.schools.some((s) => s.school_id === schoolId))
    d.schools.push({
      school_id: schoolId,
      school_name: "Broward Community High",
      school_type: "High school",
      school_contact_name: "Demo school coordinator",
      school_contact_email: "",
      required_hours: "40",
      verification_deadline: "2026-12-18",
      capstone_review_required: "no",
      account_status: "active",
      invitation_code: "",
      unique_students: "4",
      source: "Maya presentation scenario",
    });
  if (!d.events.some((x) => x.id === e.id))
    d.events.push({
      id: e.id,
      title: e.title,
      date: e.date,
      county: e.county,
      venue: e.city,
      capacity: e.capacity,
      source: "Maya presentation scenario",
      shifts: [
        {
          id: shiftId,
          role: "Event support",
          category: "All categories",
          start: e.start,
          end: e.end,
          capacity: e.capacity,
        },
      ],
    });
  for (const person of e.volunteers) {
    if (!d.profiles.some((p) => p.volunteer_id === person.id))
      d.profiles.push({
        volunteer_id: person.id,
        name: person.name,
        first_name: person.name.split(" ")[0],
        last_name: person.name.split(" ").slice(1).join(" "),
        email: "",
        school_id: schoolId,
        school_name: "Broward Community High",
        education_level: "High school",
        age: null,
        experience_goal: "Service hours",
        required_hours: "40",
        hours_deadline: "2026-12-18",
        available_days: "Not supplied",
        available_start_time: "",
        available_end_time: "",
        availability_timezone: "America/New_York",
        interests: [],
        skills: [],
        availability: [],
        guardian_consent_status: "not supplied",
        training_status: "not supplied",
        preferred_role: "Event support",
        signup_at: "2026-11-08T12:00:00-05:00",
        source: "Maya presentation scenario",
        sources: [],
      });
    const registrationId = person.id + ":" + e.id + ":" + shiftId;
    if (!d.registrations.some((r) => r.id === registrationId))
      d.registrations.push({
        id: registrationId,
        volunteer_id: person.id,
        school_id: schoolId,
        event_id: e.id,
        event_name: e.title,
        event_date: e.date,
        shift_id: shiftId,
        role: "Event support",
        program_category: "All categories",
        scheduled_start: e.start,
        scheduled_end: e.end,
        registration_status: "confirmed",
        signup_at: "2026-11-08T12:00:00-05:00",
        interest_categories: "",
        training_status: "not supplied",
        source: "Maya presentation scenario",
        submission_ids: [],
      });
  }
  d.flowersEventVersion = 2;
  return true;
}
