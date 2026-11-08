Platform: VolunteerU
Nonprofit organization: HerWell Community Alliance

HERWELL HACKATHON MOCK DATA GUIDE
All organizations, schools, names, emails, links, places, and records are fictional. Dates simulate a completed September–December 2026 cycle, including future November attendance. No actual integration or message sending has occurred. Domains ending in .example are deliberately nonfunctional.

FILES
01 and 02: plain-text meeting documents, ready for AI transcript ingestion. Speaker timestamps supply evidence for proposed tasks. The first is a board planning meeting; the second is an operations follow-up, both in September.
03: 112 raw signup submissions representing 100 unique students and 100 unique volunteer-event-shift registrations. Student profile fields repeat on duplicate submissions. This intentionally combines profiles and signup records for a compact demo.
04: 100 canonical attendance rows, including no-shows, not 112 raw submission rows. Join with 03 on volunteer_id plus event_id plus shift_id after deduplication.
05: ten school accounts with invitation codes, links, requirements, and student counts. Join on school_id. School counts are unique students, never raw submissions.

TIMELINE
September 10 board meeting; September 24 operations meeting; October 1–31 recruitment; November 14 E001 in Broward; November 21 E002 in Miami-Dade; December 4 review; December 11 planned school reporting; December 18 hours deadline.

DATA RULES
All times use America/New_York: October signup timestamps use -04:00, November event timestamps use -05:00. Available days and interest fields support semicolon-separated values. Availability windows are recurring local times, not UTC. For simplicity every student can attend the assigned Saturday shift; other profile attributes vary.
volunteer_id is the synthetic stable person ID. Normalize email by trim and lowercase to detect the 12 exact repeat identities; deduplicate registration on normalized email + event_id + shift_id. Do not merge different emails based on name. Repeated names across different people are intentional. For this fixture duplicates retain volunteer_id as a validation oracle; real incoming forms may not have it. Keep source history rather than discarding referral channels.
referral_channel tells where the invitation was encountered. registration_system is always VolunteerU central signup form: Eventbrite, Luma, LinkedIn, email, website, and school links are campaign sources only. No service scraping or live connectors are represented.
Education levels: 40 high school, 44 undergraduate, 16 graduate students. The ten entirely fictional school names do not describe actual institutions. Invitation tokens are demo values, not production security credentials. Graduate capstone exploration requires separate school review; one event does not fulfill a capstone or the full hour requirement.
Scheduled shifts reflect role capacity, not verified service. All 100 unique students hold one primary shift. Staffing need is 60 for E001 and 40 for E002; attendance is 20 and 15. The 35 percent turnout is a deliberately severe staffing shortfall for the demo, not a nonprofit benchmark.
Hours = (actual checkout - actual check-in - unpaid break) / 60, rounded to two decimals. Late arrival and early departure reduce hours. Blank calculated_hours means unknown, not zero. A no-show has no timestamps and zero hours. Missing checkout requires follow-up and blank hours. Complete time pairs may still await approval. Approved school totals include only review_status=approved, never planned hours or pending records.
Minor consent is recorded for all high school demo profiles. Clinical care, counseling, recipient health histories, and identifying family records are not part of volunteer assignments. Event concerns appear as anonymous examples in the transcript; no separate incident dataset was requested.
AI-generated tasks, assignments, reminders, and school reports need coordinator review before execution. Transcript commitments have owners and dates where stated; optional food and decoration quotes intentionally have neither. Do not infer approvals for unresolved items.

EXPECTED DASHBOARD COUNTS
{
  "raw_signup_submissions": 112,
  "unique_students": 100,
  "duplicate_submissions": 12,
  "planned_student_places": 100,
  "recruitment_target_unique_students": 150,
  "attended": 35,
  "no_shows": 65,
  "missing_checkout": 3,
  "pending_complete_time_pairs": 2,
  "approved_hours": 81.76
}
