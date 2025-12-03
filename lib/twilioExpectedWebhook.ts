/**
 * Compute the expected Twilio Voice Webhook URL for inbound calls.
 *
 * Requires PUBLIC_BASE_URL to be set. This is kept in a small helper
 * so both the health check and any fixer endpoints can stay in sync.
 */
export function getExpectedTwilioWebhookUrl(): string {
  const base = process.env.PUBLIC_BASE_URL;
  if (!base) {
    throw new Error("PUBLIC_BASE_URL is not set");
  }
  return `${base.replace(/\/$/, "")}/api/twilio/inbound`;
}




