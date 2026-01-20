type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
};

export async function sendExpoPushNotification(
  expoPushTokens: string[],
  title: string,
  message: string,
  data: Record<string, any> = {}
): Promise<{ success: boolean; sentTo: number; invalidTokens: string[]; error?: string }> {
  if (!expoPushTokens || expoPushTokens.length === 0) {
    return { success: true, sentTo: 0, invalidTokens: [] };
  }

  // Expo recommends batching; keep it conservative.
  const CHUNK_SIZE = 90;
  const chunks: string[][] = [];
  for (let i = 0; i < expoPushTokens.length; i += CHUNK_SIZE) {
    chunks.push(expoPushTokens.slice(i, i + CHUNK_SIZE));
  }

  let sentTo = 0;
  const invalidTokens: string[] = [];

  try {
    for (const chunk of chunks) {
      const payload: ExpoPushMessage[] = chunk.map((to) => ({
        to,
        title,
        body: message,
        data,
      }));

      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        return { success: false, sentTo, invalidTokens, error: txt };
      }

      const json: any = await res.json();
      const ticketData: any[] = json?.data ?? [];
      sentTo += ticketData.filter((t) => t?.status === 'ok').length;

      ticketData.forEach((t, idx) => {
        if (t?.status !== 'error') return;
        const details = t?.details ?? {};
        const err = t?.message ?? '';
        const token = chunk[idx];
        if (details?.error === 'DeviceNotRegistered' || err.includes('DeviceNotRegistered')) {
          invalidTokens.push(token);
        }
      });
    }

    return { success: true, sentTo, invalidTokens };
  } catch (e: any) {
    return { success: false, sentTo, invalidTokens, error: e?.message ?? String(e) };
  }
}

