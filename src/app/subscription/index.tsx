import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Alert as RNAlert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert, B, Badge, Card, Chip, Empty, KV, ListRow, Meter, Msg, PlanCards, PlanCompare, FeatureList, subStyles, usageLabel, usageNote } from '@/components/subscription/SubUi';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { SelectField } from '@/components/ui/SelectField';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { colors, fonts } from '@/constants/theme';
import { useSignupPlan } from '@/hooks/useSignupPlan';
import { awaitingApproval, useAuth } from '@/providers/AuthProvider';
import { errorMessage } from '@/services/api/errors';
import {
  ACTION_LABEL,
  CATEGORY_LABEL,
  cancelPlan,
  categoryForRole,
  chooseCity,
  fmtDate,
  formatInr,
  getHistory,
  getInvoices,
  getMySubscription,
  getSubNotices,
  isPaidActive,
  markSubNoticesRead,
  PAY_LABEL,
  STATUS_LABEL,
  subKeys,
  type PublicPlan,
} from '@/services/subscriptions';

// "My subscription" (website: /dashboard/<role>/subscription → SubscriptionCenter):
// current plan, status & expiry warnings, usage, purchased features, plan
// changes (checkout), payment history, invoices, events and notifications.

const STATUS_TONE: Record<string, 'ok' | 'free' | 'warn' | 'bad'> = { ACTIVE: 'ok', FREE: 'free', PAST_DUE: 'warn', EXPIRED: 'bad', CANCELLED: 'bad', SUSPENDED: 'bad', REFUNDED: 'bad', PENDING: 'warn', FAILED: 'bad' };
const DAY = 86_400_000;

export default function SubscriptionScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { plan: initialPlan } = useLocalSearchParams<{ plan?: string }>();
  const { status, user } = useAuth();
  const enabled = status === 'signedIn' && !!categoryForRole(user?.role) && !awaitingApproval(user);
  const me = useQuery({ queryKey: subKeys.current, queryFn: getMySubscription, enabled });
  const hist = useQuery({ queryKey: subKeys.history, queryFn: getHistory, enabled });
  const invoices = useQuery({ queryKey: subKeys.invoices, queryFn: getInvoices, enabled });
  const notices = useQuery({ queryKey: subKeys.notices, queryFn: getSubNotices, enabled });
  const signupPlan = useSignupPlan();
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());
  const [city, setCity] = useState('');
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const plansY = useRef(0);
  const openedPlan = useRef(false);

  const openCheckout = (p: PublicPlan) => router.push({ pathname: '/subscription/checkout', params: { plan: p.code } });

  // ?plan=<code> (sign-up, plan gate, pricing): open that plan's checkout straight away.
  useEffect(() => {
    if (openedPlan.current || !me.data || !initialPlan) return;
    const p = me.data.available.find((x) => x.code === initialPlan && !x.is_free);
    openedPlan.current = true;
    if (p) openCheckout(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.data, initialPlan]);

  // Opening the page marks the subscription notifications as read (website: same).
  useEffect(() => {
    if (notices.data?.some((n) => !n.read_at)) void markSubNoticesRead().catch(() => undefined);
  }, [notices.data]);

  const reload = () => void qc.invalidateQueries({ queryKey: ['sub'] });

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ text: ok });
      reload();
    } catch (e) {
      setMsg({ text: errorMessage(e), err: true });
    } finally {
      setBusy(false);
    }
  }

  if (status !== 'signedIn' || !user) {
    return <EmptyState icon="ribbon-outline" title="Sign in to see your plan" action={{ title: 'Sign in', onPress: () => router.push('/auth/sign-in') }} />;
  }
  if (!categoryForRole(user.role)) {
    return <EmptyState icon="ribbon-outline" title="Plans are for developer, channel-partner and buyer accounts" text="Mappingg team accounts manage subscriptions in the super admin." />;
  }
  if (awaitingApproval(user)) {
    return <EmptyState icon="hourglass-outline" title="Waiting for verification" text="Your plan and billing open once the Mappingg team has verified your RERA details (usually within one working day). Until then you’re on the Free plan." />;
  }
  if (me.isPending) return <LoadingState label="Loading your subscription…" />;
  if (me.isError) return <ErrorState error={me.error} onRetry={reload} />;

  const d = me.data;
  const sub = d.subscription;
  const st = d.status;
  const paidActive = isPaidActive(d);
  const plan = d.plan;
  const payments = hist.data?.payments || [];
  const events = hist.data?.events || [];
  const lastPay = payments[0];
  const recentFail = !!lastPay && lastPay.status === 'failed' && now - new Date(lastPay.created_at).getTime() < 7 * DAY;
  const lastExpired = !paidActive ? events.find((e) => e.action === 'expired') : undefined;
  const renewPlan = paidActive ? d.available.find((p) => p.code === (d.next_plan?.code || sub!.plan_code)) : undefined;
  const usage = d.usage.filter((u) => u.limit !== 0);
  const pickedAtSignup = !paidActive && signupPlan ? d.available.find((p) => p.code === signupPlan && !p.is_free) : undefined;
  const oneCity = d.category === 'cp' && !!plan?.limits.some((l) => l.key === 'cp_max_cities' && l.value !== null);
  const cityNeeded = oneCity && !d.city;
  const shownPayments = payments.filter((p) => p.status !== 'created' || now - new Date(p.created_at).getTime() < DAY).slice(0, 20);
  const shownEvents = events.filter((e) => e.action !== 'checkout_started').slice(0, 20);

  const confirmCancel = () =>
    RNAlert.alert(`Cancel ${plan?.name}?`, `It stays active until ${fmtDate(sub!.expires_at)} and won't renew.`, [
      { text: 'Keep plan', style: 'cancel' },
      { text: 'Cancel plan', style: 'destructive', onPress: () => void act(() => cancelPlan(), 'Cancelled — your plan stays active until the end of the term.') },
    ]);

  return (
    <Screen background={colors.land} onRefresh={reload} refreshing={me.isRefetching} scrollRef={scrollRef}>
      <View style={subStyles.stack}>
        {pickedAtSignup ? (
          <Alert tone="neutral" icon="ribbon" action={<Chip tone="primary" title={`Activate ${pickedAtSignup.name}`} onPress={() => openCheckout(pickedAtSignup)} />}>
            You chose <B>{pickedAtSignup.name}</B> when you signed up. You are on the Free plan until you activate it.
          </Alert>
        ) : null}

        {paidActive && sub!.effective_status === 'PAST_DUE' ? (
          <Alert tone="bad" icon="alert-circle" action={renewPlan ? <Chip tone="primary" title="Renew now" onPress={() => openCheckout(renewPlan)} /> : undefined}>
            <B>Renewal required.</B> Your plan ended on {fmtDate(sub!.expires_at)}. Paid features stay on until {fmtDate(sub!.grace_until)} — renew to keep them.
          </Alert>
        ) : null}
        {paidActive && sub!.effective_status === 'ACTIVE' && d.days_left <= 7 && !sub!.cancel_at_period_end ? (
          <Alert tone="warn" icon="time" action={renewPlan ? <Chip tone="primary" title="Renew" onPress={() => openCheckout(renewPlan)} /> : undefined}>
            <B>
              Your plan ends in {d.days_left} day{d.days_left === 1 ? '' : 's'}
            </B>{' '}
            ({fmtDate(sub!.expires_at)}). Renew now — the new term starts when this one ends, so you lose nothing.
          </Alert>
        ) : null}
        {paidActive && sub!.cancel_at_period_end ? (
          <Alert tone="neutral" icon="calendar" action={<Chip title="Keep my plan" disabled={busy} onPress={() => void act(() => cancelPlan(true), 'Your plan will continue as normal.')} />}>
            Cancelled — your plan stays active until <B>{fmtDate(sub!.expires_at)}</B>, then your account moves to Free. Nothing is deleted.
          </Alert>
        ) : null}
        {paidActive && d.next_plan && !sub!.cancel_at_period_end ? (
          <Alert tone="neutral" icon="trending-down" action={<Chip title="Undo" disabled={busy} onPress={() => void act(() => cancelPlan(true), 'Plan change cancelled.')} />}>
            You move to <B>{d.next_plan.name}</B> on {fmtDate(sub!.expires_at)}.
          </Alert>
        ) : null}
        {recentFail ? (
          <Alert tone="bad" icon="card">
            <B>Your last payment failed</B>
            {lastPay!.failure_reason ? ` (${lastPay!.failure_reason})` : ''}. No money is taken for a failed payment.
          </Alert>
        ) : null}
        {lastExpired && st !== 'ACTIVE' ? (
          <Alert tone="warn" icon="hourglass">
            <B>Your paid plan expired</B> on {fmtDate(lastExpired.at)}. You are on the Free plan — your data is safe. Upgrade any time to unlock paid features again.
          </Alert>
        ) : null}
        {cityNeeded ? (
          <Alert tone="warn" icon="business">
            <B>Choose your city</B> to start opening projects — your plan covers one city, and it can’t be changed later without Mappingg support.
          </Alert>
        ) : null}
        {cityNeeded ? (
          <Card>
            <SelectField label="City" value={city} placeholder="Choose…" options={d.cities.map((c) => ({ value: c.key, label: c.label }))} onChange={setCity} />
            <Button title="Save" compact disabled={!city || busy} onPress={() => void act(() => chooseCity(city), 'City saved.')} />
          </Card>
        ) : null}
        {msg ? <Msg text={msg.text} error={msg.err} /> : null}

        {/* current plan */}
        <View style={styles.current}>
          <Text style={styles.eyebrow}>{CATEGORY_LABEL[d.category]} · current plan</Text>
          <View style={subStyles.row}>
            <Text style={styles.planName}>{plan?.name || 'Free'}</Text>
            <Badge tone={STATUS_TONE[st] || 'neutral'}>{STATUS_LABEL[st] || st}</Badge>
          </View>
          {plan?.tagline ? <Text style={styles.tagline}>{plan.tagline}</Text> : null}
          <KV
            items={[
              ['Status', STATUS_LABEL[st] || st],
              ['Started', paidActive ? fmtDate(sub!.start_at) : '—'],
              ['Expires', paidActive ? fmtDate(sub!.expires_at) : 'Never (Free)'],
              ['Next renewal', paidActive ? (sub!.cancel_at_period_end ? 'Not renewing' : fmtDate(sub!.renew_at || sub!.expires_at)) : '—'],
              ['Days remaining', paidActive ? String(d.days_left) : '—'],
              ...(oneCity && d.city ? ([['City', d.cities.find((c) => c.key === d.city)?.label || d.city]] as [string, string][]) : []),
              ...(paidActive && sub!.billing_unit === 'project' ? ([['Projects covered', String(sub!.project_ids.length)]] as [string, string][]) : []),
            ]}
          />
          <View style={subStyles.row}>
            {renewPlan ? <Chip tone="gold" icon="refresh" title="Renew" onPress={() => openCheckout(renewPlan)} /> : null}
            <Chip icon="trending-up" title={paidActive ? 'Change plan' : 'Upgrade'} onPress={() => scrollRef.current?.scrollTo({ y: Math.max(0, plansY.current - 8), animated: true })} />
            {paidActive && !sub!.cancel_at_period_end ? <Chip title="Cancel plan" disabled={busy} onPress={confirmCancel} /> : null}
          </View>
        </View>

        {usage.length > 0 || d.category === 'developer' ? (
          <Card icon="speedometer-outline" title="Usage">
            {usage.map((u) => (
              <Meter key={u.metric} label={usageLabel(u)} used={u.used} limit={u.limit} note={usageNote(u)} />
            ))}
            {d.category === 'developer' ? (
              <Meter
                label="Projects listed"
                used={d.project_count ?? 0}
                limit={d.project_limit ?? null}
                note={d.project_limit == null ? 'Unlimited listings on your plan.' : 'Existing projects always stay listed — the limit only applies to new ones.'}
              />
            ) : null}
          </Card>
        ) : null}

        {d.category === 'developer' && (d.projects || []).length > 0 ? (
          <Card icon="business-outline" title="Your projects & plan coverage">
            {(d.projects || []).map((p) => (
              <ListRow
                key={p.id}
                title={p.title}
                sub={[p.location, p.state, p.review === 'live' ? 'Live' : p.review === 'pending' ? 'Waiting for review' : 'Not approved'].filter(Boolean).join(' · ')}
                right={p.covered ? <Badge tone="premium" icon="ribbon">{plan?.name || 'Paid'}</Badge> : <Badge tone="free">Free features</Badge>}
              />
            ))}
          </Card>
        ) : null}

        <View onLayout={(e) => (plansY.current = e.nativeEvent.layout.y)}>
          <Card icon="layers-outline" title={paidActive ? 'Change plan' : 'Upgrade your plan'}>
            <PlanCards
              plans={d.available}
              currentCode={plan?.code}
              cta={(p) =>
                p.is_free ? (
                  <Button title={plan?.code === p.code ? 'Current plan' : 'Included free'} variant="secondary" disabled compact />
                ) : (
                  <Button
                    title={plan?.code === p.code ? (d.category === 'developer' ? 'Renew / change projects' : 'Renew') : paidActive ? `Switch to ${p.name}` : `Choose ${p.name}`}
                    variant={p.recommended ? 'primary' : 'secondary'}
                    compact
                    onPress={() => openCheckout(p)}
                  />
                )
              }
            />
            <PlanCompare plans={d.available} />
          </Card>
        </View>

        {plan ? (
          <Card icon="checkmark-circle-outline" title="What your plan includes">
            <FeatureList plan={plan} />
            {plan.billing_unit === 'project' ? <Text style={subStyles.muted}>Project features apply to the projects on your plan; your other projects keep the Free features.</Text> : null}
          </Card>
        ) : null}

        <Card icon="document-text-outline" title="Invoices">
          {invoices.data?.length ? (
            invoices.data.map((i) => (
              <ListRow
                key={i.id}
                title={i.number}
                sub={`${fmtDate(i.issued_at)} · ${formatInr(Number(i.totals.total_paise) || 0)}${i.status !== 'paid' ? ` · ${PAY_LABEL[i.status] || i.status}` : ''}`}
                right={<Chip icon="download-outline" title="Download" onPress={() => router.push({ pathname: '/subscription/invoice/[id]', params: { id: i.id } })} />}
              />
            ))
          ) : (
            <Empty text={invoices.isPending ? 'Loading…' : 'No invoices yet.'} />
          )}
        </Card>

        <Card icon="receipt-outline" title="Payment history">
          {shownPayments.length ? (
            shownPayments.map((p) => (
              <ListRow
                key={p.id}
                title={`${p.plan_name}${p.quantity > 1 ? ` × ${p.quantity}` : ''}`}
                sub={`${fmtDate(p.paid_at || p.created_at)}${p.gateway_payment_id ? ` · ${p.gateway_payment_id}` : ''}${p.status === 'failed' && p.failure_reason ? ` · ${p.failure_reason}` : ''}`}
                right={
                  <>
                    <Text style={styles.amount}>{formatInr(p.total_paise)}</Text>
                    <Badge tone={p.status === 'paid' ? 'ok' : p.status === 'failed' ? 'bad' : 'free'}>{PAY_LABEL[p.status] || p.status}</Badge>
                  </>
                }
              />
            ))
          ) : (
            <Empty text={hist.isPending ? 'Loading…' : 'No payments yet.'} />
          )}
        </Card>

        <Card icon="time-outline" title="Subscription history">
          {shownEvents.length ? (
            shownEvents.map((e) => (
              <ListRow
                key={e.id}
                title={`${ACTION_LABEL[e.action] || e.action}${e.to_plan ? ` — ${d.available.find((p) => p.code === e.to_plan)?.name || e.to_plan}` : ''}`}
                sub={new Date(e.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              />
            ))
          ) : (
            <Empty text={hist.isPending ? 'Loading…' : 'Nothing yet.'} />
          )}
        </Card>

        {notices.data && notices.data.length > 0 ? (
          <Card icon="notifications-outline" title="Notifications">
            {notices.data.slice(0, 10).map((n) => (
              <ListRow key={n.id} title={n.title} sub={n.body} right={<Text style={subStyles.small}>{fmtDate(n.created_at)}</Text>} />
            ))}
          </Card>
        ) : null}

        <Button title="Compare all plans" variant="ghost" icon="pricetags-outline" onPress={() => router.push('/pricing')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  current: { backgroundColor: '#fff', borderRadius: 20, padding: 18, gap: 10, borderWidth: 1, borderColor: colors.line, borderTopWidth: 4, borderTopColor: colors.forest },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 12, color: colors.park, textTransform: 'uppercase', letterSpacing: 0.6 },
  planName: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.ink, letterSpacing: -0.6 },
  tagline: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  amount: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
});
