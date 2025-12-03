import twilio, { Twilio } from "twilio";

/**
 * Twilio client factory.
 *
 * Preferred authentication (more secure):
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_API_KEY
 * - TWILIO_API_SECRET
 *
 * Fallback (if API keys are not configured yet):
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 */

let _twilioClient: Twilio | undefined;

function createTwilioClient(): Twilio {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  // Validate Account SID format
  if (accountSid && !accountSid.startsWith("AC")) {
    throw new Error(
      `TWILIO_ACCOUNT_SID must start with "AC" (Account SID), but got "${accountSid.substring(0, 5)}...". ` +
      `If you're using an API Key (starts with "SK"), set it as TWILIO_API_KEY instead. ` +
      `Get your Account SID from: https://console.twilio.com/us1/develop/runtime/api-keys`
    );
  }

  // Validate API Key format if provided
  if (apiKey && !apiKey.startsWith("SK")) {
    console.warn(
      `TWILIO_API_KEY should start with "SK" (API Key SID), but got "${apiKey.substring(0, 5)}...". ` +
      `This might cause authentication issues.`
    );
  }

  // Validate API Secret format (should not contain @ or special chars that might be typos)
  if (apiSecret && (apiSecret.includes("@") || apiSecret.length < 20)) {
    console.warn(
      `TWILIO_API_SECRET format looks suspicious. API secrets are typically 32+ characters without @ symbols.`
    );
  }

  if (accountSid && apiKey && apiSecret) {
    // API key + secret auth (recommended)
    try {
      return twilio(apiKey, apiSecret, { accountSid });
    } catch (error: any) {
      console.error("[Twilio Client] Failed to create client with API Key auth:", error.message);
      throw new Error(
        `Twilio authentication failed with API Key. Please verify: ` +
        `1. TWILIO_ACCOUNT_SID matches the account that owns the API Key ` +
        `2. TWILIO_API_KEY and TWILIO_API_SECRET are from the same API Key pair ` +
        `3. The API Key hasn't been deleted or revoked. ` +
        `Error: ${error.message}`
      );
    }
  }

  if (accountSid && authToken) {
    // Fallback to Account SID + Auth Token
    try {
      return twilio(accountSid, authToken);
    } catch (error: any) {
      console.error("[Twilio Client] Failed to create client with Auth Token:", error.message);
      throw new Error(
        `Twilio authentication failed with Auth Token. Please verify: ` +
        `1. TWILIO_ACCOUNT_SID is correct ` +
        `2. TWILIO_AUTH_TOKEN matches the account ` +
        `3. The Auth Token hasn't been regenerated. ` +
        `Error: ${error.message}`
      );
    }
  }

  throw new Error(
    "Twilio is not configured. Set either (TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET) or (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)."
  );
}

export function getTwilioClient(): Twilio {
  if (!_twilioClient) {
    _twilioClient = createTwilioClient();
  }
  return _twilioClient;
}

/**
 * Reset the cached Twilio client.
 * Call this if you've updated environment variables and need to recreate the client.
 */
export function resetTwilioClient(): void {
  _twilioClient = undefined;
}


