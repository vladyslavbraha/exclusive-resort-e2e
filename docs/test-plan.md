# Test Plan — Exclusive Resorts Membership Inquiry Form

**System under test:** `https://public-site.stage.exclusiveresorts.com/inquire/` (staging)
**Prepared by:** Vladyslav Braha
**Version:** 2.0

---

## 1. Context and objective

The inquiry form is the entry point of the sales funnel: every submission becomes a Pardot prospect
and, downstream, a CRM lead for a luxury vacation club, where one lead carries a high commercial
value. That shapes the plan — the two failure modes that actually cost money are **a valid lead
that never arrives** and **a lead that arrives twice**. Cosmetic issues rank far below both.

The second driver is legal. The email/privacy consent checkbox and the SMS opt-in are the record of
consent under CAN-SPAM and TCPA. A submission accepted without consent, or one whose contact
preference contradicts the consent captured, is a compliance defect regardless of how well the form
works functionally.

The third driver is specific to this implementation: the form is protected by a **honeypot field**,
not a captcha. A spam trap that misfires does not show an error — it silently discards a genuine
lead. That makes the honeypot both a security control to verify and a lead-loss risk to probe.

## 2. Observed implementation

Established by reading the staging page and its Nuxt bundles, not assumed:

| Aspect | Finding |
| --- | --- |
| Stack | Nuxt/Vue SPA behind CloudFront; fields rendered by FormKit |
| Inquiry form | `#pardot-short-form` |
| Field names | `FirstName`, `LastName`, `Email`, `ZIP`, `telephone`, `preferredContactType` (`Phone`/`Text`/`Email`), `termsAgreement`, `smsOptIn` |
| Phone control | `vue-tel-input` (`input[type=tel]`, `maxlength=25`) with a country selector, not a plain numeric input |
| Hidden payload fields | `FBID`, `GCLID`, `msclkid`, `C_SFDCLastCampaignID`, `C_Page_URL`, `Braze_Campaign_ID`, `Referrer_URL`. The live payload also carries empty `preferredTime`/`preferredDays` keys — the two brief-documented dropdowns exist in the **wire model** but render no control |
| Honeypot | `MessagingPreferences` (`#hp-field`, `tabindex="-1"`, placeholder "Can we message you?*") |
| Anti-bot | No reCAPTCHA, hCaptcha or Turnstile anywhere in the bundles — the honeypot is the only control |
| Submit target | `POST /submit-form/` (same origin). Body is a JSON envelope `{"values":"<url-encoded query string>","form":"SHORT_FORM"}` sent with a mismatched `content-type: application/x-www-form-urlencoded`. Success → `{"data":{"id":<pardot prospect id>}}` |
| Email validation | `POST /validate-email/` fires on every keystroke; proxies to a real deliverability check (MX/disposable); 1.3–6.9 s per call; no rate limiting; raw server exceptions returned to the client at HTTP 200 |
| Membership step 2 | `POST /submit-membership-application/` enriches the prospect by `pardotId` taken from the request body — no auth/CSRF token, ids sequential, id also in the `pardot_prospect_id` cookie |
| Outcomes | success → `/submission-success/?success`, failure → `/form-submit-fail/?error` |
| Client storage | `er_prospect_email`, `er_prospect_data` |
| Validation | FormKit only — no `required` or `pattern` attributes in the markup, so there is no native browser constraint validation to fall back on |
| Second form | `#pardot-membership-form` (membership application part 2: known members, company, title, affiliations) posts to `/submit-membership-application/` |
| Edge behaviour | CloudFront returns **403** to a non-browser User-Agent; a browser UA gets through. `/inquire` 301-redirects to `/inquire/` |

Two deviations from the assignment brief, both confirmed in the DOM:

1. **`Preferred Time of Day` and `Preferred Days` do not exist.** Neither dropdown is present in the
   markup or in the form's `fieldValues` model. The brief is stale; nothing conditional reveals them.
2. **Name is two fields** (`FirstName`, `LastName`), not one free-text field.

## 3. Scope

### In scope

| Area | Coverage |
| --- | --- |
| Functional | Happy path, required-field enforcement, field validation, optional fields |
| Compliance | `termsAgreement` enforced client- and server-side; `smsOptIn` semantics against the chosen contact method |
| Security | XSS in free-text fields, honeypot behaviour, client-validation bypass reaching `/submit-form/` |
| API | `POST /submit-form/` directly: contract, status codes, server-side validation, response time |
| UX / Accessibility | Keyboard-only completion, labels and error announcement, honeypot exposure to assistive tech, 375 px viewport |
| Resilience | Double submit, slow and failed network |
| Browsers | Chromium and WebKit; Chromium at 375 px for layout |

### Out of scope, and why

- **CRM and Pardot verification.** No access to the Pardot business unit, so "the prospect was
  created with the right campaign attribution" cannot be asserted. Coverage stops at the HTTP
  request and the resulting page state.
- **Email and SMS delivery.** No mailbox or handset wired into their sending domain.
- **The membership application form** (`#pardot-membership-form`) on the same page. It is a separate
  flow with its own endpoint; the brief scopes this exercise to the inquiry form. Its presence is
  recorded so nobody mistakes it for dead markup.
- **Load and performance testing.** Shared staging infrastructure; the only timing assertion is a
  p95 over 10 sequential calls, which is diagnostic, not load.
- **Full WCAG 2.1 AA audit.** Covered instead: keyboard path, label associations, error
  announcement, focus visibility, honeypot exposure — the failures that block a real user from
  submitting. An automated `axe` pass is listed as follow-up.
- **Legal sufficiency of the consent wording.** A lawyer's call. Testing covers the mechanics of
  consent capture, not the text.

## 4. Findings from exploration

The exploratory pass is done; the defects it surfaced are written up in
[`bug-report.md`](bug-report.md). The headline ones: a membership endpoint that trusts a
client-supplied prospect id (potential IDOR), a honeypot exposed to screen readers, and an
email-validation endpoint that leaks server exceptions and runs an unthrottled live check per
keystroke. Two write-path items (server-side consent and honeypot enforcement) are left for a
controlled Postman run because confirming them creates real prospects.

## 5. Risk areas driving prioritisation

| # | Risk | Why it is likely | Impact | Cases |
| --- | --- | --- | --- | --- |
| R1 | Consent enforced only in the browser | No `required` attributes at all; all validation is FormKit, and the endpoint is reachable directly | Marketing contact with no consent record | TC-08 |
| R2 | Honeypot discards genuine leads | `#hp-field` is a visible-typed text input with a placeholder; if it is not hidden from assistive tech, a screen-reader user fills it and their lead disappears **with no error shown** | Silent lead loss from exactly the users least able to report it | TC-12 |
| R3 | Silent lead loss on a failed submit | `/submit-form/` already answers 502 to malformed input; the client's failure path is a redirect to `/form-submit-fail/?error` and must actually be taken | Revenue, invisible | TC-16 |
| R4 | Duplicate leads from double submit | Unguarded submit button plus a network round trip through a proxy route | Prospect contacted twice; dirty CRM | TC-15 |
| R5 | International postal codes rejected | The requirement "US and international" is contradictory, and a 5-digit regex is the usual shortcut | Lead loss from the affluent international audience the club targets | TC-06 |
| R6 | Phone widget mangles the number | Country selector plus a typed `+`, and `maxlength=25` truncating longer input | Unreachable lead | TC-05 |
| R7 | Free-text reflected without escaping | Two name fields and a confirmation page that may echo stored prospect data | Reflected or stored XSS | TC-10 |
| R8 | Contact preference contradicts consent | `Text` selectable while `smsOptIn` stays unchecked | SMS without opt-in, or an uncontactable lead | TC-09 |
| R9 | Keyboard and screen-reader path broken | Custom radios, custom checkboxes, a third-party phone widget and a honeypot in the tab flow | A user who cannot submit at all | TC-13, TC-14 |
| R10 | Hidden tracking fields tamperable | 12 hidden fields ride the payload, including campaign attribution | Attribution poisoning, injected values reaching Pardot | TC-08 (bypass) |

## 6. Test cases

16 cases. `P0` blocks release, `P1` fixed before the next deploy, `P2` scheduled.

| ID | Title | Category | Priority | Auto |
| --- | --- | --- | --- | --- |
| TC-01 | Form loads with every field present and no undocumented ones | Smoke / UI | P0 | Playwright |
| TC-02 | Valid submission posts the complete payload and lands on the success page | Smoke / E2E | P0 | Playwright |
| TC-03 | Empty submit is blocked and every required field reports its own error | Negative | P0 | Playwright |
| TC-04 | Malformed email rejected, valid unusual addresses accepted | Negative | P1 | Playwright |
| TC-05 | Phone accepts digits and `+`, rejects letters typed and pasted, keeps one dial code | Negative | P1 | Playwright |
| TC-06 | Postal code accepts US and international formats | Boundary | P1 | — |
| TC-07 | Name fields handle length limits, unicode and whitespace | Boundary | P2 | — |
| TC-08 | Consent enforced in the browser and again by the server when bypassed | Compliance | P0 | Playwright + Postman |
| TC-09 | `Text` preferred with `smsOptIn` unchecked resolves to a defined behaviour | Compliance | P1 | — |
| TC-10 | XSS payload in a name field renders as text and never executes | Security | P0 | Playwright |
| TC-11 | A filled honeypot is rejected, and the rejection is server-side | Security | P1 | Postman |
| TC-12 | The honeypot is invisible to assistive tech as well as to sighted users | Accessibility / Security | P1 | Playwright |
| TC-13 | The form can be completed and submitted with the keyboard alone | Accessibility | P1 | Playwright |
| TC-14 | Inputs, radio group and errors expose correct semantics to assistive tech | Accessibility | P1 | — |
| TC-15 | Double-clicking Submit produces exactly one request | Concurrency | P1 | Playwright |
| TC-16 | A failed or slow submit surfaces an error instead of losing the lead | Resilience | P1 | Playwright |
| TC-17 | Form is usable at a 375 px viewport | Responsive | P2 | Playwright |

### TC-01 — Form loads, nothing extra · P0

Open `/inquire/` cold. First, Last, Email, Postal Code, the phone widget, the three
`preferredContactType` radios, both checkboxes and Submit are present and labelled; no console
errors. The two dropdowns named in the brief are confirmed absent — recorded as a
spec-vs-implementation finding, not asserted away. `#hp-field` must not be perceivable.

### TC-02 — Valid submission, complete payload · P0

Fill every field with valid data, tick consent, submit with the network tab open.
Exactly one `POST /submit-form/`; the body carries `FirstName`, `LastName`, `Email`, `ZIP`,
`telephone`, `preferredContactType`, `termsAgreement=true`, `smsOptIn` as chosen, an **empty**
`MessagingPreferences`, and the hidden tracking fields; the browser lands on
`/submission-success/?success`. Automated with `page.route()` intercepting the POST so CI asserts
the captured payload without creating a prospect.

### TC-03 — Empty submit blocked · P0

Submit with everything empty. No request leaves the browser; each required field shows its own
error rather than one banner; focus moves to the first invalid field; consent is among the fields
reported. Note there are no native `required` attributes, so this is FormKit's behaviour end to end
— if JS fails to initialise, the form must not degrade into a submittable, unvalidated form.

### TC-04 — Email validation · P1

Rejected: `foo@`, `foo.com`, `@example.com`, `foo@@example.com`, `foo bar@example.com`, a
320-character address. Accepted: `qa.candidate+tag@example.co.uk`, a hyphenated domain, an address
at the 254-character RFC limit. Accepted values must reach the payload unmodified.

### TC-05 — Phone, typed and pasted · P1

With the US default: type `abcd`; paste `abcd`; paste `(303) 555-0142`; type `+1 303 555 0142`
while `+1` is selected; switch to United Kingdom and enter a GB mobile. Letters rejected on typing
**and on paste** (the brief's own example bug is a paste bypass); no duplicated `+1+1` in the
payload; `maxlength=25` must not silently truncate a legitimate international number into a wrong
one — truncation without a message is a defect.

### TC-06 — Postal code, US and international · P1

Accepted: `80301`, `80301-1234`, `K1A 0B1`, `SW1A 1AA`, `75008`, `100-0001`.
Rejected: empty, `abcde`, `!!!!!`, 30 characters. A 5-digit-only rule contradicts the stated
requirement and is reported as a defect, not a preference.

### TC-07 — Name fields · P2

One character; 256 and 1000 characters; `Владислав`, `Ünïcödé`, `日本語`; an emoji; leading and
trailing spaces. A maximum must be enforced with a message rather than by silent truncation;
unicode must survive into the payload unmangled; surrounding whitespace trimmed.

### TC-08 — Consent enforcement and payload tampering · P0

(a) Valid data, consent unchecked, submit → blocked with an explicit message.
(b) Bypass the client and `POST /submit-form/` directly with `termsAgreement` absent or `false`.
The server must reject it. A 2xx here is the highest-severity finding available on this form: it
means a prospect can be created with no consent record and the browser is the only guard.
(c) Same route with tampered hidden fields (`utm_source`, `C_SFDCLastCampaignID`) carrying markup
or overlong values — they must be validated or neutralised, not forwarded verbatim to Pardot.

### TC-09 — `Text` selected without SMS opt-in · P1

Either the form requires `smsOptIn` for that choice and says so, or it accepts and the payload
unambiguously records "SMS not consented". What is unacceptable is an accepted lead whose requested
channel and consent record contradict each other with nothing distinguishing them — a downstream
system will resolve that ambiguity in the wrong direction. Observed behaviour is recorded and
raised with the product owner if undefined.

### TC-10 — XSS in a free-text field · P0

`<script>alert(1)</script>`, `"><img src=x onerror=alert(1)>`, `javascript:alert(1)`, `{{7*7}}`
into First and Last. No dialog, no execution, no console error; anything echoed on
`/submission-success/` renders escaped; `{{7*7}}` must not render as `49`, which would indicate
client-side template injection. Check `er_prospect_data` in client storage too — data stored there
and re-rendered later is the stored-XSS path.

### TC-11 — Honeypot is enforced · P1

`POST /submit-form/` with a non-empty `MessagingPreferences` and everything else valid. The
submission must be rejected as spam. Establish **where** the rejection happens: if the field is only
checked in the browser, the trap is decorative, since a bot posts to the endpoint directly. Record
what the response looks like — a spam rejection that mimics success is intentional and fine, as
long as it is deliberate.

### TC-12 — Honeypot is invisible to everyone, not just to sighted users · P1

Inspect `#hp-field` in the accessibility tree and with VoiceOver. It has `tabindex="-1"`, so the
keyboard skips it — but that alone does not remove it from a screen reader's forms list, and its
placeholder ("Can we message you?*") reads like a genuine required question. If a screen-reader user
can reach and fill it, their lead is silently discarded with no error anywhere. Expected:
`aria-hidden="true"` or equivalent removal from the accessibility tree, in addition to being
visually hidden. This is the sharpest failure mode on this form: it is invisible to sighted QA,
invisible in the logs, and it targets the users least likely to report it.

### TC-13 — Keyboard-only completion · P1

From the address bar, Tab through and complete the form: text fields by typing, radios with arrow
keys, checkboxes with Space, Enter to submit. Tab order follows visual order; focus is visible at
every stop including the custom controls and the country selector; no trap in the country dropdown;
the honeypot is never reached.

### TC-14 — Assistive-technology semantics · P1

Every input has a programmatic label — the small-caps visual labels are not enough on their own.
The radios form a `fieldset`/`legend` or `role="radiogroup"` named "Preferred Contact Method". The
consent checkbox's accessible name includes the consent sentence, since consent given by a
screen-reader user must be informed consent. Errors are tied to inputs via `aria-describedby` with
`aria-invalid` and are announced, not merely painted red.

### TC-15 — Double-click Submit · P1

Double-click rapidly, then repeat with Enter pressed twice. Exactly one `POST /submit-form/`; the
button goes disabled or pending for the duration; one success page, one prospect.

### TC-16 — Failed or slow submit does not lose the lead · P1

(a) "Slow 3G": a pending indicator appears, the button cannot be pressed again, no duplicate
request. (b) Offline, and with the route stubbed to 500 and to a timeout: the user reaches
`/form-submit-fail/?error` or sees an explicit failure message, and their data is preserved for a
retry; one retry creates one lead. A success state shown on a 500 is R3 realised — the prospect
believes they made contact and nobody knows they did not.

### TC-17 — 375 px viewport · P2

At 375 × 667: no horizontal page scroll; the two-column layout reflows to one column with no
clipped labels; the consent text is readable; radios, checkboxes, the country selector and Submit
are at least 44 × 44 px; the country dropdown opens inside the viewport; the on-screen keyboard
does not hide Submit with no way to reach it.

## 7. How each case is verified

| Case | How | Where |
| --- | --- | --- |
| TC-01 Form loads | Playwright | `tests/form-loads.spec.ts` |
| TC-02 Valid submission, full payload | Playwright | `tests/form-submit.spec.ts` |
| TC-03 Empty submit blocked | Playwright | `tests/field-validation.spec.ts` |
| TC-04 Email format rejected | Playwright | `tests/field-validation.spec.ts` |
| TC-05 Phone rejects letters | Playwright | `tests/field-validation.spec.ts` |
| TC-06 Postal code US + international | Manual | data matrix, cheap by hand |
| TC-07 Name length / unicode | Manual | data matrix, cheap by hand |
| TC-08 Consent blocked without agreement | Playwright | `tests/consent.spec.ts` |
| TC-08b Consent enforced server-side | Postman | folder 2 → BUG-10 (needs confirmation) |
| TC-09 `Text` chosen without SMS opt-in | Manual | needs a product decision |
| TC-10 Script in Name blocked, no execution | Playwright | `tests/xss.spec.ts` |
| TC-11 Honeypot enforced server-side | Postman | folder 2 → BUG-11 (needs confirmation) |
| TC-12 Honeypot hidden from screen readers | Manual | → **BUG-02** |
| TC-13 Keyboard-only completion | Manual | screen-reader / keyboard judgement |
| TC-14 `/validate-email/` contract | Postman | folder 1 → **BUG-03/04/05** |
| TC-15 Double-click submit → one request | Playwright | `tests/form-submit.spec.ts` |
| TC-16 Failed submit keeps the data | Playwright | `tests/form-submit.spec.ts` |
| TC-17 375px, no horizontal scroll | Playwright | `tests/mobile-layout.spec.ts` |
| TC-18 Membership prospect-id authorisation | Postman | folder 3 → **BUG-01** |

**Automated (Playwright), by tag:** `@smoke` TC-01, TC-02; `@regression @negative` TC-03, TC-04,
TC-05; `@regression` TC-10, TC-15, TC-16; `@compliance` TC-08; `@responsive` TC-17.
**Postman:** the `/validate-email/` contract (safe), and the write-path checks (consent, honeypot,
membership id) that must be run deliberately because they create prospects.
**Manual:** the data matrices (TC-06, TC-07), the product-decision case (TC-09), and the
accessibility judgement calls (TC-12, TC-13).

## 8. Test data and responsible-testing rules

The Pardot handler baked into the bundle is a production hostname, so a staging submission may
create a real prospect. The rules below keep that safe.

- Names are always `QA Candidate` / `Braha`, recognisable as a test anywhere downstream.
- Emails use `qa.candidate+<case-id>@<own-domain>`, so each submission is traceable.
- Phone numbers come from reserved ranges (`+1 303 555 01xx`).
- Live submissions stay in single digits across the assignment; every automated run stubs
  `POST /submit-form/` with `page.route()`, so CI never creates a prospect.
- Security payloads are limited to reflection checks in the browser and one SQL-injection string
  against the endpoint. No scanning, fuzzing or load generation.
- The Postman/curl layer must send a browser-like `User-Agent`: CloudFront answers **403** to
  default client agents (the collection already sets one). The Playwright tests need no such
  override — real browsers send an accepted UA on their own.

## 9. Exit criteria and known gaps

Ready to report when every P0 passes, no P1 defect is open without an owner, and every defect in
[`bug-report.md`](bug-report.md) has been raised with the product owner.

Known gaps at this depth: no Pardot-side confirmation, no email or SMS delivery verification, no
`axe`/Lighthouse pass, two browser engines only. With another day: data-drive TC-06 and TC-07, add
`axe-core` to the Playwright run, and put a Lighthouse budget on the form page.
