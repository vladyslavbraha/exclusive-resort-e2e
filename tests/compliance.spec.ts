import { test, expect } from '@fixtures/test';
import { validLead } from '@fixtures/inquiry.data';

test.describe('Compliance', () => {
  test('TC-06 the form cannot be submitted without consent @compliance', async ({ inquiryForm, page }) => {
    await inquiryForm.stubEmailValidation();
    await inquiryForm.fillLead(validLead);

    let submitted = false;
    await page.route('**/submit-form/', (route) => { submitted = true; route.abort(); });

    await inquiryForm.submitButton.click({ force: true }).catch(() => {});

    expect(submitted).toBe(false);
    await expect(inquiryForm.consentCheckbox).not.toBeChecked();
  });
});
