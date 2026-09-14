import { test, expect } from '@fixtures/test';

test.describe('Responsive', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('TC-17 the form fits a phone screen without horizontal scrolling @responsive', async ({ inquiryForm, page }) => {
    await expect(inquiryForm.firstName).toBeVisible();
    await expect(inquiryForm.submitButton).toBeVisible();

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasHorizontalScroll).toBe(false);
  });
});
