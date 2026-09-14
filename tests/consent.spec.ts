import { test, expect } from '@fixtures/inquiryTest';
import { validLead } from '@fixtures/inquiryData';

test('TC-06 the form cannot be submitted without agreeing to consent @compliance', async ({ inquiryForm, page }) => {
  await inquiryForm.stubEmailValidation();
  await inquiryForm.fillLead(validLead);

  let submitted = false;
  await page.route('**/submit-form/', (route) => { submitted = true; route.abort(); });

  await inquiryForm.submitButton.click({ force: true }).catch(() => {});

  expect(submitted).toBe(false);
  await expect(inquiryForm.consentCheckbox).not.toBeChecked();
});
