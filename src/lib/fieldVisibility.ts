import type { CustomField, Pin, VisibilityField } from '@/types/models';

/** Visible unless the admin explicitly switched the field off (same rule as the website). */
export function isFieldOn(pin: Pick<Pin, 'fieldVisibility'>, field: VisibilityField): boolean {
  const v = pin.fieldVisibility ? pin.fieldVisibility[field] : undefined;
  return v !== false;
}

/** Admin-added custom fields that are switched on and have content. */
export function visibleCustomFields(pin: Pick<Pin, 'customFields'>): CustomField[] {
  return pin.customFields.filter((cf) => cf && cf.visible !== false && (cf.label || cf.value));
}

/** The value of a field only when it is set and visible. */
export function shown(pin: Pin, field: VisibilityField, value: string | undefined | null): string {
  return value && isFieldOn(pin, field) ? value : '';
}

/** MahaRERA-style registration numbers in the RERA field (for the "Verify" link). */
export function reraNumbers(pin: Pin): string[] {
  if (!pin.reraNumber || !isFieldOn(pin, 'rera')) return [];
  return pin.reraNumber.split(/[\s,;/]+/).filter((x) => /^P[RM]?\d{6,}/i.test(x));
}

/** Key USP text split into bullet points (same splitting as the website's details panel). */
export function uspPoints(pin: Pin): string[] {
  if (!pin.keyUsp || !isFieldOn(pin, 'key_usp')) return [];
  return pin.keyUsp
    .split(/\n|•|\*|~|\|/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

/** One-line teaser under a project name (website: teaserLine). */
export function teaserLine(p: Pin): string {
  const bits = [shown(p, 'configuration', p.configuration), shown(p, 'configuration', p.sqft)].filter(Boolean).join(' · ');
  const status = (p.status || '').toLowerCase();
  if (status === 'construction') {
    const poss = p.possessionTimeline && isFieldOn(p, 'possession') ? `Possession: ${p.possessionTimeline}` : '';
    return [bits, poss].filter(Boolean).join(' · ') || 'Details on request';
  }
  if (status === 'upcoming') {
    const launch = p.launchDate && isFieldOn(p, 'possession') ? `Launching: ${p.launchDate}` : '';
    return [bits, launch].filter(Boolean).join(' · ') || 'Launching soon';
  }
  if (status === 'sold') return 'This project has been sold out.';
  return p.whatsAvailable || shown(p, 'price', p.price) || 'Enquire for availability';
}
