import { test, expect } from '@fixtures/test';
import { validLead } from '@fixtures/inquiry.data';

test.describe('Inquiry form — smoke', () => {
  test('TC-01 the form loads with every field visible @smoke', async ({ inquiryForm }) => {
    await expect(inquiryForm.firstName).toBeVisible();
    await expect(inquiryForm.lastName).toBeVisible();
    await expect(inquiryForm.email).toBeVisible();
    await expect(inquiryForm.zip).toBeVisible();
    await expect(inquiryForm.phone).toBeVisible();
    await expect(inquiryForm.submitButton).toBeVisible();
    for (const method of ['Phone', 'Text', 'Email'] as const) {
      await expect(inquiryForm.contactMethodInput(method)).toBeAttached();
    }
  });

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
});
