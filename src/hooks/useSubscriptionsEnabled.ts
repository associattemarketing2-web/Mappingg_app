import { useQuery } from '@tanstack/react-query';
import { getPlans } from '@/services/subscriptions';

// The website's subscription master switch (Super admin → Subscriptions →
// Enable / Disable, or SUBSCRIPTIONS_ENABLED on the server). While it is off
// the website has no pricing page, plan links, plan picker, checkout or
// limits — so the app hides them too. Hidden until the server says "on".

export function usePlansQuery() {
  return useQuery({ queryKey: ['sub', 'plans'], queryFn: () => getPlans(), staleTime: 5 * 60_000, retry: 1 });
}

export function useSubscriptionsEnabled(): boolean {
  const q = usePlansQuery();
  // Servers from before the switch existed send no `enabled` flag: on.
  return !!q.data && q.data.enabled !== false;
}
