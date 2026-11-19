import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Alert as RNAlert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert, B, Badge, Card, Chip, Empty, ListRow, Msg, subStyles } from '@/components/subscription/SubUi';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { SelectField } from '@/components/ui/SelectField';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { colors, fonts, radius } from '@/constants/theme';
import { usePins } from '@/hooks/usePublicData';
import { useCompare, useFavorites } from '@/hooks/useSavedList';
import { dayOptions, monthOptions } from '@/lib/dates';
import { projectInsights } from '@/lib/insights';
import { isBuyer, useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { getBuyerProfile } from '@/services/account';
import { errorMessage } from '@/services/api/errors';
import {
  canUse,
  cancelServiceRequest,
  getMySubscription,
  getPortfolio,
  getServiceRequests,
  removeHolding,
  requestService,
  saveHolding,
  subKeys,
  type Holding,
} from '@/services/subscriptions';

// Premium buyer tools (website: /dashboard/buyer/premium). Free: loan
// calculator. Buyer Premium: insights on saved projects, expert / legal /
// vastu requests (booked with a person), portfolio manager, legal checklist
// and vastu guide. Premium writes are re-checked on the server (/api/buyer/*).

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtPsf = (v: number | null) => (v ? `₹${v.toLocaleString('en-IN')}/sq ft` : '—');

export default function PremiumScreen() {
  const router = useRouter();
  const toast = useToast();
  const { status, user } = useAuth();
  const enabled = status === 'signedIn' && isBuyer(user);
  const me = useQuery({ queryKey: subKeys.current, queryFn: getMySubscription, enabled });
  const pinsQ = usePins();
  const favs = useFavorites(toast);
  const compare = useCompare(toast);

  if (!enabled) {
    return <EmptyState icon="diamond-outline" title="Premium tools are for buyer accounts" action={status === 'signedIn' ? undefined : { title: 'Sign in', onPress: () => router.push('/auth/sign-in') }} />;
  }
  if (me.isPending) return <LoadingState />;
  if (me.isError) return <ErrorState error={me.error} onRetry={() => void me.refetch()} />;

  const d = me.data;
  const can = (k: string) => canUse(d, k);
  const premium = d.plan?.code === 'buyer_premium' || (!!d.plan && !d.plan.is_free);
  const saved = [...new Set([...favs.pins, ...compare.pins])].slice(0, 30);
  const upgrade = () => router.push({ pathname: '/subscription', params: { plan: 'buyer_premium' } });
  const locked = (title: string, text: string) => <Locked title={title} text={text} onUpgrade={upgrade} />;

  return (
    <Screen background={colors.land} onRefresh={() => void me.refetch()} refreshing={me.isRefetching}>
      <View style={subStyles.stack}>
        <Text style={subStyles.muted}>{premium ? 'Your Buyer Premium tools.' : 'The loan calculator is free. Upgrade to Buyer Premium for the rest.'}</Text>

        {can('buyer_loan_tools') ? <EmiCalculator /> : locked('Loan calculator', 'not included in your plan.')}

        <Card icon="heart-outline" title="Saved & compared">
          <Text style={subStyles.muted}>
            {saved.length ? `${saved.length} project${saved.length === 1 ? '' : 's'} saved or in your compare list.` : 'Save projects with ♥ and add them to Compare on the live map.'}
          </Text>
          <View style={subStyles.row}>
            <Chip title="Favourites" onPress={() => router.push('/favorites')} />
            <Chip title="Compare list" onPress={() => router.push('/compare')} />
            <Chip tone="primary" title="Live map" onPress={() => router.navigate('/map')} />
          </View>
        </Card>

        <Card icon="bar-chart-outline" title="Insights on your saved projects" right={<Badge tone="premium" icon="ribbon">Premium</Badge>}>
          {!can('buyer_premium_insights') ? (
            locked('Premium insights', 'price per sq ft and how each saved project compares with its locality.')
          ) : (
            <Insights ids={saved} pins={pinsQ.data} loading={pinsQ.isPending || favs.isPending || compare.isPending} onOpen={(slug) => router.push({ pathname: '/project/[slug]', params: { slug } })} />
          )}
        </Card>

        <Card icon="person-outline" title="Talk to an expert" right={<Badge tone="premium" icon="ribbon">Premium</Badge>}>
          {can('buyer_expert_assist') ? (
            <>
              <Text style={subStyles.muted}>
                Book a call with the Mappingg team — a property expert, a document review with our legal partner, a vastu consultation, or a portfolio review. We confirm the slot by phone; the request shows its real status here.
              </Text>
              <ServiceRequests projects={(pinsQ.data || []).map((p) => ({ value: p.id, label: p.title || `Project #${p.number}` }))} />
            </>
          ) : (
            locked('Expert assistance', 'book calls with a property expert, legal review and vastu consultation.')
          )}
        </Card>

        <Card icon="briefcase-outline" title="Portfolio manager" right={<Badge tone="premium" icon="ribbon">Premium</Badge>}>
          {can('buyer_portfolio') ? <Portfolio /> : locked('Portfolio manager', 'track the homes you own or booked, loans and your equity in one place.')}
        </Card>

        <Card icon="scale-outline" title="Legal checklist for buying a new home" right={<Badge tone="premium" icon="ribbon">Premium</Badge>}>
          {can('buyer_legal_info') ? <LegalGuide /> : locked('Legal checklist', 'step-by-step document checks before booking, paying and taking possession.')}
        </Card>

        <Card icon="compass-outline" title="Vastu guide" right={<Badge tone="premium" icon="ribbon">Premium</Badge>}>
          {can('buyer_vastu') ? <VastuGuide /> : locked('Vastu guide', 'traditional placement guidelines to check floor plans against.')}
        </Card>
      </View>
    </Screen>
  );
}

function Locked({ title, text, onUpgrade }: { title: string; text: string; onUpgrade: () => void }) {
  return (
    <Alert tone="neutral" icon="lock-closed" action={<Chip tone="gold" title="Upgrade" onPress={onUpgrade} />}>
      <B>{title}</B> — {text}
    </Alert>
  );
}

// ---- free: home-loan EMI & eligibility --------------------------------------

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  return (
    <TextField
      label={label}
      value={text}
      keyboardType="decimal-pad"
      onChangeText={(t) => {
        setText(t);
        const n = Number(t.replace(/,/g, ''));
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

function EmiCalculator() {
  const [amount, setAmount] = useState(6_000_000);
  const [rate, setRate] = useState(8.5);
  const [years, setYears] = useState(20);
  const [income, setIncome] = useState(150_000);
  const [otherEmi, setOtherEmi] = useState(0);
  const r = Math.max(0, rate) / 12 / 100;
  const n = Math.min(30, Math.max(1, years)) * 12;
  const amt = Math.max(0, amount);
  const emi = useMemo(() => (r > 0 ? (amt * r * (1 + r) ** n) / ((1 + r) ** n - 1) : amt / n), [amt, r, n]);
  const total = emi * n;
  // Lenders commonly cap all EMIs at about 50% of net monthly income (varies by lender and profile).
  const maxEmi = Math.max(0, Math.max(0, income) * 0.5 - Math.max(0, otherEmi));
  const eligible = r > 0 ? (maxEmi * ((1 + r) ** n - 1)) / (r * (1 + r) ** n) : maxEmi * n;
  return (
    <Card icon="calculator-outline" title="Home-loan EMI & eligibility">
      <View style={styles.grid}>
        <View style={styles.half}>
          <NumField label="Loan amount (₹)" value={amount} onChange={setAmount} />
        </View>
        <View style={styles.half}>
          <NumField label="Interest (% p.a.)" value={rate} onChange={setRate} />
        </View>
        <View style={styles.half}>
          <NumField label="Tenure (years)" value={years} onChange={setYears} />
        </View>
        <View style={styles.half}>
          <NumField label="Net monthly income (₹)" value={income} onChange={setIncome} />
        </View>
        <View style={styles.half}>
          <NumField label="Existing EMIs (₹/month)" value={otherEmi} onChange={setOtherEmi} />
        </View>
      </View>
      <Stats
        items={[
          ['Monthly EMI', inr(emi)],
          ['Total interest', inr(total - amt)],
          ['Indicative eligibility', inr(eligible)],
        ]}
      />
      <Text style={subStyles.small}>Estimates only. Eligibility assumes EMIs up to ~50% of net income; each bank decides using its own rules, your credit score and documents.</Text>
    </Card>
  );
}

function Stats({ items }: { items: [string, string][] }) {
  return (
    <View style={styles.stats}>
      {items.map(([k, v]) => (
        <View key={k} style={styles.stat}>
          <Text style={styles.statKey}>{k}</Text>
          <Text style={styles.statVal}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

// ---- premium: insights ------------------------------------------------------

function Insights({ ids, pins, loading, onOpen }: { ids: string[]; pins?: import('@/types/models').Pin[]; loading: boolean; onOpen: (slug: string) => void }) {
  const rows = useMemo(() => projectInsights(pins || [], ids), [pins, ids]);
  if (loading) return <Text style={subStyles.muted}>Loading…</Text>;
  if (!rows.length) return <Empty text="Save or compare projects on the live map to see insights here." />;
  const COLS: [string, number][] = [
    ['Project', 170],
    ['Listed price', 120],
    ['Area', 120],
    ['Indicative ₹/sq ft', 120],
    ['Locality median', 130],
    ['vs locality', 90],
    ['RERA', 60],
    ['Possession', 110],
  ];
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={[styles.tr, styles.trHead]}>
            {COLS.map(([h, w]) => (
              <Text key={h} style={[styles.th, { width: w }]}>
                {h}
              </Text>
            ))}
          </View>
          {rows.map((i) => (
            <View key={i.id} style={styles.tr}>
              <Pressable onPress={() => onOpen(i.slug)} accessibilityRole="link" style={[styles.tdBox, { width: 170 }]}>
                <Text style={styles.link}>{i.title}</Text>
                <Text style={subStyles.small}>{i.locality}</Text>
              </Pressable>
              <Text style={[styles.td, { width: 120 }]}>{i.price || '—'}</Text>
              <Text style={[styles.td, { width: 120 }]}>{i.area || '—'}</Text>
              <Text style={[styles.td, { width: 120 }]}>{fmtPsf(i.psf)}</Text>
              <View style={[styles.tdBox, { width: 130 }]}>
                {i.localityMedianPsf ? (
                  <>
                    <Text style={styles.td0}>{fmtPsf(i.localityMedianPsf)}</Text>
                    <Text style={subStyles.small}>{i.localityCount} projects</Text>
                  </>
                ) : (
                  <Text style={subStyles.small}>Too few listings</Text>
                )}
              </View>
              <Text style={[styles.td, { width: 90, fontFamily: fonts.bold, color: i.vsLocality == null ? colors.text : i.vsLocality > 0 ? colors.earth : colors.park }]}>
                {i.vsLocality == null ? '—' : `${i.vsLocality > 0 ? '+' : ''}${i.vsLocality}%`}
              </Text>
              <Text style={[styles.td, { width: 60, color: colors.park }]} accessibilityLabel={i.rera ? 'RERA number listed' : 'No RERA number'}>
                {i.rera ? '✔' : '—'}
              </Text>
              <Text style={[styles.td, { width: 110 }]}>{i.possession || '—'}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <Text style={subStyles.small}>
        Indicative ₹/sq ft = lowest listed price ÷ smallest listed area, from the details shown on Mappingg. Locality median uses other listed projects with both figures (at least 3). Always confirm the current price list and carpet area with the developer.
      </Text>
    </>
  );
}

// ---- premium: expert / legal / vastu requests --------------------------------

const TYPES: Record<string, string> = { expert: 'Property expert call', legal: 'Legal document review', vastu: 'Vastu consultation', portfolio: 'Portfolio review' };
const REQ_STATUS: Record<string, string> = { requested: 'Requested — we will call you', scheduled: 'Scheduled', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled' };
const DAYS = dayOptions(90);
const TIMES = ['Morning (10–1)', 'Afternoon (1–4)', 'Evening (4–7)'];

function ServiceRequests({ projects }: { projects: { value: string; label: string }[] }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['buyer', 'services'], queryFn: getServiceRequests });
  const profile = useQuery({ queryKey: ['me', 'profile'], queryFn: getBuyerProfile });
  const [form, setForm] = useState({ type: 'expert', pin_id: '', message: '', preferred_date: '', preferred_time: '', contact_phone: '' });
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const phone = phoneTouched ? form.contact_phone : form.contact_phone || profile.data?.mobile || '';

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      await requestService({ ...form, contact_phone: phone });
      setMsg({ text: 'Request sent. The Mappingg team will contact you to schedule it.' });
      setForm((f) => ({ ...f, message: '', preferred_date: '', preferred_time: '' }));
      void qc.invalidateQueries({ queryKey: ['buyer', 'services'] });
    } catch (e) {
      setMsg({ text: errorMessage(e), err: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={subStyles.stack}>
      <View>
        <SelectField label="I need" value={form.type} options={Object.entries(TYPES).map(([value, label]) => ({ value, label }))} onChange={(v) => setForm({ ...form, type: v })} />
        <SelectField label="For project (optional)" value={form.pin_id} placeholder="General" options={[{ value: '', label: 'General' }, ...projects]} onChange={(v) => setForm({ ...form, pin_id: v })} />
        <SelectField label="Preferred date" value={form.preferred_date} placeholder="Any day" options={[{ value: '', label: 'Any day' }, ...DAYS]} onChange={(v) => setForm({ ...form, preferred_date: v })} />
        <SelectField label="Preferred time" value={form.preferred_time} placeholder="Any time" options={[{ value: '', label: 'Any time' }, ...TIMES.map((t) => ({ value: t, label: t }))]} onChange={(v) => setForm({ ...form, preferred_time: v })} />
        <TextField
          label="Phone"
          value={phone}
          onChangeText={(v) => {
            setPhoneTouched(true);
            setForm({ ...form, contact_phone: v });
          }}
          maxLength={30}
          keyboardType="phone-pad"
        />
        <TextField label="What would you like help with?" value={form.message} onChangeText={(v) => setForm({ ...form, message: v })} maxLength={2000} multiline placeholder="e.g. Please check the agreement for sale before I sign" />
        <Button title={busy ? 'Sending…' : 'Request a call'} loading={busy} onPress={() => void submit()} />
      </View>
      {msg ? <Msg text={msg.text} error={msg.err} /> : null}
      {list.data?.map((r) => (
        <ListRow
          key={r.id}
          title={`${TYPES[r.type] || r.type}${r.project_title ? ` — ${r.project_title}` : ''}`}
          sub={`${new Date(r.created_at).toLocaleDateString('en-IN')}${r.preferred_date ? ` · prefers ${r.preferred_date} ${r.preferred_time}` : ''}${r.admin_note ? ` · ${r.admin_note}` : ''}`}
          right={
            <>
              <Badge tone={r.status === 'completed' ? 'ok' : r.status === 'cancelled' ? 'bad' : 'warn'}>{REQ_STATUS[r.status] || r.status}</Badge>
              {['requested', 'scheduled'].includes(r.status) ? (
                <Chip
                  title="Cancel"
                  onPress={() =>
                    void cancelServiceRequest(r.id)
                      .catch(() => undefined)
                      .then(() => qc.invalidateQueries({ queryKey: ['buyer', 'services'] }))
                  }
                />
              ) : null}
            </>
          }
        />
      ))}
    </View>
  );
}

// ---- premium: portfolio manager ---------------------------------------------

const blank = { name: '', location: '', purchase_price: '', purchase_date: '', area_sqft: '', current_value: '', loan_outstanding: '', notes: '' };
const MONTHS = monthOptions(360);

function Portfolio() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['buyer', 'portfolio'], queryFn: getPortfolio });
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => list.data || [], [list.data]);
  const totals = useMemo(() => {
    const paid = rows.reduce((a, h) => a + h.purchase_price_paise, 0);
    const now = rows.reduce((a, h) => a + (h.current_value_paise ?? h.purchase_price_paise), 0);
    const loan = rows.reduce((a, h) => a + (h.loan_outstanding_paise || 0), 0);
    return { paid, now, loan, equity: now - loan };
  }, [rows]);
  const rs = (p: number | null) => (p == null ? '—' : inr(p / 100));
  const reload = () => void qc.invalidateQueries({ queryKey: ['buyer', 'portfolio'] });

  async function save() {
    setMsg(null);
    if (!form.name.trim()) {
      setMsg({ text: 'Enter a name for the property.', err: true });
      return;
    }
    setBusy(true);
    try {
      await saveHolding(form, editId);
      setForm(blank);
      setEditId(null);
      setMsg({ text: 'Saved.' });
      reload();
    } catch (e) {
      setMsg({ text: errorMessage(e), err: true });
    } finally {
      setBusy(false);
    }
  }
  const edit = (h: Holding) => {
    setEditId(h.id);
    setForm({
      name: h.name,
      location: h.location,
      purchase_price: h.purchase_price_paise ? String(h.purchase_price_paise / 100) : '',
      purchase_date: h.purchase_date,
      area_sqft: h.area_sqft ? String(h.area_sqft) : '',
      current_value: h.current_value_paise != null ? String(h.current_value_paise / 100) : '',
      loan_outstanding: h.loan_outstanding_paise != null ? String(h.loan_outstanding_paise / 100) : '',
      notes: h.notes,
    });
  };

  if (list.isError) return <Msg text={errorMessage(list.error)} error />;
  return (
    <View style={subStyles.stack}>
      {rows.length > 0 ? (
        <Stats
          items={[
            ['Total paid', rs(totals.paid)],
            ['Your estimate today', rs(totals.now)],
            ['Loans outstanding', rs(totals.loan)],
            ['Your equity', rs(totals.equity)],
          ]}
        />
      ) : null}
      {rows.map((h) => {
        const gain = h.current_value_paise != null && h.purchase_price_paise ? Math.round(((h.current_value_paise - h.purchase_price_paise) / h.purchase_price_paise) * 1000) / 10 : null;
        return (
          <ListRow
            key={h.id}
            title={h.name}
            sub={[h.location, h.purchase_date && `Bought ${h.purchase_date}`, h.area_sqft && `${h.area_sqft.toLocaleString('en-IN')} sq ft`].filter(Boolean).join(' · ')}
            right={
              <>
                <Text style={styles.value}>{rs(h.current_value_paise ?? h.purchase_price_paise)}</Text>
                <Text style={subStyles.small}>{gain != null ? `${gain >= 0 ? '+' : ''}${gain}% vs paid` : `Paid ${rs(h.purchase_price_paise)}`}</Text>
              </>
            }
          >
            <View style={[subStyles.row, styles.rowActs]}>
              <Chip title="Edit" onPress={() => edit(h)} />
              <Chip
                title="Remove"
                onPress={() =>
                  RNAlert.alert(`Remove ${h.name}?`, undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () =>
                        void removeHolding(h.id)
                          .catch(() => undefined)
                          .then(reload),
                    },
                  ])
                }
              />
            </View>
          </ListRow>
        );
      })}
      <View>
        <TextField label="Property name *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} maxLength={160} placeholder="e.g. 2 BHK, Kharadi" />
        <TextField label="Location" value={form.location} onChangeText={(v) => setForm({ ...form, location: v })} maxLength={160} />
        <TextField label="Purchase price (₹)" value={form.purchase_price} onChangeText={(v) => setForm({ ...form, purchase_price: v })} keyboardType="numeric" />
        <SelectField label="Purchase date" value={form.purchase_date.slice(0, 7)} placeholder="Choose month" options={MONTHS} onChange={(v) => setForm({ ...form, purchase_date: v })} />
        <TextField label="Carpet area (sq ft)" value={form.area_sqft} onChangeText={(v) => setForm({ ...form, area_sqft: v })} keyboardType="numeric" />
        <TextField label="Your estimate of value today (₹)" value={form.current_value} onChangeText={(v) => setForm({ ...form, current_value: v })} keyboardType="numeric" />
        <TextField label="Loan outstanding (₹)" value={form.loan_outstanding} onChangeText={(v) => setForm({ ...form, loan_outstanding: v })} keyboardType="numeric" />
        <TextField label="Notes" value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} maxLength={2000} />
        <View style={subStyles.row}>
          <Button title={editId ? 'Save changes' : 'Add property'} loading={busy} onPress={() => void save()} />
          {editId ? (
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => {
                setEditId(null);
                setForm(blank);
              }}
            />
          ) : null}
        </View>
      </View>
      {msg ? <Msg text={msg.text} error={msg.err} /> : null}
      <Text style={subStyles.small}>Values are your own entries — Mappingg does not value property. Ask for a portfolio review above for a conversation with our team.</Text>
    </View>
  );
}

// ---- premium: guides (website text) -----------------------------------------

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <View>
      {items.map((t, i) => (
        <Text key={i} style={subStyles.bullet}>
          • {t}
        </Text>
      ))}
    </View>
  );
}

function LegalGuide() {
  return (
    <View>
      <Text style={styles.disclaimer}>
        General information to help you ask the right questions — <B>not legal advice</B>. Have an advocate check the documents for your specific property before you pay or sign.
      </Text>
      <Text style={subStyles.h3}>Before you book</Text>
      <Bullets
        items={[
          'Check the project’s RERA registration on the state RERA website (MahaRERA in Maharashtra): registration number, validity, promoter details, sanctioned plans and quarterly progress updates.',
          'Ask for the title search report / title certificate and check that the land owner and the promoter (or their development agreement) match.',
          'Ask for the 7/12 extract or property card, and an encumbrance search for existing mortgages or loans on the land.',
          'See the approved building plan and commencement certificate (CC) from the planning authority, and that the floor you are buying is within the approved floors.',
          'Note the RERA carpet area of your unit — the price must be quoted on carpet area.',
        ]}
      />
      <Text style={subStyles.h3}>Before you pay more than 10%</Text>
      <Bullets
        items={[
          'Under RERA, the promoter should not take more than 10% of the cost before a written agreement for sale is registered.',
          'Read the agreement for sale: carpet area, total price and what it includes, payment schedule linked to construction stages, possession date, penalty/interest for delay, and defect liability (5 years under RERA).',
          'The agreement must be registered; stamp duty and registration charges are paid by the buyer and vary by state and city.',
          'If you take a loan, confirm the bank has approved the project (APF) — it is also a useful check.',
        ]}
      />
      <Text style={subStyles.h3}>At possession</Text>
      <Bullets
        items={[
          'Ask for the occupancy certificate (OC) before taking possession; check utilities (water, electricity, sewage) are connected.',
          'Get the possession letter, all payment receipts, and the society formation / conveyance timeline in writing.',
        ]}
      />
    </View>
  );
}

function VastuGuide() {
  return (
    <View>
      <Text style={styles.disclaimer}>
        Vastu Shastra is a traditional system of design preferences. These are commonly followed guidelines, not scientific or engineering advice — the floor plan, light, ventilation and structure matter most. For a home-specific opinion, book a vastu consultation above.
      </Text>
      <Text style={subStyles.h3}>Commonly preferred placements</Text>
      <Bullets
        items={[
          <Text key="e">
            <B>Main entrance:</B> north, east or north-east facing entrances are traditionally favoured.
          </Text>,
          <Text key="k">
            <B>Kitchen:</B> south-east (the Agni corner), with the cook facing east; north-west is the usual alternative.
          </Text>,
          <Text key="m">
            <B>Master bedroom:</B> south-west, with the head of the bed towards the south or east.
          </Text>,
          <Text key="l">
            <B>Living room:</B> north or east, ideally with more open space and windows on those sides.
          </Text>,
          <Text key="p">
            <B>Puja / prayer space:</B> north-east corner of the home.
          </Text>,
          <Text key="t">
            <B>Toilets:</B> north-west or west; traditionally avoided in the north-east and the centre of the home.
          </Text>,
          <Text key="s">
            <B>Staircase & heavy storage:</B> south or west sides.
          </Text>,
          <Text key="c">
            <B>Centre of the home (Brahmasthan):</B> kept open and uncluttered.
          </Text>,
        ]}
      />
      <Text style={subStyles.h3}>When comparing flats</Text>
      <Bullets
        items={[
          'Use the compass direction on the floor plan (check it on site with a phone compass — brochure plans are not always to true north).',
          'Most apartments can’t follow every rule; buyers usually prioritise the entrance, kitchen and master bedroom.',
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  half: { width: '50%', paddingHorizontal: 4 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { flexGrow: 1, minWidth: '45%', backgroundColor: colors.forestTint, borderRadius: radius.md, padding: 10 },
  statKey: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  statVal: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.forest, marginTop: 2 },
  tr: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  trHead: { backgroundColor: colors.land },
  th: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink, padding: 8 },
  td: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.text, padding: 8 },
  td0: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.text },
  tdBox: { padding: 8 },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.forest },
  value: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  rowActs: { marginTop: 6 },
  disclaimer: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.text, backgroundColor: colors.road50, borderRadius: radius.sm, padding: 10, marginBottom: 4 },
});
