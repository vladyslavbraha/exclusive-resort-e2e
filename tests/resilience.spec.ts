import { test, expect } from '@playwright/test';
import { InquiryPage } from '@pages/InquiryPage';
import { validLead } from '@fixtures/inquiry.data';

test.describe('Resilience', () => {
  test('TC-15 double-clicking Submit produces exactly one request @regression', async ({ page }) => {
    const inquiry = new InquiryPage(page);
    await inquiry.goto();
    await inquiry.stubEmailValidation();

    let count = 0;
    await page.route('**/submit-form/', async (route) => {
      count += 1;
      await new Promise((r) => setTimeout(r, 800)); // hold the response to widen the race window
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":{"id":1}}' });
    });

    await inquiry.fill(validLead);
    await inquiry.setConsent();
    await expect(inquiry.submit).toBeEnabled({ timeout: 15000 });
    await inquiry.submit.dblclick();
    await page.waitForTimeout(2000);

    expect(count, 'a double click must not create two leads').toBe(1);
  });

  test('TC-16 a failed submit surfaces an error, not a false success @regression', async ({ page }) => {
    const inquiry = new InquiryPage(page);
    await inquiry.goto();
    await inquiry.stubEmailValidation();
    await page.route('**/submit-form/', (route) => route.fulfill({ status: 500, body: 'boom' }));

    await inquiry.fill(validLead);
    await inquiry.setConsent();
    await inquiry.submitForm();
    await page.waitForTimeout(1500);

    // Must not land on the success state on a 500.
    expect(page.url()).not.toContain('submission-success');
    // The data must still be there to retry (no silent wipe).
    expect(await inquiry.firstName.inputValue()).toBe(validLead.firstName);
  });
});
