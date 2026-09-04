import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_GA_ID,
  initializeGoogleAnalytics,
  installGoogleTagQueue,
  trackAppStoreClick,
  type Gtag,
} from './googleAnalytics';

describe('googleAnalytics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('queues commands as native Arguments objects for Google Tag', () => {
    const target: { dataLayer?: unknown[]; gtag?: Gtag } = {};
    const gtag = installGoogleTagQueue(target);

    gtag('config', 'G-TEST');

    expect(target.dataLayer).toHaveLength(1);
    expect(Array.isArray(target.dataLayer?.[0])).toBe(false);
    expect(Array.from(target.dataLayer?.[0] as IArguments)).toEqual([
      'config',
      'G-TEST',
    ]);
  });

  it('initializes one production GA script with consent before config', () => {
    const appended: Array<{ src?: string; async?: boolean }> = [];
    const target = {
      location: { hostname: 'playtotl.test' },
      addEventListener: vi.fn(),
    };
    const document = {
      querySelector: vi.fn(() => null),
      createElement: vi.fn(() => ({ src: '', async: false })),
      head: {
        appendChild: vi.fn((script) => {
          appended.push(script);
        }),
      },
    };
    vi.stubGlobal('window', target);
    vi.stubGlobal('document', document);

    expect(initializeGoogleAnalytics()).toBe(true);

    const commands = (target as typeof target & { dataLayer: IArguments[] }).dataLayer.map(
      (command) => Array.from(command),
    );
    expect(commands[0]).toEqual([
      'consent',
      'default',
      expect.objectContaining({ analytics_storage: 'denied' }),
    ]);
    expect(commands[1]?.[0]).toBe('js');
    expect(commands[2]).toEqual(['config', DEFAULT_GA_ID]);
    expect(appended).toEqual([
      {
        async: true,
        src: `https://www.googletagmanager.com/gtag/js?id=${DEFAULT_GA_ID}`,
      },
    ]);
  });

  it('sends an app_store_click event with placement metadata', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag });

    expect(
      trackAppStoreClick({
        placement: 'feature_slide',
        slideId: 'leaderboard',
        linkUrl: 'https://apps.apple.com/example',
      }),
    ).toBe(true);

    expect(gtag).toHaveBeenCalledWith('event', 'app_store_click', {
      placement: 'feature_slide',
      slide_id: 'leaderboard',
      link_url: 'https://apps.apple.com/example',
    });
  });
});
