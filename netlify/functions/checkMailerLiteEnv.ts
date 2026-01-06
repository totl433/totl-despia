/**
 * Diagnostic function to check if MAILERLITE_API_KEY is accessible
 * Useful for debugging env var propagation issues
 * 
 * Usage: GET /.netlify/functions/checkMailerLiteEnv
 */

import type { Handler } from '@netlify/functions';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async () => {
  const apiKey = process.env.MAILERLITE_API_KEY;
  const allEnvKeys = Object.keys(process.env);
  const mailerKeys = allEnvKeys.filter(k => 
    k.includes('MAILER') || 
    k.includes('MAIL') || 
    k.includes('EMAIL')
  );

  return json(200, {
    hasApiKey: Boolean(apiKey),
    apiKeyLength: apiKey ? apiKey.length : 0,
    apiKeyFirstChars: apiKey ? apiKey.substring(0, 20) : null,
    apiKeyLastChars: apiKey ? apiKey.substring(apiKey.length - 20) : null,
    context: process.env.CONTEXT || 'unknown',
    branch: process.env.BRANCH || process.env.COMMIT_REF || 'unknown',
    deployUrl: process.env.DEPLOY_URL || 'unknown',
    siteUrl: process.env.URL || 'unknown',
    allEnvKeysCount: allEnvKeys.length,
    mailerRelatedKeys: mailerKeys,
    // Check if other known env vars are accessible (for comparison)
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
    hasOneSignalAppId: Boolean(process.env.ONESIGNAL_APP_ID),
    timestamp: new Date().toISOString(),
  });
};







