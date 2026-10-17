import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share } from 'react-native';
import { config } from '@/constants/config';
import { isStaff, useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { enquire } from '@/services/account';
import { errorMessage, isApiError } from '@/services/api/errors';
import { copyLeadToSheet } from '@/services/contact';
import type { Pin } from '@/types/models';

/** Public link for a project (the website's project page). */
export const projectShareUrl = (pin: Pin) => `${config.siteUrl}/projects/${pin.slug}`;

export function useProjectActions() {
  const router = useRouter();
  const toast = useToast();
  const { user, status } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);

  /**
   * "Enquire now". Signed in: the lead is created from the account on the server
   * (no form), then the full details open. Guests: the contact form, with the
   * project filled in — the same as the website's project pages.
   */
  const enquireAbout = useCallback(
    async (pin: Pin) => {
      if (status !== 'signedIn' || !user) {
        router.push({ pathname: '/contact', params: { project: pin.title } });
        return;
      }
      if (busyId) return;
      setBusyId(pin.id);
      try {
        const d = await enquire(pin.id);
        if (d.lead && !d.already) {
          copyLeadToSheet({
            project: pin.title || `#${pin.number}`,
            role: d.role,
            name: d.name,
            whatsapp: d.whatsapp,
            email: d.email,
            consent: true,
            consent_call: false,
            consent_whatsapp: false,
            source: 'mobile-app',
          });
        }
        const note = !d.lead ? '' : d.already ? 'already' : 'sent';
        router.push({
          pathname: '/project/[slug]',
          params: { slug: pin.slug, enquiry: note, via: d.whatsapp || '' },
        });
        if (isStaff(user)) toast('Staff accounts don’t create leads — showing details.');
      } catch (e) {
        if (isApiError(e, 'unauthorized')) {
          toast('Your session has ended. Please sign in again.');
          router.push('/auth/sign-in');
        } else {
          toast(errorMessage(e));
        }
      } finally {
        setBusyId(null);
      }
    },
    [busyId, router, status, toast, user],
  );

  const share = useCallback(async (pin: Pin) => {
    const url = projectShareUrl(pin);
    try {
      await Share.share({ title: pin.title, message: `Check out this project on Mappingg: ${pin.title}\n${url}`, url });
    } catch {
      /* the share sheet was dismissed */
    }
  }, []);

  return { enquireAbout, share, busyId };
}
