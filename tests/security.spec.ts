import { test, expect } from '@playwright/test';
import { InquiryPage } from '@pages/InquiryPage';
import { validLead } from '@fixtures/inquiry.data';

test.describe('Security', () => {
  test('TC-10 XSS in a name is rejected client-side and never executes @regression', async ({ page }) => {
    let dialogFired = false;
    page.on('dialog', async (d) => { dialogFired = true; await d.dismiss(); });

    const inquiry = new InquiryPage(page);
    await inquiry.goto();
    await inquiry.stubEmailValidation();

    await inquiry.fill({ ...validLead, firstName: '<script>alert(1)</script>' });
    // The form disallows script-like input in the name and refuses to submit it.
    await expect(page.locator('#pardot-short-form .formkit-message')).toContainText(/not an allowed value/i);

    await inquiry.setConsent();
    await inquiry.submit.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
    expect(dialogFired, 'no script should have executed').toBe(false);
  });
});
