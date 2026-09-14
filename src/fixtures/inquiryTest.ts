import { test as base } from '@playwright/test';
import { InquiryPage } from '@pages/InquiryPage';

export const test = base.extend<{ inquiryForm: InquiryPage }>({
  inquiryForm: async ({ page }, use) => {
    const inquiryForm = new InquiryPage(page);
    await inquiryForm.open();
    await use(inquiryForm);
  },
});

export { expect } from '@playwright/test';
