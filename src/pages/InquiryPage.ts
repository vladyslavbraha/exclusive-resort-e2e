import { Page, Locator, Request, expect } from '@playwright/test';

export type ContactMethod = 'Phone' | 'Text' | 'Email';

/** Decoded body of a POST /submit-form/ request, ready to assert on. */
export interface SubmitPayload {
  form: string;
  values: Record<string, string>;
}

/**
 * Page Object for the membership inquiry form (#pardot-short-form).
 * User-facing locators (getByRole/getByPlaceholder) are used so the object survives CSS refactors.
 */
export class InquiryPage {
  readonly page: Page;
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly email: Locator;
  readonly zip: Locator;
  readonly phone: Locator;
  readonly consent: Locator;
  readonly smsOptIn: Locator;
  readonly submit: Locator;
  /** The honeypot — must stay invisible; a real user never touches it. */
  readonly honeypot: Locator;

  constructor(page: Page) {
    this.page = page;
    const form = page.locator('#pardot-short-form');
    this.firstName = form.getByPlaceholder('First');
    this.lastName = form.getByPlaceholder('Last');
    this.email = form.getByPlaceholder('name@example.com');
    this.zip = form.getByPlaceholder('Postal Code');
    this.phone = form.locator('input[name="telephone"]');
    this.consent = form.locator('input[name="termsAgreement"]');
    this.smsOptIn = form.locator('input[name="smsOptIn"]');
    this.submit = form.locator('button[type="submit"]:visible');
    this.honeypot = form.locator('#hp-field');
  }

  private async type(field: Locator, value: string) {
    await field.click();
    await field.pressSequentially(value);
  }

  /** Visible control for a FormKit checkbox (native input is off-screen). */
  private checkboxControl(name: string): Locator {
    return this.page.locator(`#pardot-short-form label:has(input[name="${name}"]) .formkit-decorator`);
  }

  async setConsent(on = true) {
    if ((await this.consent.isChecked()) !== on) await this.checkboxControl('termsAgreement').click();
  }

  async setSmsOptIn(on = true) {
    if ((await this.smsOptIn.isChecked()) !== on) await this.checkboxControl('smsOptIn').click();
  }

  /** Click Submit once the form has enabled it (async email validation must settle first). */
  async submitForm() {
    await expect(this.submit).toBeEnabled({ timeout: 15000 });
    await this.submit.click();
  }

  async goto() {
    // The Vue app must finish hydrating before FormKit will capture input. networkidle never
    // settles here (Nuxt keeps prefetching route payloads), so navigate to domcontentloaded, give
    // hydration a bounded settle window, then gate on the first field being editable.
    await this.page.goto('/inquire/', { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
    await expect(this.firstName).toBeEditable();
  }

  /** The clickable control for a contact method (the native input is positioned off-screen). */
  radio(method: ContactMethod): Locator {
    return this.page.locator(
      `#pardot-short-form li.formkit-option:has(input[value="${method}"]) .formkit-label`,
    );
  }

  /** The underlying native radio input, for checked-state assertions. */
  radioInput(method: ContactMethod): Locator {
    return this.page.locator(`#pardot-short-form input[name="preferredContactType"][value="${method}"]`);
  }

  async fill(lead: {
    firstName: string; lastName: string; email: string; zip: string; phone: string; contactMethod: ContactMethod;
  }) {
    // .fill() sets DOM values but not FormKit's Vue model, so the form would submit empty.
    // Real keystrokes are required for the reactive model to capture each field.
    await this.type(this.firstName, lead.firstName);
    await this.type(this.lastName, lead.lastName);
    await this.type(this.email, lead.email);
    await this.email.blur(); // trigger async email validation deterministically
    await this.type(this.zip, lead.zip);
    await this.type(this.phone, lead.phone);
    await this.radio(lead.contactMethod).click();
  }

  /**
   * Intercept POST /submit-form/ and return a fake success without hitting Pardot.
   * Returns a promise resolving with the decoded payload. The wait starts here, before the form
   * fires the request, so the capture cannot be missed under parallel load.
   */
  async stubSubmit(fakeId = 999999999): Promise<{ payload: Promise<SubmitPayload> }> {
    await this.page.route('**/submit-form/', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: fakeId } }),
      }),
    );
    // Wrapped in an object so `await stubSubmit()` does not recursively unwrap (and thus block on)
    // the still-pending request promise.
    const payload = this.page.waitForRequest('**/submit-form/').then((req) => InquiryPage.decode(req));
    return { payload };
  }

  /** Force /validate-email/ to pass, so a test does not depend on a real mailbox. */
  async stubEmailValidation(valid = true) {
    await this.page.route('**/validate-email/', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid }) }),
    );
  }

  /** The wire format: JSON envelope whose `values` is a url-encoded query string. */
  static decode(req: Request): SubmitPayload {
    const raw = JSON.parse(req.postData() ?? '{}') as { values?: string; form?: string };
    const values: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(raw.values ?? '')) values[k] = v;
    return { form: raw.form ?? '', values };
  }
}
