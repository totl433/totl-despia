export const BRANDED_LEADERBOARD_ACTIVATION_RETRY_DELAYS_MS = [0, 1000, 2000, 4000];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function shouldRetryBrandedLeaderboardActivation(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const status = 'status' in error ? (error as { status?: unknown }).status : null;
  const message = 'message' in error ? (error as { message?: unknown }).message : null;
  return status === 403 && typeof message === 'string' && message.includes('No verified purchase was found');
}

export async function retryBrandedLeaderboardActivation<T>(input: {
  runAttempt: () => Promise<T>;
  delaysMs?: number[];
  onRetryableError?: (error: unknown, meta: { attempt: number; delayMs: number; finalAttempt: boolean }) => void;
}) {
  const delaysMs = input.delaysMs ?? BRANDED_LEADERBOARD_ACTIVATION_RETRY_DELAYS_MS;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < delaysMs.length; attempt += 1) {
    const delayMs = delaysMs[attempt];
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    try {
      return await input.runAttempt();
    } catch (error) {
      lastError = error;
      const finalAttempt = attempt === delaysMs.length - 1;
      input.onRetryableError?.(error, { attempt: attempt + 1, delayMs, finalAttempt });
      if (!shouldRetryBrandedLeaderboardActivation(error) || finalAttempt) {
        break;
      }
    }
  }

  throw lastError;
}
