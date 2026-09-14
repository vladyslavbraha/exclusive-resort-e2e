# Bug Report — Exclusive Resorts Membership Inquiry Form

**System under test:** `https://public-site.stage.exclusiveresorts.com/inquire/` (staging)
**Method:** ~60 min exploratory session on the live form, plus request inspection in DevTools and
direct calls to the endpoints the form uses.

Findings are ordered by severity. Everything below the "Confirmed" heading was observed directly;
the two items under "Needs confirmation" would create real prospects to prove, so they are left for
a controlled run (see the Postman collection).

## Summary

| ID | Title | Severity | Area |
|---|---|---|---|
| BUG-01 | Membership form trusts a client-supplied prospect id (IDOR) | Critical | Security |
| BUG-02 | Anti-spam honeypot is read out by screen readers | High | Accessibility |
| BUG-03 | Email validation endpoint leaks raw server exceptions | High | Security |
| BUG-04 | Email validation runs an unthrottled live check on every keystroke | Medium | Performance / Security |
| BUG-05 | Email validation endpoint answers GET with 200 instead of 405 | Medium | API contract |
| BUG-06 | Console hydration error on every page load | Medium | Stability |
| BUG-07 | Two separate form implementations (desktop and mobile DOM) | Medium | Maintainability |
| BUG-08 | Submit sends a JSON body under a form-urlencoded content type | Low | API contract |
| BUG-09 | Form does not match its own spec (missing dropdowns, split name) | Low | Documentation |

---

## Confirmed

### BUG-01 — Membership form trusts a client-supplied prospect id · Critical
**Steps:**
1. Submit the inquiry form once; the response returns a prospect id, e.g. `{"data":{"id":126837745}}`.
2. Open the second form on the page (membership questions) and submit it; the request is
   `POST /submit-membership-application/` with `{"pardotId":126837745, ...}` in the body.
3. The request carries no auth or CSRF token, and the id also sits in the `pardot_prospect_id`
   cookie. Ids are sequential.

**Expected:** the server ties the update to the caller's own session, and rejects an application
for a prospect the caller did not create.
**Actual:** the prospect to update is chosen by a number in the request body. Since ids are
sequential and there is no authorization, iterating the id could overwrite any other member's
prospect (company, title, affiliations). Not exploited here — that would modify real records; the
request shape is enough to raise it. One controlled test with two self-created ids would confirm it.

### BUG-02 — Anti-spam honeypot is read out by screen readers · High
**Steps:**
1. Open the form and inspect the field with placeholder "Can we message you?*" (`#hp-field`).
2. Check it in the accessibility tree / with VoiceOver.

**Expected:** a honeypot must be hidden from everyone, including assistive tech (`aria-hidden`,
`display:none`, or off the accessibility tree).
**Actual:** the field has only `tabindex="-1"`. It has no `aria-hidden`, and is `display:block`,
so a screen reader announces it as a normal, seemingly-required question. A blind user fills it,
the server treats the submission as a bot, and their lead is silently discarded with no error —
invisible to the user and to sighted QA.

### BUG-03 — Email validation endpoint leaks raw server exceptions · High
**Steps:**
```
curl -X POST https://public-site.stage.exclusiveresorts.com/validate-email/ \
  -H 'content-type: application/json' --data '{}'
```
**Expected:** a 4xx status with a generic validation message; internal detail kept in server logs.
**Actual:** HTTP **200** with the raw exception in the body:
`{"valid":false,"error":"TypeError: Cannot read properties of undefined (reading 'endsWith')"}`.
Injection-shaped input returns a `SyntaxError` string that also reveals the upstream answered with
an HTML error page. Internal implementation detail is exposed to any caller.

### BUG-04 — Email validation runs an unthrottled live check on every keystroke · Medium
**Steps:** type in the Email field and watch the Network tab; `POST /validate-email/` fires on
every keystroke. Send 10 rapid calls from the terminal.
**Expected:** debounced client-side, rate-limited server-side, and ideally authenticated.
**Actual:** every call reaches a live SMTP deliverability check (a non-existent mailbox on a real
domain returns `valid:false`), taking 1.3–6.9 s each, with no rate limiting on ten rapid calls.
Unauthenticated, costs money per call, and is a denial-of-service surface.

### BUG-05 — Email validation endpoint answers GET with 200 · Medium
**Steps:** `curl https://public-site.stage.exclusiveresorts.com/validate-email/`
**Expected:** `405 Method Not Allowed` on a POST-only endpoint.
**Actual:** returns `200`.

### BUG-06 — Console hydration error on every page load · Medium
**Steps:** open `/inquire/` with the console open.
**Expected:** a clean console on load.
**Actual:** `Hydration completed but contains mismatches` appears on every load. Beyond the noise,
it signals the server-rendered and client-rendered markup disagree, which is what makes the form
brittle to automate and can leave event handlers wired up late.

### BUG-07 — Two separate form implementations · Medium
**Steps:** complete the form on desktop, then at a phone-width viewport (≤375px).
**Expected:** one form that reflows responsively.
**Actual:** the narrow layout renders a different DOM — its consent checkbox even has a distinct
`...AgreementMobile` id. Two parallel implementations of the same form double the surface for
inconsistency and mean a fix or a field change has to be made twice.

### BUG-08 — Submit sends a JSON body under a form-urlencoded content type · Low
**Steps:** submit a valid lead and inspect the request.
**Expected:** the `Content-Type` header matches the body.
**Actual:** the body is a JSON envelope `{"values":"<url-encoded query>","form":"SHORT_FORM"}` sent
with `Content-Type: application/x-www-form-urlencoded`. It works today, but the mismatch is fragile
against any stricter proxy or parser.

### BUG-09 — Form does not match its own spec · Low
**Steps:** compare the rendered form to the documented field list.
**Expected:** the page matches the spec.
**Actual:** the documented "Preferred Time of Day" and "Preferred Days" dropdowns are not on the
page, yet empty `preferredTime` / `preferredDays` keys still ride in the payload; and "Name" is two
fields (First, Last), not the single field the spec describes. Stale spec or dead payload fields.

---

## Needs confirmation

These would create real prospects to prove, so they were not run against production. The Postman
collection has ready requests (folder 2) to confirm them in a controlled way.

### BUG-10 — Consent may be enforced only in the browser · High (if confirmed)
All form validation is JavaScript (there are no native `required` attributes), and `POST
/submit-form/` is reachable directly. If the server accepts a submission with `termsAgreement`
missing or `false`, a marketing lead is created with no consent record — a compliance breach.
**To confirm:** the "Consent missing" request in Postman folder 2; a returned prospect id is the bug.

### BUG-11 — Honeypot may not be enforced server-side · Medium (if confirmed)
If `MessagingPreferences` (the honeypot) is only checked in the browser, a bot posting straight to
the endpoint bypasses it. **To confirm:** the "Honeypot filled" request in Postman folder 2.

---

## Not a bug (verified good behaviour)

- A `<script>` payload in the Name field is rejected client-side ("Name is not an allowed value")
  and never executes.
- The Email field's format validation correctly rejects malformed addresses before any submission.
