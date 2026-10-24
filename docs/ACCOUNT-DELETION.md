# Account deletion — app flow and the website change it needs

**Status:** the app side is built. The website route below is a **proposal awaiting approval**.
It has *not* been added to the `mappingg` website, and no live data was touched.

## Why

- **Apple App Store (Guideline 5.1.1(v))**: apps that let people create an account must let them delete it from inside the app.
- **Google Play (User Data policy)**: the same in-app path, **plus a web link** where people can request deletion without the app (entered in Play Console → Data safety).

## Current state (verified 2026-10-23)

- The website has **no self-service delete route**. Only staff can delete public accounts, through `DELETE /api/admin/accounts` (copies the user to the recycle bin, deletes it, then calls `forgetAccount`).
- Sessions are stateless 60-day JWTs (`lib/auth.ts`). Every request re-checks the `users` table, with a cache of up to 30 s, so **a deleted account is signed out on every device within 30 s**.
- `/api/auth/logout` only clears the cookie. It does not revoke the token (see "Session revocation" below).

## App flow (built)

Account → **Delete my account** → `src/app/delete-account.tsx`:

1. Explains what is deleted. Staff accounts are refused (managed by the owner).
2. Asks for the password, then a final "Delete your account?" confirmation.
3. Calls `POST /api/my/account/delete` (`deleteAccount()` in `src/services/account.ts`). It is single-flight, so a double tap sends one request.
4. Result:
   - `200` → signs out on this device, then shows "Account deleted".
   - `400 wrong_password` → "That password is not correct." (deliberately not 401, which would sign the person out)
   - `400 no_password` (Google-created account) → falls back to the request flow
   - plain `404` page (route not deployed yet) → **falls back to today's flow**: sends a deletion request to the team through `/api/contact`, then signs out; if that fails, offers an email draft
   - `429` → "Too many attempts…"

Tests: `src/services/api/__tests__/deleteAccount.test.ts`.

## Website route to add (needs your approval)

`app/api/my/account/delete/route.ts`, built from the website's own helpers:

```ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '@/lib/mongodb';
import { PUBLIC_ROLES, clearSessionCookie, forgetAccount, getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ password: z.string().min(1).max(200), confirm: z.literal('DELETE') });
const fail = (status: number, code: string, message: string) => NextResponse.json({ error: { code, message } }, { status });

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return fail(401, 'signed_out', 'Please sign in again.');
  if (!(PUBLIC_ROLES as readonly string[]).includes(me.role)) return fail(403, 'staff', 'Team accounts are managed by the owner.');

  const limited = rateLimit(`acct-delete:${me.id}`, 5, 15 * 60_000) || rateLimit(`acct-delete-ip:${clientIp(req)}`, 20, 15 * 60_000);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, 'invalid', 'Enter your password to confirm.');

  const db = await getDb();
  const user = await db.collection('users').findOne({ id: me.id, role: { $in: [...PUBLIC_ROLES] } });
  if (!user) return fail(400, 'no_account', 'This account no longer exists.');
  if (!user.password_hash) return fail(400, 'no_password', 'This account has no password. We will handle the deletion by email.');
  if (!(await bcrypt.compare(parsed.data.password, String(user.password_hash)))) return fail(400, 'wrong_password', 'That password is not correct.');

  // DECISION NEEDED (see below): which related records are deleted or anonymised.
  await db.collection('users').deleteOne({ id: me.id, role: { $in: [...PUBLIC_ROLES] } });
  forgetAccount(me.id); // other devices are signed out at once
  await logActivity({ user_id: me.id, role: me.role, type: 'deleted', detail: 'Account deleted by its owner (mobile app / website)' });
  clearSessionCookie();
  return NextResponse.json({ data: { ok: true } });
}
```

### Decisions you need to make before it ships

1. **Recycle bin or not.** The admin delete keeps a full copy in Backups → Recycle bin with no time limit, which conflicts with "permanently delete". Options: (a) no copy (shown above), or (b) a copy that a scheduled job purges after N days. Option (b) needs that job, and N must be stated in the Privacy Policy.
2. **Related data.** Check which collections hold this person's data beyond `users`: buyer profile, compare and favourites (likely on the user document), developer projects, notifications, activity log entries (these contain the email), leads and enquiries created from the account (CRM records), and Google Sheet copies of enquiries. For each, decide: delete, anonymise (keep the record, remove name/phone/email), or keep with a stated legal or business reason in the Privacy Policy.
3. **Developer accounts that own live projects.** Should their projects stay on the map (ownership moved to staff) or be unpublished?
4. **Web deletion page for Google Play.** For example `https://www.mappingg.com/account/delete`: signed-in users get the same password-confirmed button, and signed-out visitors get a short form (email + reason) that creates a deletion request. It must be reachable without the app.

## Session revocation (separate, optional, related)

After sign-out, the old token stays valid until it expires (60 days), including the copy kept in the panel WebView's cookie store.
Fix: store `sessions_valid_after` on the user, have `currentRoleOf` (lib/auth.ts) reject tokens whose `iat` is older, and set
it on `/api/auth/logout`. Note that this makes every sign-out sign that account out on **all** devices. If you'd rather sign out
one device at a time, use a per-token `jti` deny-list instead (more storage).
