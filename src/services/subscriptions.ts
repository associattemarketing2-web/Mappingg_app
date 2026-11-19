import type { Href } from 'expo-router';
import { apiRequest } from './api/client';

// Subscriptions & membership — the website's /api/subscriptions/*, /api/cp/*
// and /api/buyer/* routes (mappingg: lib/subscriptions). Plans, prices,
// features, limits, usage and every amount come from the server; the app only
// shows them. Labels and texts below are the website's own
// (components/subscriptions/*), so both say exactly the same thing.

export type Category = 'developer' | 'cp' | 'buyer';

export const CATEGORY_LABEL: Record<Category, string> = { developer: 'Developer', cp: 'Channel Partner', buyer: 'Buyer' };

export function categoryForRole(role?: string | null): Category | null {
  if (role === 'developer') return 'developer';
  if (role === 'agent') return 'cp';
  if (role === 'buyer') return 'buyer';
  return null;
}

export interface PublicPlan {
  category: Category;
  code: string;
  name: string;
  tagline: string;
  description: string;
  price_paise: number;
  billing_period: string;
  period_label: string;
  period_months: number;
  billing_unit: string;
  recommended: boolean;
  is_free: boolean;
  sort: number;
  features: { key: string; label: string; included: boolean }[];
  limits: { key: string; label: string; value: number | null }[];
}

export interface Subscription {
  id: string;
  plan_code: string;
  plan_name: string;
  status: string;
  effective_status: string;
  billing_unit: string;
  quantity: number;
  project_ids: string[];
  city: string | null;
  start_at: string;
  expires_at: string | null;
  renew_at: string | null;
  grace_until: string | null;
  cancel_at_period_end: boolean;
  next_plan_id: string | null;
}

export interface UsageState {
  metric: string;
  limit: number | null;
  used: number;
  remaining: number | null;
  period: string;
  resetsAt?: string | null;
}

export interface DevProject {
  id: string;
  number: number | null;
  title: string;
  location: string;
  city: string | null;
  state: string | null;
  review: 'pending' | 'rejected' | 'live';
  covered: boolean;
}

export interface MySubscription {
  category: Category;
  enforced: boolean;
  status: string;
  plan: PublicPlan | null;
  subscription: Subscription | null;
  days_left: number;
  next_plan: { code: string; name: string } | null;
  usage: UsageState[];
  available: PublicPlan[];
  payments: { configured: boolean; mode: 'test' | 'live' | null };
  cities: { key: string; label: string; state?: string }[];
  projects?: DevProject[];
  project_count?: number;
  project_limit?: number | null;
  city: string | null;
  unread: number;
  tax: { registered: boolean; rate: number; inclusive: boolean };
  terms_url: string;
}

export interface Payment {
  id: string;
  kind: string;
  plan_name: string;
  quantity: number;
  total_paise: number;
  refunded_paise: number;
  status: string;
  failure_reason: string | null;
  created_at: string;
  paid_at: string | null;
  gateway_payment_id: string | null;
}
export interface SubEvent {
  id: string;
  action: string;
  from_plan: string | null;
  to_plan: string | null;
  to_status: string | null;
  at: string;
}
export interface InvoiceSummary {
  id: string;
  number: string;
  status: string;
  issued_at: string;
  totals: { total_paise: number };
}
export interface SubNotice {
  id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}
export interface Invoice {
  id: string;
  number: string;
  status: string;
  tax_mode: string;
  seller: Record<string, string | boolean | undefined>;
  customer: Record<string, string | undefined>;
  lines: { description: string; sac?: string; quantity: number; unit_paise: number; amount_paise: number }[];
  totals: Record<string, number | string>;
  period_start: string | null;
  period_end: string | null;
  issued_at: string;
}

export interface Quote {
  unit_price_paise: number;
  quantity: number;
  base_paise: number;
  discount_paise: number;
  credit_paise: number;
  taxable_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  tax_paise: number;
  total_paise: number;
  tax_mode: 'none' | 'exclusive' | 'inclusive';
  tax_rate: number;
  coupon_code: string | null;
}
export interface QuoteRes {
  kind: 'new' | 'renewal' | 'upgrade' | 'downgrade';
  quantity: number;
  quote: Quote;
  coupon_error: string | null;
  period_start: string;
  current: { plan_code: string; expires_at: string | null } | null;
}
export interface CheckoutBody {
  plan: string;
  project_ids?: string[];
  city?: string;
  coupon?: string;
  billing?: { name?: string; gstin?: string; address?: string };
}
export interface CheckoutRes {
  payment_id: string;
  status: 'awaiting_payment' | 'activated' | 'scheduled';
  gateway?: { key: string; order_id: string; amount: number; currency: string; mode: string | null };
}

/** react-query keys; invalidate ['sub'] after any change. */
export const subKeys = {
  current: ['sub', 'current'] as const,
  history: ['sub', 'history'] as const,
  invoices: ['sub', 'invoices'] as const,
  notices: ['sub', 'notices'] as const,
};

const data = async <T>(p: Promise<{ data: T }>): Promise<T> => (await p).data;

// ---- plans & my subscription ---------------------------------------------

/** Every active plan (public — /pricing and the sign-up plan picker). */
export const getPlans = (category?: Category) =>
  data(
    apiRequest<{ data: { plans: PublicPlan[]; payments?: MySubscription['payments']; enabled?: boolean } }>('/api/subscriptions/plans', { query: { category } }),
  );

export const getMySubscription = () => data(apiRequest<{ data: MySubscription }>('/api/subscriptions/current', { auth: true }));
export const getHistory = () => data(apiRequest<{ data: { payments: Payment[]; events: SubEvent[] } }>('/api/subscriptions/history', { auth: true }));
export const getInvoices = () => data(apiRequest<{ data: InvoiceSummary[] }>('/api/subscriptions/invoices', { auth: true }));
export const getInvoice = (id: string) => data(apiRequest<{ data: Invoice }>(`/api/subscriptions/invoices/${encodeURIComponent(id)}`, { auth: true }));
export const getSubNotices = () => data(apiRequest<{ data: SubNotice[] }>('/api/subscriptions/notifications', { auth: true }));
export const markSubNoticesRead = () => apiRequest('/api/subscriptions/notifications', { method: 'POST', auth: true });

export const quote = (body: CheckoutBody) => data(apiRequest<{ data: QuoteRes }>('/api/subscriptions/quote', { method: 'POST', body, auth: true }));
export const checkout = (body: CheckoutBody) => data(apiRequest<{ data: CheckoutRes }>('/api/subscriptions/checkout', { method: 'POST', body, auth: true }));
export const verifyPayment = (body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
  data(apiRequest<{ data: { status: 'paid' | 'pending' | 'failed'; invoice_id?: string | null } }>('/api/subscriptions/verify-payment', { method: 'POST', body, auth: true }));
export const paymentCancelled = (paymentId: string) =>
  apiRequest('/api/subscriptions/payment-cancelled', { method: 'POST', body: { payment_id: paymentId }, auth: true });
/** Cancel at the end of the term — or, with resume, undo a cancellation / scheduled plan change. */
export const cancelPlan = (resume = false) => apiRequest('/api/subscriptions/cancel', { method: 'POST', body: resume ? { resume: true } : {}, auth: true });
export const chooseCity = (city: string) => apiRequest('/api/subscriptions/city', { method: 'POST', body: { city }, auth: true });

// ---- channel partner: lead book / CRM ------------------------------------

export interface CpLead {
  id: string;
  name: string;
  phone: string;
  email: string;
  pin_id: string | null;
  project_title: string;
  budget: string;
  requirement: string;
  city: string;
  status: string;
  priority: string;
  follow_up_at: string | null;
  notes: string;
  activity: { at: string; text: string }[];
  archived: boolean;
  created_at: string;
  updated_at: string;
}
export interface CpPlanInfo {
  can_add: boolean;
  crm: boolean;
  visibility: boolean;
  limit: number | null;
  used: number;
  enforced: boolean;
}
export interface Outlook {
  pin_id: string;
  title: string;
  location: string;
  current_price: string;
  expected_price: string;
  horizon: string;
  note: string;
  source: string;
  updated_at: string;
}

export const getCpLeads = (archived: boolean) =>
  data(apiRequest<{ data: { leads: CpLead[]; plan: CpPlanInfo } }>('/api/cp/leads', { auth: true, query: archived ? { archived: 1 } : undefined }));
export const addCpLead = (body: Record<string, string | null>) => data(apiRequest<{ data: CpLead }>('/api/cp/leads', { method: 'POST', body, auth: true }));
export const patchCpLead = (id: string, body: Record<string, unknown>) =>
  data(apiRequest<{ data: CpLead }>('/api/cp/leads', { method: 'PATCH', body: { id, ...body }, auth: true }));
export const archiveCpLead = (id: string, restore = false) =>
  apiRequest('/api/cp/leads', { method: 'DELETE', auth: true, query: { id, restore: restore ? 1 : undefined } });
export const exportCpLeadsCsv = () => apiRequest<string>('/api/cp/leads', { auth: true, query: { format: 'csv' }, text: true });
export const getFuturePrices = () => data(apiRequest<{ data: Outlook[] }>('/api/cp/future-price', { auth: true }));

// ---- buyer premium tools -------------------------------------------------

export interface ServiceRequest {
  id: string;
  type: string;
  project_title: string;
  message: string;
  preferred_date: string;
  preferred_time: string;
  status: string;
  admin_note: string;
  created_at: string;
}
export interface Holding {
  id: string;
  name: string;
  location: string;
  purchase_price_paise: number;
  purchase_date: string;
  area_sqft: number | null;
  current_value_paise: number | null;
  loan_outstanding_paise: number | null;
  notes: string;
}

export const getServiceRequests = () => data(apiRequest<{ data: ServiceRequest[] }>('/api/buyer/services', { auth: true }));
export const requestService = (body: Record<string, string>) => apiRequest('/api/buyer/services', { method: 'POST', body, auth: true });
export const cancelServiceRequest = (id: string) => apiRequest('/api/buyer/services', { method: 'DELETE', auth: true, query: { id } });
export const getPortfolio = () => data(apiRequest<{ data: Holding[] }>('/api/buyer/portfolio', { auth: true }));
export const saveHolding = (body: Record<string, string>, id?: string | null) =>
  apiRequest('/api/buyer/portfolio', { method: id ? 'PATCH' : 'POST', body: id ? { id, ...body } : body, auth: true });
export const removeHolding = (id: string) => apiRequest('/api/buyer/portfolio', { method: 'DELETE', auth: true, query: { id } });

// ---- display helpers (website: lib/subscriptions/catalog.ts, PlanGrid.tsx) ----

export const formatInr = (paise: number) =>
  `₹${(Math.round(paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

export const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '');

export const unitLabel = (p: Pick<PublicPlan, 'billing_unit' | 'billing_period' | 'period_label'>) =>
  p.billing_period === 'none' ? 'free forever' : `${p.billing_unit === 'project' ? 'per project ' : ''}${p.period_label}`;

/** Short billing suffix next to the price on /pricing, e.g. "/ month", "/ project / month". */
export function perLabel(p: PublicPlan): string {
  if (p.billing_period === 'none') return '/ month';
  const period = ({ month: 'month', quarter: 'quarter', half_year: '6 months', year: 'year' } as Record<string, string>)[p.billing_period] || p.period_label;
  return `${p.billing_unit === 'project' ? '/ project ' : ''}/ ${period}`;
}

export function limitText(l: { key: string; label: string; value: number | null }): string {
  if (l.value === null) {
    if (l.key === 'cp_max_cities') return 'All cities';
    if (l.key === 'dev_max_states') return 'Multiple states';
    return `Unlimited — ${l.label.toLowerCase()}`;
  }
  if (l.key === 'cp_weekly_project_access') return `${l.value} project details / week`;
  if (l.key === 'buyer_listing_limit') return `${l.value} property listings`;
  if (l.key === 'cp_max_cities') return `${l.value} selected cit${l.value === 1 ? 'y' : 'ies'}`;
  if (l.key === 'dev_max_projects') return `Up to ${l.value} projects listed`;
  if (l.key === 'dev_max_states') return `${l.value} state${l.value === 1 ? '' : 's'}`;
  if (l.key === 'cp_max_leads') return l.value ? `Up to ${l.value} client leads` : 'No lead manager';
  if (l.key === 'dev_media_per_project') return l.value ? `${l.value} media files per project` : 'No media uploads';
  return `${l.label}: ${l.value}`;
}

/** Limits worth listing on a plan (a 0 media / lead allowance just means "not included"). */
export const shownLimits = (p: PublicPlan) => p.limits.filter((l) => !(l.value === 0 && /media|lead/.test(l.key)));

export const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  FREE: 'Free plan',
  PAST_DUE: 'Renewal due',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  SUSPENDED: 'Suspended',
  REFUNDED: 'Refunded',
  PENDING: 'Pending',
  FAILED: 'Failed',
};
export const PAY_LABEL: Record<string, string> = {
  created: 'Not completed',
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  partially_refunded: 'Part refunded',
};
export const ACTION_LABEL: Record<string, string> = {
  activated: 'Plan activated',
  upgraded: 'Upgraded',
  renewed: 'Renewed',
  expired: 'Expired',
  past_due: 'Term ended — renewal due',
  cancel_requested: 'Cancelled (until term end)',
  resumed: 'Cancellation undone',
  downgrade_scheduled: 'Plan change scheduled',
  refunded: 'Refunded',
  admin_activated: 'Activated by Mappingg',
  checkout_started: 'Checkout started',
  payment_failed: 'Payment failed',
  city_selected: 'City selected',
  replaced_by_upgrade: 'Replaced by upgrade',
  replaced: 'Replaced',
  admin_extend: 'Extended by Mappingg',
  admin_cancel_now: 'Cancelled by Mappingg',
  admin_suspend: 'Suspended by Mappingg',
  admin_resume: 'Resumed by Mappingg',
  replaced_by_admin: 'Replaced by Mappingg',
};
export const KIND_LABEL: Record<QuoteRes['kind'], string> = {
  new: 'New subscription',
  renewal: 'Renewal',
  upgrade: 'Plan change (upgrade)',
  downgrade: 'Scheduled plan change',
};

/** A paid plan is running (active, or in its grace period). */
export const isPaidActive = (me: MySubscription) => !!me.subscription && ['ACTIVE', 'PAST_DUE'].includes(me.subscription.effective_status);

/** Plan feature check for client UIs (website: premium page `can()`); the server enforces it anyway. */
export const canUse = (me: MySubscription | undefined, feature: string) =>
  !me || !me.enforced || !!me.plan?.features.find((f) => f.key === feature)?.included;

/** App screen for a website account path (links inside panels, plan-gate "manage" links). */
export function appRouteForSitePath(pathname: string, search = ''): Href | null {
  const q = new URLSearchParams(search);
  const plan = (q.get('plan') || '').slice(0, 40);
  if (/^\/pricing\/?$/.test(pathname)) return '/pricing';
  if (/^\/dashboard\/(developer|agent|buyer)\/subscription\/?$/.test(pathname)) return plan ? { pathname: '/subscription', params: { plan } } : '/subscription';
  const inv = /^\/dashboard\/(?:developer|agent|buyer)\/invoices\/([^/]+)\/?$/.exec(pathname);
  if (inv) return { pathname: '/subscription/invoice/[id]', params: { id: decodeURIComponent(inv[1]!) } };
  if (/^\/dashboard\/agent\/crm\/?$/.test(pathname)) return '/crm';
  if (/^\/dashboard\/buyer\/premium\/?$/.test(pathname)) return '/premium';
  if (/^\/dashboard\/(agent|buyer)\/favorites\/?$/.test(pathname)) return '/favorites';
  return null;
}
