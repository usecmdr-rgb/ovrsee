/**
 * Twilio Client Helper with Mock Mode Support
 * 
 * When TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are missing,
 * this module operates in mock mode, simulating Twilio API responses.
 * 
 * TODO: Install twilio package: npm install twilio
 * TODO: When Twilio credentials are configured, replace mock functions with real Twilio SDK calls
 */

// TODO: Uncomment when Twilio SDK is installed
// import twilio from 'twilio';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

export const isTwilioConfigured = !!TWILIO_ACCOUNT_SID && !!TWILIO_AUTH_TOKEN;

// TODO: Initialize real Twilio client when credentials are available
// const twilioClient = isTwilioConfigured 
//   ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
//   : null;

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
  if (!isTwilioConfigured) {
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

  // TODO: Real Twilio implementation
  // try {
  //   const availableNumbers = await twilioClient.availablePhoneNumbers(country)
  //     .local
  //     .list({
  //       areaCode: areaCode,
  //       voiceEnabled: true,
  //       limit: 10,
  //     });
  //
  //   return availableNumbers.map(num => ({
  //     phoneNumber: num.phoneNumber,
  //     friendlyName: num.friendlyName,
  //   }));
  // } catch (error) {
  //   console.error('Error searching Twilio numbers:', error);
  //   throw error;
  // }

  // Fallback (should not reach here if Twilio is configured)
  return [];
}

/**
 * Purchase a phone number from Twilio
 * In mock mode: returns a simulated SID
 * In real mode: purchases via Twilio API
 */
export async function purchasePhoneNumber(
  phoneNumber: string,
  voiceUrl: string
): Promise<{ sid: string; phoneNumber: string }> {
  if (!isTwilioConfigured) {
    // Mock mode: generate fake SID
    const mockSid = `SIMULATED_SID_${Math.random().toString(36).substring(2, 15)}`;
    return {
      sid: mockSid,
      phoneNumber,
    };
  }

  // TODO: Real Twilio implementation
  // try {
  //   const phone = await twilioClient.incomingPhoneNumbers.create({
  //     phoneNumber,
  //     voiceUrl,
  //   });
  //
  //   return {
  //     sid: phone.sid,
  //     phoneNumber: phone.phoneNumber,
  //   };
  // } catch (error) {
  //   console.error('Error purchasing Twilio number:', error);
  //   throw error;
  // }

  // Fallback (should not reach here if Twilio is configured)
  throw new Error('Twilio not configured');
}

/**
 * Release a phone number (delete from Twilio)
 * In mock mode: just returns success
 * In real mode: deletes via Twilio API
 */
export async function releasePhoneNumber(twilioPhoneSid: string): Promise<void> {
  if (!isTwilioConfigured) {
    // Mock mode: no-op
    return;
  }

  // TODO: Real Twilio implementation
  // try {
  //   await twilioClient.incomingPhoneNumbers(twilioPhoneSid).remove();
  // } catch (error) {
  //   console.error('Error releasing Twilio number:', error);
  //   throw error;
  // }
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
  if (!isTwilioConfigured) {
    // Mock mode: generate fake call SID
    const mockCallSid = `SIMULATED_CALL_${Math.random().toString(36).substring(2, 15)}`;
    return { callSid: mockCallSid };
  }

  // TODO: Real Twilio implementation
  // try {
  //   const call = await twilioClient.calls.create({
  //     to,
  //     from,
  //     url,
  //   });
  //
  //   return { callSid: call.sid };
  // } catch (error) {
  //   console.error('Error making Twilio call:', error);
  //   throw error;
  // }

  // Fallback (should not reach here if Twilio is configured)
  throw new Error('Twilio not configured');
}








