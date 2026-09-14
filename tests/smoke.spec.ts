import { test, expect } from '@playwright/test';
import { InquiryPage } from '@pages/InquiryPage';
import { validLead } from '@fixtures/inquiry.data';

test.describe('Inquiry form — smoke', () => {
  test('TC-01 form loads with all fields and the honeypot in the DOM @smoke', async ({ page }) => {
    const inquiry = new InquiryPage(page);
    await inquiry.goto();

    await expect(inquiry.firstName).toBeVisible();
    await expect(inquiry.lastName).toBeVisible();
    await expect(inquiry.email).toBeVisible();
    await expect(inquiry.zip).toBeVisible();
    await expect(inquiry.phone).toBeVisible();
    await expect(inquiry.submit).toBeVisible();
    for (const m of ['Phone', 'Text', 'Email'] as const) {
      await expect(inquiry.radioInput(m)).toBeAttached();
    }
    // Honeypot is present and removed from the tab order. Whether it is *also* hidden from
    // assistive tech is a known concern, checked in the a11y spec (TC-12), not asserted here.
    await expect(inquiry.honeypot).toBeAttached();
    await expect(inquiry.honeypot).toHaveAttribute('tabindex', '-1');
  });

  test('TC-02 valid submission posts the full payload (write stubbed) @smoke', async ({ page }) => {
    const inquiry = new InquiryPage(page);
    await inquiry.goto();
    await inquiry.stubEmailValidation();
    const { payload } = await inquiry.stubSubmit();

    await inquiry.fill(validLead);
    await inquiry.setConsent();
    await inquiry.submitForm();

    const { form, values } = await payload;
    expect(form).toBe('SHORT_FORM');
    expect(values.Email).toBe(validLead.email);
    expect(values.FirstName).toBe(validLead.firstName);
    expect(values.termsAgreement).toBe('true');
    expect(values.MessagingPreferences ?? '').toBe(''); // honeypot rides along empty
  });
});
