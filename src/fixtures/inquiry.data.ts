import { Lead } from '@pages/InquiryPage';

// Clearly fake data, so a test submission is recognisable if it reaches the CRM.
export const validLead: Lead = {
  firstName: 'QA Candidate',
  lastName: 'Braha',
  email: 'qa.candidate@example.com',
  zip: '80301',
  phone: '+1 303 555 0142',
  contactMethod: 'Email',
};

export const invalidEmails = ['foo@', 'foo.com', '@example.com', 'foo@@example.com', 'foo bar@example.com'];
