# VolunteerU — Student experience

The supplied GitHub repository was empty. This implementation establishes a lightweight Vite + vanilla JavaScript application without changing any teammate code.

## Run

```sh
npm ci
npm run dev
npm run build
```

## Implemented

- Welcome and five-step onboarding: identity/age, interests, skills, availability, location.
- Multiple choices, back/next, progress, saved drafts, editable profile.
- Eligibility-filtered discovery ranked by interest, schedule, location, and skills, with cause/location filters.
- Pointer swipe right saves, swipe left skips; explicit buttons provide equivalent actions. Swiping never applies.
- Saved listings, details, prefilled application with availability confirmation and interest, duplicate prevention, application statuses.
- Responsive desktop/mobile navigation, semantic forms, keyboard focus, native dialogs and reduced-motion support.
- Local persistence across refresh and same-origin tab updates.

All opportunity listings and their organizations are explicitly fictional demo data. A separate research directory lists real potential organizations, without representing them as confirmed partners or available placements. No actual application is sent. No organizations are represented as partners. Dates are sample schedules, not confirmed openings.

## Team integration contract

`src/data.js` exports shared opportunity records. `src/store.js` owns the versioned `volunteeru.shared.v1` localStorage record:

- `student`: `id`, `name`, `school`, `age` (13–100), `interests[]`, `skills[]`, `availability[]`, `locations[]`, `onboarded`.
- `saved`: opportunity IDs belonging to this single-device student.
- `applications`: `id`, `studentId`, `opportunityId`, `status` (`pending`, `approved`, `rejected`), `interest`, `availabilityConfirmed`, `submittedAt`, `studentSnapshot` (name/school/age at submission).
- `opportunities`: `id`, `title`, `role`, `nonprofit`, `cause`, `location`, `city`, `date` (ISO date), `time`, `hours`, `minAge`, `skills[]`, `availability`, `description`, `requirements`, `website`, `publicContact`, `isDemo`, presentation fields.

Person 2 should replace demo opportunity reads with published opportunities and supply verified `website` (HTTP/HTTPS URL) and `publicContact` (public text) fields. The details screen already renders these fields safely when provided. Replace local application writes with an authenticated endpoint validating age, schedule, listing state, and a database unique constraint on `(studentId, opportunityId)`. Person 2 decisions update the same application's status; verified hours should be separate records keyed to application/student/opportunity. The existing application screen renders status from shared records, including updates from another browser tab.

Person 3 should reference these same stable student/application IDs for organization-wide reporting and verified hours. Person 1 now includes a browser-local school participation dashboard and student progress views; broader impact reports remain a separate integration.

Before real use: add authentication, server storage and authorization, student/school access rules, guardian-consent workflow where needed, and server-side eligibility and duplicate validation. Current data is browser-local, unencrypted, single-student demo storage; clearing site data removes it and it does not sync across devices. No shared backend details or credentials were provided to connect. Optional school, messaging, and student-update API adapters are implemented as described below.

## Verification

```sh
npx playwright install chromium
npm test
```

Tests cover complete onboarding, matching, save/reopen/remove and refresh persistence, details, application submission/status/duplicate prevention, profile editing, age filtering, empty filters, no horizontal overflow, and browser errors on desktop and mobile (mobile also requests reduced motion).

Tests start the development server automatically; no separate server terminal is needed. The GitHub Actions workflow runs formatting, the production build, and all desktop/mobile journey tests on pushes and pull requests. The expanded verification suite covers the original journey plus women’s health selections, potential organization links, school-code validation/confirmation, coordinator acknowledgment, and record-derived notifications.

## Handoff boundaries

This is the **Person 1 school and student portal demo**, ready for the team to connect to shared services. It includes school requirements, invitations, participation tracking, student progress, and mascot guidance. It is not a live volunteer placement service. Nonprofit administration and organization-wide reporting remain the responsibilities of Persons 2 and 3. A same-browser shared-record decision update is covered by the tests; decisions from another device require the team's backend.

The application validates persisted browser records, rolls failed writes back to the last saved state, and rechecks local duplicate/age rules at submission. These are client safeguards; they do not replace database uniqueness or authenticated server validation. `src/store.js` is the persistence boundary to replace when the team backend is available.

### Build and hosting

Use Node.js 22 or later. `npm run build` outputs a static site to `dist/`; serve that directory over HTTPS with any static host. `npm run preview` previews the production build locally. Vite's default configuration works on a root domain; if hosting at a subpath such as GitHub Pages, pass the matching base path to the build (`npm run build -- --base=/volunteeru/`). Publishing source code to GitHub does not by itself publish a live website.

## Women’s health interests and potential organizations

Choosing **Women’s health** adds one screen with exactly four multi-select cards in a 2×2 grid: Period Care & Menstrual Equity, Cancer Support, Maternal & Postpartum Health, and Mental Health & Emotional Wellness. Selections persist under `student.womensHealth[]` and can be edited through Profile. Existing saved opportunities, applications, and profile fields are preserved. Safety & Survivor Support and Health Access & Basic Needs are not separate categories.

The Discover directory links PERIOD. Miami, Gilda’s Club South Florida, Healthy Mothers, Healthy Babies Coalition of Broward County, and Lotus House. Directory entries are **potential organizations**, never confirmed partners or opportunity records. They have no Apply action. The PERIOD entry links the official national chapter directory at `https://period.org/chapters`; a Miami-specific official chapter website could not be verified. `periodmiami.org` currently redirects to a differently named organization, so that URL is deliberately not attributed to PERIOD. Miami. The other official links were checked successfully on November 7, 2026. Contact details and volunteer eligibility must be confirmed with the organization directly.

## Optional school connection

The signup identity screen and Profile both offer **Add school invitation code**. Students can skip it. In disconnected demo mode, `DEMO-BROWARD` validates against the fictional **VolunteerU Demo School — Broward**; other codes are rejected. Validation previews the school but does not connect anything. Explicit confirmation saves a separately labeled `student.schoolConnection: {schoolId, schoolName, isDemo}`. This demo membership does not share data with a real school. The self-reported school field remains separate from the confirmed connection.

## Backend adapter contract

The frontend remains a static app. Set `VITE_STUDENT_API_URL=/api` at build time only after the team implements the authenticated same-origin routes below. A hosting-provided `window.__VOLUNTEERU_API__` may also specify the same-origin base path before the app loads. This is a public URL setting, **not a place for credentials**. Blank configuration keeps integrations disconnected; `.env.example` documents this default. These endpoints are not implemented or deployed in this repository.

| Route                               | Request                                                             | Successful response                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `POST /school-invitations/validate` | `{code}`                                                            | `{valid:true, validationToken, schoolId, schoolName}`                                                       |
| `POST /school-invitations/confirm`  | `{validationToken}` after the student confirms the displayed school | `{connected:true, schoolId, schoolName}` matching the validated school                                      |
| `POST /opportunities/:id/messages`  | `{senderName, replyTo, message}`                                    | `{submitted:true, messageId}` **only after durable submission to the designated coordinator’s inbox/queue** |
| `GET /student/updates`              | Authenticated session; no caller-selected student identity          | `{studentId, applications:[], hours:[], shifts:[]}` scoped to the authenticated student                     |

Invitation validation must check validity, expiry, allowed school membership, and rate limits on the server. Confirmation tokens should be single-use, tied to the session and school, and checked again at confirmation. Server membership determines reporting access; localStorage is not proof of school membership. A real school connection is only recorded after the confirmation response matches the validated school.

Opportunity records may provide `designatedContact: {id, name}`. This must be a designated contact, not an email scraped from the potential-organization directory. The server resolves the recipient from the authenticated opportunity ID; the student cannot choose or override it. Implement authorization, validation, CSRF protections, message rate limits, and idempotent submission on the backend. Do not return success before submission is durably accepted. The form preserves its draft on failure and never treats `mailto:`, a local draft, an HTTP error, or an unacknowledged response as a successful send. Disconnected listings explain that messaging is unavailable and show an error rather than a success when Send is attempted.

## Notifications and shared events

The notification bell shows the unread count; the list supports individual and bulk read actions. Read IDs persist in `readNotificationIds[]` across refresh.

Notifications are derived from records, not hardcoded accepted/approved example messages:

- Matching eligible opportunity records generate recommendations explicitly labeled **not a placement**. New opportunity records receive new notification IDs.
- Applications with `approved`/`accepted` or `rejected`/`declined` produce the corresponding decision notice. Pending applications produce no decision notice.
- `shifts[]` records contain `{id, studentId, applicationId, status, startsAt, isDemo}`. A reminder requires `status:'confirmed'`, an approved/accepted application, and a start within the next 48 hours. A recommendation alone never generates a shift reminder.
- `hours[]` records contain `{id, studentId, applicationId, status, hours, correctionNote?, updatedAt?, isDemo}`. Only `approved` or `needs_corrections` produces an hours notice; records must reference that student’s application.

Application events use `{id, studentId, opportunityId, status, submittedAt, updatedAt?, isDemo}`. Any event tied to a demo application, listing, shift, or hours record is marked **DEMO** and cannot be presented as a real placement. Existing local demo applications are retained and remain labeled by their demo opportunity even if their legacy record lacks `isDemo`.

Same-origin storage changes refresh notifications, so Person 2 decision/hour updates to shared records are reflected. When configured, the authenticated update adapter runs after onboarding, on app startup/focus, and every minute while the page is visible. It merges validated records only when the feed student ID matches the current student. Failed refreshes preserve last-known records and never invent decisions. The backend must map the actual signed-in student to the shared student ID, supply canonical records, and connect opportunity/application creation before this becomes a live service. Person 3 can consume the same hours records. The student progress page and school participation dashboard show record-derived hours; mascot encouragement celebrates approved-hour milestones. These views do not constitute server-verified reporting.

## School and student portal demo

The existing student design is preserved. **School Portal** is accessible before student onboarding so a coordinator can create a demo school. Registration collects a school name, coordinator name and email, an authorization declaration, graduation hours, and optional capstone and service learning requirements. The declaration is self-reported; no administrator identity or school authorization is verified in this static demo. Use sample information.

Each demo school receives a unique `?school=<id>` registration link. A student reviews the school and requirements, then explicitly chooses **Join this school**. Joining fills the student's school and attaches the school connection. The link works only in the same browser origin where the school registry exists; sharing it to another device does not provision a school. Missing invitations display an unavailable message. The original optional invitation-code adapter remains supported.

School requirements can be edited and are read live by the student progress page. The school dashboard shows students who have completed onboarding, their application counts, approved volunteer hours, and graduation-hour progress. Switching schools removes the current student's stale entry from the previous demo school's roster. Applications and pending hours never count as completed hours. Capstone and service learning requirements are displayed as school instructions; this demo does not certify their completion.

**My Progress** groups registered events, training, volunteer hours, school requirements, and student work. The Sunny mascot provides onboarding guidance, reminders, encouragement, and approved-hour milestone messages. Recommendations use the existing transparent interest, skill, availability, location, and age rules; no external AI model is called. Additional fictional health listings cover period health, cancer support, maternal health, and mental health. These are demo opportunities, not real placements.

### Additional shared records and production integration

`volunteeru.schools.v1` is a separate browser-local school registry: `{version:1, activeId, schools:[]}`. A school record contains `{id, name, adminName, adminEmail, requiredHours, capstone, serviceLearning, isDemo:true, students:[]}`. Roster summaries contain `{id, name, hours, applications, updatedAt}` and are refreshed from the current browser's student/application/hour records. Selecting a demo school is a workspace convenience, not an authenticated session. The student's `schoolConnection` can include `{schoolId, schoolName, isDemo, targetHours, capstone, serviceLearning}`; the connected local school remains the source of current requirements.

Production must replace this registry with authenticated, tenant-scoped school endpoints and durable membership records. Verify administrator authorization, generate server-backed invitations with expiry and revocation, require student membership confirmation, and enforce school access rules on every request. Store requirements separately from student submissions and coordinator approvals. The backend must supply canonical nonprofit decisions, confirmed events, training completion, attendance, and approved hours; students must not be able to grant themselves verified hours. Existing API routes in the adapter contract do not implement school administration or these additional records.

## Nonprofit meeting planner prototype

The nonprofit workspace includes two clearly labeled mock monthly leadership meetings (October and November), local `.txt`/`.md` transcript import (maximum 100,000 bytes), a meeting draft, and an editable event brief. Files are read in the browser; there is no audio upload, recording, Fireflies/Otter connection, or transcription service. Mock organizations, people, budgets, and proposed partnerships are fictional. The local draft groups matching source lines into goals, action items, dates/deadlines, partnerships, funding, and responsibilities. It is a rule-based extractor, not an AI model; omitted facts remain unidentified rather than being invented.

The staffing estimate is `ceil(expected participants / participants per helper) + station helpers + setup helpers`. All inputs and recruitment lead time are editable. Recruitment starts the configured number of days before the planned event date. These are planning assumptions, not a supervision or safety assessment; confirm actual venue capacity, age eligibility, accessible routes, supplies, adult supervision, funding, and partner commitments with the team. Saving the brief reveals a separate review step. Using the reviewed brief creates an unpublished event draft; it does not publish, recruit, or send messages.

Plans are stored in `volunteeru.plans.v1` as `{version:1, organizations:{[organizationId]:{transcript,brief,analysis,analysisMode}}}`. `analysisMode` distinguishes `local` from `ai`; each finding preserves its source excerpt and line number. Editing a transcript hides old findings, and saving changed notes invalidates the old analysis. Late AI responses are discarded if the user edits or saves another version, leaves the planner, or switches workspaces. Browser-local storage and workspace selection do not authenticate a nonprofit or establish access permissions.

### Optional team AI endpoint

When the existing same-origin API configuration is set, **Generate AI draft** is offered separately from local extraction. Its disclosure states that clicking sends the transcript and organization ID to the team's configured API. Local import/extraction alone makes no AI request. The repository does not include an AI server or credentials, and no successful AI result is fabricated while disconnected. Server credentials must remain on the server.

`POST <apiBase>/nonprofit/plans` uses the authenticated same-origin session (`credentials: same-origin`) and JSON `{organizationId, transcript}`. The endpoint must authenticate the nonprofit, authorize organization membership from the session, validate request size, apply CSRF/rate protections, and keep tenant data isolated. Do not trust the caller's organization ID as authorization. The team must define transcript retention and AI-provider data handling before accepting real notes.

A successful JSON response must include the identical `organizationId` and **all six** arrays: `goals`, `actions`, `deadlines`, `partnerships`, `funding`, and `responsibilities`. Each array contains at most 20 `{text, evidence}` findings. `text` must be a nonempty string up to 2,000 characters; `evidence` must be a nonempty exact substring of the supplied transcript, up to 3,000 characters. Empty arrays represent facts not found. Missing arrays, mismatched organization IDs, unsupported evidence, HTTP/network failures, and a 30-second timeout preserve the saved plan. Exact excerpts support review; they do not establish that every model conclusion is correct. A coordinator must review every result before creating or publishing an event.

## Event day, school review, reporting, and integrations (Person 3)

The browser demo now includes **Event Day**, **Impact Reports**, **Nearby**, and **Integrations** in navigation. All earlier school/student/nonprofit screens preserve their browser-local records and remain labeled as demos. Selecting a demo school or nonprofit is not an authenticated role change.

- Approved students with a confirmed nonprofit shift can check in and out, document activities, save notes, and submit feedback. Calculated hours use the overlap with the scheduled shift and become **pending** records; a check-in never verifies attendance. A browser clock is not proof of real attendance.
- Nonprofit coordinators see check-ins, completed check-outs, reflections, school groupings, and pending hours. Approval requires a matching approved application, coordinator-recorded attendance, valid scheduled hours, and a completed event.
- School administrators see linked attendance and approved hours. Students can submit capstone/service-learning evidence for school approval or correction. Application-time school connections preserve membership provenance; self-reported school names alone do not establish access.
- Reports filter by nonprofit, event, and month. They separate registrations, confirmed attendance, completed check-outs, approved hours, and coordinator-reported reach/supplies/outcomes. CSV, JSON, and printable HTML exports omit student names, private notes, and feedback. CSV values beginning with spreadsheet formula characters are escaped. Local narratives are labeled rule-based; configured AI output requires scoped record references and human review.
- Nearby uses a coordinate schematic and city-center distances for Miami, Fort Lauderdale, and Hollywood when exact venue coordinates are unavailable. Exact coordinates can be supplied in the nonprofit event editor. Street maps open in OpenStreetMap; the schematic is not a navigation or confirmed-venue map. The authenticated map endpoint searches stored published event coordinates; it does not geocode addresses or request a user's live location.

### Authenticated SQLite workspace

A separate, functional **Integrations** workspace uses server records instead of localStorage records. It deliberately does not upload or silently trust the demo database. Run two terminals with Node.js 22 or later:

```sh
npm ci
npm run server
# In another terminal:
npm run dev
```

Vite proxies `/api` to the loopback API on port 3001. The API database defaults to `server/data/volunteeru.sqlite`, excluded from Git, with restrictive file permissions. `server.env.example` lists environment variables; export them in the server environment (the server does not automatically load this example). Restart the API after changing environment settings.

Create sample school-administrator and nonprofit accounts through Integrations. A school administrator creates a seven-day, bounded-use, opaque student invitation link. Students must present a valid invitation to create their account and are bound to the issuing school. School/nonprofit signup records an authorization declaration; the prototype does not independently verify institutional authority. Production onboarding needs an institutional approval process.

Server authentication uses salted scrypt password hashes, expiring HttpOnly SameSite session cookies, origin checks, mutation CSRF tokens, basic rate limits, prepared SQL, and role/record ownership checks. Server timestamps determine check-in/out hours. Student requests never select another student identity; school reports use the authenticated administrator's school. The application is a local prototype, not a completed production privacy, consent, recovery, audit, backup, or deployment program. Use TLS and Secure cookies for deployment; arrange institutional verification, guardian consent and privacy policies, monitoring, backups, and retention before real student use.

The database connects users, schools, nonprofits, invitations, events, registrations, attendance, hours, and the in-app notification outbox. Browser-demo training/project records remain separate from the smaller authenticated workspace; they are not automatically migrated or server-verified.

### Server provider contracts

AI is optional and unavailable until a server administrator configures `VOLUNTEERU_AI_URL` and `VOLUNTEERU_AI_KEY`. The endpoint must be a custom HTTPS JSON service. The key is sent only server-to-provider in the Authorization header. The server blocks redirects, limits response size, times out requests, and validates organization scope and evidence before accepting output. No OpenAI, Fireflies, Otter, Google Maps, email, or SMS connection is implied by the prototype.

The custom provider receives `kind: "meeting_plan"`, `organizationId`, and `transcript`, and returns the same organization ID plus `goals`, `actions`, `deadlines`, `partnerships`, `funding`, and `responsibilities`: arrays of `{text, evidence}`. Each evidence string must occur verbatim in the transcript. For `kind: "impact_report"`, the server sends an organization-scoped aggregate `report` with `sourceRecordIds`; the provider returns `{organizationId, summary, evidenceRecordIds}` referring only to those records. Source references aid review; they do not prove every generated assertion correct.

Notifications use an authenticated, student-scoped in-app outbox. Posting creates queued in-app updates; no external delivery is claimed. An external email/SMS/push provider, delivery receipts, opt-out policy, and background scheduling remain deployment integrations.

Verification:

```sh
npm run format:check
npm run build
npm test
npm run test:server
```

The existing DM Sans and Manrope fonts are bundled locally to preserve the design without a third-party font request. Their SIL Open Font License notices are included under `public/font-licenses/` and copied into production builds.

## Presentation demo

The photo-led public homepage has three one-click sample accounts. Open
`/demo.html?role=student`, `/demo.html?role=nonprofit`, or
`/demo.html?role=school` to bypass setup. Use `/?home=1` to view the public
homepage while retaining an existing personal profile.

The demo is an isolated presentation scenario: no authentication, messages,
real placements, or modifications to the personal workspace. It stores only
sample presentation state in `sessionStorage` under
`volunteeru.presentation-demo.v1`. The sample people, school, and event records
are fictional; Flowers for Women is shown as a demonstration organization.

Suggested walkthrough: Student (26/40 hours) → Nonprofit (verify Maya's four
hours) → School Admin (accept the verified hours) → Student (30/40 hours,
budding plant). Reset demo restores the starting scenario. Sample dashboard
pages, roster search, and a CSV impact report are pre-filled and usable.

Stock photographs: [volunteers packing donations](https://www.pexels.com/photo/volunteers-packing-up-donations-7156189/)
and [students working together](https://www.pexels.com/photo/cheerful-multiethnic-female-students-working-on-homework-together-5965707/),
used under the [Pexels license](https://www.pexels.com/license/). The plant
illustration is the previously approved VolunteerU mascot asset.

Student demo hours are editable: open My dashboard or My volunteering, enter 0.25–4 hours for the completed sample shift, then select Submit hours. Switch to Nonprofit to verify the submitted amount and School Admin to accept it. Only acceptance adds those hours to the existing 26-hour progress. Reset demo clears the submission; refresh preserves it within the current browser session.
