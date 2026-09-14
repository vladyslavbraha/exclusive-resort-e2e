# Manual Execution Guide — Inquiry Form

**Target:** `https://public-site.stage.exclusiveresorts.com/inquire/`
**Companion to:** `docs/test-plan.md` (scope, risks, prioritisation)

Execute in session order — each session shares a setup, so running them in order avoids
reconfiguring the browser between cases. Record the result inline: **PASS**, **FAIL** (+ what you
saw), or **N/A** (+ why).

---

## 0. Before you start

- **Browser:** Chrome, normal window, DevTools open on **Network** (Preserve log **on**) and
  **Console** visible. Watch both for every case.
- **Test identity — use these exact values everywhere:**
  - First: `QA Candidate` · Last: `Braha`
  - Email: `qa.candidate+<case-id>@<your-domain>` (e.g. `qa.candidate+tc02@…`) — one per submission
    so you can trace it later
  - Phone: `+1 303 555 0142` (reserved range, never a real subscriber)
  - Postal: `80301`
- **Submission budget:** staging posts to the Pardot handler `www2.exclusiveresorts.com/l/27772/…`,
  which is **not** a staging hostname, so a submission here may create a real prospect. Keep actual
  successful submissions to single digits across the whole run.
- **Never type into** the field with placeholder "Can we message you?*" — it is a spam trap
  (`#hp-field`). Filling it is a test of its own (TC-11), not part of any other case.
- **After each failed expectation:** screenshot + copy the Console error + note the Network entry.

### Capture for automation — do this during TC-02, it is needed later

When the valid submission goes through:
1. Network tab → find `submit-form` → right-click → **Copy as cURL** → paste it to me.
2. Right-click in the Network list → **Save all as HAR with content** → keep the file.
3. Note the **status code**, the **response body**, and where the browser navigated afterwards.

Without this the Postman collection is guesswork.

---

## Session A — desktop, happy path and validation

### TC-01 · Form loads · P0
**Steps:** open `/inquire/` in a fresh tab (hard reload, cache disabled).
**Expected:** First, Last, Email, Postal Code, phone widget with country selector, three radios
(Phone / Text / Email), consent checkbox, SMS checkbox, Submit — all visible and labelled. No
console errors.
**Also record:** (a) are there dropdowns for *Preferred Time of Day* or *Preferred Days* anywhere,
including after choosing Phone or Text? The brief says they exist; they are not in the markup.
(b) Is the "Can we message you?*" field visible to you? It must not be.
**Result:**

### TC-02 · Valid submission · P0
**Data:** the standard identity, contact method **Email**, consent **checked**, SMS **unchecked**.
**Steps:** fill → submit → watch Network.
**Expected:** exactly one `POST /submit-form/`; browser lands on `/submission-success/?success`; a
confirmation is visible; no console errors.
**Also record:** the payload field values (expand the request → Payload), the status code, and
**do the cURL + HAR capture above**.
**Result:**

### TC-03 · Empty submit · P0
**Steps:** reload the form, press Submit with every field empty.
**Expected:** nothing is sent (Network stays quiet); every required field shows its own error, not
one generic banner; focus moves to the first invalid field; the consent checkbox is reported too.
**Result:**

### TC-04 · Email format · P1
**Reject these:** `foo@` · `foo.com` · `@example.com` · `foo@@example.com` · `foo bar@example.com`
**Accept these:** `qa.candidate+tag@example.co.uk` · `qa@my-domain.com`
**Steps:** for each value, fill only Email, blur, then try Submit with the rest valid.
**Expected:** rejected values block submission with a message naming the email field; accepted ones
pass validation.
**Also record:** does the error appear on blur, on submit, or both?
**Result:**

### TC-05 · Phone · P1
Run each, with the country selector on **US** unless stated:
| # | Action | Expected |
|---|---|---|
| a | Type `abcd` | rejected, letters do not stay |
| b | **Paste** `abcd` | rejected — paste must not bypass the filter |
| c | Paste `(303) 555-0142` | accepted or punctuation stripped, consistently |
| d | Type `+1 303 555 0142` while US (+1) selected | no duplicated `+1+1` in the payload |
| e | Switch to **United Kingdom**, enter `+44 7700 900123` | accepted, payload carries one clean number |
| f | Paste a 30-character number | field caps at 25 chars — check it does **not** silently truncate into a wrong-but-valid number without telling you |
**Result:**

### TC-06 · Postal code · P1
**Accept:** `80301` · `80301-1234` · `K1A 0B1` (CA) · `SW1A 1AA` (UK) · `75008` (FR) · `100-0001` (JP)
**Reject:** empty · `abcde` · `!!!!!` · 30 characters
**Expected:** all six international formats accepted — the field is documented as "US and
international", so a 5-digit-only rule is a defect, not a preference.
**Result:**

### TC-07 · Name fields · P2
Try in First and Last: one character · 256 characters · 1000 characters · `Владислав` · `Ünïcödé` ·
`日本語` · an emoji · `  spaces around  `.
**Expected:** a maximum is enforced **with a message**, not by silent truncation; unicode survives
into the payload unmangled (check the Payload tab); surrounding spaces trimmed.
**Result:**

### TC-09 · Text without SMS opt-in · P1
**Steps:** valid data, preferred contact **Text**, consent checked, SMS opt-in **unchecked**, submit.
**Expected:** one of two defined outcomes — either the form demands the SMS opt-in and says so, or
it accepts and the payload clearly records "SMS not consented". Record which one happens verbatim;
an accepted lead whose channel and consent contradict each other with nothing marking the conflict
is the finding here.
**Result:**

### TC-10 · XSS in a name field · P0
**Payloads, one at a time in First (then in Last):**
`<script>alert(1)</script>` · `"><img src=x onerror=alert(1)>` · `javascript:alert(1)` · `{{7*7}}`
**Expected:** no dialog, no script execution, no console error. If the success page echoes the
name, it shows the literal text. `{{7*7}}` must **not** render as `49`.
**Also check:** Application → Local Storage → keys `er_prospect_email` / `er_prospect_data`. If the
payload is stored there, reload the success page and see whether it renders escaped.
**Result:**

---

## Session B — API layer (needs the terminal)

These bypass the browser, which is the point: the form's validation is entirely JavaScript — there
are no `required` attributes in the markup — so the only real guard is the server.

**Request shape, from the captured submission.** `/submit-form/` takes a JSON envelope whose
`values` key is a URL-encoded query string, and the browser sends it with a
`content-type: application/x-www-form-urlencoded` header that does not match that body:

```
{"values":"Email=…&FirstName=…&termsAgreement=true&…","form":"SHORT_FORM"}
```

Record the **status code** and **response body** for each command. A successful submission answers
`{"data":{"id":<pardot prospect id>}}`. CloudFront rejects non-browser agents with 403, so the
`User-Agent` below is required and is not itself under test.

```
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36'
EP='https://public-site.stage.exclusiveresorts.com/submit-form/'
H=(-H "User-Agent: $UA" -H 'content-type: application/x-www-form-urlencoded' \
   -H 'origin: https://public-site.stage.exclusiveresorts.com' \
   -H 'referer: https://public-site.stage.exclusiveresorts.com/inquire/')
```

### TC-08 · Consent enforced server-side · P0
```
# (b) consent flag missing entirely
curl -i -X POST "$EP" "${H[@]}" --data-raw '{"values":"Email=qa.candidate%2Btc08b@example.com&FirstName=QA%20Candidate&LastName=Braha&ZIP=80301&Phone=%2B1%20303%20555%200142&preferredContactType=Email","form":"SHORT_FORM"}'

# (c) consent explicitly false
curl -i -X POST "$EP" "${H[@]}" --data-raw '{"values":"Email=qa.candidate%2Btc08c@example.com&FirstName=QA%20Candidate&LastName=Braha&ZIP=80301&Phone=%2B1%20303%20555%200142&preferredContactType=Email&termsAgreement=false","form":"SHORT_FORM"}'
```
**Expected:** both rejected with a field-level error. **A prospect id in the response is the most
serious finding on this form** — it means a prospect is created with no consent record, and the
browser is the only thing standing between the business and a compliance breach.

```
# (d) tampered hidden tracking fields
curl -i -X POST "$EP" "${H[@]}" --data-raw '{"values":"Email=qa.candidate%2Btc08d@example.com&FirstName=QA%20Candidate&LastName=Braha&ZIP=80301&Phone=%2B1%20303%20555%200142&preferredContactType=Email&termsAgreement=true&utm_source=%3Cscript%3Ealert(1)%3C%2Fscript%3E&C_SFDCLastCampaignID=..%2F..%2Fetc%2Fpasswd","form":"SHORT_FORM"}'

# (e) unknown form name — is `form` validated against a list?
curl -i -X POST "$EP" "${H[@]}" --data-raw '{"values":"Email=qa.candidate%2Btc08e@example.com&termsAgreement=true","form":"NOT_A_REAL_FORM"}'
```
**Expected:** (d) values validated or neutralised, not forwarded verbatim to Pardot. (e) rejected —
an unknown `form` value must not fall through to a default handler.
**Result:**

### TC-11 · Honeypot is enforced server-side · P1
```
curl -i -X POST "$EP" "${H[@]}" --data-raw '{"values":"Email=qa.candidate%2Btc11@example.com&FirstName=QA%20Candidate&LastName=Braha&ZIP=80301&Phone=%2B1%20303%20555%200142&preferredContactType=Email&termsAgreement=true&MessagingPreferences=spam-bot-filled-this","form":"SHORT_FORM"}'
```
**Expected:** rejected as spam. A response that *looks* like success is acceptable **if** the lead
is genuinely dropped — record exactly what comes back so the two can be told apart. If the honeypot
is only checked in the browser, the trap is decorative: a bot posts straight here, and note there is
**no CSRF token anywhere in the captured request**, so nothing else blocks it.
**Result:**

### TC-18 · `/validate-email/` contract · P1
This endpoint was not in the brief. It fires on **every keystroke** in the Email field, proxies to a
real deliverability check (a non-existent domain, `example.com` and disposable domains all come back
`valid:false`), and takes 1.3–6.9 s to answer.

```
VE='https://public-site.stage.exclusiveresorts.com/validate-email/'
curl -i -X POST "$VE" -H "User-Agent: $UA" -H 'content-type: application/json' --data-raw '{}'
curl -i -X POST "$VE" -H "User-Agent: $UA" -H 'content-type: application/json' --data-raw '{"email":"'"'"' OR 1=1--@example.com"}'
curl -i -X GET  "$VE" -H "User-Agent: $UA"
```
**Already observed on my run — confirm it reproduces for you:**
- missing `email` key → `{"valid":false,"error":"TypeError: Cannot read properties of undefined (reading 'endsWith')"}` — a raw server exception returned to the client, at HTTP **200**
- injection-shaped input → `{"valid":false,"error":"SyntaxError: Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"}` — the upstream answered with an HTML page and the route surfaced the parse failure verbatim, again at **200**
- `GET` → **200**, where 405 belongs
- ten rapid calls → all served, no throttling of any kind
**Expected:** 4xx for malformed input, a generic error message with the detail in server logs only,
405 on GET, and some rate limiting on an unauthenticated endpoint that spends money per call.
**Result:**

### TC-19 · Membership step 2 authorises the prospect id · P0 (security)
**Do NOT run this against ids you did not create — it writes to real Pardot prospects.** Use only
two ids from your own submissions.

The inquiry flow is two steps. The short form returns a prospect id
(`{"data":{"id":126837745}}`), and `/submit-membership-application/` then enriches that prospect —
company, title, affiliations — taking the id straight from the request body:
```
{"pardotId":126837745,"email":"…","firstName":"…","hasKnownMembers":"No", …}
```
There is **no auth token and no CSRF token** in the captured request; the id is also sitting in the
`pardot_prospect_id` cookie, and ids are **sequential**. So the guard against "user A edits user B's
prospect" is nothing but knowing a number.

**Steps (own ids only):** submit the short form twice to get id_1 and id_2. Then POST
`/submit-membership-application/` with `pardotId: id_1` while everything else describes id_2 — or
simply with your own id but from a fresh session that never created it.
**Expected:** the server rejects an application for a prospect the caller did not create in this
session (403/401), or ties the write to a server-side session rather than to a client-supplied id.
**If it accepts it, that is an IDOR:** any prospect can be overwritten by iterating the id. Highest
severity on the assessment. Record the response.
**Result:**

## Session C — accessibility

### TC-12 · The honeypot must be invisible to screen readers too · P1
This is the sharpest case in the set: the trap is a real text input with the placeholder
"Can we message you?*" and `tabindex="-1"`. The keyboard skips it — but that does not remove it from
a screen reader. If a blind user reaches it and answers what reads like a required question, their
lead is silently discarded and nobody ever finds out.
**Steps:** DevTools → Elements → select `#hp-field` → **Accessibility** pane. Then turn on
VoiceOver (⌘F5) and navigate the form with VO+arrow keys.
**Expected:** the field is absent from the accessibility tree (`aria-hidden="true"` or equivalent)
and VoiceOver never announces it.
**Result:**

### TC-13 · Keyboard-only · P1
**Steps:** from the address bar, reach and complete the form using only Tab / Shift-Tab, arrow keys
for the radios, Space for the checkboxes, Enter to submit.
**Expected:** tab order matches visual order; focus is clearly visible at every stop, including the
country selector and both custom checkboxes; the country dropdown can be opened, used and left
without trapping focus; the honeypot is never focused.
**Result:**

### TC-14 · Semantics · P1
**Steps:** with VoiceOver on, walk the form; then trigger validation errors and listen.
**Expected:** every input is announced with its own label; the radios are announced as one group
named for "Preferred Contact Method"; the consent checkbox is announced **with the consent
sentence**, not just "checkbox" — consent from a screen-reader user must be informed; errors are
announced when they appear, not just shown in red.
**Result:**

---

## Session D — resilience

### TC-15 · Double submit · P1
**Steps:** fill valid data, then double-click Submit fast. Repeat with Enter pressed twice quickly.
**Expected:** exactly one `POST /submit-form/` in Network; the button goes disabled/pending; one
success page.
**Result:**

### TC-16 · Failed and slow submit · P1
**Steps:**
1. DevTools → Network → throttling **Slow 3G** → submit valid data. Watch for a pending state and
   for any second request.
2. Throttling **Offline** → submit.
3. Back online: right-click the `submit-form` request → **Block request URL** → submit again.
**Expected:** (1) a pending indicator, button not re-pressable, exactly one request. (2) and (3) an
explicit failure — `/form-submit-fail/?error` or a visible message — with the entered data still in
the form so it can be retried, and a retry creating one lead, not two.
**A success state shown while the request failed is the worst outcome on this form:** the prospect
believes they made contact and nobody knows they did not.
**Result:**

---

## Session E — mobile

### TC-17 · 375 px · P2
**Steps:** DevTools device toolbar → iPhone SE (375 × 667) → complete the form.
**Expected:** no horizontal page scroll; the two-column layout becomes one column with nothing
clipped or overlapping; the consent text is fully readable; radios, checkboxes, country selector and
Submit are comfortably tappable (≈44 px); the country dropdown opens inside the viewport; the
keyboard does not cover Submit with no way to reach it.
**Result:**

---

## Session F — free exploration (30–40 min, no script)

The brief grades exploratory findings separately, and sharp findings beat long lists. Poke at:

- **Back button** after a successful submit, then Forward; reload the success page. Does anything
  resubmit?
- **Two tabs**: fill the form in both, submit one, then the other.
- **Copy-paste** everything: paste into every field, including multi-line text and text with
  trailing newlines.
- **Submit the second form on the page** (`#pardot-membership-form`, the membership questions) and
  see whether it interferes with the inquiry form's state.
- **Disable JavaScript** and load the page. Is the form still submittable in any form? There are no
  native `required` attributes, so if it degrades to a plain HTML POST, nothing validates.
- **Resize mid-entry** from desktop to mobile — does entered data survive the reflow?
- **Leave the form idle 20+ minutes**, then submit — session/CSRF expiry.
- **Rapid field switching**: fill, clear, refill, blur quickly; watch for errors that appear and
  never clear.
- **Console** the whole time: any error, warning or failed request that appears without you causing
  it is worth a note.

---

## Reporting back

Per case, send me: **ID → PASS / FAIL** and, for failures, what you saw (message text, status code,
console error, screenshot). For anything from Session F, a one-line description is enough — I will
turn it into the bug-report format the brief asks for (ID, Title, Severity, Steps, Expected,
Actual).

Priority order if time runs short: **TC-08 → TC-11 → TC-12 → TC-02 → TC-16 → TC-03**. Those six
carry the compliance, security and lead-loss risk; the rest is coverage.
