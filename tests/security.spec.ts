import { test, expect } from '@fixtures/test';
import { validLead } from '@fixtures/inquiry.data';

test.describe('Security', () => {
  test('TC-10 a script in the name field is blocked and never runs @regression', async ({ inquiryForm, page }) => {
    let scriptRan = false;
    page.on('dialog', async (dialog) => { scriptRan = true; await dialog.dismiss(); });

    await inquiryForm.stubEmailValidation();
    await inquiryForm.fillLead({ ...validLead, firstName: '<script>alert(1)</script>' });

    await expect(inquiryForm.fieldError).toContainText(/not an allowed value/i);
    expect(scriptRan).toBe(false);
  });
});
