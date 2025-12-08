/**
 * Weekly Plan Types
 * 
 * TypeScript types for weekly content plan generation
 */

export type SocialPlatform = "instagram" | "tiktok" | "facebook";

export interface ProposedPost {
  platforms: SocialPlatform[];
  suggested_datetime: string; // ISO timestamp
  idea_title: string;
  content_brief: string;
  caption?: string; // Optional starting caption/hook
  suggested_media_type?: "image" | "video" | "carousel";
  hashtags?: string[]; // Optional hashtag suggestions
}

export interface WeeklyPlan {
  week_start: string; // ISO date (start of week, e.g., Monday)
  week_end: string; // ISO date (end of week, e.g., Sunday)
  proposed_posts: ProposedPost[];
  plan_rationale?: string; // Optional explanation of the plan
  total_posts: number;
  posts_by_platform: Record<SocialPlatform, number>;
}

/**
 * User preferences for plan generation
 */
export interface PlanPreferences {
  desired_cadence?: {
    instagram?: number; // Posts per week
    tiktok?: number;
    facebook?: number;
  };
  preferred_days?: string[]; // ["Monday", "Tuesday", etc.]
  preferred_times?: string[]; // ["9-12", "12-15", etc.]
  content_themes?: string[]; // Optional themes to focus on
  avoid_topics?: string[]; // Topics to avoid
}

