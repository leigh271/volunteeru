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

All opportunities and organizations are explicitly fictional demo data. No actual application is sent. No organizations are represented as partners. Dates are sample schedules, not confirmed openings.

## Team integration contract

`src/data.js` exports shared opportunity records. `src/store.js` owns the versioned `volunteeru.shared.v1` localStorage record:

- `student`: `id`, `name`, `school`, `age` (13–100), `interests[]`, `skills[]`, `availability[]`, `locations[]`, `onboarded`.
- `saved`: opportunity IDs belonging to this single-device student.
- `applications`: `id`, `studentId`, `opportunityId`, `status` (`pending`, `approved`, `rejected`), `interest`, `availabilityConfirmed`, `submittedAt`, `studentSnapshot` (name/school/age at submission).
- `opportunities`: `id`, `title`, `role`, `nonprofit`, `cause`, `location`, `city`, `date` (ISO date), `time`, `hours`, `minAge`, `skills[]`, `availability`, `description`, `requirements`, `website`, `publicContact`, `isDemo`, presentation fields.

Person 2 should replace demo opportunity reads with published opportunities and supply verified `website` (HTTP/HTTPS URL) and `publicContact` (public text) fields. The details screen already renders these fields safely when provided. Replace local application writes with an authenticated endpoint validating age, schedule, listing state, and a database unique constraint on `(studentId, opportunityId)`. Person 2 decisions update the same application's status; verified hours should be separate records keyed to application/student/opportunity. The existing application screen renders status from shared records, including updates from another browser tab.

Person 3 should reference these same stable student/application IDs for school reporting and verified hours; no reporting, thermometer, badges, or confetti implementation is included.

Before real use: add authentication, server storage and authorization, student/school access rules, guardian-consent workflow where needed, and server-side eligibility and duplicate validation. Current data is browser-local, unencrypted, single-student demo storage; clearing site data removes it and it does not sync across devices. No backend or credentials were present to connect.

## Verification

```sh
npx playwright install chromium
npm test
```

Tests cover complete onboarding, matching, save/reopen/remove and refresh persistence, details, application submission/status/duplicate prevention, profile editing, age filtering, empty filters, no horizontal overflow, and browser errors on desktop and mobile (mobile also requests reduced motion).

Tests start the development server automatically; no separate server terminal is needed. The GitHub Actions workflow runs formatting, the production build, and all desktop/mobile journey tests on pushes and pull requests. Local verification completed with 14 passing browser tests.

## Handoff boundaries

This is the complete **Person 1 student demo**, ready for the team to connect to shared services. It is not a live volunteer placement service. Person 2 and Person 3 interfaces remain unimplemented as requested. A same-browser shared-record decision update is covered by the tests; decisions from another device require the team's backend.

The application validates persisted browser records, rolls failed writes back to the last saved state, and rechecks local duplicate/age rules at submission. These are client safeguards; they do not replace database uniqueness or authenticated server validation. `src/store.js` is the persistence boundary to replace when the team backend is available.

### Build and hosting

Use Node.js 22 or later. `npm run build` outputs a static site to `dist/`; serve that directory over HTTPS with any static host. `npm run preview` previews the production build locally. Vite's default configuration works on a root domain; if hosting at a subpath such as GitHub Pages, pass the matching base path to the build (`npm run build -- --base=/volunteeru/`). Publishing source code to GitHub does not by itself publish a live website.
