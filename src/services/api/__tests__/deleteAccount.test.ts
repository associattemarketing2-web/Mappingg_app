import { deleteAccount } from '@/services/account';
import { setSessionBridge } from '../client';
import { ApiError } from '../errors';

type FetchArgs = [string, RequestInit];

function respond(status: number, body: unknown) {
  return Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));
}

describe('deleteAccount', () => {
  const fetchMock = jest.fn<Promise<Response>, FetchArgs>();
  const bridge = { getToken: jest.fn(() => 'tok123'), onToken: jest.fn(), onUnauthorized: jest.fn() };

  beforeEach(() => {
    fetchMock.mockReset();
    bridge.onUnauthorized.mockClear();
    global.fetch = fetchMock as unknown as typeof fetch;
    setSessionBridge(bridge);
  });
  afterAll(() => setSessionBridge(null));

  it('posts the password with the signed-in session and reports success', async () => {
    fetchMock.mockReturnValueOnce(respond(200, { data: { ok: true } }));
    await expect(deleteAccount('pw')).resolves.toBe('deleted');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toMatch(/\/api\/my\/account\/delete$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ password: 'pw', confirm: 'DELETE' });
    expect((init.headers as Record<string, string>).Cookie).toBe('mg_session=tok123');
  });

  it('falls back (unsupported) while the website has no delete route yet', async () => {
    fetchMock.mockReturnValueOnce(respond(404, '<!doctype html><title>404</title>'));
    await expect(deleteAccount('pw')).resolves.toBe('unsupported');
  });

  it('a wrong password is an error with a code, and does not sign the person out', async () => {
    fetchMock.mockReturnValueOnce(respond(400, { error: { code: 'wrong_password', message: 'Wrong password' } }));
    const err = await deleteAccount('nope').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('wrong_password');
    expect(bridge.onUnauthorized).not.toHaveBeenCalled();
  });

  it('a JSON 404 from the route itself is a real error, not "unsupported"', async () => {
    fetchMock.mockReturnValueOnce(respond(404, { error: { code: 'no_account', message: 'Account not found' } }));
    await expect(deleteAccount('pw')).rejects.toBeInstanceOf(ApiError);
  });
});
