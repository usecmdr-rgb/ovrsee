/**
 * Platform client configuration
 * Centralized environment variable access and validation
 */

export interface PlatformClientConfig {
  facebook: {
    appId: string;
    appSecret: string;
    baseUrl: string;
    apiVersion: string;
  };
  instagram: {
    baseUrl: string;
    apiVersion: string;
  };
  tiktok: {
    clientKey: string;
    clientSecret: string;
    baseUrl: string;
    apiVersion: string;
  };
}

/**
 * Get platform client configuration from environment variables
 */
export function getPlatformConfig(): PlatformClientConfig {
  const facebookAppId = process.env.FACEBOOK_APP_ID;
  const facebookAppSecret = process.env.FACEBOOK_APP_SECRET;
  const tiktokClientKey = process.env.TIKTOK_CLIENT_KEY;
  const tiktokClientSecret = process.env.TIKTOK_CLIENT_SECRET;

  if (!facebookAppId || !facebookAppSecret) {
    throw new Error("Missing Facebook OAuth configuration (FACEBOOK_APP_ID, FACEBOOK_APP_SECRET)");
  }

  if (!tiktokClientKey || !tiktokClientSecret) {
    throw new Error("Missing TikTok OAuth configuration (TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET)");
  }

  return {
    facebook: {
      appId: facebookAppId,
      appSecret: facebookAppSecret,
      baseUrl: "https://graph.facebook.com",
      apiVersion: process.env.FACEBOOK_API_VERSION || "v19.0",
    },
    instagram: {
      baseUrl: "https://graph.facebook.com",
      apiVersion: process.env.FACEBOOK_API_VERSION || "v19.0", // Instagram uses Facebook Graph API
    },
    tiktok: {
      clientKey: tiktokClientKey,
      clientSecret: tiktokClientSecret,
      baseUrl: "https://open.tiktokapis.com",
      apiVersion: process.env.TIKTOK_API_VERSION || "v2",
    },
  };
}

