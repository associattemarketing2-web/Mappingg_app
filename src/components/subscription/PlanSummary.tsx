import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/constants/theme';
import { fmtDate, getMySubscription, isPaidActive, subKeys } from '@/services/subscriptions';
import { Alert, Badge, Card, Chip, Meter, subStyles, usageLabel } from './SubUi';

// Compact "Your plan" card (website: PlanSummary on the developer dashboard and
// the channel-partner / buyer profile pages): plan, status, days left, usage
// and the account's key links. Hidden quietly if subscriptions are unavailable.

/** Shown only while subscriptions are on (the account screen checks the master switch). */
export function PlanSummary({ links = [] }: { links?: { href: Href; label: string; icon: React.ComponentProps<typeof Chip>['icon'] }[] }) {
  const router = useRouter();
  const q = useQuery({ queryKey: subKeys.current, queryFn: getMySubscription, retry: 1 });
  if (q.isError) return null;
  if (q.isPending) {
    return (
      <Card>
        <Text style={subStyles.muted}>Loading your plan…</Text>
      </Card>
    );
  }
  const me = q.data;
  const sub = me.subscription;
  const paid = isPaidActive(me);
  const tone = me.status === 'PAST_DUE' ? 'bad' : paid && me.days_left <= 7 ? 'warn' : paid ? 'ok' : 'free';
  const statusText = me.status === 'PAST_DUE' ? 'Renewal due' : paid ? (sub!.cancel_at_period_end ? `Ends ${fmtDate(sub!.expires_at)}` : `Renews ${fmtDate(sub!.expires_at)}`) : 'Free plan';
  const upgrade = me.available.filter((p) => !p.is_free && p.code !== me.plan?.code).sort((a, b) => a.price_paise - b.price_paise)[0];

  return (
    <Card icon="ribbon" title={`${me.plan?.name || 'Free'} plan`} right={<Badge tone={tone}>{statusText}</Badge>}>
      {paid && me.days_left <= 7 ? (
        <Alert tone="warn" icon="time">
          {me.status === 'PAST_DUE' ? `Your plan ended on ${fmtDate(sub!.expires_at)} — renew to keep paid features.` : `${me.days_left} day${me.days_left === 1 ? '' : 's'} left on your plan.`}
        </Alert>
      ) : null}
      {me.usage
        .filter((u) => u.limit !== 0)
        .map((u) => (
          <Meter
            key={u.metric}
            label={usageLabel(u, true)}
            used={u.used}
            limit={u.limit}
            note={u.limit == null ? 'Unlimited' : `${u.remaining ?? Math.max(0, u.limit - u.used)} left${u.resetsAt ? ` · resets ${fmtDate(u.resetsAt)}` : ''}`}
          />
        ))}
      {me.category === 'developer' ? (
        <Meter label="Projects listed" used={me.project_count ?? 0} limit={me.project_limit ?? null} note={`${(me.projects || []).filter((p) => p.covered).length} on a paid plan`} />
      ) : null}
      {me.category === 'cp' && paid && sub!.city ? (
        <Text style={subStyles.muted}>
          City: <Text style={styles.b}>{me.cities.find((c) => c.key === sub!.city)?.label || sub!.city}</Text>
        </Text>
      ) : null}
      <View style={subStyles.row}>
        <Chip tone="primary" icon="ribbon" title="Manage subscription" onPress={() => router.push('/subscription')} />
        {links.map((l) => (
          <Chip key={l.label} icon={l.icon} title={l.label} onPress={() => router.push(l.href)} />
        ))}
        {!paid && upgrade ? <Chip tone="gold" title={`Upgrade to ${upgrade.name}`} onPress={() => router.push({ pathname: '/subscription', params: { plan: upgrade.code } })} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  b: { fontFamily: fonts.bold, color: colors.ink },
});
