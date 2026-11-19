import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius, TOUCH } from '@/constants/theme';
import { formatInr, limitText, shownLimits, unitLabel, type PublicPlan, type UsageState } from '@/services/subscriptions';
import { fmtDate } from '@/services/subscriptions';

// Building blocks of the subscription screens (website: components/subscriptions/
// subscriptions.css + PlanGrid.tsx), drawn the app's way.

type IconName = keyof typeof Ionicons.glyphMap;
export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'free' | 'premium';

const TONES: Record<Tone, { bg: string; fg: string; border: string }> = {
  ok: { bg: colors.successBg, fg: colors.success, border: '#cfe9db' },
  warn: { bg: colors.road50, fg: '#8a5a12', border: '#f3dfb4' },
  bad: { bg: colors.dangerBg, fg: colors.danger, border: '#f5c6c0' },
  info: { bg: colors.water50, fg: colors.water, border: '#cfe2f3' },
  neutral: { bg: colors.land, fg: colors.ink, border: colors.line },
  free: { bg: colors.land2, fg: colors.muted, border: colors.line },
  premium: { bg: '#f7f0df', fg: '#7a5f1f', border: '#ead9b3' },
};

export function Card({ icon, title, right, children, style }: { icon?: IconName; title?: ReactNode; right?: ReactNode; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.card, style]}>
      {title ? (
        <View style={s.cardHead}>
          {icon ? <Ionicons name={icon} size={18} color={colors.forest} /> : null}
          <Text style={s.cardTitle} accessibilityRole="header">
            {title}
          </Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Badge({ tone = 'neutral', icon, children }: { tone?: Tone; icon?: IconName; children: ReactNode }) {
  const t = TONES[tone];
  return (
    <View style={[s.badge, { backgroundColor: t.bg, borderColor: t.border }]}>
      {icon ? <Ionicons name={icon} size={11} color={t.fg} /> : null}
      <Text style={[s.badgeText, { color: t.fg }]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

export function Alert({ tone = 'neutral', icon, children, action }: { tone?: Tone; icon: IconName; children: ReactNode; action?: ReactNode }) {
  const t = TONES[tone];
  return (
    <View style={[s.alert, { backgroundColor: t.bg, borderColor: t.border }]} accessibilityRole="alert">
      <View style={s.alertRow}>
        <Ionicons name={icon} size={18} color={t.fg} style={s.alertIcon} />
        <Text style={s.alertText}>{children}</Text>
      </View>
      {action ? <View style={s.alertAction}>{action}</View> : null}
    </View>
  );
}

export function Msg({ text, error }: { text: string; error?: boolean }) {
  return (
    <Text style={[s.msg, error && s.msgErr]} accessibilityRole="alert">
      {text}
    </Text>
  );
}

export const B = ({ children }: { children: ReactNode }) => <Text style={s.b}>{children}</Text>;

/** A usage bar: "Project details opened this week · 2 / 3". */
export function Meter({ label, used, limit, note }: { label: string; used: number; limit: number | null; note?: string }) {
  const pct = limit == null ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  return (
    <View style={s.meter}>
      <View style={s.meterRow}>
        <Text style={s.meterLabel}>{label}</Text>
        <Text style={s.meterVal}>
          {used}
          {limit == null ? '' : ` / ${limit}`}
        </Text>
      </View>
      {limit != null ? (
        <View style={s.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: limit, now: used }}>
          <View style={[s.barFill, { width: `${pct}%` }, pct >= 90 && s.barHot]} />
        </View>
      ) : null}
      {note ? <Text style={s.small}>{note}</Text> : null}
    </View>
  );
}

/** The website's usage labels (SubscriptionCenter). */
export function usageLabel(u: UsageState, short = false): string {
  if (u.metric === 'project_access') return short ? 'Project details this week' : 'Project details opened this week';
  if (short || u.period === 'lifetime') return 'Property listings opened';
  return 'Property listings opened this month';
}
export function usageNote(u: UsageState): string {
  if (u.limit == null) return 'Unlimited on your plan.';
  return `${u.remaining ?? Math.max(0, u.limit - u.used)} left${u.resetsAt ? ` · resets ${fmtDate(u.resetsAt)}` : ''}. Opening the same project again doesn’t count twice.`;
}

/** Label / value pairs in a two-column grid. */
export function KV({ items }: { items: [string, ReactNode][] }) {
  return (
    <View style={s.kv}>
      {items.map(([k, v]) => (
        <View key={k} style={s.kvItem}>
          <Text style={s.kvKey}>{k}</Text>
          <Text style={s.kvVal}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

export function ListRow({ title, sub, right, children }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; children?: ReactNode }) {
  return (
    <View style={s.li}>
      <View style={s.liMain}>
        <Text style={s.liTitle}>{title}</Text>
        {sub ? <Text style={s.small}>{sub}</Text> : null}
        {children}
      </View>
      {right ? <View style={s.liRight}>{right}</View> : null}
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={s.empty}>{text}</Text>;
}

/** A plan's limits and included features as a checklist (+ a few that aren't included). */
export function FeatureList({ plan, excluded = 0 }: { plan: PublicPlan; excluded?: number }) {
  return (
    <View style={s.feats}>
      {shownLimits(plan).map((l) => (
        <View key={l.key} style={s.feat}>
          <Ionicons name="speedometer-outline" size={15} color={colors.goldDeep} />
          <Text style={[s.featText, s.b]}>{limitText(l)}</Text>
        </View>
      ))}
      {plan.features
        .filter((f) => f.included)
        .map((f) => (
          <View key={f.key} style={s.feat}>
            <Ionicons name="checkmark" size={15} color={colors.park} />
            <Text style={s.featText}>{f.label}</Text>
          </View>
        ))}
      {plan.features
        .filter((f) => !f.included)
        .slice(0, excluded)
        .map((f) => (
          <View key={f.key} style={s.feat}>
            <Ionicons name="close" size={15} color="#a3aaa6" />
            <Text style={[s.featText, s.off]}>{f.label}</Text>
          </View>
        ))}
    </View>
  );
}

/** Plan cards (website: PlanGrid). The call to action comes from the screen. */
export function PlanCards({ plans, currentCode, cta }: { plans: PublicPlan[]; currentCode?: string | null; cta: (p: PublicPlan) => ReactNode }) {
  return (
    <View style={s.plans}>
      {plans.map((p) => (
        <View key={p.code} style={[s.plan, p.recommended && s.planRec, currentCode === p.code && s.planCurrent]}>
          {p.recommended ? (
            <View style={s.ribbon}>
              <Text style={s.ribbonText}>★ Recommended</Text>
            </View>
          ) : null}
          <View style={s.planHead}>
            <Text style={s.planName}>{p.name}</Text>
            {p.is_free ? <Badge tone="free">Free</Badge> : <Badge tone="premium" icon="ribbon">Premium</Badge>}
            {currentCode === p.code ? <Badge tone="ok">Your plan</Badge> : null}
          </View>
          {p.tagline ? <Text style={s.tag}>{p.tagline}</Text> : null}
          <View style={s.price}>
            <Text style={s.priceBig}>{p.is_free ? '₹0' : formatInr(p.price_paise)}</Text>
            <Text style={s.priceUnit}>{unitLabel(p)}</Text>
          </View>
          <FeatureList plan={p} excluded={3} />
          <View style={s.planCta}>{cta(p)}</View>
        </View>
      ))}
    </View>
  );
}

/** Feature-by-feature comparison (website: PlanCompare — collapsed by default). */
export function PlanCompare({ plans, open: initial = false }: { plans: PublicPlan[]; open?: boolean }) {
  const [open, setOpen] = useState(initial);
  if (!plans.length) return null;
  const first = plans[0]!;
  const COL = 118;
  const LABEL = 170;
  return (
    <View style={s.compare}>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={s.compareHead}>
        <Text style={s.compareTitle}>Compare every feature</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.forest} />
      </Pressable>
      {open ? (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={[s.tr, s.trHead]}>
              <Text style={[s.th, { width: LABEL }]}>Feature</Text>
              {plans.map((p) => (
                <Text key={p.code} style={[s.th, s.center, { width: COL }]}>
                  {p.name}
                </Text>
              ))}
            </View>
            <View style={s.tr}>
              <Text style={[s.td, { width: LABEL }]}>Price</Text>
              {plans.map((p) => (
                <View key={p.code} style={[s.tdBox, { width: COL }]}>
                  <Text style={[s.td, s.center, s.b]}>{p.is_free ? '₹0' : formatInr(p.price_paise)}</Text>
                  <Text style={[s.small, s.center]}>{unitLabel(p)}</Text>
                </View>
              ))}
            </View>
            {first.limits.map((lim) => (
              <View key={lim.key} style={s.tr}>
                <Text style={[s.td, { width: LABEL }]}>{lim.label}</Text>
                {plans.map((p) => {
                  const l = p.limits.find((x) => x.key === lim.key);
                  return (
                    <Text key={p.code} style={[s.td, s.center, { width: COL }]}>
                      {l ? (l.value === null ? 'Unlimited' : String(l.value)) : '—'}
                    </Text>
                  );
                })}
              </View>
            ))}
            {first.features.map((f) => (
              <View key={f.key} style={s.tr}>
                <Text style={[s.td, { width: LABEL }]}>{f.label}</Text>
                {plans.map((p) => {
                  const on = !!p.features.find((x) => x.key === f.key)?.included;
                  return (
                    <View key={p.code} style={[s.tdBox, { width: COL }]} accessibilityLabel={on ? 'Included' : 'Not included'}>
                      <Ionicons name={on ? 'checkmark-circle' : 'remove'} size={18} color={on ? colors.park : '#a3aaa6'} />
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

/** Small pill button used inside cards (website: .sub-btn.sm). */
export function Chip({ title, onPress, tone = 'ghost', icon, disabled }: { title: string; onPress: () => void; tone?: 'ghost' | 'primary' | 'gold'; icon?: IconName; disabled?: boolean }) {
  const bg = tone === 'primary' ? colors.forest : tone === 'gold' ? colors.gold : '#fff';
  const fg = tone === 'ghost' ? colors.forest : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [s.chip, { backgroundColor: bg, borderColor: tone === 'ghost' ? colors.line : bg }, (pressed || disabled) && { opacity: disabled ? 0.45 : 0.8 }]}
    >
      {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
      <Text style={[s.chipText, { color: fg }]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

export const subStyles = StyleSheet.create({
  stack: { gap: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  muted: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.muted },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
  h3: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink, marginTop: 10, marginBottom: 4 },
  bullet: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.text, marginBottom: 6 },
});

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardTitle: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.ink, letterSpacing: -0.2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11.5 },
  alert: { borderWidth: 1, borderRadius: radius.md, padding: 12, gap: 10 },
  alertRow: { flexDirection: 'row', gap: 10 },
  alertIcon: { marginTop: 1 },
  alertText: { flex: 1, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.ink },
  alertAction: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginLeft: 28 },
  msg: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.success, backgroundColor: colors.successBg, padding: 10, borderRadius: radius.md },
  msgErr: { color: colors.danger, backgroundColor: colors.dangerBg },
  b: { fontFamily: fonts.bold, color: colors.ink },
  meter: { gap: 6 },
  meterRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  meterLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.text },
  meterVal: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.land2, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.forest },
  barHot: { backgroundColor: colors.earth },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
  kv: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  kvItem: { width: '50%', paddingRight: 8 },
  kvKey: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  kvVal: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, marginTop: 2 },
  li: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  liMain: { flex: 1, minWidth: 0, gap: 2 },
  liTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  liRight: { alignItems: 'flex-end', gap: 6 },
  empty: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.muted, paddingVertical: 6 },
  feats: { gap: 7 },
  feat: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  featText: { flex: 1, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.text },
  off: { color: '#8f9893', textDecorationLine: 'line-through' },
  plans: { gap: 14 },
  plan: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: 16, gap: 10, backgroundColor: '#fff' },
  planRec: { borderColor: colors.gold, borderWidth: 2 },
  planCurrent: { backgroundColor: colors.forestTint },
  ribbon: { alignSelf: 'flex-start', backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  ribbonText: { color: '#fff', fontFamily: fonts.bold, fontSize: 11.5 },
  planHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  planName: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.ink, letterSpacing: -0.4, marginRight: 2 },
  tag: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.muted },
  price: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  priceBig: { fontFamily: fonts.extrabold, fontSize: 28, color: colors.ink, letterSpacing: -0.8 },
  priceUnit: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  planCta: { marginTop: 4 },
  compare: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, overflow: 'hidden' },
  compareHead: { minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, backgroundColor: colors.land },
  compareTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.forest },
  tr: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, alignItems: 'center' },
  trHead: { backgroundColor: colors.land },
  th: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink, padding: 10 },
  td: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.text, padding: 10 },
  tdBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  center: { textAlign: 'center' },
  chip: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontFamily: fonts.semibold, fontSize: 13 },
});
