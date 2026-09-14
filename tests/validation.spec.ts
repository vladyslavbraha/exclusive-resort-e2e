import { test, expect } from '@fixtures/test';
import { invalidEmails } from '@fixtures/inquiry.data';

test.describe('Field validation', () => {
  test('TC-03 the form cannot be submitted empty @regression @negative', async ({ inquiryForm, page }) => {
    let submitted = false;
    await page.route('**/submit-form/', (route) => { submitted = true; route.abort(); });

    await inquiryForm.submitButton.click({ force: true }).catch(() => {});

    expect(submitted).toBe(false);
    await expect(inquiryForm.fieldError.first()).toBeVisible();
  });

  test('TC-04 an invalid email is rejected @regression @negative', async ({ inquiryForm }) => {
    await inquiryForm.stubEmailValidation();

    for (const email of invalidEmails) {
      await inquiryForm.email.fill('');
      await inquiryForm.email.pressSequentially(email);
      await inquiryForm.email.blur();
      await expect(inquiryForm.fieldError, `"${email}" should be rejected`).toContainText(/valid email/i);
    }
  });

  test('TC-05 the phone field rejects letters @regression @negative', async ({ inquiryForm }) => {
    await inquiryForm.phone.click();
    await inquiryForm.phone.pressSequentially('abcd');
    expect(await inquiryForm.phone.inputValue()).not.toMatch(/[a-z]/i);
  });
});
