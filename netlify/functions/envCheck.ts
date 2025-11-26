import type { Handler } from '@netlify/functions'

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export const handler: Handler = async () => {
  const appId = process.env.ONESIGNAL_APP_ID
  const restKey = process.env.ONESIGNAL_REST_API_KEY

  // Never return the raw values; only booleans and lengths for diagnostics
  return json(200, {
    hasAppId: Boolean(appId),
    hasRestKey: Boolean(restKey),
    appIdLength: appId ? appId.length : 0,
    appId,
    restKeyLength: restKey ? restKey.length : 0,
    branch: process.env.BRANCH || process.env.COMMIT_REF || 'unknown',
    context: process.env.CONTEXT || 'unknown'
  })
}


