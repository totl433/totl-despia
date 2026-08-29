import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  PLAY_ONLINE_COOKIE,
  clearPreferPlayOnline,
  prefersPlayOnline,
  setPreferPlayOnline,
} from './playOnlinePreference';

describe('playOnlinePreference', () => {
  beforeEach(() => {
    clearPreferPlayOnline();
  });

  afterEach(() => {
    clearPreferPlayOnline();
  });

  it('is false by default', () => {
    expect(prefersPlayOnline()).toBe(false);
  });

  it('remembers play online for the cookie lifetime', () => {
    setPreferPlayOnline();
    expect(document.cookie).toContain(`${PLAY_ONLINE_COOKIE}=1`);
    expect(prefersPlayOnline()).toBe(true);
  });

  it('can be cleared', () => {
    setPreferPlayOnline();
    clearPreferPlayOnline();
    expect(prefersPlayOnline()).toBe(false);
  });
});
