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

Person 3 should reference these same stable student/application IDs for school reporting and verified hours; no reporting, thermometer, badges, or confetti implementation is included.

Before real use: add authentication, server storage and authorization, student/school access rules, guardian-consent workflow where needed, and server-side eligibility and duplicate validation. Current data is browser-local, unencrypted, single-student demo storage; clearing site data removes it and it does not sync across devices. No shared backend details or credentials were provided to connect. Optional school, messaging, and student-update API adapters are implemented as described below.

## Verification

```sh
npx playwright install chromium
npm test
```

Tests cover complete onboarding, matching, save/reopen/remove and refresh persistence, details, application submission/status/duplicate prevention, profile editing, age filtering, empty filters, no horizontal overflow, and browser errors on desktop and mobile (mobile also requests reduced motion).

Tests start the development server automatically; no separate server terminal is needed. The GitHub Actions workflow runs formatting, the production build, and all desktop/mobile journey tests on pushes and pull requests. The expanded verification suite covers the original journey plus women’s health selections, potential organization links, school-code validation/confirmation, coordinator acknowledgment, and record-derived notifications.

## Handoff boundaries

This is the complete **Person 1 student demo**, ready for the team to connect to shared services. It is not a live volunteer placement service. Person 2 and Person 3 interfaces remain unimplemented as requested. A same-browser shared-record decision update is covered by the tests; decisions from another device require the team's backend.

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

Same-origin storage changes refresh notifications, so Person 2 decision/hour updates to shared records are reflected. When configured, the authenticated update adapter runs after onboarding, on app startup/focus, and every minute while the page is visible. It merges validated records only when the feed student ID matches the current student. Failed refreshes preserve last-known records and never invent decisions. The backend must map the actual signed-in student to the shared student ID, supply canonical records, and connect opportunity/application creation before this becomes a live service. Person 3 can consume the same hours records; no reporting, badges, thermometer, or confetti UI was added.
