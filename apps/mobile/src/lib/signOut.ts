import { deactivatePushSubscription } from './push';
import { supabase } from './supabase';

/**
 * Signs out the current user and deactivates active push subscriptions first
 * to prevent ghost notifications after logout.
 */
export async function signOutWithPushCleanup(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  await deactivatePushSubscription(data.session ?? null).catch(() => {});
  await supabase.auth.signOut();
}
