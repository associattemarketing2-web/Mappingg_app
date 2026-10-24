import { Alert, Linking } from 'react-native';
import { TimeoutError, withTimeout } from '../async';
import { mapAttribution } from '../mapAttribution';
import { OPEN_FAILED_MESSAGE, openUrl } from '../openLink';

describe('withTimeout (location fix can no longer hang the "Near me" spinner)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolves with the value when the promise settles in time', async () => {
    const p = withTimeout(Promise.resolve(42), 1000);
    await expect(p).resolves.toBe(42);
  });

  it('passes through the original rejection', async () => {
    const p = withTimeout(Promise.reject(new Error('gps off')), 1000);
    await expect(p).rejects.toThrow('gps off');
  });

  it('rejects with TimeoutError when the promise never settles', async () => {
    const p = withTimeout(new Promise<never>(() => undefined), 15_000);
    jest.advanceTimersByTime(15_000);
    await expect(p).rejects.toBeInstanceOf(TimeoutError);
  });
});

describe('openUrl (links with no app to handle them)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('opens the link and reports success', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await expect(openUrl('mailto:hello@example.com')).resolves.toBe(true);
    expect(open).toHaveBeenCalledWith('mailto:hello@example.com');
    expect(alert).not.toHaveBeenCalled();
  });

  it('tells the person instead of failing silently (no unhandled rejection)', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('No Activity found'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await expect(openUrl('whatsapp://send?phone=1')).resolves.toBe(false);
    expect(alert).toHaveBeenCalledWith(expect.any(String), OPEN_FAILED_MESSAGE);
  });

  it('ignores an empty link', async () => {
    const open = jest.spyOn(Linking, 'openURL');
    open.mockClear();
    await expect(openUrl('')).resolves.toBe(false);
    expect(open).not.toHaveBeenCalled();
  });
});

describe('map attribution (OpenStreetMap / Esri credit must be visible)', () => {
  it('credits OpenStreetMap on the map and night styles', () => {
    expect(mapAttribution('map').text).toContain('OpenStreetMap');
    expect(mapAttribution('night').text).toContain('OpenStreetMap');
    expect(mapAttribution('map').url).toBe('https://www.openstreetmap.org/copyright');
  });

  it('credits Esri on satellite imagery', () => {
    expect(mapAttribution('satellite').text).toContain('Esri');
    expect(mapAttribution('satellite').url.startsWith('https://')).toBe(true);
  });
});
