import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Alert, Empty, Msg, subStyles } from '@/components/subscription/SubUi';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Choice';
import { Screen } from '@/components/ui/Screen';
import { SelectField } from '@/components/ui/SelectField';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { siteLink } from '@/constants/contact';
import { colors, fonts, radius } from '@/constants/theme';
import { openRazorpay, RazorpayError } from '@/lib/razorpay';
import { useAuth } from '@/providers/AuthProvider';
import { errorMessage } from '@/services/api/errors';
import {
  checkout,
  fmtDate,
  formatInr,
  getMySubscription,
  KIND_LABEL,
  paymentCancelled,
  quote as getQuote,
  subKeys,
  unitLabel,
  verifyPayment,
  type CheckoutBody,
  type MySubscription,
  type PublicPlan,
  type QuoteRes,
} from '@/services/subscriptions';

// Checkout (website: components/subscriptions/Checkout.tsx): plan summary →
// (projects / city) → coupon → server-computed price breakdown → Razorpay →
// server verification. The app only sends the plan code and the choices;
// every amount shown comes from the server.

type Result = { state: 'paid' | 'pending' | 'failed' | 'scheduled' | 'activated'; text: string; invoice?: string | null };

export default function CheckoutScreen() {
  const { plan: code } = useLocalSearchParams<{ plan?: string }>();
  const me = useQuery({ queryKey: subKeys.current, queryFn: getMySubscription });
  if (me.isPending) return <LoadingState />;
  if (me.isError) return <ErrorState error={me.error} onRetry={() => void me.refetch()} />;
  const plan = me.data.available.find((p) => p.code === code && !p.is_free);
  if (!plan) return <ErrorState title="Plan not found" error={new Error('This plan is not available for your account.')} />;
  return <Checkout plan={plan} me={me.data} />;
}

function Checkout({ plan, me }: { plan: PublicPlan; me: MySubscription }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isProject = plan.billing_unit === 'project';
  const needsCity = plan.limits.some((l) => l.key === 'cp_max_cities' && l.value !== null);
  const eligible = useMemo(() => (me.projects || []).filter((p) => p.review !== 'rejected'), [me.projects]);
  const [projects, setProjects] = useState<string[]>(() => {
    const covered = (me.projects || []).filter((p) => p.covered).map((p) => p.id);
    return covered.length ? covered : eligible.slice(0, 1).map((p) => p.id);
  });
  const [city, setCity] = useState<string>(me.subscription?.city || '');
  const [coupon, setCoupon] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [gst, setGst] = useState({ open: false, name: '', gstin: '', address: '' });
  const [agree, setAgree] = useState(false);
  const [q, setQ] = useState<QuoteRes | null>(null);
  const [qErr, setQErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [payErr, setPayErr] = useState('');

  const body = useMemo<CheckoutBody>(
    () => ({
      plan: plan.code,
      ...(isProject ? { project_ids: projects } : {}),
      ...(needsCity && city ? { city } : {}),
      ...(appliedCoupon ? { coupon: appliedCoupon } : {}),
      ...(gst.open && (gst.name || gst.gstin) ? { billing: { name: gst.name || undefined, gstin: gst.gstin || undefined, address: gst.address || undefined } } : {}),
    }),
    [plan.code, isProject, projects, needsCity, city, appliedCoupon, gst],
  );

  const refresh = useCallback(async () => {
    if (isProject && !projects.length) {
      setQ(null);
      setQErr('Choose at least one project.');
      return;
    }
    if (needsCity && !city) {
      setQ(null);
      setQErr('Choose the city your plan should cover.');
      return;
    }
    setQErr('');
    try {
      setQ(await getQuote(body));
    } catch (e) {
      setQ(null);
      setQErr(errorMessage(e));
    }
  }, [body, isProject, projects.length, needsCity, city]);

  useEffect(() => {
    const t = setTimeout(() => void refresh(), 250);
    return () => clearTimeout(t);
  }, [refresh]);

  const done = () => {
    void qc.invalidateQueries({ queryKey: ['sub'] });
    router.back();
  };

  async function pay() {
    setBusy(true);
    setPayErr('');
    try {
      const r = await checkout(body);
      if (r.status === 'scheduled') {
        setResult({ state: 'scheduled', text: `You will move to ${plan.name} when your current term ends${me.subscription?.expires_at ? ` on ${fmtDate(me.subscription.expires_at)}` : ''}. Nothing is charged now.` });
        return;
      }
      if (r.status === 'activated') {
        setResult({ state: 'activated', text: `${plan.name} is active — no payment was needed.` });
        return;
      }
      if (!r.gateway) throw new Error('Could not open the payment window. Check your connection and try again.');
      let resp;
      try {
        resp = await openRazorpay({
          key: r.gateway.key,
          order_id: r.gateway.order_id,
          amount: r.gateway.amount,
          currency: r.gateway.currency,
          name: 'Mappingg',
          description: `${plan.name} — ${unitLabel(plan)}`,
          image: siteLink('/img/mappingg-icon-mark-sm.webp'),
          prefill: { email: user?.email || '', contact: user?.mobile || '' },
          notes: { plan: plan.code },
          theme: { color: colors.forest },
        });
      } catch (e) {
        // Closed the window or the payment failed: close our unpaid order (website: ondismiss).
        void paymentCancelled(r.payment_id).catch(() => undefined);
        if (e instanceof RazorpayError && e.cancelled) return;
        setPayErr(e instanceof Error ? e.message : 'The payment failed. You can try another method.');
        return;
      }
      try {
        const v = await verifyPayment(resp);
        if (v.status === 'paid') setResult({ state: 'paid', text: `Payment received — ${plan.name} is active.`, invoice: v.invoice_id });
        else if (v.status === 'pending') setResult({ state: 'pending', text: 'Your bank is still confirming the payment. Your plan switches on automatically as soon as it is confirmed — no need to pay again.' });
        else setResult({ state: 'failed', text: 'The payment did not go through. No money was taken for a failed payment. You can try again.' });
      } catch (e) {
        setResult({ state: 'pending', text: `We could not confirm the payment yet (${errorMessage(e)}). If money was taken, your plan switches on automatically within a few minutes — please don't pay twice.` });
      }
    } catch (e) {
      setPayErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const qt = q?.quote;
  const paidPlan = !plan.is_free;
  const cannotPay = !qt || !agree || busy || (q?.kind !== 'downgrade' && qt.total_paise > 0 && !me.payments.configured);

  if (result) {
    const good = result.state !== 'failed';
    return (
      <Screen contentStyle={styles.doneWrap}>
        <View style={[styles.big, !good && styles.bigBad]}>
          <Ionicons name={result.state === 'pending' ? 'hourglass' : good ? 'checkmark' : 'close'} size={36} color="#fff" />
        </View>
        <Text style={styles.doneTitle} accessibilityRole="header">
          {result.state === 'paid' || result.state === 'activated' ? 'You’re all set' : result.state === 'scheduled' ? 'Change scheduled' : result.state === 'pending' ? 'Payment pending' : 'Payment failed'}
        </Text>
        <Text style={[subStyles.muted, styles.center]}>{result.text}</Text>
        <View style={styles.doneBtns}>
          {result.invoice ? (
            <Button title="View invoice" variant="secondary" icon="document-text-outline" onPress={() => router.replace({ pathname: '/subscription/invoice/[id]', params: { id: result.invoice! } })} />
          ) : null}
          {result.state === 'failed' ? (
            <Button
              title="Try again"
              onPress={() => {
                setResult(null);
                setPayErr('');
              }}
            />
          ) : (
            <Button title="Done" onPress={done} />
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      background={colors.land}
      footer={
        <View style={styles.footer}>
          <View style={styles.footRow}>
            <Text style={styles.footLabel}>{q?.kind === 'downgrade' ? 'Due now' : 'Total payable'}</Text>
            <Text style={styles.footTotal}>{q?.kind === 'downgrade' ? '₹0' : qt ? formatInr(qt.total_paise) : '—'}</Text>
          </View>
          <Button
            title={busy ? 'Processing…' : q?.kind === 'downgrade' ? 'Schedule change' : qt && qt.total_paise === 0 ? 'Activate' : `Pay ${qt ? formatInr(qt.total_paise) : ''}`}
            icon={q?.kind === 'downgrade' || (qt && qt.total_paise === 0) ? undefined : 'lock-closed'}
            loading={busy}
            disabled={cannotPay}
            onPress={() => void pay()}
          />
          <Text style={[subStyles.small, styles.center]}>
            <Ionicons name="shield-checkmark" size={12} color={colors.muted} /> Secured by Razorpay. Card and UPI details never reach Mappingg.
          </Text>
        </View>
      }
    >
      <View style={subStyles.stack}>
        <View style={styles.head}>
          <Ionicons name="lock-closed" size={18} color={colors.forest} />
          <Text style={styles.title} accessibilityRole="header">
            Checkout — {plan.name}
          </Text>
        </View>
        {!me.payments.configured && paidPlan ? (
          <Alert tone="warn" icon="flash-off">
            <Text style={styles.b}>Online payments are being set up.</Text> You can see the exact price here; paying will be possible as soon as Mappingg switches payments on.
          </Alert>
        ) : null}
        {me.payments.mode === 'test' ? (
          <Alert tone="info" icon="flask">
            Test mode: use Razorpay test cards/UPI — no real money is charged.
          </Alert>
        ) : null}

        <View style={styles.card}>
          {plan.tagline ? <Text style={subStyles.muted}>{plan.tagline}</Text> : null}
          <View style={styles.price}>
            <Text style={styles.priceBig}>{formatInr(plan.price_paise)}</Text>
            <Text style={subStyles.muted}>{unitLabel(plan)}</Text>
          </View>
        </View>

        {isProject ? (
          <View style={styles.card}>
            <Text style={styles.label}>
              Projects on this plan <Text style={subStyles.small}>— billed per project</Text>
            </Text>
            {eligible.length ? (
              eligible.map((p) => {
                const on = projects.includes(p.id);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setProjects((cur) => (on ? cur.filter((x) => x !== p.id) : [...cur, p.id]))}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={[styles.pick, on && styles.pickOn]}
                  >
                    <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.forest : colors.muted} />
                    <View style={styles.flex}>
                      <Text style={styles.pickTitle}>{p.title}</Text>
                      <Text style={subStyles.small}>{[p.location, p.state, p.review === 'pending' ? 'Waiting for review' : 'Live'].filter(Boolean).join(' · ')}</Text>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <Empty text="Add a project in Projects Intake first, then choose it here." />
            )}
          </View>
        ) : null}

        {needsCity ? (
          <View style={styles.card}>
            {me.subscription?.city && me.subscription.plan_code === plan.code ? (
              <>
                <Text style={styles.label}>City your plan covers</Text>
                <Text style={styles.pickTitle}>{me.cities.find((c) => c.key === city)?.label || city}</Text>
              </>
            ) : (
              <SelectField label="City your plan covers" value={city} placeholder="Choose a city…" options={me.cities.map((c) => ({ value: c.key, label: c.label }))} onChange={setCity} />
            )}
            <Text style={subStyles.small}>Project details outside this city need Pro Max. Changing city later goes through Mappingg support.</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.couponRow}>
            <View style={styles.flex}>
              <TextField label="Coupon code" optional value={coupon} onChangeText={(t) => setCoupon(t.toUpperCase())} placeholder="Optional" maxLength={30} autoCapitalize="characters" />
            </View>
            <Button title="Apply" variant="secondary" compact disabled={!coupon.trim() || coupon.trim() === appliedCoupon} onPress={() => setAppliedCoupon(coupon.trim())} style={styles.apply} />
          </View>
          {appliedCoupon && q?.coupon_error ? <Msg text={q.coupon_error} error /> : null}
          {appliedCoupon && q && !q.coupon_error && qt?.discount_paise ? <Msg text={`Coupon ${appliedCoupon} applied.`} /> : null}

          {me.tax.registered ? (
            <>
              <Checkbox checked={gst.open} onChange={(v) => setGst((g) => ({ ...g, open: v }))} label="Add my GSTIN to the invoice (business purchase)" />
              {gst.open ? (
                <>
                  <TextField label="Business name" value={gst.name} onChangeText={(v) => setGst((g) => ({ ...g, name: v }))} maxLength={120} />
                  <TextField label="GSTIN" value={gst.gstin} onChangeText={(v) => setGst((g) => ({ ...g, gstin: v.toUpperCase() }))} maxLength={15} autoCapitalize="characters" placeholder="27ABCDE1234F1Z5" />
                  <TextField label="Billing address" value={gst.address} onChangeText={(v) => setGst((g) => ({ ...g, address: v }))} maxLength={300} />
                </>
              ) : null}
            </>
          ) : null}

          <Checkbox
            checked={agree}
            onChange={setAgree}
            label="I agree to the Terms and understand the plan renews only when I pay again. RERA and certification badges show verified status and are not changed by a plan."
          />
          <Pressable onPress={() => void WebBrowser.openBrowserAsync(me.terms_url && /^https?:/.test(me.terms_url) ? me.terms_url : siteLink(me.terms_url || '/terms'))} accessibilityRole="link" hitSlop={8} style={styles.termsLink}>
            <Text style={styles.link}>Read the Terms</Text>
          </Pressable>
          {payErr ? <Msg text={payErr} error /> : null}
        </View>

        <View style={styles.card} accessibilityLiveRegion="polite">
          <Text style={styles.label}>{q ? KIND_LABEL[q.kind] : 'Price breakdown'}</Text>
          {qErr ? <Msg text={qErr} error /> : null}
          {!q && !qErr ? <Text style={subStyles.muted}>Calculating…</Text> : null}
          {qt && q ? (
            <>
              <Line label={`${plan.name}${qt.quantity > 1 ? ` × ${qt.quantity}` : ''}`} value={formatInr(qt.base_paise)} />
              {qt.discount_paise > 0 ? <Line minus label={`Coupon ${qt.coupon_code}`} value={`− ${formatInr(qt.discount_paise)}`} /> : null}
              {qt.credit_paise > 0 ? <Line minus label="Credit for unused time" value={`− ${formatInr(qt.credit_paise)}`} /> : null}
              {qt.tax_mode !== 'none' ? (
                <>
                  <Line label="Taxable value" value={formatInr(qt.taxable_paise)} />
                  {qt.cgst_paise > 0 ? <Line label={`CGST ${qt.tax_rate / 2}%`} value={formatInr(qt.cgst_paise)} /> : null}
                  {qt.sgst_paise > 0 ? <Line label={`SGST ${qt.tax_rate / 2}%`} value={formatInr(qt.sgst_paise)} /> : null}
                  {qt.igst_paise > 0 ? <Line label={`IGST ${qt.tax_rate}%`} value={formatInr(qt.igst_paise)} /> : null}
                </>
              ) : null}
              <Line total label={q.kind === 'downgrade' ? 'Due now' : 'Total payable'} value={q.kind === 'downgrade' ? '₹0' : formatInr(qt.total_paise)} />
              <Text style={subStyles.small}>
                {qt.tax_mode === 'none' ? 'No GST is charged (Mappingg is not GST-registered).' : qt.tax_mode === 'inclusive' ? 'Price includes GST.' : 'GST is added to the plan price.'}
                {q.kind === 'renewal' ? ` Your new term starts ${fmtDate(q.period_start)}, when the current one ends.` : ''}
                {q.kind === 'upgrade' ? ' The new plan starts today.' : ''}
                {q.kind === 'downgrade' ? ` The change happens on ${fmtDate(q.current?.expires_at)}.` : ''}
              </Text>
            </>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

function Line({ label, value, minus, total }: { label: string; value: string; minus?: boolean; total?: boolean }) {
  return (
    <View style={[styles.line, total && styles.lineTotal]}>
      <Text style={[styles.lineText, minus && styles.minus, total && styles.totalText]}>{label}</Text>
      <Text style={[styles.lineText, minus && styles.minus, total && styles.totalText]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  b: { fontFamily: fonts.bold },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontFamily: fonts.extrabold, fontSize: 21, color: colors.ink, letterSpacing: -0.4 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 10 },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  price: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  priceBig: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.ink },
  pick: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  pickOn: { borderColor: colors.forest, backgroundColor: colors.forestTint },
  pickTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  couponRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  apply: { marginTop: 26 },
  termsLink: { marginLeft: 32, paddingVertical: 4 },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.forest },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  lineTotal: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8, marginTop: 2 },
  lineText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  minus: { color: colors.success },
  totalText: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  footer: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line, padding: 14, gap: 8 },
  footRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  footLabel: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.muted },
  footTotal: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.ink },
  doneWrap: { alignItems: 'center', paddingTop: 48, gap: 14 },
  big: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  bigBad: { backgroundColor: colors.danger },
  doneTitle: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.ink },
  doneBtns: { alignSelf: 'stretch', gap: 10, marginTop: 8 },
});
