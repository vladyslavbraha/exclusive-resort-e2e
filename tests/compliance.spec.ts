import { test, expect } from '@playwright/test';
import { InquiryPage } from '@pages/InquiryPage';
import { validLead } from '@fixtures/inquiry.data';

test.describe('Compliance', () => {
  test('TC-06 submit is blocked in the browser while the consent box is unchecked @compliance', async ({ page }) => {
    const inquiry = new InquiryPage(page);
    await inquiry.goto();
    await inquiry.stubEmailValidation();

    // Fill a complete, valid lead but leave the privacy/consent checkbox untouched.
    await inquiry.fill(validLead);

    // No submission may leave the browser without consent — this is a legal requirement, not UX.
    let posted = false;
    await page.route('**/submit-form/', (route) => { posted = true; route.abort(); });

    await inquiry.submit.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);

    expect(posted, 'a lead must not be sent while consent is unchecked').toBe(false);
    await expect(inquiry.consent, 'the consent checkbox should remain unchecked').not.toBeChecked();
  });
});
