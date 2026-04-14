import { describe, expect, it, vi } from 'vitest';

import {
  retryBrandedLeaderboardActivation,
  shouldRetryBrandedLeaderboardActivation,
} from './brandedLeaderboardActivation';

describe('shouldRetryBrandedLeaderboardActivation', () => {
  it('retries only when activation is waiting for RevenueCat visibility', () => {
    expect(
      shouldRetryBrandedLeaderboardActivation({
        status: 403,
        message: 'No verified purchase was found for this leaderboard yet. Please try again shortly.',
      })
    ).toBe(true);

    expect(
      shouldRetryBrandedLeaderboardActivation({
        status: 402,
        message: 'A fresh purchase is required for this leaderboard.',
      })
    ).toBe(false);
  });
});

describe('retryBrandedLeaderboardActivation', () => {
  it('succeeds after a delayed verification retry', async () => {
    const runAttempt = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce({
        status: 403,
        message: 'No verified purchase was found for this leaderboard yet. Please try again shortly.',
      })
      .mockResolvedValueOnce('ok');

    await expect(
      retryBrandedLeaderboardActivation({
        runAttempt,
        delaysMs: [0, 0],
      })
    ).resolves.toBe('ok');

    expect(runAttempt).toHaveBeenCalledTimes(2);
  });

  it('does not retry a product mismatch error', async () => {
    const runAttempt = vi.fn<() => Promise<string>>().mockRejectedValue({
      status: 402,
      message: 'A fresh purchase is required for this leaderboard.',
    });

    await expect(
      retryBrandedLeaderboardActivation({
        runAttempt,
        delaysMs: [0, 0, 0],
      })
    ).rejects.toMatchObject({
      status: 402,
    });

    expect(runAttempt).toHaveBeenCalledTimes(1);
  });
});
