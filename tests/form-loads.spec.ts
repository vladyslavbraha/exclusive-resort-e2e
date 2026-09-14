import { test, expect } from '@fixtures/inquiryTest';

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
