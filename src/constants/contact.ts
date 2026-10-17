import { config } from './config';

// Official Mappingg contact details (same values as the website's lib/contact.ts
// and the live map's WhatsApp / Call buttons).

export const EMAIL = 'mappingg.associatte@gmail.com';
export const WHATSAPP_NUMBER = '918228828200';
export const WHATSAPP_DISPLAY = '+91 82288 28200';
export const CALL_NUMBER = '918228828200';

export const whatsappGeneralUrl = () =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi, I'm interested in a project on Mappingg.com. Could you share more details?")}`;

export const whatsappProjectUrl = (title?: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi, I'm interested in ${title || 'this project'} on the Mappingg.com. Could you share more details?`)}`;

export const callUrl = () => `tel:+${CALL_NUMBER}`;

export const directionsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export const MAHARERA_VERIFY_URL = 'https://maharera.maharashtra.gov.in/projects-search-result';

/** Website pages opened in the in-app browser (static legal text). */
export const LEGAL_PAGES = [
  { title: 'Privacy Policy', path: '/privacy' },
  { title: 'Terms of Use', path: '/terms' },
  { title: 'Disclaimer', path: '/disclaimer' },
  { title: 'Cookie Policy', path: '/cookies' },
  { title: 'Map data & attribution', path: '/map-data' },
] as const;

export const siteLink = (path: string) => `${config.siteUrl}${path}`;

export const SOCIALS = [
  { name: 'Instagram', icon: 'logo-instagram', href: 'https://www.instagram.com/mappingg.associatte/' },
  { name: 'LinkedIn', icon: 'logo-linkedin', href: 'https://www.linkedin.com/company/mappingg-com/' },
  { name: 'YouTube', icon: 'logo-youtube', href: 'https://www.youtube.com/@mappingg-official' },
  { name: 'Facebook', icon: 'logo-facebook', href: 'https://www.facebook.com/share/1CH5PwZUsM/?mibextid=wwXIfr' },
] as const;
