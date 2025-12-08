/**
 * Instagram Graph API helpers
 * Handles fetching media and insights from Instagram Business accounts
 */

const FB_GRAPH_BASE = "https://graph.facebook.com/v19.0";

export interface InstagramMediaItem {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  timestamp: string;
  permalink?: string;
}

export interface InstagramInsights {
  impressions?: number;
  reach?: number;
  engagement?: number;
  likes?: number;
  saves?: number;
  comments?: number;
  shares?: number;
}

export interface InstagramConnection {
  user_id: string;
  provider: "instagram" | "facebook";
  provider_user_id: string;
  access_token: string;
  expires_at: string | null;
  metadata: {
    ig_business_id?: string;
    name?: string;
    username?: string;
    [key: string]: any;
  };
}

/**
 * Get Instagram Business account ID from connection
 */
export function getInstagramBusinessId(
  connection: InstagramConnection
): string | null {
  if (connection.provider === "instagram") {
    return connection.provider_user_id;
  }
  // For Facebook connections, check metadata for IG business ID
  return connection.metadata?.ig_business_id ?? null;
}

/**
 * Check if access token is expired or invalid
 */
export function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt);
  const now = new Date();
  // Add 5 minute buffer
  return expiry.getTime() - now.getTime() < 5 * 60 * 1000;
}

/**
 * Fetch recent media from Instagram Business account
 */
export async function fetchInstagramMedia(
  accessToken: string,
  igBusinessId: string,
  limit: number = 25
): Promise<InstagramMediaItem[]> {
  const url = `${FB_GRAPH_BASE}/${igBusinessId}/media`;
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: "id,caption,media_type,media_url,timestamp,permalink",
    limit: limit.toString(),
  });

  const response = await fetch(`${url}?${params}`);

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      throw new Error("TOKEN_EXPIRED");
    }
    throw new Error(`Instagram API error: ${errorText}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Fetch insights for a specific media item
 */
export async function fetchMediaInsights(
  accessToken: string,
  mediaId: string
): Promise<InstagramInsights> {
  const url = `${FB_GRAPH_BASE}/${mediaId}/insights`;
  const params = new URLSearchParams({
    access_token: accessToken,
    metric: "impressions,reach,engagement,likes,saves,comments,shares",
  });

  const response = await fetch(`${url}?${params}`);

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      throw new Error("TOKEN_EXPIRED");
    }
    // Some media might not have insights available, return empty object
    if (response.status === 400) {
      return {};
    }
    throw new Error(`Instagram Insights API error: ${errorText}`);
  }

  const data = await response.json();
  const insights: InstagramInsights = {};

  // Parse the insights response
  if (data.data && Array.isArray(data.data)) {
    for (const metric of data.data) {
      const value = metric.values?.[0]?.value ?? 0;
      switch (metric.name) {
        case "impressions":
          insights.impressions = value;
          break;
        case "reach":
          insights.reach = value;
          break;
        case "engagement":
          insights.engagement = value;
          break;
        case "likes":
          insights.likes = value;
          break;
        case "saves":
          insights.saves = value;
          break;
        case "comments":
          insights.comments = value;
          break;
        case "shares":
          insights.shares = value;
          break;
      }
    }
  }

  return insights;
}

/**
 * Fetch all media with insights for an Instagram Business account
 */
export async function fetchInstagramMediaWithInsights(
  accessToken: string,
  igBusinessId: string,
  limit: number = 25
): Promise<Array<InstagramMediaItem & { insights: InstagramInsights }>> {
  const media = await fetchInstagramMedia(accessToken, igBusinessId, limit);

  // Fetch insights for each media item (with rate limiting consideration)
  const results: Array<InstagramMediaItem & { insights: InstagramInsights }> =
    [];

  for (const item of media) {
    try {
      const insights = await fetchMediaInsights(accessToken, item.id);
      results.push({ ...item, insights });
      // Small delay to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error: any) {
      // If insights fail, still include the media item with empty insights
      if (error.message === "TOKEN_EXPIRED") {
        throw error;
      }
      results.push({ ...item, insights: {} });
    }
  }

  return results;
}


