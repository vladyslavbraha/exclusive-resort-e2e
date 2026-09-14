# Exclusive Resorts — Inquiry Form E2E

End-to-end tests for the membership inquiry form at
`https://public-site.stage.exclusiveresorts.com/inquire/`.

Playwright (TypeScript) for the UI, a manual/API layer for the server-side checks. Test design,
risks and the full case list are in [`docs/test-plan.md`](docs/test-plan.md); the manual execution
guide is [`docs/test-cases.md`](docs/test-cases.md).

## Setup

```bash
npm ci
npx playwright install chromium webkit
```

## Running

```bash
npm test               # full suite, all projects (chromium, webkit, mobile-chromium)
npm run test:smoke     # @smoke only
npm run test:regression
npm run test:headed
npm run report         # open the last HTML report
```

Target another environment with `BASE_URL`:

```bash
BASE_URL=https://exclusiveresorts.com npm test
```

### Smoke vs full regression

- **Smoke** (`@smoke`): the form loads and a valid submission posts the right payload — the
  minimum that must pass on every change.
- **Regression** (`@regression`): validation, security and resilience — the full guard.
- Tags: `@smoke`, `@regression`, `@negative`, `@compliance`, `@a11y`, `@responsive`.

## What is and isn't hit live

Every submission on the real form creates a **Pardot prospect** (the handler is a production
host, even from staging). So:

- **UI tests stub the write.** `InquiryPage.stubSubmit()` intercepts `POST /submit-form/` with
  `page.route()` and asserts the captured payload — no prospect is created, and CI is safe to run
  on every push.
- **Server-side write-path checks are not automated.** Consent-bypass, honeypot enforcement and
  the membership-step IDOR (TC-08/11/19) would each create or mutate a real prospect, so they live
  in the manual guide and the Postman collection, not in CI.
- **Read-only API checks are opt-in.** The `/validate-email/` contract tests (TC-18) hit the real
  backend, so they are skipped unless `RUN_LIVE_API=1`:

  ```bash
  RUN_LIVE_API=1 npx playwright test tests/api.spec.ts
  ```

## Postman / API collection

`postman/` holds a collection plus staging and production environments. Switch environment to
retarget everything via the `baseUrl` variable.

```bash
# Safe folder only — /validate-email/, creates no prospects:
npx newman run postman/collection.json -e postman/environment.staging.json \
  --folder "1. Email validation — safe to run"

# Full collection (see the warning below):
npx newman run postman/collection.json -e postman/environment.staging.json
```

Three folders, by blast radius:

1. **Email validation** — safe to run repeatedly. Two assertions are named `FINDING:` and fail on
   purpose: they assert the correct behaviour for two real server bugs (a missing `email` key
   returns HTTP 200 with a raw exception; `GET` returns 200 instead of 405).
2. **Inquiry submit** — the write path. A successful call **creates a real Pardot prospect**, so
   run it deliberately, never in a loop. This is where the server-side consent (TC-08) and
   honeypot (TC-11) checks live, because they can only be proven against the real server.
3. **Membership IDOR** — disabled by default. Only ever set `ownProspectId` to an id you created
   yourself; it writes to a real prospect (TC-19).

The valid-address test asserts the response *shape*, not a specific verdict: the endpoint does a
live SMTP mailbox check, so a real verdict would need a real mailbox.

## Layout

```
src/pages/InquiryPage.ts     Page Object — user-facing locators, submit/email-validation stubs
src/fixtures/inquiry.data.ts Test data
tests/*.spec.ts              Specs grouped by concern (smoke, validation, security, a11y, ...)
playwright.config.ts         3 projects, retries, HTML reporter, browser UA
.github/workflows/           CI
docs/                        Test plan + manual guide
```

## Notes for anyone extending this

The form is a Nuxt/Vue SPA with FormKit fields, and two behaviours shaped the Page Object:

- **Type with `pressSequentially`, not `fill`.** FormKit's reactive model only captures real key
  events; `fill()` sets the DOM value (even enabling Submit) while the model stays empty, so the
  form submits nothing.
- **Wait for hydration.** `goto()` waits for load plus a bounded settle before interacting, because
  handlers are wired on hydration and `networkidle` never truly settles (Nuxt keeps prefetching).
- Radios, checkboxes and the phone widget render their native input off-screen; the Page Object
  clicks the visible control (label/decorator) and reads state from the input.

## Known limitations / next day

- No Pardot-side confirmation, no email/SMS delivery verification (no access).
- Two browser engines; no `axe`/Lighthouse pass yet.
- TC-06 (postal formats) and TC-07 (name length matrix) are manual for now — cheap by hand,
  brittle to automate against a marketing page.
- With another day: data-drive TC-06/07, add `axe-core` to the run, add a Lighthouse budget, and
  turn the Postman collection into a Newman CI job for the server-side write-path cases against a
  non-production endpoint.
