# Studio Repurposing Engine Implementation Summary

## Overview

Implemented a repurposing engine that generates platform-specific content variants from a source post. The system uses LLM to adapt content for different platforms while preserving the core message and brand voice.

## What Changed

### 1. Data Model Linkage

**Migration**: `supabase/migrations/20250125000000_studio_repurposing_schema.sql`

Added two fields to `studio_social_posts`:

- **`repurposed_from_post_id`**: UUID reference to the source post (for tracking ancestry)
  - Foreign key to `studio_social_posts(id)` with `ON DELETE SET NULL`
  - Allows tracking which post was repurposed from which

- **`content_group_id`**: UUID to group related posts (source + all repurposed variants)
  - Enables finding all posts in a content group
  - Automatically set via trigger when `repurposed_from_post_id` is set

**Indexes**:
- `idx_studio_social_posts_repurposed_from` - For finding repurposed posts from a source
- `idx_studio_social_posts_content_group` - For finding all posts in a content group

**Trigger**:
- `trigger_set_content_group_id_on_repurpose` - Automatically sets `content_group_id` when repurposing, inheriting from source post or using source post ID

### 2. Repurposing Service

**File**: `lib/studio/repurposing-service.ts`

Created `generateRepurposedPack()` function that:

1. **Fetches source post**:
   - Gets post details (caption, platform, metadata)
   - Fetches latest metrics if available

2. **Calculates performance indicators**:
   - Computes engagement rate: `(likes + comments + shares + saves) / impressions` (or views for TikTok)
   - Flags high-performing posts (engagement rate > 3%)

3. **Fetches brand profile**:
   - Gets workspace brand profile
   - Formats for prompt inclusion

4. **LLM prompt construction**:
   - System prompt: Defines role as repurposing specialist
   - User prompt includes:
     - Source post caption and platform
     - Performance metrics (if available)
     - High-performing indicator (if applicable)
     - Brand profile (if configured)
     - Platform-specific guidelines

5. **LLM call**:
   - Uses `gpt-4o` model
   - `response_format: { type: "json_object" }`
   - Temperature: 0.7 (balanced creativity and consistency)

6. **Response parsing**:
   - Validates JSON structure
   - Returns `RepurposedPack` with platform-specific content

**Output Schema** (`PlatformContent`):
```typescript
{
  caption?: string;        // For Instagram, Facebook, LinkedIn
  script?: string;         // For TikTok (video script)
  hook: string;            // Opening line/hook
  cta: string;             // Call-to-action
  hashtags?: string[];     // Hashtag suggestions
  suggested_media_type?: "image" | "video" | "carousel" | "reel" | "story";
  notes?: string;          // Platform-specific notes
}
```

**Platform Guidelines**:
- **Instagram**: Visual-first, caption up to 2,200 chars, 5-10 hashtags, engaging hooks
- **TikTok**: Video-first, short captions (100-150 chars), trending hooks, clear CTA
- **Facebook**: Conversational, longer captions (up to 5,000 chars), community-focused
- **X (Twitter)**: Concise (280 chars), punchy hooks, thread-friendly
- **LinkedIn**: Professional, value-focused, longer form (up to 3,000 chars), industry insights

### 3. API Endpoint

**File**: `app/api/studio/repurpose/route.ts`

Created `POST /api/studio/repurpose` endpoint that:

1. **Validates input**:
   - Requires `source_post_id`
   - Requires `target_platforms` array (non-empty)
   - Validates platforms are in allowed list
   - Filters out source platform (can't repurpose to same platform)

2. **Verifies source post**:
   - Checks post exists and belongs to workspace
   - Gets or creates `content_group_id`

3. **Generates repurposed content**:
   - Calls `generateRepurposedPack()` service
   - Handles errors gracefully

4. **Creates draft posts**:
   - For each target platform:
     - Finds connected social account
     - Creates `studio_social_posts` record with:
       - `status = 'draft'`
       - `repurposed_from_post_id = source_post_id`
       - `content_group_id` (inherited or created)
       - `caption` from repurposed content
       - `metadata` with hook, CTA, hashtags, notes
       - `scheduled_for` (optional, from request)
   - Collects errors for any failed creations

5. **Response**:
   - Returns created post IDs
   - Includes repurposed pack content
   - Includes any errors encountered

**Request Body**:
```json
{
  "source_post_id": "uuid",
  "target_platforms": ["instagram", "tiktok", "facebook"],
  "scheduled_for": "2024-01-15T10:00:00Z" // Optional
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "source_post_id": "uuid",
    "content_group_id": "uuid",
    "created_posts": [
      { "id": "uuid", "platform": "instagram", "caption": "..." },
      { "id": "uuid", "platform": "tiktok", "caption": "..." }
    ],
    "repurposed_pack": { ... },
    "errors": [] // If any
  }
}
```

**Additional Endpoint**: `app/api/studio/posts/[postId]/route.ts`

- **GET**: Fetches post with metrics and repurposed variants
- **PATCH**: Updates post (for rescheduling, status changes)

### 4. UI Integration

**File**: `components/studio/RepurposeModal.tsx`

Created modal component for repurposing:

- **Platform Selection**:
  - Checkboxes for available platforms (excludes source platform)
  - Visual icons for each platform
  - Disabled state during generation

- **Generation Flow**:
  - Shows loading state
  - Displays success message with created drafts
  - Shows errors if any
  - Auto-closes after 2 seconds on success

- **User Experience**:
  - Clean, accessible modal design
  - Clear instructions
  - Visual feedback

**File**: `app/studio/calendar/page.tsx` (modified)

Added repurpose action to calendar:

- **Repurpose Button**:
  - Appears on hover for each post
  - Uses `Repeat` icon
  - Opens repurpose modal

- **Integration**:
  - `handleRepurposePost()` - Opens modal with selected post
  - `handleRepurposeSuccess()` - Reloads calendar after successful repurposing
  - Modal state management

- **User Flow**:
  1. User hovers over a post in calendar
  2. Repurpose icon appears
  3. User clicks icon
  4. Modal opens with platform selection
  5. User selects target platforms
  6. System generates content and creates drafts
  7. Calendar reloads to show new drafts
  8. User can edit/schedule new drafts

## Files Created

1. `supabase/migrations/20250125000000_studio_repurposing_schema.sql` - Database migration
2. `lib/studio/repurposing-service.ts` - Repurposing service
3. `app/api/studio/repurpose/route.ts` - Repurpose API endpoint
4. `app/api/studio/posts/[postId]/route.ts` - Post detail/update endpoint
5. `components/studio/RepurposeModal.tsx` - Repurpose UI modal
6. `STUDIO_REPURPOSING_IMPLEMENTATION_SUMMARY.md` - This file

## Files Modified

1. `app/studio/calendar/page.tsx` - Added repurpose button and modal integration

## LLM Prompt Shape

### System Prompt
```
You are a social media content repurposing specialist. Your job is to adapt content from one platform to others while:
1. Preserving the core message and value
2. Optimizing for each platform's format and audience
3. Maintaining brand voice and tone
4. Adapting length and style to platform best practices
```

### User Prompt Structure
```
Repurpose this content for the following platforms: [platforms].

Source Post:
Platform: [platform]
Caption: [caption]

⚠️ HIGH-PERFORMING POST: This post has an engagement rate of [X]%.
Preserve the core message and key elements that made it successful.

Brand Profile:
[formatted brand profile]

Performance Metrics:
- Likes: [X]
- Comments: [X]
- Engagement Rate: [X]%

For each platform, generate:
- hook: Engaging opening line
- caption/script: Full platform-optimized content
- cta: Clear call-to-action
- hashtags: 5-10 relevant hashtags
- suggested_media_type: Best format
- notes: Platform-specific considerations
```

### Response Schema
```json
{
  "instagram": {
    "caption": "Full Instagram caption...",
    "hook": "Opening hook...",
    "cta": "Call to action...",
    "hashtags": ["#tag1", "#tag2"],
    "suggested_media_type": "image",
    "notes": "Instagram-specific notes"
  },
  "tiktok": {
    "script": "Video script for TikTok...",
    "hook": "Hook for first 3 seconds...",
    "cta": "CTA...",
    "hashtags": ["#trending", "#fyp"],
    "suggested_media_type": "video",
    "notes": "TikTok-specific notes"
  }
}
```

## Key Features

### 1. Ancestry Tracking
- `repurposed_from_post_id` links repurposed posts to source
- Enables tracking which posts were repurposed from which

### 2. Content Grouping
- `content_group_id` groups related posts (source + variants)
- Enables finding all posts in a content family
- Automatically managed via database trigger

### 3. Performance-Aware Repurposing
- If source post has metrics, includes in prompt
- Flags high-performing posts (>3% engagement)
- Instructs LLM to preserve successful elements

### 4. Brand Profile Integration
- Always includes brand profile in prompt (if configured)
- Ensures repurposed content maintains brand voice
- Falls back gracefully if no profile exists

### 5. Platform-Specific Optimization
- LLM adapts content for each platform's format
- Different caption lengths, styles, hashtags
- Platform-specific hooks and CTAs

## Error Handling

- **Missing source post**: Returns 404 with clear error
- **No connected accounts**: Returns 400 with guidance
- **LLM failures**: Catches parsing errors, returns helpful messages
- **Partial failures**: Creates posts for available platforms, reports errors
- **Invalid platforms**: Validates and filters invalid options

## Constraints Met

✅ **Brand profile always included**: Fetched and included in prompt if available  
✅ **High-performing post detection**: Calculates engagement rate, flags if >3%  
✅ **Draft creation**: All repurposed posts created with `status = 'draft'`  
✅ **No auto-scheduling**: `scheduled_for` only set if explicitly requested  
✅ **Ancestry tracking**: `repurposed_from_post_id` links to source  
✅ **Content grouping**: `content_group_id` groups related posts  

## UI Entry Points

1. **Calendar View** (`/studio/calendar`):
   - Hover over any post → Repurpose icon appears
   - Click icon → Modal opens
   - Select platforms → Generate drafts
   - New drafts appear in calendar

2. **Future Integration Points** (not yet implemented):
   - Post detail/editor view
   - Analytics page (repurpose from top-performing posts)
   - Post list view

## Follow-up Ideas

### Short-term Enhancements

1. **Post Detail View Integration**:
   - Add repurpose button to post detail/editor
   - Show repurposed variants in sidebar
   - Quick repurpose to single platform

2. **Batch Repurposing**:
   - Select multiple posts
   - Repurpose all to target platforms
   - Bulk draft creation

3. **Repurpose History**:
   - Show repurposing history for a post
   - Track which variants were created when
   - View performance comparison

### Medium-term Enhancements

1. **Smart Repurposing Suggestions**:
   - Suggest repurposing high-performing posts
   - Recommend best platforms based on content type
   - Auto-detect repurposing opportunities

2. **Content Variations**:
   - Generate multiple variations per platform
   - A/B test different hooks/CTAs
   - Let user choose preferred variant

3. **Media Adaptation**:
   - Suggest media format changes (image → video)
   - Generate video scripts from image posts
   - Recommend aspect ratio changes

### Long-term Vision

1. **Autonomous Repurposing**:
   - Auto-repurpose high-performing posts
   - Schedule repurposed variants automatically
   - Learn from user preferences

2. **Cross-Platform Optimization**:
   - Optimize content for each platform's algorithm
   - Adapt to platform-specific trends
   - Time-based repurposing (post at optimal times per platform)

3. **Content Library Integration**:
   - Repurpose from content library
   - Reuse successful content formats
   - Build repurposing templates

## Testing Recommendations

1. **Unit Tests**:
   - Test `generateRepurposedPack()` with various inputs
   - Test engagement rate calculation
   - Test content group ID inheritance

2. **Integration Tests**:
   - Test full repurposing flow
   - Test with/without brand profile
   - Test with high-performing vs. low-performing posts
   - Test error scenarios (missing accounts, invalid platforms)

3. **E2E Tests**:
   - Test UI modal flow
   - Test calendar integration
   - Test draft creation and display

## Performance Considerations

- LLM call is async and doesn't block UI
- Post creation is sequential (could be parallelized)
- Calendar reload after repurposing is efficient
- Database indexes support fast queries for repurposed posts

## Security Considerations

- Requires authentication
- Workspace-scoped (RLS enforced)
- Validates user owns workspace
- No sensitive data in prompts (only public post content)

## Next Steps

1. **Test the implementation**:
   - Test repurposing from various post types
   - Verify content quality
   - Check database relationships

2. **Monitor LLM responses**:
   - Track repurposing quality
   - Monitor for parsing errors
   - Collect user feedback

3. **Iterate on prompts**:
   - Refine based on generated content
   - Improve platform-specific adaptations
   - Better performance-aware repurposing

4. **Add more UI entry points**:
   - Post detail view
   - Analytics page
   - Post list view

