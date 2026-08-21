/**
 * Compatibility endpoint for any stale database hook or external caller.
 *
 * All score events are processed by the dual-stack V2 implementation. Keeping
 * this thin alias avoids silently dropping notifications while the old
 * endpoint name ages out.
 */
export { handler } from './sendScoreNotificationsWebhookV2';
