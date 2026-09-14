// Test identity: recognisable as fake anywhere downstream, per docs/test-plan.md §8.
export const validLead = {
  firstName: 'QA Candidate',
  lastName: 'Braha',
  email: 'qa.candidate+pw@example.com',
  zip: '80301',
  phone: '+1 303 555 0142',
  contactMethod: 'Email' as const,
};

export const xssPayloads = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  'javascript:alert(1)',
  '{{7*7}}',
];

export const invalidEmails = ['foo@', 'foo.com', '@example.com', 'foo@@example.com', 'foo bar@example.com'];
