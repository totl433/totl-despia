import { describe, expect, it } from 'vitest';

import { buildOneSignalAuthorization } from './onesignalAuth';

describe('OneSignal authorization', () => {
  it('uses Key authentication for current App API keys', () => {
    expect(buildOneSignalAuthorization('os_v2_app_test')).toBe('Key os_v2_app_test');
  });

  it('preserves Basic authentication for legacy REST keys', () => {
    expect(buildOneSignalAuthorization('legacy-key')).toBe('Basic legacy-key');
  });
});
