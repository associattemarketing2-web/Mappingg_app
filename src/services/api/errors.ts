export type ApiErrorKind =
  | 'network' // no connection / DNS / TLS failure
  | 'timeout'
  | 'unauthorized' // 401: not signed in or session expired
  | 'forbidden' // 403
  | 'not_found'
  | 'rate_limited' // 429
  | 'validation' // 400 / 409 / 422 with a message from the server
  | 'payment_required' // 402: the account's plan doesn't include this (subscriptions)
  | 'server' // 5xx
  | 'parse'; // response was not the JSON we expected

/** What the website's plan guards send with a 402 ({ error: { message, code, upgrade, usage, manage } }). */
export interface PlanGateInfo {
  upgrade: { code: string; name: string } | null;
  usage: { used: number; limit: number | null; remaining?: number | null; resetsAt?: string | null } | null;
  manage: string;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly code?: string;
  /** Set on 402 answers: the plan that unlocks this, and the usage so far. */
  readonly plan?: PlanGateInfo;

  constructor(kind: ApiErrorKind, message: string, status = 0, code?: string, plan?: PlanGateInfo) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.plan = plan;
  }
}

export function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 402) return 'payment_required';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server';
  return 'validation';
}

const DEFAULTS: Record<ApiErrorKind, string> = {
  network: 'No internet connection. Check your connection and try again.',
  timeout: 'The server took too long to respond. Please try again.',
  unauthorized: 'Please sign in to continue.',
  forbidden: 'Your account is not allowed to do this.',
  not_found: 'Not found.',
  rate_limited: 'Too many attempts. Please wait a few minutes and try again.',
  validation: 'Please check the details and try again.',
  payment_required: 'Upgrade your plan to continue.',
  server: 'Something went wrong on our side. Please try again shortly.',
  parse: 'Unexpected response from the server. Please try again.',
};

export const defaultMessage = (kind: ApiErrorKind) => DEFAULTS[kind];

/** A message that is safe to show to people for any thrown value. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message || DEFAULTS[e.kind];
  return DEFAULTS.server;
}

export const isApiError = (e: unknown, kind?: ApiErrorKind): e is ApiError =>
  e instanceof ApiError && (!kind || e.kind === kind);
