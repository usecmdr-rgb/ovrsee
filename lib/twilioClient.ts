/**
 * Twilio Client Helper with Mock Mode Support
 *
 * This module prefers using Twilio API Keys (recommended for server-side usage):
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_API_KEY
 * - TWILIO_API_SECRET
 *
 * If API credentials are missing, it falls back to mock mode, simulating Twilio
 * API responses so the rest of the app can continue to function.
 */

import twilio, { Twilio } from "twilio";
import { env } from "@/lib/config/env";

export const isTwilioConfigured =
  !!env.TWILIO_ACCOUNT_SID && !!env.TWILIO_API_KEY && !!env.TWILIO_API_SECRET;

export const twilioClient: Twilio | null = isTwilioConfigured
  ? twilio(env.TWILIO_API_KEY, env.TWILIO_API_SECRET, {
      accountSid: env.TWILIO_ACCOUNT_SID,
    })
  : null;

export interface AvailablePhoneNumber {
  phoneNumber: string;
  friendlyName?: string;
}

/**
 * Search for available phone numbers
 * In mock mode: generates fake numbers
 * In real mode: queries Twilio API
 */
export async function searchAvailableNumbers(
  country: string = "US",
  areaCode?: string
): Promise<AvailablePhoneNumber[]> {
  if (!isTwilioConfigured || !twilioClient) {
    // Mock mode: generate fake numbers
    const numbers: AvailablePhoneNumber[] = [];
    const count = Math.floor(Math.random() * 6) + 5; // 5-10 numbers
    
    for (let i = 0; i < count; i++) {
      let phoneNumber: string;
      
      if (areaCode) {
        // Generate number with specific area code
        const last7 = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
        phoneNumber = `+1${areaCode}${last7}`;
      } else {
        // Generate random US number
        const area = Math.floor(Math.random() * 900) + 200; // 200-999
        const exchange = Math.floor(Math.random() * 900) + 200; // 200-999
        const number = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        phoneNumber = `+1${area}${exchange}${number}`;
      }
      
      numbers.push({
        phoneNumber,
        friendlyName: `Mock Number ${i + 1}`,
      });
    }
    
    return numbers;
  }

  try {
    const availableNumbers = await twilioClient.availablePhoneNumbers(country)
      .local
      .list({
        areaCode: areaCode ? parseInt(areaCode, 10) : undefined,
        voiceEnabled: true,
        limit: 10,
      });

    return availableNumbers.map(num => ({
      phoneNumber: num.phoneNumber,
      friendlyName: num.friendlyName,
    }));
  } catch (error) {
    console.error('Error searching Twilio numbers:', error);
    throw error;
  }
}

/**
 * Purchase a phone number from Twilio
 * In mock mode: returns a simulated SID
 * In real mode: purchases via Twilio API
 */
export async function purchasePhoneNumber(
  phoneNumber: string,
  voiceUrl: string,
  statusCallbackUrl?: string
): Promise<{ sid: string; phoneNumber: string }> {
  if (!isTwilioConfigured || !twilioClient) {
    // Mock mode: generate fake SID
    const mockSid = `SIMULATED_SID_${Math.random().toString(36).substring(2, 15)}`;
    return {
      sid: mockSid,
      phoneNumber,
    };
  }

  try {
    const phone = await twilioClient.incomingPhoneNumbers.create({
      phoneNumber,
      voiceUrl,
      statusCallback: statusCallbackUrl,
      statusCallbackMethod: 'POST',
    });

    return {
      sid: phone.sid,
      phoneNumber: phone.phoneNumber,
    };
  } catch (error) {
    console.error('Error purchasing Twilio number:', error);
    throw error;
  }
}

/**
 * Update webhook URLs for an existing Twilio phone number
 */
export async function updatePhoneNumberWebhooks(
  phoneNumberSid: string,
  voiceUrl: string,
  statusCallbackUrl?: string
): Promise<void> {
  if (!isTwilioConfigured || !twilioClient) {
    throw new Error('Twilio client not configured');
  }

  try {
    await twilioClient.incomingPhoneNumbers(phoneNumberSid).update({
      voiceUrl,
      statusCallback: statusCallbackUrl,
      statusCallbackMethod: 'POST',
    });
  } catch (error) {
    console.error('Error updating phone number webhooks:', error);
    throw error;
  }
}

/**
 * Release a phone number (delete from Twilio)
 * In mock mode: just returns success
 * In real mode: deletes via Twilio API
 */
export async function releasePhoneNumber(twilioPhoneSid: string): Promise<void> {
  if (!isTwilioConfigured || !twilioClient) {
    // Mock mode: no-op
    return;
  }

  try {
    await twilioClient.incomingPhoneNumbers(twilioPhoneSid).remove();
  } catch (error) {
    console.error('Error releasing Twilio number:', error);
    throw error;
  }
}

/**
 * Make an outbound call via Twilio
 * In mock mode: returns a simulated call SID
 * In real mode: creates call via Twilio API
 */
export async function makeOutboundCall(
  from: string,
  to: string,
  url: string
): Promise<{ callSid: string }> {
  if (!isTwilioConfigured || !twilioClient) {
    // Mock mode: generate fake call SID
    const mockCallSid = `SIMULATED_CALL_${Math.random().toString(36).substring(2, 15)}`;
    return { callSid: mockCallSid };
  }

  try {
    const call = await twilioClient.calls.create({
      to,
      from,
      url,
    });

    return { callSid: call.sid };
  } catch (error) {
    console.error('Error making Twilio call:', error);
    throw error;
  }
}
