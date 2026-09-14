import { test, expect } from '@playwright/test';
import { InquiryPage } from '@pages/InquiryPage';

// Runs on every project, but the assertion only matters at a narrow viewport.
test.describe('Responsive', () => {
  test('TC-17 form is usable with no horizontal scroll at 375px @responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const inquiry = new InquiryPage(page);
    await inquiry.goto();

    await expect(inquiry.firstName).toBeVisible();
    await expect(inquiry.submit).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow, 'the page must not scroll horizontally at 375px').toBe(false);
  });
});
