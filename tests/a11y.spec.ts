import { test, expect } from '@fixtures/test';

test.describe('Accessibility', () => {
  test('TC-12 the hidden anti-spam field is not exposed to screen readers @a11y', async ({ inquiryForm }) => {
    test.fail(); // known bug: the honeypot is hidden from the tab order but still read by screen readers
    expect(await inquiryForm.honeypotIsHiddenFromScreenReaders()).toBe(true);
  });

  test('TC-13 the whole form can be completed using only the keyboard @a11y', async ({ inquiryForm }) => {
    const focusedFieldNames = await inquiryForm.tabThroughForm();

    for (const field of ['FirstName', 'LastName', 'Email', 'ZIP', 'telephone']) {
      expect(focusedFieldNames, `${field} should be reachable with Tab`).toContain(field);
    }
    expect(focusedFieldNames, 'the anti-spam field must be skipped').not.toContain('MessagingPreferences');
  });
});
