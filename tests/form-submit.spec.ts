import { test, expect } from '@fixtures/inquiryTest';
import { validLead } from '@fixtures/inquiryData';

test('TC-02 a valid lead is submitted with all its data @smoke', async ({ inquiryForm }) => {
  await inquiryForm.stubEmailValidation();
  await inquiryForm.stubSubmitEndpoint();
  const submitted = inquiryForm.waitForSubmittedForm();

  await inquiryForm.fillLead(validLead);
  await inquiryForm.acceptConsent();
  await inquiryForm.submit();

  const { form, fields } = await submitted;
  expect(form).toBe('SHORT_FORM');
  expect(fields.FirstName).toBe(validLead.firstName);
  expect(fields.Email).toBe(validLead.email);
  expect(fields.termsAgreement).toBe('true');
});

test('TC-15 clicking submit twice sends only one request @regression', async ({ inquiryForm, page }) => {
  let requestCount = 0;
  await page.route('**/submit-form/', async (route) => {
    requestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":{"id":1}}' });
  });
  await inquiryForm.stubEmailValidation();

  await inquiryForm.fillLead(validLead);
  await inquiryForm.acceptConsent();
  await expect(inquiryForm.submitButton).toBeEnabled();
  await inquiryForm.submitButton.dblclick();
  await page.waitForTimeout(2_000);

  expect(requestCount).toBe(1);
});

test('TC-16 a failed submit shows an error and keeps the entered data @regression', async ({ inquiryForm, page }) => {
  await inquiryForm.stubEmailValidation();
  await page.route('**/submit-form/', (route) => route.fulfill({ status: 500, body: 'error' }));

  await inquiryForm.fillLead(validLead);
  await inquiryForm.acceptConsent();
  await inquiryForm.submit();
  await page.waitForTimeout(1_500);

  expect(page.url()).not.toContain('submission-success');
  expect(await inquiryForm.firstName.inputValue()).toBe(validLead.firstName);
});
