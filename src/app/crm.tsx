import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert as RNAlert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Alert, B, Badge, Card, Chip, Empty, ListRow, Msg, subStyles } from '@/components/subscription/SubUi';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { SelectField } from '@/components/ui/SelectField';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { colors, fonts, radius } from '@/constants/theme';
import { usePins } from '@/hooks/usePublicData';
import { dayOptions, isoToLocal, localToIso, TIME_OPTIONS } from '@/lib/dates';
import { openUrl } from '@/lib/openLink';
import { shareTextFile } from '@/lib/shareFile';
import { awaitingApproval, isAgent, useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { errorMessage } from '@/services/api/errors';
import { addCpLead, archiveCpLead, exportCpLeadsCsv, fmtDateTime, getCpLeads, getFuturePrices, patchCpLead, type CpLead } from '@/services/subscriptions';

// Leads & CRM (website: /dashboard/agent/crm → CpCrm): a channel partner's
// private lead book (Pro) and CRM (Pro Max) — add clients, move them through
// the pipeline, priority, follow-ups, notes timeline, CSV export — and the
// future prices Mappingg published. Everything is scoped to this account on the server.

const STATUSES = ['new', 'contacted', 'site_visit', 'negotiation', 'booked', 'lost'];
const LABEL: Record<string, string> = { new: 'New', contacted: 'Contacted', site_visit: 'Site visit', negotiation: 'Negotiation', booked: 'Booked', lost: 'Lost' };
const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
];
const empty = { name: '', phone: '', email: '', budget: '', requirement: '', city: '', notes: '', pin_id: '' };
const FOLLOW_DAYS = dayOptions(120);

export default function CrmScreen() {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { status, user } = useAuth();
  const enabled = status === 'signedIn' && isAgent(user) && !awaitingApproval(user);
  const [archived, setArchived] = useState(false);
  const leadsQ = useQuery({ queryKey: ['cp', 'leads', archived], queryFn: () => getCpLeads(archived), enabled });
  const outlookQ = useQuery({ queryKey: ['cp', 'future-price'], queryFn: getFuturePrices, enabled, retry: false });
  const pinsQ = usePins();
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [form, setForm] = useState(empty);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [now] = useState(() => Date.now());

  const projects = useMemo(
    () =>
      (pinsQ.data || [])
        .map((p) => ({ value: p.id, label: `${p.title || `Project #${p.number}`}${p.location ? ` — ${p.location}` : ''}` }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [pinsQ.data],
  );
  const leads = leadsQ.data?.leads;
  const plan = leadsQ.data?.plan;
  const shown = useMemo(
    () => (leads || []).filter((l) => (!stage || l.status === stage) && (!q || `${l.name} ${l.phone} ${l.email} ${l.project_title} ${l.city}`.toLowerCase().includes(q.toLowerCase()))),
    [leads, stage, q],
  );
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, (leads || []).filter((l) => l.status === s).length])), [leads]);
  const followUps = useMemo(
    () => (leads || []).filter((l) => l.follow_up_at && new Date(l.follow_up_at).getTime() < now + 86_400_000 && !['booked', 'lost'].includes(l.status)),
    [leads, now],
  );

  const reload = () => void qc.invalidateQueries({ queryKey: ['cp'] });
  const setLead = (updated: CpLead) => qc.setQueryData(['cp', 'leads', archived], (d: typeof leadsQ.data) => (d ? { ...d, leads: d.leads.map((l) => (l.id === updated.id ? updated : l)) } : d));

  async function add() {
    setMsg(null);
    if (!form.name.trim()) {
      setMsg({ text: 'Enter the client’s name.', err: true });
      return;
    }
    setSaving(true);
    try {
      await addCpLead({ ...form, pin_id: form.pin_id || null });
      setForm(empty);
      setAdding(false);
      setMsg({ text: 'Lead added.' });
      reload();
    } catch (e) {
      setMsg({ text: errorMessage(e), err: true });
    } finally {
      setSaving(false);
    }
  }
  async function patch(id: string, body: Record<string, unknown>, ok?: string) {
    try {
      setLead(await patchCpLead(id, body));
      if (ok) setMsg({ text: ok });
    } catch (e) {
      setMsg({ text: errorMessage(e), err: true });
    }
  }
  async function archive(id: string, restore = false) {
    try {
      await archiveCpLead(id, restore);
      reload();
    } catch (e) {
      setMsg({ text: errorMessage(e), err: true });
    }
  }
  async function exportCsv() {
    setExporting(true);
    try {
      const csv = await exportCpLeadsCsv();
      if (!(await shareTextFile('my-leads.csv', 'text/csv', csv))) toast('Install the latest version of the app to export files.');
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setExporting(false);
    }
  }

  if (!enabled) {
    return <EmptyState icon="people-outline" title="Leads & CRM is for channel-partner accounts" action={status === 'signedIn' ? undefined : { title: 'Sign in', onPress: () => router.push('/auth/sign-in') }} />;
  }
  if (leadsQ.isPending) return <LoadingState label="Loading your leads…" />;
  if (leadsQ.isError) return <ErrorState error={leadsQ.error} onRetry={reload} />;
  const p = plan!;
  const locked = !p.can_add;
  const outlook = outlookQ.data;

  return (
    <Screen background={colors.land} onRefresh={reload} refreshing={leadsQ.isRefetching}>
      <View style={subStyles.stack}>
        <Text style={subStyles.muted}>Your own client leads — private to you. Nothing here is shared with other partners or developers.</Text>
        {locked ? (
          <Alert tone="warn" icon="lock-closed" action={<Chip tone="primary" title="See plans" onPress={() => router.push('/subscription')} />}>
            <B>Lead management is part of Pro and Pro Max.</B> {leads!.length ? 'Your saved leads are still here to view.' : ''} Upgrade to add and track client leads.
          </Alert>
        ) : null}
        {msg ? <Msg text={msg.text} error={msg.err} /> : null}
        {p.crm && followUps.length > 0 ? (
          <Alert tone="info" icon="notifications">
            <B>
              {followUps.length} follow-up{followUps.length === 1 ? '' : 's'} due
            </B>{' '}
            — {followUps.slice(0, 3).map((l) => l.name).join(', ')}
            {followUps.length > 3 ? '…' : ''}
          </Alert>
        ) : null}

        <Card
          icon="people-outline"
          title={archived ? 'Archived leads' : 'Your client leads'}
          right={
            <Badge>
              {p.used}
              {p.limit != null ? ` / ${p.limit}` : ''} active
            </Badge>
          }
        >
          <View style={subStyles.row}>
            {!archived && !locked ? <Chip tone="primary" icon="add" title="Add lead" onPress={() => setAdding((v) => !v)} /> : null}
            {p.crm ? <Chip icon="document-outline" title={exporting ? 'Exporting…' : 'Export'} disabled={exporting} onPress={() => void exportCsv()} /> : null}
            <Chip
              title={archived ? 'Active leads' : 'Archived'}
              onPress={() => {
                setArchived((v) => !v);
                setOpen(null);
              }}
            />
          </View>

          {adding ? (
            <View style={styles.form}>
              <TextField label="Client name *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} maxLength={120} />
              <TextField label="Phone / WhatsApp" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} maxLength={30} keyboardType="phone-pad" />
              <TextField label="Email" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} maxLength={160} keyboardType="email-address" autoCapitalize="none" />
              <TextField label="Budget" value={form.budget} onChangeText={(v) => setForm({ ...form, budget: v })} placeholder="e.g. 1–1.5 Cr" maxLength={80} />
              <SelectField label="Interested project" value={form.pin_id} placeholder="Not decided" options={[{ value: '', label: 'Not decided' }, ...projects]} onChange={(v) => setForm({ ...form, pin_id: v })} />
              <TextField label="City / area" value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} maxLength={60} />
              <TextField label="Requirement" value={form.requirement} onChangeText={(v) => setForm({ ...form, requirement: v })} placeholder="e.g. 3 BHK, ready to move, near metro" maxLength={1000} />
              <TextField label="Notes" value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} maxLength={4000} multiline />
              <View style={subStyles.row}>
                <Button title="Save lead" compact loading={saving} onPress={() => void add()} />
                <Button title="Cancel" variant="ghost" compact onPress={() => setAdding(false)} />
              </View>
            </View>
          ) : null}

          {p.crm && !archived ? (
            <View style={styles.pipe}>
              {STATUSES.map((s) => (
                <Pressable key={s} onPress={() => setStage(stage === s ? '' : s)} accessibilityRole="button" accessibilityState={{ selected: stage === s }} style={[styles.pipeItem, stage === s && styles.pipeOn]}>
                  <Text style={[styles.pipeN, stage === s && styles.pipeTextOn]}>{counts[s]}</Text>
                  <Text style={[styles.pipeLabel, stage === s && styles.pipeTextOn]} numberOfLines={1}>
                    {LABEL[s]}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <TextInput style={styles.search} placeholder="Search name, phone, project…" placeholderTextColor="#8a938f" value={q} onChangeText={setQ} accessibilityLabel="Search leads" />
          {!p.crm ? (
            <SelectField label="Status" value={stage} placeholder="All statuses" options={[{ value: '', label: 'All statuses' }, ...STATUSES.map((s) => ({ value: s, label: LABEL[s]! }))]} onChange={setStage} />
          ) : null}

          {shown.length ? (
            shown.map((l) => (
              <LeadCard
                key={l.id}
                lead={l}
                crm={p.crm}
                visibility={p.visibility}
                locked={locked}
                archived={archived}
                open={open === l.id}
                onToggle={() => setOpen(open === l.id ? null : l.id)}
                onPatch={(body, ok) => void patch(l.id, body, ok)}
                onArchive={() =>
                  RNAlert.alert(`Archive ${l.name}?`, 'You can restore it later.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Archive', onPress: () => void archive(l.id) },
                  ])
                }
                onRestore={() => void archive(l.id, true)}
              />
            ))
          ) : (
            <Empty text={leads!.length ? 'No leads match.' : archived ? 'No archived leads.' : 'No leads yet — add your first client.'} />
          )}
        </Card>

        <Card icon="trending-up-outline" title="Future price information" right={<Badge tone="premium" icon="ribbon">Pro Max</Badge>}>
          {outlookQ.isError ? (
            <>
              <Text style={subStyles.muted}>Upcoming price revisions published by Mappingg (with their source) are part of Pro Max.</Text>
              <Chip title="Upgrade" tone="gold" onPress={() => router.push('/subscription')} />
            </>
          ) : outlookQ.isPending ? (
            <Text style={subStyles.muted}>Loading…</Text>
          ) : outlook && outlook.length ? (
            outlook.map((o) => (
              <ListRow
                key={o.pin_id}
                title={o.title}
                sub={`${[o.location, o.current_price && `Now: ${o.current_price}`].filter(Boolean).join(' · ')}\nSource: ${o.source}${o.note ? ` — ${o.note}` : ''}`}
                right={
                  <>
                    <Text style={styles.expected}>{o.expected_price}</Text>
                    <Text style={subStyles.small}>{o.horizon}</Text>
                  </>
                }
              />
            ))
          ) : (
            <Empty text="No future prices have been published yet. They appear here as soon as Mappingg confirms a revision with the developer." />
          )}
        </Card>
      </View>
    </Screen>
  );
}

function LeadCard({
  lead: l,
  crm,
  visibility,
  locked,
  archived,
  open,
  onToggle,
  onPatch,
  onArchive,
  onRestore,
}: {
  lead: CpLead;
  crm: boolean;
  visibility: boolean;
  locked: boolean;
  archived: boolean;
  open: boolean;
  onToggle(): void;
  onPatch(body: Record<string, unknown>, ok?: string): void;
  onArchive(): void;
  onRestore(): void;
}) {
  const [notes, setNotes] = useState(l.notes);
  const [note, setNote] = useState('');
  const follow = isoToLocal(l.follow_up_at);
  const [fDay, setFDay] = useState(follow.day);
  const [fTime, setFTime] = useState(follow.time || '10:00');

  const setFollow = (day: string, time: string) => {
    setFDay(day);
    setFTime(time);
    onPatch({ follow_up_at: day ? localToIso(day, time || '10:00') : null });
  };

  return (
    <View style={styles.lead}>
      <View style={subStyles.row}>
        <Text style={styles.leadName}>{l.name}</Text>
        {crm && l.priority !== 'normal' ? <Badge tone={l.priority === 'high' ? 'bad' : 'free'}>{l.priority}</Badge> : null}
        <Badge tone="info">{LABEL[l.status] || l.status}</Badge>
      </View>
      <View style={styles.meta}>
        {l.phone ? (
          <Pressable onPress={() => void openUrl(`tel:${l.phone}`)} accessibilityRole="link" hitSlop={6}>
            <Text style={styles.link}>📞 {l.phone}</Text>
          </Pressable>
        ) : null}
        {l.email ? <Text style={styles.metaText}>✉️ {l.email}</Text> : null}
        {l.project_title ? <Text style={styles.metaText}>🏢 {l.project_title}</Text> : null}
        {l.budget || l.city ? <Text style={styles.metaText}>₹ {[l.budget, l.city].filter(Boolean).join(' · ')}</Text> : null}
        {l.requirement ? <Text style={styles.metaText}>{l.requirement}</Text> : null}
        {crm && l.follow_up_at ? <Text style={styles.metaText}>🔔 Follow up {fmtDateTime(l.follow_up_at)}</Text> : null}
      </View>
      {!locked && !archived ? (
        <View style={styles.selects}>
          <View style={styles.flex}>
            <SelectField label="Status" value={l.status} options={STATUSES.map((s) => ({ value: s, label: LABEL[s]! }))} onChange={(v) => onPatch({ status: v })} />
          </View>
          {crm ? (
            <View style={styles.flex}>
              <SelectField label="Priority" value={l.priority} options={PRIORITIES} onChange={(v) => onPatch({ priority: v })} />
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={subStyles.row}>
        <Chip title={open ? 'Close' : 'Details'} onPress={onToggle} />
        {archived ? <Chip title="Restore" onPress={onRestore} /> : <Chip title="Archive" disabled={locked} onPress={onArchive} />}
      </View>
      {open ? (
        <View style={styles.details}>
          <TextField
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            editable={!locked}
            multiline
            onBlur={() => {
              if (notes !== l.notes) onPatch({ notes }, 'Notes saved.');
            }}
          />
          {crm ? (
            <>
              <View style={styles.selects}>
                <View style={styles.flex}>
                  <SelectField label="Next follow-up" value={fDay} placeholder="No follow-up" options={[{ value: '', label: 'No follow-up' }, ...FOLLOW_DAYS]} onChange={(d) => setFollow(d, fTime)} />
                </View>
                {fDay ? (
                  <View style={styles.flex}>
                    <SelectField label="Time" value={fTime} options={TIME_OPTIONS} onChange={(t) => setFollow(fDay, t)} />
                  </View>
                ) : null}
              </View>
              <View style={styles.noteRow}>
                <View style={styles.flex}>
                  <TextField label="Log an update" value={note} onChangeText={setNote} placeholder="e.g. Called — visiting Saturday" maxLength={500} />
                </View>
                <Button
                  title="Add"
                  variant="secondary"
                  compact
                  disabled={!note.trim()}
                  onPress={() => {
                    onPatch({ note });
                    setNote('');
                  }}
                  style={styles.addBtn}
                />
              </View>
            </>
          ) : null}
          {visibility && l.activity.length > 0
            ? [...l.activity]
                .reverse()
                .slice(0, 15)
                .map((a, i) => <ListRow key={i} title={a.text} sub={fmtDateTime(a.at)} />)
            : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  form: { backgroundColor: colors.land, borderRadius: radius.md, padding: 12 },
  pipe: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pipeItem: { width: '31.5%', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: 8, alignItems: 'center', backgroundColor: '#fff' },
  pipeOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  pipeN: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink },
  pipeLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  pipeTextOn: { color: '#fff' },
  search: { minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, backgroundColor: '#fff' },
  lead: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12, gap: 8 },
  leadName: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.ink },
  meta: { gap: 3 },
  metaText: { fontFamily: fonts.regular, fontSize: 13, color: colors.text },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.forest },
  selects: { flexDirection: 'row', gap: 8 },
  details: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  noteRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  addBtn: { marginTop: 26 },
  expected: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
});
