import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, PlanCompare, subStyles } from '@/components/subscription/SubUi';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { colors, fonts, radius } from '@/constants/theme';
import { useAuth } from '@/providers/AuthProvider';
import { usePlansQuery } from '@/hooks/useSubscriptionsEnabled';
import { CATEGORY_LABEL, categoryForRole, formatInr, limitText, perLabel, shownLimits, type Category, type PublicPlan } from '@/services/subscriptions';

// Pricing (website: /pricing): every active plan from the database, in three
// sections, with the same call to action per plan — guests sign up with the
// plan pre-selected; signed-in accounts open their own plan's checkout.

type IconName = keyof typeof Ionicons.glyphMap;

const SECTIONS: { key: Category; tab: string; icon: IconName; intro: string }[] = [
  { key: 'developer', tab: 'Developers', icon: 'business', intro: 'List projects free, then add brochures, floor plans, galleries, site-visit booking and priority promotion per project.' },
  { key: 'cp', tab: 'Channel Partners', icon: 'people', intro: 'Open project details, download brochures, manage your client leads and see future prices — pick the access you need.' },
  { key: 'buyer', tab: 'Home Buyers', icon: 'home', intro: 'Compare, save and share projects free. Premium adds vastu and legal guidance, expert help and a portfolio manager.' },
];

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'person-add', title: 'Pick your account type', text: 'Developer / Builder, Channel Partner or Buyer — each has its own plans.' },
  { icon: 'layers', title: 'Choose a plan while signing up', text: 'Free is selected by default. You can also pick any paid plan right on the sign-up form.' },
  { icon: 'lock-closed', title: 'Pay securely (paid plans only)', text: 'Buyers pay right after sign-up. Developers and channel partners pay once their RERA number is verified.' },
  { icon: 'checkmark-circle', title: 'Get exactly your plan’s access', text: 'Free accounts get the Free features; each paid plan unlocks only what it lists. Upgrade any time.' },
];

const TRUST: { icon: IconName; title: string; text: string }[] = [
  { icon: 'lock-closed', title: 'Secure payments', text: 'Processed by Razorpay' },
  { icon: 'trending-up', title: 'Upgrade any time', text: 'Credit for unused days' },
  { icon: 'notifications', title: 'No surprise renewals', text: 'Reminders 7 days & 1 day before' },
  { icon: 'shield-checkmark', title: 'Nothing is deleted', text: 'Your data stays if a plan ends' },
];

const BILLING = [
  'The exact amount, with any GST, is shown before you pay. Payments are processed securely by Razorpay; Mappingg never sees or stores your card details.',
  'Plans renew only when you choose to — we remind you 7 days and 1 day before your plan ends.',
  'Upgrade any time: you get credit for the unused part of your current plan. Moving to a smaller plan takes effect at the end of your term.',
  'When a plan ends, nothing is deleted — your projects, leads and saved properties stay; only paid features pause until you renew.',
  'RERA and green-certification badges always show the verified status — a paid plan never changes it.',
];

/** Features shown on a card before "See all". */
const CARD_FEATURES = 6;

function planIcon(p: PublicPlan, i: number, count: number): IconName {
  if (p.is_free) return 'leaf';
  if (p.recommended) return 'ribbon';
  return i === count - 1 ? 'layers' : 'rocket';
}

export default function PricingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { status, user } = useAuth();
  const signedIn = status === 'signedIn' && !!user;
  const mine = signedIn ? categoryForRole(user!.role) : null;
  const [active, setActive] = useState<Category>(() => (SECTIONS.some((s) => s.key === params.tab) ? (params.tab as Category) : (mine ?? 'developer')));
  const plansQ = usePlansQuery();

  const cta = (category: Category, p: PublicPlan) => {
    if (!signedIn) {
      const role = category === 'cp' ? 'agent' : category;
      return (
        <Button
          title={p.is_free ? `Create free ${CATEGORY_LABEL[category]} account` : `Sign up with ${p.name}`}
          variant={p.recommended ? 'primary' : 'secondary'}
          icon={p.recommended ? 'arrow-forward' : undefined}
          onPress={() => router.push({ pathname: '/auth/sign-up', params: { role, ...(p.is_free ? {} : { plan: p.code }) } })}
        />
      );
    }
    if (mine !== category) return <Button title={`For ${CATEGORY_LABEL[category]} accounts`} variant="secondary" disabled />;
    return (
      <Button
        title={p.is_free ? 'View my plan' : `Choose ${p.name}`}
        variant={p.recommended ? 'primary' : 'secondary'}
        icon={p.recommended ? 'arrow-forward' : undefined}
        onPress={() => router.push(p.is_free ? '/subscription' : { pathname: '/subscription', params: { plan: p.code } })}
      />
    );
  };

  // Subscription master switch off: the website has no pricing page (404).
  if (plansQ.data && plansQ.data.enabled === false) {
    return <EmptyState icon="pricetags-outline" title="Plans are not available right now" text="Every feature works as usual. Check back later." />;
  }

  const section = SECTIONS.find((s) => s.key === active)!;
  const list = (plansQ.data?.plans || []).filter((p) => p.category === active).sort((a, b) => a.sort - b.sort);

  return (
    <Screen background={colors.land} onRefresh={() => void plansQ.refetch()} refreshing={plansQ.isRefetching}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Pricing plans</Text>
        <Text style={styles.h1}>
          Choose the right <Text style={styles.plum}>plan for your</Text> <Text style={styles.green}>real estate goals</Text>
        </Text>
        <Text style={subStyles.muted}>Flexible, value-packed plans for Developers, Channel Partners and Home Buyers.</Text>
        {signedIn && mine ? (
          <Button title="My plan & billing" variant="ghost" icon="arrow-forward" compact onPress={() => router.push('/subscription')} style={styles.heroLink} />
        ) : !signedIn ? (
          <Button title="Already have an account? Sign in" variant="ghost" compact onPress={() => router.push('/auth/sign-in')} style={styles.heroLink} />
        ) : null}
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {SECTIONS.map((s) => {
          const on = s.key === active;
          return (
            <Pressable key={s.key} onPress={() => setActive(s.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.tab, on && styles.tabOn]}>
              <Ionicons name={s.icon} size={16} color={on ? '#fff' : colors.forest} />
              <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>
                {s.tab}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[subStyles.muted, styles.intro]}>
        {section.intro}
        {mine === active ? <Text style={styles.b}> · Your account</Text> : null}
      </Text>

      {plansQ.isPending ? (
        <LoadingState label="Loading plans…" />
      ) : plansQ.isError ? (
        <ErrorState error={plansQ.error} onRetry={() => void plansQ.refetch()} />
      ) : list.length ? (
        <View style={subStyles.stack}>
          {list.map((p, i) => (
            <PriceCard key={p.code} plan={p} icon={planIcon(p, i, list.length)} cta={cta(active, p)} />
          ))}
          <View style={styles.trust}>
            {TRUST.map((t) => (
              <View key={t.title} style={styles.trustItem}>
                <Ionicons name={t.icon} size={18} color={colors.forest} />
                <View style={styles.flex}>
                  <Text style={styles.b}>{t.title}</Text>
                  <Text style={subStyles.small}>{t.text}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={styles.compareHead}>
            <Text style={styles.h2}>Compare every feature</Text>
            <Text style={subStyles.muted}>Side by side, plan by plan.</Text>
          </View>
          <PlanCompare plans={list} open />
        </View>
      ) : (
        <Card>
          <Text style={subStyles.muted}>No plans are published for this account type yet.</Text>
        </Card>
      )}

      <View style={[subStyles.stack, styles.section]}>
        {STEPS.map((st, i) => (
          <View key={st.title} style={styles.step}>
            <View style={styles.stepN}>
              <Text style={styles.stepNText}>{i + 1}</Text>
            </View>
            <View style={styles.flex}>
              <View style={subStyles.row}>
                <Ionicons name={st.icon} size={16} color={colors.forest} />
                <Text style={styles.b}>{st.title}</Text>
              </View>
              <Text style={subStyles.small}>{st.text}</Text>
            </View>
          </View>
        ))}
      </View>

      <Card icon="receipt-outline" title="Billing, taxes & renewals" style={styles.section}>
        {BILLING.map((t) => (
          <View key={t} style={styles.check}>
            <Ionicons name="checkmark" size={16} color={colors.park} />
            <Text style={[subStyles.muted, styles.flex]}>{t}</Text>
          </View>
        ))}
      </Card>

      <Card style={styles.section}>
        <Text style={styles.h2}>Questions about a plan?</Text>
        <Text style={subStyles.muted}>Talk to the Mappingg team — we will help you pick the right plan for your projects or business.</Text>
        <Button title="Contact us" onPress={() => router.push({ pathname: '/contact', params: { topic: 'Pricing & plans' } })} />
      </Card>
    </Screen>
  );
}

function PriceCard({ plan: p, icon, cta }: { plan: PublicPlan; icon: IconName; cta: React.ReactNode }) {
  const [more, setMore] = useState(false);
  const limits = shownLimits(p);
  const included = p.features.filter((f) => f.included);
  const excluded = p.features.filter((f) => !f.included).slice(0, 3);
  const shown = included.slice(0, CARD_FEATURES);
  const rest = included.slice(CARD_FEATURES);
  return (
    <View style={[styles.card, p.recommended && styles.cardHot]}>
      {p.recommended ? (
        <View style={styles.popular}>
          <Ionicons name="ribbon" size={12} color="#fff" />
          <Text style={styles.popularText}>Most popular</Text>
        </View>
      ) : null}
      <View style={subStyles.row}>
        <Ionicons name={icon} size={20} color={p.recommended ? colors.goldDeep : colors.forest} />
        <Text style={styles.cardName}>{p.name}</Text>
      </View>
      {p.tagline ? <Text style={subStyles.muted}>{p.tagline}</Text> : null}
      <View style={styles.price}>
        <Text style={styles.priceBig}>{p.is_free ? '₹0' : formatInr(p.price_paise)}</Text>
        <Text style={subStyles.muted}>{perLabel(p)}</Text>
      </View>
      {cta}
      {limits.length ? (
        <View style={styles.limits}>
          {limits.map((l) => (
            <View key={l.key} style={styles.check}>
              <Ionicons name="speedometer-outline" size={15} color={colors.goldDeep} />
              <Text style={[styles.limitText, styles.flex]}>{limitText(l)}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {(more ? included : shown).map((f) => (
        <View key={f.key} style={styles.check}>
          <Ionicons name="checkmark" size={15} color={colors.park} />
          <Text style={[styles.featText, styles.flex]}>{f.label}</Text>
        </View>
      ))}
      {more
        ? excluded.map((f) => (
            <View key={f.key} style={styles.check}>
              <Ionicons name="close" size={15} color="#a3aaa6" />
              <Text style={[styles.featText, styles.off, styles.flex]}>{f.label}</Text>
            </View>
          ))
        : null}
      {rest.length + excluded.length > 0 ? (
        <Pressable onPress={() => setMore((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: more }} style={styles.moreBtn} hitSlop={6}>
          <Text style={styles.moreText}>{more ? 'Show less' : rest.length ? `See all ${included.length} features` : 'What’s not included'}</Text>
          <Ionicons name={more ? 'chevron-up' : 'chevron-down'} size={16} color={colors.forest} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  b: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  hero: { gap: 8, marginBottom: 16 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, color: colors.park, letterSpacing: 0.8, textTransform: 'uppercase' },
  h1: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34, color: colors.ink, letterSpacing: -0.7 },
  plum: { color: '#6b3d7a' },
  green: { color: colors.forest },
  heroLink: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  h2: { fontFamily: fonts.bold, fontSize: 19, color: colors.ink, letterSpacing: -0.3 },
  tabs: { flexDirection: 'row', gap: 6, backgroundColor: '#fff', borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colors.line },
  tab: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: 6 },
  tabOn: { backgroundColor: colors.forest },
  tabText: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 12.5, color: colors.forest },
  tabTextOn: { color: '#fff' },
  intro: { marginVertical: 14 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 10 },
  cardHot: { borderColor: colors.gold, borderWidth: 2 },
  popular: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  popularText: { color: '#fff', fontFamily: fonts.bold, fontSize: 11.5 },
  cardName: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.ink, letterSpacing: -0.4 },
  price: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  priceBig: { fontFamily: fonts.extrabold, fontSize: 32, color: colors.ink, letterSpacing: -1 },
  limits: { gap: 6, backgroundColor: colors.land, borderRadius: radius.md, padding: 10 },
  limitText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  check: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  featText: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.text },
  off: { color: '#8f9893', textDecorationLine: 'line-through' },
  moreBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 6 },
  moreText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.forest },
  trust: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 12, rowGap: 12 },
  trustItem: { width: '50%', flexDirection: 'row', gap: 8, paddingRight: 8 },
  compareHead: { marginTop: 8, gap: 2 },
  section: { marginTop: 18 },
  step: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 12 },
  stepN: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  stepNText: { color: '#fff', fontFamily: fonts.bold, fontSize: 13 },
});
