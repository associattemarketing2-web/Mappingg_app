import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { colors, fonts } from '@/constants/theme';
import { ApiError, isApiError } from '@/services/api/errors';
import { appRouteForSitePath } from '@/services/subscriptions';

// "Plan limit" popup (website: showPlanGate on the live map). A signed-in
// channel partner / buyer over their plan's limit — or outside a one-city
// plan, or using a feature their plan doesn't include — gets a 402 from the
// server; this explains it and offers the upgrade. Nothing else changes.

interface Gate {
  title: string;
  error: ApiError;
}

interface PlanGateApi {
  /** Shows the popup when `e` is a plan refusal (402) and returns true; otherwise false. */
  handle(e: unknown, title?: string): boolean;
}

const Ctx = createContext<PlanGateApi>({ handle: () => false });

export const usePlanGate = () => useContext(Ctx);

export function PlanGateProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [gate, setGate] = useState<Gate | null>(null);

  const handle = useCallback((e: unknown, title?: string) => {
    if (!isApiError(e, 'payment_required')) return false;
    setGate({ title: title || 'This project', error: e });
    return true;
  }, []);
  const api = useMemo(() => ({ handle }), [handle]);

  const plan = gate?.error.plan;
  const usage = plan?.usage;
  const close = () => setGate(null);
  const upgrade = () => {
    close();
    // The guard's "manage" link is the account's subscription page; open its app screen.
    let to: Href | null = null;
    if (plan?.manage?.startsWith('/')) {
      const [path, search = ''] = plan.manage.split('?');
      to = appRouteForSitePath(path!, search);
    }
    if (plan?.upgrade?.code) to = { pathname: '/subscription', params: { plan: plan.upgrade.code } };
    router.push(to || '/pricing');
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <Modal visible={!!gate} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close">
          <Pressable style={styles.box} onPress={() => undefined} accessibilityViewIsModal accessibilityLabel="Plan limit">
            <View style={styles.lock}>
              <Ionicons name="lock-closed" size={22} color="#7a5f1f" />
            </View>
            <Text style={styles.title} accessibilityRole="header">
              {gate?.title}
            </Text>
            <Text style={styles.text}>{gate?.error.message || 'Upgrade your plan to open more projects.'}</Text>
            {usage && usage.limit != null ? (
              <Text style={styles.usage}>
                {usage.used} of {usage.limit} used
                {usage.resetsAt ? ` · resets ${new Date(usage.resetsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
              </Text>
            ) : null}
            <View style={styles.btns}>
              <Button title={plan?.upgrade?.name ? `Upgrade to ${plan.upgrade.name}` : 'See plans'} onPress={upgrade} />
              <Button
                title="Compare plans"
                variant="secondary"
                onPress={() => {
                  close();
                  router.push('/pricing');
                }}
              />
              <Button title="Not now" variant="ghost" onPress={close} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,30,24,.55)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  box: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 18, padding: 22 },
  lock: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7f0df' },
  title: { marginTop: 12, marginBottom: 6, fontFamily: fonts.bold, fontSize: 19, color: colors.ink, letterSpacing: -0.3 },
  text: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: '#4a5568', marginBottom: 8 },
  usage: { fontFamily: fonts.regular, fontSize: 13, color: '#66716b' },
  btns: { marginTop: 16, gap: 8 },
});

