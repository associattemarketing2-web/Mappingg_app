import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { isBuyer, useAuth } from '@/providers/AuthProvider';
import { getBuyerProfile } from '@/services/account';

// The paid plan picked on the sign-up form (saved as profile.plan on the
// account, like the website). "My subscription" offers to activate it until a
// paid plan is bought. Buyers read it from their profile; for developer and
// channel-partner accounts the app also remembers the choice made on this phone.

const KEY = (who: string) => `mg_signup_plan:${who.toLowerCase()}`;

export async function rememberSignupPlan(who: string, code: string): Promise<void> {
  if (!who) return;
  try {
    if (code) await AsyncStorage.setItem(KEY(who), code.slice(0, 40));
    else await AsyncStorage.removeItem(KEY(who));
  } catch {
    /* storage unavailable — the banner is only a reminder */
  }
}

export function useSignupPlan(): string | null {
  const { user, status } = useAuth();
  const who = user?.email || user?.mobile || '';
  const q = useQuery({
    queryKey: ['sub', 'signup-plan', who],
    enabled: status === 'signedIn' && !!who,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      if (isBuyer(user)) {
        const p = await getBuyerProfile().catch(() => null);
        if (p?.profile?.plan) return String(p.profile.plan).slice(0, 40);
      }
      return (await AsyncStorage.getItem(KEY(who)).catch(() => null)) || '';
    },
  });
  return q.data || null;
}
