import { test, expect } from '@playwright/test';
import { InquiryPage } from '@pages/InquiryPage';
import { validLead, invalidEmails } from '@fixtures/inquiry.data';

test.describe('Field validation', () => {
  test('TC-03 empty submit is blocked and shows required errors @regression @negative', async ({ page }) => {
    const inquiry = new InquiryPage(page);
    await inquiry.goto();

    let posted = false;
    await page.route('**/submit-form/', (r) => { posted = true; r.abort(); });

    await inquiry.submit.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);

    expect(posted, 'no request should leave the browser for an empty form').toBe(false);
    // FormKit surfaces a per-field message rather than a single banner.
    await expect(page.locator('#pardot-short-form .formkit-message').first()).toBeVisible();
  });

  test('TC-04 malformed email is rejected @regression @negative', async ({ page }) => {
    const inquiry = new InquiryPage(page);
    await inquiry.goto();
    await inquiry.stubEmailValidation(); // isolate format validation from deliverability

    for (const bad of invalidEmails) {
      await inquiry.email.click();
      await inquiry.email.fill('');
      await inquiry.email.pressSequentially(bad);
      await inquiry.email.blur();
      await expect(
        page.locator('#pardot-short-form .formkit-message'),
        `"${bad}" should be rejected`,
      ).toContainText(/valid email/i);
    }
  });

  test('TC-04 a valid unusual email is accepted @regression', async ({ page }) => {
    const inquiry = new InquiryPage(page);
    await inquiry.goto();
    await inquiry.stubEmailValidation();

    await inquiry.email.click();
    await inquiry.email.pressSequentially('qa.candidate+tag@example.co.uk');
    await inquiry.email.blur();
    await page.waitForTimeout(500);
    await expect(page.locator('#pardot-short-form .formkit-message')).toHaveCount(0);
  });

  test('TC-05 phone rejects letters when typed and pasted @regression @negative', async ({ page }) => {
    const inquiry = new InquiryPage(page);
    await inquiry.goto();

    // typed
    await inquiry.phone.click();
    await inquiry.phone.pressSequentially('abcd');
    expect(await inquiry.phone.inputValue(), 'typed letters must not remain').not.toMatch(/[a-z]/i);

    // pasted — the brief's own example bug
    await inquiry.phone.fill('');
    await inquiry.phone.evaluate((el: HTMLInputElement) => {
      el.focus();
      const dt = new DataTransfer();
      dt.setData('text/plain', 'abcd');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    });
    await page.waitForTimeout(200);
    expect(await inquiry.phone.inputValue(), 'pasted letters must not remain').not.toMatch(/[a-z]/i);
  });

  test('TC-07 unicode in a name survives into the payload @regression', async ({ page }) => {
    const inquiry = new InquiryPage(page);
    await inquiry.goto();
    await inquiry.stubEmailValidation();
    const { payload } = await inquiry.stubSubmit();

    await inquiry.fill({ ...validLead, firstName: 'Ünïcödé', lastName: '日本語' });
    await inquiry.setConsent();
    await inquiry.submitForm();

    const { values } = await payload;
    expect(values.FirstName).toBe('Ünïcödé');
    expect(values.LastName).toBe('日本語');
  });
});
