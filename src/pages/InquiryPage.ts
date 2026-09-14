import { Page, Locator, Request, expect } from '@playwright/test';

export type ContactMethod = 'Phone' | 'Text' | 'Email';

export interface Lead {
  firstName: string;
  lastName: string;
  email: string;
  zip: string;
  phone: string;
  contactMethod: ContactMethod;
}

export interface SubmittedForm {
  form: string;
  fields: Record<string, string>;
}

export class InquiryPage {
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly email: Locator;
  readonly zip: Locator;
  readonly phone: Locator;
  readonly consentCheckbox: Locator;
  readonly submitButton: Locator;
  readonly honeypot: Locator;
  readonly fieldError: Locator;

  constructor(private readonly page: Page) {
    const form = page.locator('#pardot-short-form');
    this.firstName = form.getByPlaceholder('First');
    this.lastName = form.getByPlaceholder('Last');
    this.email = form.getByPlaceholder('name@example.com');
    this.zip = form.getByPlaceholder('Postal Code');
    this.phone = form.locator('input[name="telephone"]');
    this.consentCheckbox = form.locator('input[name="termsAgreement"]');
    this.submitButton = form.locator('button[type="submit"]:visible');
    this.honeypot = form.locator('#hp-field');
    this.fieldError = form.locator('.formkit-message');
  }

  async open() {
    await this.page.goto('/inquire/', { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle', { timeout: 4_000 }).catch(() => {});
    await expect(this.firstName).toBeEditable();
  }

  contactMethodOption(method: ContactMethod): Locator {
    return this.page.locator(`#pardot-short-form li.formkit-option:has(input[value="${method}"]) .formkit-label`);
  }

  contactMethodInput(method: ContactMethod): Locator {
    return this.page.locator(`#pardot-short-form input[name="preferredContactType"][value="${method}"]`);
  }

  async fillLead(lead: Lead) {
    await this.typeInto(this.firstName, lead.firstName);
    await this.typeInto(this.lastName, lead.lastName);
    await this.typeInto(this.email, lead.email);
    await this.email.blur();
    await this.typeInto(this.zip, lead.zip);
    await this.typeInto(this.phone, lead.phone);
    await this.contactMethodOption(lead.contactMethod).click();
  }

  async acceptConsent() {
    await this.page.locator('#pardot-short-form label:has(input[name="termsAgreement"]) .formkit-decorator').click();
  }

  async submit() {
    await expect(this.submitButton).toBeEnabled();
    await this.submitButton.click();
  }

  async stubSubmitEndpoint(prospectId = 1) {
    await this.page.route('**/submit-form/', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: prospectId } }) }),
    );
  }

  async stubEmailValidation(valid = true) {
    await this.page.route('**/validate-email/', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid }) }),
    );
  }

  waitForSubmittedForm(): Promise<SubmittedForm> {
    return this.page.waitForRequest('**/submit-form/').then((request) => InquiryPage.readForm(request));
  }

  async honeypotIsHiddenFromScreenReaders(): Promise<boolean> {
    return this.honeypot.evaluate((field) => {
      const style = getComputedStyle(field);
      return field.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden';
    });
  }

  async tabThroughForm(steps = 10): Promise<string[]> {
    const focusedFieldNames: string[] = [];
    await this.firstName.focus();
    for (let i = 0; i < steps; i++) {
      focusedFieldNames.push(await this.page.evaluate(() => document.activeElement?.getAttribute('name') ?? ''));
      await this.page.keyboard.press('Tab');
    }
    return focusedFieldNames;
  }

  // FormKit only records values typed key by key; page.fill() would leave the form empty.
  private async typeInto(field: Locator, value: string) {
    await field.click();
    await field.pressSequentially(value);
  }

  private static readForm(request: Request): SubmittedForm {
    const body = JSON.parse(request.postData() ?? '{}') as { values?: string; form?: string };
    const fields: Record<string, string> = {};
    for (const [key, value] of new URLSearchParams(body.values ?? '')) fields[key] = value;
    return { form: body.form ?? '', fields };
  }
}
