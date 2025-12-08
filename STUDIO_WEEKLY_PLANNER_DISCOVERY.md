# Studio Weekly Planner - Discovery

## Existing Pieces Summary

### 1. Metrics Storage & Query Helpers

**Table**: `studio_social_post_metrics`
- Structure: Time-series table with `social_post_id`, `captured_at`, and metrics (impressions, views, likes, comments, shares, saves)
- Unique constraint: `(social_post_id, captured_at)` - allows multiple snapshots
- Indexes: On `social_post_id` and `captured_at`

**How to Fetch Last 30-90 Days of Posts + Metrics**:

```typescript
// From app/api/studio/social/summary/route.ts pattern:
const thresholdDate = new Date();
thresholdDate.setDate(thresholdDate.getDate() - 90); // 90 days

const { data: posts } = await supabase
  .from("studio_social_posts")
  .select(`
    id,
    platform,
    caption,
    posted_at,
    metadata,
    studio_social_post_metrics (
      impressions,
      views,
      likes,
      comments,
      shares,
      saves,
      captured_at
    )
  `)
  .eq("workspace_id", workspaceId)
  .gte("posted_at", thresholdDate.toISOString())
  .order("posted_at", { ascending: false });

// Get latest metrics per post (order by captured_at DESC, limit 1)
```

**Existing Helpers**:
- `app/api/studio/social/summary/route.ts` - Aggregates posts into summary format
- `app/api/studio/analytics/posts/route.ts` - Gets posts with latest metrics
- Both use workspace-scoped queries

### 2. Brand Profile Service

**File**: `lib/studio/brand-profile-service.ts`

**How to Fetch Brand Profile**:

```typescript
import { getBrandProfile, formatBrandProfileForPrompt } from "@/lib/studio/brand-profile-service";

const brandProfile = await getBrandProfile(workspaceId, supabase);
const brandProfileText = formatBrandProfileForPrompt(brandProfile);
```

**Returns**:
- `BrandProfile` object with:
  - `brand_description`, `target_audience`
  - `voice_tone` (style, formality, personality traits, etc.)
  - `brand_attributes` (keywords, colors, values, mission, tagline)
- `formatBrandProfileForPrompt()` returns formatted string for LLM prompts

### 3. Studio Agent / Prompt Construction

**File**: `app/api/studio/ask/route.ts`

**Pattern**:
- Fetches brand profile and formats it
- Fetches social media summary (last 90 days)
- Constructs system prompt with brand profile and performance data
- Uses `openai.chat.completions.create()` with `response_format: { type: "json_object" }`
- Model: `AGENT_CONFIG.studio.primaryModel` (gpt-4o)

**Prompt Structure**:
```
System: You are the Studio Agent...
- Brand Profile: [formatted brand profile]
- Social Media Performance: [summary data]

User: [question/request]
```

## Summary

- **Metrics**: Query `studio_social_posts` with joined `studio_social_post_metrics`, filter by `posted_at >= thresholdDate`, get latest metrics per post
- **Brand Profile**: Use `getBrandProfile()` and `formatBrandProfileForPrompt()` from `lib/studio/brand-profile-service.ts`
- **LLM Pattern**: Use OpenAI with JSON response format, include brand profile and metrics summary in prompt

