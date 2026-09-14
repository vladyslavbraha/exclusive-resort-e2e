# Exclusive Resorts — Inquiry Form E2E

End-to-end tests for the membership inquiry form at
`https://public-site.stage.exclusiveresorts.com/inquire/`.

Playwright (TypeScript) tests the UI; a Postman collection covers the API. Test design, risks and
the full case list are in [`docs/test-plan.md`](docs/test-plan.md); the manual execution guide is
[`docs/test-cases.md`](docs/test-cases.md).

## Setup

```bash
npm ci
npx playwright install chromium webkit
```

## Running

```bash
npm test               # full suite on chromium and webkit
npm run test:smoke     # @smoke only
npm run test:regression
npm run test:headed
npm run report         # open the last HTML report
```

Tags: `@smoke`, `@regression`, `@negative`, `@compliance`, `@a11y`, `@responsive`.

## Test submissions never reach the CRM

A real submission creates a Pardot prospect, so the UI tests intercept `POST /submit-form/` with
`page.route()` and assert the captured request instead. No prospect is created, and CI is safe to
run on every push. The server-side write-path checks (consent bypass, honeypot, IDOR) can only be
proven against the real backend, so they live in the Postman collection and the manual guide, not
in CI.

## Postman collection

`postman/` holds the collection and the staging environment the developers provided.

```bash
# Safe folder only — /validate-email/, creates no prospects:
npx newman run postman/collection.json -e postman/environment.json \
  --folder "1. Email validation — safe to run"

# Full collection (see the warning below):
npx newman run postman/collection.json -e postman/environment.json
```

Three folders, by blast radius:

1. **Email validation** — safe to run repeatedly. Two assertions are named `FINDING:` and fail on
   purpose: they assert the correct behaviour for two real server bugs (a missing `email` key
   returns HTTP 200 with a raw exception; `GET` returns 200 instead of 405).
2. **Inquiry submit** — the write path. A successful call creates a real prospect, so run it
   deliberately, never in a loop. The server-side consent and honeypot checks live here.
3. **Membership IDOR** — disabled by default. Only ever set `ownProspectId` to an id you created
   yourself; it writes to a real prospect.

## Layout

```
src/pages/InquiryPage.ts       Page Object for the form
src/fixtures/test.ts           Playwright fixture that opens the form for each test
src/fixtures/inquiry.data.ts   Test data
tests/*.spec.ts                Specs grouped by concern
playwright.config.ts           Config: chromium + webkit, retries, HTML report
.github/workflows/             CI
docs/                          Test plan and manual guide
```

## Notes for whoever extends this

The form is a Nuxt/Vue SPA with FormKit fields. Two things are easy to get wrong:

- The Page Object types values key by key (`pressSequentially`). FormKit records values from real
  key events, so `page.fill()` leaves the form empty even though it looks filled.
- `open()` waits for the page to finish hydrating before touching any field, because the field
  handlers are wired up on hydration.
- At phone-screen widths the form swaps to a separate mobile DOM. The specs target the desktop
  form, so the responsive check (`TC-17`) is the only one run at 375px.

## Known limitations / next day

- No Pardot-side confirmation, no email/SMS delivery verification (no access).
- Two browser engines; no `axe`/Lighthouse pass yet.
- Postal-code formats and the name length/unicode matrix are covered in the manual guide — cheap
  by hand, brittle to automate against a marketing page.
- With another day: add `axe-core` to the run, add a Lighthouse budget, and turn the Postman
  write-path cases into a Newman job against a non-production endpoint.
