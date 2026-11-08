# Maya Chen reference and HerWell coordinator alignment

Compared on November 8, 2026 against GitHub `main` commit `56883d200ad1612761d80fe246d5e1b35d73feef` ("Unify homepage and dashboards with VolunteerU purple branding"). The local working branch originally started from `68759973e51f56edf883373a9a54f1db2f84d386`.

## Where Maya is

Maya Chen is the fictional student in the repository's isolated **presentation demo**, not an additional real account in the authenticated database. The reference lives in `src/presentation-demo.js`, with shared styling in `src/presentation.css`. Open `/demo.html?role=student`; use the role switcher to see the related nonprofit and school screens.

Upstream reference: https://github.com/leigh271/volunteeru/blob/56883d200ad1612761d80fe246d5e1b35d73feef/src/presentation-demo.js

## What is aligned here

- The nonprofit sidebar now has exactly **Command Center, Events, Reporting**. There is one consistent active highlight for contextual/legacy pages.
- Command Center is the nonprofit landing page. Event setup and planning stay in Events; the five-step guided workflow stays in Command Center.
- Directory, demo guide, Maya's reference, and account/connections are in a compact **Workspace tools** dropdown, preserving access without adding sidebar entries.
- Reporting groups event impact and school participation into tabs instead of separate navigation destinations.
- The coordinator UI uses the reference's purple `#7454df`, lavender `#f3efff`, dark text `#292a38`, muted text `#777281`, and border `#eeedf2`, with Manrope headings, DM Sans body text, consistent icons, rounded cards, and quieter surfaces.
- The intact upstream presentation demo, public-home component, photos, presentation styles, and multi-page build entry were imported. Existing local command center, mock-data adapters, and attendance rules are retained. A blanket Git merge was not performed.
- The public entry screen now reuses the latest photo-led homepage and links to the presentation accounts. `/?home=1` explicitly opens it.

## Differences that still matter

| Area             | Maya's GitHub demo                                                                       | HerWell working app                                                                                                     | What to add next                                                                                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scenario         | Maya, Flowers for Women, Broward Community High; four roster students                    | 100 students, ten schools, two HerWell events                                                                           | Keep datasets separate; provide a named scenario selector if both need one shared demo tour.                                                                                                     |
| Hour lifecycle   | Submitted → nonprofit verified → school accepted                                         | HerWell records distinguish calculated/pending and nonprofit-approved hours; school totals currently use approved hours | Add a separate school-acceptance record, reviewer, date, and reason. Preserve nonprofit verification; do not relabel it as school acceptance.                                                    |
| Student growth   | Starts at 26 of 40 school-accepted hours; school acceptance of four hours moves it to 30 | Uses nonprofit-approved hours against the connected school's target                                                     | Decide whether school-linked growth should use school-accepted hours, then derive the visual from that record stage. Keep community volunteers' organization approvals separate.                 |
| Persistence      | `sessionStorage` presentation state; resets independently                                | Browser-local canonical fixture plus shared profile/event/school stores; separate authenticated SQLite workspace        | Connect coordinator screens to authenticated scoped APIs. Migrate only reviewed, permissioned records; never silently promote demo fixtures.                                                     |
| Roster decisions | A small staged presentation interaction                                                  | Training/consent checks, explicit event-day roster review, and staffing-gap note                                        | Persist the newer roster decision as a server record and expose the same canonical status to student and school views. Source signup confirmation is currently distinct from event-day approval. |
| Outreach         | Presentation message previews, no external sending                                       | Channel links, template drafts, and manual records of external sharing                                                  | Connect approved delivery providers and record consent, delivery status, replies, and opt-outs before automating follow-up.                                                                      |
| AI               | No live model calls in the presentation scenario                                         | Template preview and deterministic registration checks; existing optional server provider interface                     | Configure OpenAI server-side and add reviewed outreach actions. Counts and duplicate checks should stay deterministic.                                                                           |
| Attendance       | A guided four-hour sample verification                                                   | Check-in/check-out evidence, breaks, missing-time reviews, and audit trail                                              | Connect the new coordinator/student preview to the existing authenticated attendance endpoints.                                                                                                  |

## Recommended sequence

1. **Unify the hour statuses.** Add school acceptance after nonprofit verification, including review history and separate totals. This is the largest behavioral difference.
2. **Connect the records.** Back the coordinator screens with the existing authenticated organization/student/school API, including roster readiness and decisions.
3. **Enable outreach.** Connect delivery and response tracking, then add OpenAI-assisted drafts and approved automation.

Current build scope is navigation and visual alignment. These next steps are documented requirements, not claims of completed integrations. Source datasets and school/organization identities have not been merged, and the local changes have not been pushed to GitHub.
