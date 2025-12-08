/**
 * TikTok API helpers
 * Handles fetching videos and metrics from TikTok Business accounts
 */

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

export interface TikTokVideo {
  video_id: string;
  title?: string;
  cover_image_url?: string;
  video_url?: string;
  create_time: number;
  duration: number;
  share_url?: string;
}

export interface TikTokMetrics {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  play_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  completion_rate?: number;
}

export interface TikTokConnection {
  user_id: string;
  provider: "tiktok";
  provider_user_id: string;
  access_token: string;
  expires_at: string | null;
  metadata: {
    username?: string;
    display_name?: string;
    [key: string]: any;
  };
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
 * Fetch recent videos from TikTok account
 * Note: TikTok API endpoints may vary based on your API product/plan
 */
export async function fetchTikTokVideos(
  accessToken: string,
  openId: string,
  limit: number = 20
): Promise<TikTokVideo[]> {
  // TikTok Research API endpoint for video list
  const url = `${TIKTOK_API_BASE}/research/video/list/`;
  const params = {
    query: {
      fields: [
        "id",
        "title",
        "cover_image_url",
        "create_time",
        "duration",
        "share_url",
        "video_description",
      ],
      max_count: limit,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      throw new Error("TOKEN_EXPIRED");
    }
    throw new Error(`TikTok API error: ${errorText}`);
  }

  const data = await response.json();
  // TikTok API response structure may vary
  return data.data?.videos || data.data?.list || [];
}

/**
 * Fetch metrics for TikTok videos
 * Note: TikTok metrics endpoints may require different API products
 */
export async function fetchVideoMetrics(
  accessToken: string,
  videoIds: string[]
): Promise<Record<string, TikTokMetrics>> {
  if (videoIds.length === 0) return {};

  // TikTok Research API endpoint for video metrics
  const url = `${TIKTOK_API_BASE}/research/video/query/`;
  const params = {
    query: {
      and: [
        {
          operation: "IN",
          field_name: "video_id",
          field_values: videoIds,
        },
      ],
    },
    fields: [
      "view_count",
      "like_count",
      "comment_count",
      "share_count",
      "play_count",
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      throw new Error("TOKEN_EXPIRED");
    }
    // If metrics endpoint fails, return empty metrics
    console.warn("TikTok metrics fetch failed:", errorText);
    return {};
  }

  const data = await response.json();
  const metricsMap: Record<string, TikTokMetrics> = {};

  // Parse TikTok metrics response
  if (data.data?.videos && Array.isArray(data.data.videos)) {
    for (const video of data.data.videos) {
      metricsMap[video.video_id] = {
        views: video.view_count || video.play_count,
        likes: video.like_count,
        comments: video.comment_count,
        shares: video.share_count,
        play_count: video.play_count,
        like_count: video.like_count,
        comment_count: video.comment_count,
        share_count: video.share_count,
      };
    }
  }

  return metricsMap;
}

/**
 * Fetch all videos with metrics for a TikTok account
 * Falls back to basic video list if metrics endpoint is unavailable
 */
export async function fetchTikTokVideosWithMetrics(
  accessToken: string,
  openId: string,
  limit: number = 20
): Promise<Array<TikTokVideo & { metrics: TikTokMetrics }>> {
  const videos = await fetchTikTokVideos(accessToken, openId, limit);

  // Try to fetch metrics for all videos
  const videoIds = videos.map((v) => v.video_id);
  let metricsMap: Record<string, TikTokMetrics> = {};

  try {
    metricsMap = await fetchVideoMetrics(accessToken, videoIds);
  } catch (error: any) {
    // If metrics fetch fails, continue with empty metrics
    if (error.message !== "TOKEN_EXPIRED") {
      console.warn("TikTok metrics fetch failed, continuing without metrics");
    } else {
      throw error;
    }
  }

  return videos.map((video) => ({
    ...video,
    metrics: metricsMap[video.video_id] || {},
  }));
}


