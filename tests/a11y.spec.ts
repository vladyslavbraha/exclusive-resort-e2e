import { test, expect } from '@playwright/test';
import { InquiryPage } from '@pages/InquiryPage';

test.describe('Accessibility', () => {
  // KNOWN DEFECT (TC-12): the honeypot #hp-field is only removed from the tab order
  // (tabindex=-1). It stays in the accessibility tree (aria-hidden is not set, display:block),
  // so a screen-reader user reaches a field labelled "Can we message you?*", fills it, and their
  // lead is silently discarded. This test asserts the CORRECT behaviour and is marked as expected
  // to fail; when the field is properly hidden it will start passing and flag that the fix landed.
  test('TC-12 honeypot is hidden from assistive technology @a11y', async ({ page }) => {
    test.fail(); // documents the current defect; flips to passing when the honeypot is fixed
    const inquiry = new InquiryPage(page);
    await inquiry.goto();
    const removedFromTree = await inquiry.honeypot.evaluate((el) => {
      const s = getComputedStyle(el);
      return (
        el.getAttribute('aria-hidden') === 'true' ||
        s.display === 'none' ||
        s.visibility === 'hidden' ||
        !!el.closest('[aria-hidden="true"]')
      );
    });
    expect(removedFromTree, 'honeypot must not be exposed to screen readers').toBe(true);
  });

  test('TC-13 the form is keyboard-navigable and skips the honeypot @a11y', async ({ page }) => {
    const inquiry = new InquiryPage(page);
    await inquiry.goto();

    // Walk the tab order from the first field and record what receives focus.
    await inquiry.firstName.focus();
    const order: string[] = [];
    for (let i = 0; i < 12; i++) {
      const id = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        return a ? (a.getAttribute('name') || a.id || a.tagName) : '';
      });
      order.push(id);
      await page.keyboard.press('Tab');
    }

    // Every user-facing field must be reachable by keyboard...
    for (const name of ['FirstName', 'LastName', 'Email', 'ZIP', 'telephone']) {
      expect(order, `${name} must be reachable by Tab`).toContain(name);
    }
    // ...and the honeypot must never be focused.
    expect(order, 'the honeypot must be skipped by the keyboard').not.toContain('MessagingPreferences');
  });
});
