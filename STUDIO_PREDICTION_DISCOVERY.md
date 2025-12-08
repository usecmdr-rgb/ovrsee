# Studio Performance Prediction & Draft Scoring - Discovery

## Overview

This document outlines the approach for scoring draft posts with expected performance predictions (`low`, `medium`, `high`) and providing explanatory text.

## Available Data Sources

### 1. Post Data (`studio_social_posts`)
- `platform` (instagram, tiktok, facebook)
- `caption` (text content)
- `scheduled_for` (timestamp)
- `status` (draft, scheduled, etc.)
- `repurposed_from_post_id` (if repurposed from high-performing content)
- `content_group_id` (related posts)
- `metadata` (media_type, hashtags, etc.)

### 2. Historical Metrics (`studio_social_post_metrics`)
- Time-series metrics per post:
  - `impressions`, `views`, `likes`, `comments`, `shares`, `saves`
  - `captured_at` (allows tracking performance over time)
- Can compute:
  - Engagement rate: `(likes + comments + shares + saves) / (impressions or views)`
  - Best performing posts by platform
  - Best posting times (day-of-week, hour ranges)

### 3. Hashtag Intelligence (`studio_hashtags`, `studio_post_hashtags`)
- Top-performing hashtags per workspace
- Hashtag usage frequency
- Average engagement rates per hashtag

### 4. Brand Profile (`brand_profiles`)
- `target_audience`
- `voice_tone` (JSONB)
- `brand_attributes` (JSONB)

## Feature Extraction

### Derivable Features for Scoring

1. **Platform Alignment**
   - Platform type (instagram/tiktok/facebook)
   - Historical performance by platform

2. **Content Characteristics**
   - Caption length (character count)
   - Hashtag count (from parsed hashtags)
   - Media type (image/video/carousel) - from metadata
   - Presence of emojis (count)

3. **Timing Alignment**
   - Scheduled time vs. historically best times
   - Day of week vs. best day-of-week
   - Hour vs. best time window
   - Score: higher if aligned with best times

4. **Hashtag Performance**
   - Number of top-performing hashtags used
   - Average engagement rate of used hashtags
   - Mix of proven vs. exploratory hashtags

5. **Content Lineage**
   - If `repurposed_from_post_id` exists:
     - Check source post's engagement rate
     - If source was high-performing (>3% engagement), boost score
   - If part of `content_group_id` with other high performers

6. **Brand Alignment** (heuristic)
   - Caption length vs. typical successful length for platform
   - Hashtag count vs. optimal range (e.g., Instagram: 5-10, TikTok: 3-5)

## Scoring Heuristic (v1)

### Score Calculation

Start with base score of 0.5 (medium), then adjust:

**Positive Factors (+0.1 to +0.2 each):**
- Scheduled at historically best time window: +0.15
- Uses 3+ top-performing hashtags: +0.1
- Repurposed from high-performing post (>3% engagement): +0.2
- Caption length in optimal range for platform: +0.1
- Hashtag count in optimal range: +0.1

**Negative Factors (-0.1 to -0.2 each):**
- Scheduled at historically worst time: -0.15
- No top-performing hashtags used: -0.1
- Caption too short (<50 chars) or too long (>500 chars): -0.1
- Too many hashtags (>15) or too few (<3): -0.1

**Final Score Mapping:**
- `score_numeric < 0.4` → `low`
- `score_numeric >= 0.4 && < 0.7` → `medium`
- `score_numeric >= 0.7` → `high`

## LLM Explanation

### Context for LLM
- Brand profile (target audience, voice)
- Draft features (extracted above)
- Score and reasoning features
- Historical context (best times, top hashtags)

### Prompt Structure
```
You are a social media performance analyst. Explain why this draft post is predicted to perform at a [low/medium/high] level.

Draft Post:
- Platform: {platform}
- Caption: {caption}
- Scheduled: {scheduled_for}
- Hashtags: {hashtags}

Performance Factors:
- Timing: {timing_alignment}
- Hashtags: {hashtag_performance}
- Content: {content_characteristics}
- Lineage: {if_repurposed}

Brand Context:
{brand_profile}

Provide a brief (2-3 sentences) explanation that's actionable and specific.
```

## Integration Points

1. **Weekly Planner**
   - After creating draft posts, score each one
   - Store scores in `predicted_score_*` fields
   - Planner can highlight high-scoring drafts

2. **Agent Tools**
   - After `createDraftPost`, optionally compute score
   - After `generateWeeklyPlan`, score all created drafts
   - Agent can mention: "I've created 7 drafts, 3 are predicted to perform well"

3. **Repurposing Engine**
   - Score repurposed variants
   - If source was high-performing, boost score

4. **Calendar/Editor UI**
   - Show score badge (color-coded dot or pill)
   - Tooltip or expandable section with explanation
   - Optional: "Improve Score" suggestions

## Database Schema Changes

Add to `studio_social_posts`:
- `predicted_score_label` TEXT (low, medium, high)
- `predicted_score_numeric` FLOAT (0.0 to 1.0)
- `predicted_score_explanation` TEXT
- `predicted_score_updated_at` TIMESTAMPTZ

Index on `predicted_score_label` for filtering.

## Performance Considerations

- Scoring should be fast (<500ms per post)
- Cache historical best times/hashtags per workspace
- LLM explanation can be lazy-loaded (on-demand)
- Batch scoring for planner (score multiple posts in one call)

## Future Enhancements

- Machine learning model (replace heuristic)
- Multi-factor scoring (engagement, reach, saves)
- Confidence intervals
- A/B test integration (score variants)
- Real-time score updates as metrics change

