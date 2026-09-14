import { test, expect } from '@playwright/test';

// These hit the real staging backend, so they are opt-in: set RUN_LIVE_API=1.
// Only non-mutating calls live here — anything that creates a Pardot prospect (server-side
// consent bypass, honeypot, IDOR) stays in the Postman collection / manual run by design.
const live = process.env.RUN_LIVE_API === '1';
const BASE = process.env.BASE_URL ?? 'https://public-site.stage.exclusiveresorts.com';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

test.describe('API — /validate-email/ contract (TC-18)', () => {
  test.skip(!live, 'live API test — set RUN_LIVE_API=1 to run');

  test('a missing email key must not leak a server exception @regression', async ({ request }) => {
    const res = await request.post(`${BASE}/validate-email/`, {
      headers: { 'user-agent': UA, 'content-type': 'application/json' },
      data: {},
    });
    const body = await res.json();
    // FINDING: currently returns HTTP 200 with a raw TypeError string. Correct behaviour is a 4xx
    // and a generic message with the detail kept server-side.
    expect(res.status(), 'malformed input should be a client error, not 200').toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(body)).not.toMatch(/TypeError|SyntaxError|undefined \(reading/);
  });

  test('GET is not allowed on a POST-only endpoint @regression', async ({ request }) => {
    const res = await request.get(`${BASE}/validate-email/`, { headers: { 'user-agent': UA } });
    expect(res.status(), 'GET on a submit endpoint should be 405').toBe(405);
  });

  test('a well-formed deliverable address validates @smoke', async ({ request }) => {
    const res = await request.post(`${BASE}/validate-email/`, {
      headers: { 'user-agent': UA, 'content-type': 'application/json' },
      data: { email: 'vladbragga2005@gmail.com' },
    });
    expect(res.ok()).toBeTruthy();
    expect(await res.json()).toMatchObject({ valid: true });
  });
});
