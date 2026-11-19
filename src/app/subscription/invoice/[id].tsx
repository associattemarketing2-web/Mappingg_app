import { useQuery } from '@tanstack/react-query';
import { requireOptionalNativeModule } from 'expo';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { colors, fonts, radius } from '@/constants/theme';
import { useToast } from '@/providers/ToastProvider';
import { formatInr, getInvoice, type Invoice } from '@/services/subscriptions';

// One invoice (website: /dashboard/<role>/invoices/<id>): the snapshot taken
// when the payment was made. "Download PDF" makes the same document as a PDF
// on the phone (the website uses the browser's "Save as PDF").

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—');
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

interface Row {
  label: string;
  value: string;
}

function view(inv: Invoice) {
  const t = inv.totals;
  const n = (k: string) => Number(t[k] || 0);
  const s = inv.seller;
  const c = inv.customer;
  const registered = !!s.registered;
  const extra: Row[] = [];
  if (n('discount_paise') > 0) extra.push({ label: `Discount${t.coupon_code ? ` (coupon ${t.coupon_code})` : ''}`, value: `− ${formatInr(n('discount_paise'))}` });
  if (n('credit_paise') > 0) extra.push({ label: 'Credit for unused time on previous plan', value: `− ${formatInr(n('credit_paise'))}` });
  if (String(inv.tax_mode) !== 'none') {
    extra.push({ label: 'Taxable value', value: formatInr(n('taxable_paise')) });
    if (n('cgst_paise') > 0) extra.push({ label: `CGST @ ${n('tax_rate') / 2}%`, value: formatInr(n('cgst_paise')) });
    if (n('sgst_paise') > 0) extra.push({ label: `SGST @ ${n('tax_rate') / 2}%`, value: formatInr(n('sgst_paise')) });
    if (n('igst_paise') > 0) extra.push({ label: `IGST @ ${n('tax_rate')}%`, value: formatInr(n('igst_paise')) });
  }
  return {
    registered,
    title: registered ? 'Tax Invoice' : 'Invoice',
    statusText: inv.status === 'paid' ? 'Paid' : inv.status === 'refunded' ? 'Refunded' : 'Partly refunded',
    seller: [s.legal_name || 'Mappingg', s.address, registered && s.gstin ? `GSTIN: ${s.gstin}` : '', s.state ? `State: ${s.state}${s.state_code ? ` (${s.state_code})` : ''}` : '', s.support_email].filter(Boolean).map(String),
    customer: [c.name || '—', c.email, c.mobile, c.address, c.gstin ? `GSTIN: ${c.gstin}` : ''].filter(Boolean).map(String),
    period: `${fmt(inv.period_start)} – ${fmt(inv.period_end)}`,
    payment: String(t.gateway) === 'none' ? 'No payment needed (coupon / credit)' : `Razorpay · ${t.gateway_payment_id || '—'}`,
    place: registered ? `Place of supply: ${c.state_code || s.state_code || ''}` : '',
    extra,
    total: { label: `Total paid (${String(t.currency || 'INR')})`, value: formatInr(n('total_paise')) },
    foot: `${registered ? (String(inv.tax_mode) === 'inclusive' ? 'Amounts are inclusive of GST.' : 'GST charged as shown above.') : 'The supplier is not registered under GST; no GST has been charged on this invoice.'} This is a computer-generated invoice and does not need a signature. Order reference: ${String(t.gateway_order_id || '—')}.`,
  };
}

function html(inv: Invoice): string {
  const v = view(inv);
  const span = v.registered ? 4 : 3;
  const lines = inv.lines
    .map((l) => `<tr><td>${esc(l.description)}</td>${v.registered ? `<td>${esc(l.sac || '—')}</td>` : ''}<td>${l.quantity}</td><td>${esc(formatInr(l.unit_paise))}</td><td>${esc(formatInr(l.amount_paise))}</td></tr>`)
    .join('');
  const extra = v.extra.map((r) => `<tr><td colspan="${span}">${esc(r.label)}</td><td>${esc(r.value)}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:Helvetica,Arial,sans-serif;color:#16261f;margin:32px;font-size:13px}
.head{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #0f5c47;padding-bottom:16px}
h1{margin:0 0 6px;font-size:24px;color:#0f5c47}.brand{font-size:20px;font-weight:800;margin-bottom:8px}.brand em{font-style:normal;color:#b8925a}
.muted{color:#5f6964;line-height:1.7}.parties{display:flex;justify-content:space-between;gap:24px;margin:18px 0;line-height:1.7}
table{width:100%;border-collapse:collapse;margin-top:8px}th,td{text-align:left;padding:8px;border-bottom:1px solid #e7e3d9}th{background:#f6f4ee}
td:last-child,th:last-child{text-align:right}.tot td{font-weight:800;font-size:15px;border-top:2px solid #16261f}.foot{margin-top:18px;color:#5f6964;font-size:11.5px;line-height:1.6}
</style></head><body>
<div class="head"><div><div class="brand">Mappingg<em>.com</em></div><div class="muted">${v.seller.map(esc).join('<br>')}</div></div>
<div style="text-align:right"><h1>${v.title}</h1><div class="muted">No. <b>${esc(inv.number)}</b><br>Date: ${esc(fmt(inv.issued_at))}<br>Status: <b>${v.statusText}</b></div></div></div>
<div class="parties"><div><b>Billed to</b><br>${v.customer.map(esc).join('<br>')}</div>
<div><b>Billing period</b><br>${esc(v.period)}<br><b>Payment</b><br>${esc(v.payment)}${v.place ? `<br>${esc(v.place)}` : ''}</div></div>
<table><thead><tr><th>Description</th>${v.registered ? '<th>SAC</th>' : ''}<th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
<tbody>${lines}${extra}<tr class="tot"><td colspan="${span}">${esc(v.total.label)}</td><td>${esc(v.total.value)}</td></tr></tbody></table>
<div class="foot">${esc(v.foot)}</div></body></html>`;
}

// expo-print / expo-sharing are native: older app builds don't have them.
const canPrint = !!requireOptionalNativeModule('ExpoPrint') && !!requireOptionalNativeModule('ExpoSharing');

export default function InvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const q = useQuery({ queryKey: ['sub', 'invoice', id], queryFn: () => getInvoice(String(id)), enabled: !!id });
  const [busy, setBusy] = useState(false);

  if (q.isPending) return <LoadingState />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const inv = q.data;
  const v = view(inv);

  const download = async () => {
    setBusy(true);
    try {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const Print = require('expo-print') as typeof import('expo-print');
      const Sharing = require('expo-sharing') as typeof import('expo-sharing');
      /* eslint-enable @typescript-eslint/no-require-imports */
      const { uri } = await Print.printToFileAsync({ html: html(inv) });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice ${inv.number}`, UTI: 'com.adobe.pdf' });
    } catch {
      toast('Could not make the PDF. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen background={colors.land}>
      <View style={styles.paper}>
        <View style={styles.headRow}>
          <View style={styles.flex}>
            <Text style={styles.brand}>
              Mappingg<Text style={styles.brandEm}>.com</Text>
            </Text>
            {v.seller.map((l) => (
              <Text key={l} style={styles.muted}>
                {l}
              </Text>
            ))}
          </View>
        </View>
        <View style={styles.titleBox}>
          <Text style={styles.title}>{v.title}</Text>
          <Text style={styles.muted}>
            No. <Text style={styles.b}>{inv.number}</Text>
          </Text>
          <Text style={styles.muted}>Date: {fmt(inv.issued_at)}</Text>
          <Text style={styles.muted}>
            Status: <Text style={[styles.b, { color: inv.status === 'paid' ? colors.success : colors.earth }]}>{v.statusText}</Text>
          </Text>
        </View>
        <View style={styles.parties}>
          <View style={styles.flex}>
            <Text style={styles.b}>Billed to</Text>
            {v.customer.map((l) => (
              <Text key={l} style={styles.text}>
                {l}
              </Text>
            ))}
          </View>
          <View style={styles.flex}>
            <Text style={styles.b}>Billing period</Text>
            <Text style={styles.text}>{v.period}</Text>
            <Text style={[styles.b, styles.gap]}>Payment</Text>
            <Text style={styles.text}>{v.payment}</Text>
            {v.place ? <Text style={styles.text}>{v.place}</Text> : null}
          </View>
        </View>
        {inv.lines.map((l, i) => (
          <View key={i} style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.text}>{l.description}</Text>
              <Text style={styles.muted}>
                {v.registered && l.sac ? `SAC ${l.sac} · ` : ''}
                {l.quantity} × {formatInr(l.unit_paise)}
              </Text>
            </View>
            <Text style={styles.amount}>{formatInr(l.amount_paise)}</Text>
          </View>
        ))}
        {v.extra.map((r) => (
          <View key={r.label} style={styles.row}>
            <Text style={[styles.text, styles.flex]}>{r.label}</Text>
            <Text style={styles.amount}>{r.value}</Text>
          </View>
        ))}
        <View style={[styles.row, styles.total]}>
          <Text style={[styles.totalText, styles.flex]}>{v.total.label}</Text>
          <Text style={styles.totalText}>{v.total.value}</Text>
        </View>
        <Text style={styles.foot}>{v.foot}</Text>
      </View>
      {canPrint ? (
        <Button title="Download PDF" icon="download-outline" loading={busy} onPress={() => void download()} style={styles.btn} />
      ) : (
        <Text style={[styles.muted, styles.btn]}>Install the latest version of the app to download invoices as PDF.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  paper: { backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 12 },
  headRow: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: colors.forest, paddingBottom: 12 },
  brand: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.ink, marginBottom: 6 },
  brandEm: { color: colors.gold },
  titleBox: { gap: 2 },
  title: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.forest, marginBottom: 4 },
  muted: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.muted },
  text: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.ink },
  b: { fontFamily: fonts.bold, color: colors.ink },
  gap: { marginTop: 6 },
  parties: { flexDirection: 'row', gap: 14 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  amount: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  total: { borderTopWidth: 2, borderTopColor: colors.ink },
  totalText: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink },
  foot: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 17, color: colors.muted },
  btn: { marginTop: 16 },
});
