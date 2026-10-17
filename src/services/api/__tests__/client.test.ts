import { apiRequest, setSessionBridge } from '../client';
import { ApiError } from '../errors';

type FetchArgs = [string, RequestInit];

function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
  return Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers }));
}

describe('apiRequest', () => {
  const fetchMock = jest.fn<Promise<Response>, FetchArgs>();
  const bridge = { getToken: jest.fn(() => 'tok123'), onToken: jest.fn(), onUnauthorized: jest.fn() };

  beforeEach(() => {
    fetchMock.mockReset();
    bridge.getToken.mockClear();
    bridge.onToken.mockClear();
    bridge.onUnauthorized.mockClear();
    global.fetch = fetchMock as unknown as typeof fetch;
    setSessionBridge(bridge);
  });
  afterAll(() => setSessionBridge(null));

  it('sends the session as a Cookie header only for authenticated calls, without the platform cookie jar', async () => {
    fetchMock.mockReturnValueOnce(respond(200, { ok: true }));
    await apiRequest('/api/my/compare', { auth: true });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toMatch(/\/api\/my\/compare$/);
    expect((init.headers as Record<string, string>).Cookie).toBe('mg_session=tok123');
    expect(init.credentials).toBe('omit');

    fetchMock.mockReturnValueOnce(respond(200, { data: [] }));
    await apiRequest('/api/developers');
    expect((fetchMock.mock.calls[1]![1].headers as Record<string, string>).Cookie).toBeUndefined();
  });

  it('encodes query parameters', async () => {
    fetchMock.mockReturnValueOnce(respond(200, { data: [] }));
    await apiRequest('/api/db', { query: { op: JSON.stringify({ table: 'pins' }), empty: '' } });
    expect(fetchMock.mock.calls[0]![0]).toMatch(/\/api\/db\?op=%7B%22table%22%3A%22pins%22%7D$/);
  });

  it('hands a renewed session cookie to the session layer', async () => {
    fetchMock.mockReturnValueOnce(respond(200, { session: {} }, { 'set-cookie': 'mg_session=newtok; Path=/; HttpOnly' }));
    await apiRequest('/api/auth/session', { auth: true });
    expect(bridge.onToken).toHaveBeenCalledWith('newtok');
  });

  it('gives sign-in its own session callback', async () => {
    const onSession = jest.fn();
    fetchMock.mockReturnValueOnce(respond(200, { user: {} }, { 'set-cookie': 'mg_session=login; Path=/' }));
    await apiRequest('/api/auth/login', { method: 'POST', body: {}, onSession });
    expect(onSession).toHaveBeenCalledWith('login');
    expect(bridge.onToken).not.toHaveBeenCalled();
  });

  it('reports 401 on authenticated calls as an ended session', async () => {
    fetchMock.mockReturnValueOnce(respond(401, { error: { message: 'Not authorized' } }));
    await expect(apiRequest('/api/my/profile', { auth: true })).rejects.toMatchObject({ kind: 'unauthorized', status: 401, message: 'Not authorized' });
    expect(bridge.onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not end the session for a wrong password (401 on a public call)', async () => {
    fetchMock.mockReturnValueOnce(respond(401, { error: { message: 'Invalid login credentials' } }));
    await expect(apiRequest('/api/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({ message: 'Invalid login credentials' });
    expect(bridge.onUnauthorized).not.toHaveBeenCalled();
  });

  it('maps server errors, rate limits and bad JSON', async () => {
    fetchMock.mockReturnValueOnce(respond(429, { error: { message: 'Too many attempts' } }));
    await expect(apiRequest('/x')).rejects.toMatchObject({ kind: 'rate_limited' });
    fetchMock.mockReturnValueOnce(respond(500, 'oops'));
    await expect(apiRequest('/x')).rejects.toMatchObject({ kind: 'server' });
    fetchMock.mockReturnValueOnce(respond(200, '<html>'));
    await expect(apiRequest('/x')).rejects.toMatchObject({ kind: 'parse' });
  });

  it('turns connection failures into a network error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    const err = await apiRequest('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).kind).toBe('network');
  });

  it('times out slow requests', async () => {
    fetchMock.mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    await expect(apiRequest('/slow', { timeoutMs: 20 })).rejects.toMatchObject({ kind: 'timeout' });
  });
});
