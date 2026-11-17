import { NativeModules, TurboModuleRegistry } from 'react-native';

// Razorpay's official native checkout (react-native-razorpay). The website opens
// the same checkout with checkout.js; both return the same three fields, which
// go to the same /api/subscriptions/verify-payment check on the server.
// App builds made before this module was added don't have it: `available` is
// then false and the checkout asks to update the app instead of crashing.

export interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface Checkout {
  open(options: Record<string, unknown>): Promise<RazorpaySuccess>;
}

const present = (() => {
  try {
    return !!TurboModuleRegistry.get('RNRazorpayCheckout') || !!NativeModules.RNRazorpayCheckout;
  } catch {
    return false;
  }
})();

const checkoutModule: Checkout | null = present
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    ((require('react-native-razorpay') as { default: Checkout }).default ?? null)
  : null;

export const razorpayAvailable = !!checkoutModule;

export class RazorpayError extends Error {
  /** Razorpay's code: 0 = network error, 2 = cancelled by the user (Android), others = failed. */
  readonly code: number;
  readonly cancelled: boolean;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.cancelled = code === 2 || /cancel/i.test(message);
  }
}

function describe(err: unknown): RazorpayError {
  const e = (err || {}) as { code?: unknown; description?: unknown; error?: { description?: unknown } };
  let text = typeof e.description === 'string' ? e.description : '';
  // Android sends the gateway's JSON as the description.
  try {
    const parsed = JSON.parse(text) as { error?: { description?: string; reason?: string } };
    text = parsed.error?.description || parsed.error?.reason || text;
  } catch {
    /* plain text */
  }
  if (!text && e.error && typeof e.error.description === 'string') text = e.error.description;
  return new RazorpayError(Number(e.code) || 0, text || 'The payment failed. You can try another method.');
}

export async function openRazorpay(options: Record<string, unknown>): Promise<RazorpaySuccess> {
  if (!checkoutModule) throw new RazorpayError(-1, 'This version of the app can’t take payments. Please install the latest version.');
  try {
    return await checkoutModule.open(options);
  } catch (e) {
    throw describe(e);
  }
}
