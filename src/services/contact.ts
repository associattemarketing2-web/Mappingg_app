import { config } from '@/constants/config';
import { apiRequest } from './api/client';

// Public contact form → the website's /api/contact (a lead in the Mappingg CRM).
// Same topics and choices as the website's components/ContactForm.tsx.

export const CONTACT_TOPICS = [
  { value: 'Project enquiry', label: 'Buying a home' },
  { value: 'List my project', label: 'List my project' },
  { value: 'Channel partner', label: 'Channel partner' },
  { value: 'Correction', label: 'Correction' },
  { value: 'Something else', label: 'Something else' },
] as const;

export const CONTACT_CHOICES = {
  city: ['Pune', 'Mumbai & MMR'],
  budget: ['Under ₹1 Cr', '₹1 – 2 Cr', '₹2 – 3 Cr', '₹3 Cr +'],
  bhk: ['1 BHK', '2 BHK', '3 BHK', '4+ BHK'],
  timeline: ['Within 3 months', '3–6 months', '6–12 months', 'Just exploring'],
} as const;

export const CONTACT_PLACEHOLDER: Record<string, string> = {
  'Project enquiry': 'Anything else? e.g. a project you liked, or a question about a locality.',
  'List my project': 'Project name, location and MahaRERA number.',
  'Channel partner': 'Your name or firm and MahaRERA agent number.',
  Correction: 'Which project, and what needs fixing?',
  'Something else': 'How can we help?',
};

export interface ContactInput {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  city: string;
  locality: string;
  budget: string;
  bhk: string;
  timeline: string;
  consent_call: boolean;
  consent_whatsapp: boolean;
}

export async function sendContact(input: ContactInput): Promise<void> {
  // Buyer details are only sent for the "Buying a home" topic (same as the website).
  const buying = input.subject === 'Project enquiry';
  const body = buying ? input : { ...input, city: '', locality: '', budget: '', bhk: '', timeline: '' };
  await apiRequest('/api/contact', { method: 'POST', body: { ...body, company: '' } });
}

/**
 * Optional copy of a signed-in enquiry to the Google Sheet the website's live
 * map also writes to. Best effort only: the lead is already saved on the server.
 */
export function copyLeadToSheet(payload: Record<string, unknown>): void {
  if (!config.leadSheetWebhookUrl.startsWith('https://')) return;
  fetch(config.leadSheetWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  }).catch(() => {
    /* never blocks or fails the enquiry */
  });
}
