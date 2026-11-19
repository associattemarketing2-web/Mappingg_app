import { apiRequest, setSessionBridge } from '@/services/api/client';
import { ApiError } from '@/services/api/errors';
import { appRouteForSitePath, canUse, formatInr, limitText, perLabel, unitLabel, type MySubscription, type PublicPlan } from '@/services/subscriptions';
import { formatLakh, parseAreaSqft, parsePriceLakh, projectInsights } from '@/lib/insights';
import { dayOptions, isoToLocal, localToIso } from '@/lib/dates';
import type { Pin } from '@/types/models';

// Subscriptions: the app must show the same plans, prices, limits and plan
// refusals as the website (mappingg: lib/subscriptions, components/subscriptions).

const plan = (over: Partial<PublicPlan> = {}): PublicPlan => ({
  category: 'cp',
  code: 'cp_pro',
  name: 'Pro',
  tagline: '',
  description: '',
  price_paise: 100000,
  billing_period: 'month',
  period_label: 'per month',
  period_months: 1,
  billing_unit: 'account',
  recommended: true,
  is_free: false,
  sort: 1,
  features: [{ key: 'cp_crm', label: 'CRM', included: false }],
  limits: [],
  ...over,
});

describe('plan display (website PlanGrid / catalog)', () => {
  it('formats paise as rupees like the website', () => {
    expect(formatInr(100000)).toBe('₹1,000');
    expect(formatInr(199900)).toBe('₹1,999');
    expect(formatInr(150)).toBe('₹1.50');
  });

  it('labels billing units and periods', () => {
    expect(unitLabel(plan())).toBe('per month');
    expect(unitLabel(plan({ billing_unit: 'project' }))).toBe('per project per month');
    expect(unitLabel(plan({ billing_period: 'none' }))).toBe('free forever');
    expect(perLabel(plan({ billing_unit: 'project' }))).toBe('/ project / month');
    expect(perLabel(plan({ billing_period: 'quarter' }))).toBe('/ quarter');
  });

  it('words limits the way the website does', () => {
    expect(limitText({ key: 'cp_weekly_project_access', label: 'x', value: 3 })).toBe('3 project details / week');
    expect(limitText({ key: 'cp_max_cities', label: 'x', value: 1 })).toBe('1 selected city');
    expect(limitText({ key: 'cp_max_cities', label: 'x', value: null })).toBe('All cities');
    expect(limitText({ key: 'dev_max_projects', label: 'x', value: 3 })).toBe('Up to 3 projects listed');
    expect(limitText({ key: 'cp_max_leads', label: 'x', value: 0 })).toBe('No lead manager');
    expect(limitText({ key: 'buyer_listing_limit', label: 'Listings', value: null })).toBe('Unlimited — listings');
  });

  it('treats every feature as available until the owner switches enforcement on', () => {
    const me = { enforced: false, plan: plan() } as unknown as MySubscription;
    expect(canUse(me, 'cp_crm')).toBe(true);
    expect(canUse({ ...me, enforced: true }, 'cp_crm')).toBe(false);
    expect(canUse({ ...me, enforced: true, plan: plan({ features: [{ key: 'cp_crm', label: 'CRM', included: true }] }) }, 'cp_crm')).toBe(true);
  });
});

describe('website account links → app screens', () => {
  it('maps subscription, invoices, CRM, premium, favourites and pricing', () => {
    expect(appRouteForSitePath('/pricing')).toBe('/pricing');
    expect(appRouteForSitePath('/dashboard/developer/subscription')).toBe('/subscription');
    expect(appRouteForSitePath('/dashboard/agent/subscription', '?plan=cp_pro_max')).toEqual({ pathname: '/subscription', params: { plan: 'cp_pro_max' } });
    expect(appRouteForSitePath('/dashboard/buyer/invoices/inv_1')).toEqual({ pathname: '/subscription/invoice/[id]', params: { id: 'inv_1' } });
    expect(appRouteForSitePath('/dashboard/agent/crm')).toBe('/crm');
    expect(appRouteForSitePath('/dashboard/buyer/premium')).toBe('/premium');
    expect(appRouteForSitePath('/dashboard/buyer/favorites')).toBe('/favorites');
  });

  it('leaves the panels themselves alone', () => {
    expect(appRouteForSitePath('/dashboard/developer')).toBeNull();
    expect(appRouteForSitePath('/dashboard/s-admin')).toBeNull();
    expect(appRouteForSitePath('/dashboard/agent/crm-extra')).toBeNull();
  });
});

describe('plan refusals (402) from the API', () => {
  const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    setSessionBridge({ getToken: () => 't', onToken: jest.fn(), onUnauthorized: jest.fn() });
  });
  afterAll(() => setSessionBridge(null));

  it('carries the upgrade plan and usage of guards.ts answers', async () => {
    const body = { error: { message: 'You have opened 3 of 3 projects this week.', code: 'limit_reached', upgrade: { code: 'cp_pro', name: 'Pro' }, usage: { used: 3, limit: 3, remaining: 0, resetsAt: '2026-11-23T18:30:00Z' }, manage: '/dashboard/agent/subscription' } };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 402 }));
    const err = await apiRequest('/api/my/enquire', { method: 'POST', auth: true, body: { pin_id: 'p1' } }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const e = err as ApiError;
    expect(e.kind).toBe('payment_required');
    expect(e.message).toBe('You have opened 3 of 3 projects this week.');
    expect(e.plan?.upgrade).toEqual({ code: 'cp_pro', name: 'Pro' });
    expect(e.plan?.usage).toMatchObject({ used: 3, limit: 3 });
    expect(e.plan?.manage).toBe('/dashboard/agent/subscription');
  });

  it('returns raw text for exports', async () => {
    fetchMock.mockResolvedValueOnce(new Response('name,phone\nA,1', { status: 200, headers: { 'Content-Type': 'text/csv' } }));
    await expect(apiRequest('/api/cp/leads', { auth: true, text: true, query: { format: 'csv' } })).resolves.toBe('name,phone\nA,1');
  });
});

describe('buyer premium insights (website lib/subscriptions/insights.ts)', () => {
  it('parses prices and areas the same way', () => {
    expect(parsePriceLakh('₹ 1.2 – 2.5 Cr')).toEqual({ min: 120, max: 250 });
    expect(parsePriceLakh('85 L onwards')).toEqual({ min: 85, max: 85 });
    expect(parsePriceLakh('Price on request')).toBeNull();
    expect(parseAreaSqft('650 - 1,100 sq ft carpet')).toEqual({ min: 650, max: 1100 });
    expect(parseAreaSqft('1200')).toBeNull();
    expect(formatLakh(120)).toBe('₹1.2 Cr');
    expect(formatLakh(85)).toBe('₹85 L');
  });

  it('compares a saved project with its locality median (3+ peers)', () => {
    const pin = (id: string, price: string, sqft: string): Pin => ({ id, number: 1, title: id, slug: id, locality: 'Kharadi', price, sqft, fieldVisibility: null, possessionTimeline: 'Dec 2028', reraNumber: 'P521', status: 'available' }) as unknown as Pin;
    const pins = [pin('a', '1 Cr', '1000 sq ft'), pin('b', '1.2 Cr', '1000 sq ft'), pin('c', '80 L', '1000 sq ft'), pin('d', '1.5 Cr', '1000 sq ft')];
    const [i] = projectInsights(pins, ['d']);
    expect(i!.psf).toBe(15000);
    expect(i!.localityCount).toBe(4);
    expect(i!.localityMedianPsf).toBe(11000);
    expect(i!.vsLocality).toBe(36);
    expect(i!.rera).toBe(true);
  });
});

describe('form dates', () => {
  it('round-trips a local day + time', () => {
    const iso = localToIso('2026-12-05', '10:30')!;
    expect(isoToLocal(iso)).toEqual({ day: '2026-12-05', time: '10:30' });
    expect(localToIso('', '10:00')).toBeNull();
    expect(dayOptions(3, new Date(2026, 10, 17)).map((d) => d.value)).toEqual(['2026-11-17', '2026-11-18', '2026-11-19']);
  });
});
