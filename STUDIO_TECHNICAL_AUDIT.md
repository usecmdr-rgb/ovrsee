# STUDIO Module: Technical & Product Audit

**Date:** January 2025  
**Auditor:** Lead AI Engineer  
**Scope:** Complete technical and product analysis of the STUDIO social media intelligence + content generation agent

---

## 1. High-Level Overview

### What Studio Currently Does

**Confirmed by code:** Studio is positioned as OVRSEE's social media intelligence and content generation agent. Based on the codebase analysis:

1. **Media Asset Management**
   - Users can upload images/videos to `studio_assets` table
   - Supports versioning via `studio_asset_versions`
   - Tracks edit events (`studio_edit_events`) for analytics
   - Frontend provides rich editing UI with filters, adjustments, text overlays, cropping

2. **Social Media Account Connections**
   - OAuth integrations exist for Instagram (via Facebook Graph API), TikTok, and Facebook
   - Connections stored in `social_connections` table (user-scoped)
   - Workspace-level account tracking in `studio_social_accounts` table
   - **Status:** OAuth flows implemented but connection status is partially simulated (see `/api/studio/social/connect/route.ts`)

3. **Post Analytics & Metrics**
   - Fetches posts from connected accounts via refresh endpoints (`/api/studio/social/instagram/refresh`, `/api/studio/social/tiktok/refresh`)
   - Stores posts in `social_media_posts` (user-scoped) and `studio_social_posts` (workspace-scoped)
   - Captures metrics in `studio_social_post_metrics` with time-series capability
   - Provides summary aggregation (`/api/studio/social/summary`)

4. **AI-Powered Intelligence**
   - Studio Agent Chat (`/api/studio/agent/chat`) - answers branding/content questions
   - Studio Ask (`/api/studio/ask`) - analyzes social performance and suggests content
   - Uses GPT-4o for vision-capable content analysis
   - Integrates with memory system (`getMemoryFacts`) for brand context

5. **Analytics Dashboard**
   - Posts list with metrics (`/api/studio/analytics/posts`)
   - Summary stats (`/api/studio/analytics/summary`)
   - Trends over time (`/api/studio/analytics/trends`)

### Role in OVRSEE System

Studio is one of four agents (Aloha, Sync, Studio, Insight) in the OVRSEE platform. It focuses on:
- **Content creation and editing** (media assets)
- **Social media intelligence** (analytics, insights)
- **Brand consistency** (tone, style, voice guidance)

### Core Flows (Current State)

**Confirmed by code:**
1. **Connect Accounts:** User initiates OAuth → tokens stored in `social_connections` → workspace account record created in `studio_social_accounts`
2. **Sync Posts:** Manual refresh via API → fetches posts from platforms → stores in `social_media_posts` and `studio_social_posts`
3. **Generate Content:** User uploads media → edits in frontend → saves to `studio_assets` → can ask Studio Agent for suggestions
4. **Analyze Performance:** Studio Ask endpoint analyzes `social_media_posts` summary → provides insights via LLM
5. **View Analytics:** Frontend fetches posts/metrics → displays in dashboard

**Inference:** There is **no automated scheduling or publishing flow** currently implemented. The `scheduled_for` field exists in `studio_social_posts` but no job/cron system publishes posts.

---

## 2. Current Architecture Audit

### 2.1 Database Schemas Related to Studio

**Confirmed by code:** Migration files:
- `20250116021000_studio_social_and_analytics.sql`
- `20250121000000_social_connections_and_posts.sql`

#### Tables:

1. **`studio_assets`** (workspace-scoped)
   - Stores uploaded media (images, videos, templates)
   - Fields: `asset_type`, `name`, `filename`, `mime_type`, `storage_path`, `url`, `preview_url`, `width`, `height`, `duration_seconds`, `metadata` (JSONB)
   - Indexes: workspace_id, created_by, asset_type, created_at
   - **Weakness:** No soft-delete, no tags/categories structure

2. **`studio_asset_versions`** (linked to assets)
   - Version history for edits
   - Fields: `version_number`, `is_current`, `edit_operations` (JSONB), `caption`
   - **Weakness:** No diff tracking, no rollback mechanism

3. **`studio_social_accounts`** (workspace-scoped)
   - Connected social accounts per workspace
   - Fields: `platform`, `status`, `external_account_id`, `handle`, `avatar_url`, `connected_at`, `last_sync_at`
   - Unique constraint: `(workspace_id, platform)`
   - **Weakness:** No token storage here (tokens in `social_connections` are user-scoped, creating a disconnect)

4. **`studio_social_posts`** (workspace-scoped)
   - Posts published from Studio
   - Fields: `platform`, `external_post_id`, `post_url`, `caption`, `posted_at`, `scheduled_for`
   - Links to `asset_id` and `social_account_id`
   - **Weakness:** `scheduled_for` exists but no publishing job

5. **`studio_social_post_metrics`** (linked to posts)
   - Time-series metrics: `impressions`, `views`, `likes`, `comments`, `shares`, `saves`
   - Indexed on `social_post_id` and `captured_at`
   - **Weakness:** No automatic metric refresh, manual only

6. **`studio_edit_events`** (workspace-scoped)
   - Analytics events: `create`, `edit`, `filter`, `crop`, `overlay`, `caption_edit`
   - **Weakness:** No aggregation or insights derived from this

7. **`social_connections`** (user-scoped, separate from workspace tables)
   - OAuth tokens: `access_token`, `refresh_token`, `expires_at`, `scopes`, `metadata`
   - Unique: `(user_id, provider)`
   - **Critical Issue:** User-scoped tokens but workspace-scoped posts creates a multi-tenant mismatch

8. **`social_media_posts`** (user-scoped)
   - Fetched posts from platforms
   - Fields: `provider_media_id`, `caption`, `media_url`, `media_type`, `metrics` (JSONB), `taken_at`, `fetched_at`
   - **Weakness:** No unique constraint on `(user_id, provider, provider_media_id)` mentioned in code comments but not enforced

#### Missing Concepts:

- **Campaigns:** No table for grouping posts into campaigns
- **Content Themes/Topics:** No categorization system
- **Hashtag tracking:** No hashtag extraction or analysis
- **Audience insights:** No demographic or audience data
- **Content calendar:** No calendar view or scheduling UI data model
- **Draft states:** No explicit draft/published/scheduled state machine
- **A/B tests:** No experiment tracking
- **Brand voice profile:** No structured brand voice storage (only in memory facts)

#### Index Gaps:

- `studio_social_posts.scheduled_for` - no index for querying scheduled posts
- `social_media_posts.taken_at` - no index for time-range queries
- `studio_social_post_metrics` - composite index on `(social_post_id, captured_at DESC)` would help

---

### 2.2 APIs and Endpoints

**Confirmed by code:** All endpoints in `app/api/studio/`:

#### Content & Media:
- `POST /api/studio/media` - Upload media asset
- `GET /api/studio/media/recent` - List recent assets
- `GET /api/studio/overview` - Brand facts + recent assets

#### Social Connections:
- `GET /api/studio/social/accounts` - List connected accounts
- `POST /api/studio/social/connect` - **Simulated connection** (not real OAuth)
- `GET /api/studio/social/status` - Connection status from `social_connections`
- `POST /api/studio/social/instagram/refresh` - Fetch Instagram posts
- `POST /api/studio/social/tiktok/refresh` - Fetch TikTok posts
- `GET /api/studio/social/summary` - Aggregate post data for LLM

#### Analytics:
- `GET /api/studio/analytics/summary` - Total counts (edits, posts, views, likes, comments)
- `GET /api/studio/analytics/posts` - Posts with latest metrics
- `GET /api/studio/analytics/trends` - Time-series data for charts

#### AI Intelligence:
- `POST /api/studio/agent/chat` - Chat with Studio agent (branding questions)
- `POST /api/studio/ask` - Ask questions about performance/content

#### OAuth Callbacks (separate):
- `GET /api/oauth/facebook/callback` - Facebook/Instagram OAuth
- `GET /api/oauth/tiktok/callback` - TikTok OAuth

#### Architecture Issues:

1. **No Unified Social Service**
   - Instagram/TikTok logic scattered in `lib/social/instagram.ts` and `lib/social/tiktok.ts`
   - Each platform has different error handling
   - No abstraction layer for "post to platform" or "fetch metrics"

2. **Duplication**
   - `studio_social_posts` (workspace) vs `social_media_posts` (user) - unclear which is source of truth
   - Two different connection tracking systems (`studio_social_accounts` vs `social_connections`)

3. **Missing Endpoints**
   - No `POST /api/studio/posts` to create/schedule a post
   - No `POST /api/studio/posts/:id/publish` to publish immediately
   - No `DELETE /api/studio/posts/:id` to cancel scheduled post
   - No `GET /api/studio/calendar` for content calendar view
   - No `POST /api/studio/generate` for AI content generation

4. **Error Handling**
   - Inconsistent error responses (some return `{ok: false, error: ...}`, others return `{error: ...}`)
   - No retry logic for failed API calls to social platforms
   - Token refresh not automated (user must manually reconnect)

5. **Rate Limiting**
   - No rate limiting on Studio endpoints
   - No queuing for social platform API calls
   - Instagram refresh does 200ms delay between insights fetches but no backoff on failures

---

### 2.3 OAuth Integrations (Instagram, TikTok, Facebook)

**Confirmed by code:** OAuth implementations in:
- `app/api/oauth/facebook/callback/route.ts`
- `app/api/oauth/tiktok/callback/route.ts`

#### Instagram (via Facebook Graph API):

**Auth Flow:**
1. User redirected to Facebook OAuth
2. Exchanges code for short-lived token
3. Exchanges short-lived for long-lived token (60 days)
4. Fetches user's Facebook Pages
5. Checks for Instagram Business account linked to first page
6. Stores in `social_connections` with provider = "instagram" or "facebook"

**Scopes Requested:**
- `public_profile`, `email`, `pages_show_list`, `instagram_basic`, `instagram_manage_insights`

**Token Handling:**
- Long-lived tokens stored with `expires_at`
- **Weakness:** No automatic refresh before expiry
- **Weakness:** No refresh token mechanism (Facebook long-lived tokens can't be refreshed indefinitely)

**Connection Health:**
- `isTokenExpired()` checks expiry with 5-minute buffer
- **Weakness:** No proactive health checks or reconnection prompts

#### TikTok:

**Auth Flow:**
1. User redirected to TikTok OAuth (PKCE flow)
2. Exchanges code for access token
3. Fetches user profile
4. Stores in `social_connections` with provider = "tiktok"

**Scopes Requested:**
- `user.info.basic`, `video.list`, `video.upload`

**Token Handling:**
- Tokens stored with `expires_at`
- Refresh tokens stored but **not used** (no refresh endpoint implemented)
- **Weakness:** When token expires, user must reconnect manually

#### Facebook (standalone):

**Auth Flow:** Same as Instagram (uses Facebook Graph API)

**Issues:**

1. **No Webhooks**
   - No webhook endpoints for post updates, comments, or engagement changes
   - Must poll via refresh endpoints

2. **Missing Refresh Logic**
   - No background job to refresh tokens before expiry
   - No automatic reconnection on token failure

3. **Error Handling Gaps**
   - Token expiry errors return 401 but no user-facing retry flow
   - No handling for revoked permissions

4. **Connection State Confusion**
   - `studio_social_accounts.status` can be "connected" but token might be expired
   - No sync between `social_connections` (user) and `studio_social_accounts` (workspace)

5. **Multi-Account Support**
   - Code assumes one account per platform per user
   - No support for multiple Instagram accounts or Facebook Pages

---

### 2.4 Content Generation Logic

**Confirmed by code:** LLM prompts in:
- `app/api/studio/agent/chat/route.ts`
- `app/api/studio/ask/route.ts`
- `lib/studioInsights.ts`

#### Current Prompt Structure:

**Studio Agent Chat (`/api/studio/agent/chat`):**
```
System: "You are the Studio Agent, a branding and content intelligence coach..."
User: "User message: {question}\n\nContext: {brandFacts, assetContext, recentAssets}"
```

**Studio Ask (`/api/studio/ask`):**
- Detects if question is about social media performance
- If yes: uses `generateStudioInsights()` with social summary
- If no: uses brand context + recent assets

**Studio Insights (`lib/studioInsights.ts`):**
```
System: "You are the OVRSEE Studio branding assistant. You analyze cross-platform social media performance data..."
User: "User question: {question}\n\nSocial Media Performance Summary: {truncatedSummary}"
```

#### Issues:

1. **Monolithic Prompts**
   - Single large system prompt, no modularity
   - No prompt versioning or A/B testing

2. **Limited Brand Voice**
   - Brand facts extracted from memory but no structured brand voice profile
   - No examples of past successful content to learn from
   - No tone/style guidelines stored

3. **No Platform-Specific Generation**
   - Same prompt for all platforms
   - No Instagram-specific caption style vs TikTok vs Facebook
   - No hashtag generation

4. **No Structured Output**
   - `suggestedAssets` returned as free-form JSON
   - No validation or schema enforcement

5. **Missing Context**
   - No competitor analysis
   - No trend data
   - No audience insights
   - No posting history patterns

6. **No Content Templates**
   - No reusable templates or content blocks
   - No A/B test variants generated

7. **No Image Analysis**
   - GPT-4o is vision-capable but no image analysis for uploaded assets
   - No automatic caption suggestions based on image content

---

### 2.5 Metric Ingestion + Analytics Pipeline

**Confirmed by code:** Metrics flow:

1. **Ingestion:**
   - Manual refresh via `/api/studio/social/instagram/refresh` or `/api/studio/social/tiktok/refresh`
   - Fetches posts with insights/metrics from platform APIs
   - Stores in `social_media_posts.metrics` (JSONB) and `studio_social_post_metrics` (time-series)

2. **Storage:**
   - `studio_social_post_metrics` has `captured_at` for time-series
   - Latest metric per post fetched in analytics endpoints

3. **Aggregation:**
   - `generateSocialSummary()` aggregates last 90 days
   - Calculates totals, averages by media type, top posts

#### Issues:

1. **No Automatic Refresh**
   - Metrics only updated when user manually triggers refresh
   - No background job to sync metrics daily/hourly

2. **Shallow Metrics**
   - Only basic metrics: views, likes, comments, shares, saves
   - No engagement rate calculation
   - No reach/impressions ratio
   - No audience demographics
   - No best posting times analysis

3. **No Time-Series Analysis**
   - Metrics stored but no trend detection
   - No anomaly detection (e.g., "engagement dropped 50%")
   - No forecasting

4. **No Cross-Platform Comparison**
   - Metrics analyzed per platform but not compared
   - No "what works on Instagram vs TikTok" insights

5. **No Metric History**
   - `social_media_posts.metrics` is a single JSONB blob (overwrites on refresh)
   - `studio_social_post_metrics` has time-series but not used for historical analysis

6. **Performance Issues**
   - `/api/studio/analytics/summary` loops through all posts to sum metrics (N+1 query pattern)
   - No caching of aggregated metrics

---

### 2.6 Scheduling Engine

**Confirmed by code:** 
- `studio_social_posts.scheduled_for` field exists
- No job/cron system found in codebase
- No publishing endpoint

#### What's Missing:

1. **No Scheduler**
   - No background job to check `scheduled_for` and publish posts
   - No queue system (e.g., Bull, BullMQ, or Supabase Edge Functions)

2. **No Publishing Logic**
   - No endpoint to actually post to Instagram/TikTok/Facebook
   - No media upload to platforms
   - No caption formatting for platform-specific requirements

3. **No Retry Mechanism**
   - If publishing fails, no retry logic
   - No dead-letter queue for failed posts

4. **No Idempotency**
   - No check to prevent duplicate posts
   - No `external_post_id` stored before publishing

5. **No Timezone Handling**
   - `scheduled_for` is TIMESTAMPTZ but no user timezone preference
   - No "best time to post" suggestions

6. **No Draft State Machine**
   - No explicit states: draft → scheduled → publishing → published → failed
   - No status field in `studio_social_posts`

---

### 2.7 Draft Workflows

**Confirmed by code:**
- `studio_assets` stores media
- `studio_asset_versions` tracks versions
- Frontend has rich editing UI

#### Current State:

1. **Asset Creation:**
   - User uploads → `studio_assets` created
   - Edits stored in `studio_asset_versions.edit_operations` (JSONB)
   - `is_current` flag marks active version

2. **No Draft Posts Table**
   - No separate `studio_drafts` table
   - Drafts are just `studio_assets` that haven't been posted

#### Issues:

1. **No Version History UI**
   - Versions stored but no UI to browse/compare versions
   - No "revert to version X" functionality

2. **No Collaboration**
   - No comments or review workflow
   - No approval process

3. **No Idea Backlog**
   - No "content ideas" or "saved for later" concept
   - No tagging or categorization

4. **No Draft-to-Post Flow**
   - No explicit "create post from asset" action
   - No caption editor linked to asset

5. **No Multi-Asset Posts**
   - Instagram carousels not supported
   - No "post series" concept

---

### 2.8 AI Prompt Design Issues

**Confirmed by code:** Prompts in:
- `app/api/studio/agent/chat/route.ts` (lines 102-119)
- `app/api/studio/ask/route.ts` (lines 138-156)
- `lib/studioInsights.ts` (lines 46-65)

#### Analysis:

1. **Structure:**
   - System prompts are long strings (not templated)
   - User prompts concatenate context as JSON string
   - No prompt chaining or multi-step reasoning

2. **Inputs:**
   - Brand facts from memory (unstructured)
   - Recent assets (limited to 5-10)
   - Social summary (truncated to 5 posts per platform)

3. **Outputs:**
   - Free-form JSON with `answer` and `suggestedAssets`
   - No schema validation
   - No structured actions (e.g., "create post", "schedule for X time")

4. **Issues:**

   - **Repetition:** Similar prompts in `agent/chat` and `ask` endpoints
   - **Inconsistent Styles:** Some use markdown, some use plain text
   - **No Brand Voice:** No explicit brand voice instructions in prompts
   - **No A/B Testing:** Same prompt for all users, no experimentation
   - **No Analytics:** No tracking of prompt performance or user satisfaction
   - **Token Waste:** Social summary truncated but still large; no smart filtering
   - **No Few-Shot Examples:** No examples of good responses
   - **No Chain-of-Thought:** No step-by-step reasoning for complex questions

---

### 2.9 Caching or Performance Gaps

**Confirmed by code:** No caching layer found.

#### Missing Caching:

1. **Social Summary**
   - `generateSocialSummary()` recalculates on every request
   - Should cache for 1-6 hours

2. **Analytics Aggregations**
   - `/api/studio/analytics/summary` sums metrics on every request
   - Should cache daily totals

3. **Brand Facts**
   - `getMemoryFacts()` called on every chat request
   - Should cache per workspace

4. **Platform API Responses**
   - Instagram/TikTok API responses not cached
   - Should cache for 5-15 minutes to reduce API calls

#### Performance Issues:

1. **N+1 Queries:**
   - `/api/studio/analytics/posts` fetches latest metric per post in a loop
   - Should use a single query with `LATERAL JOIN` or window functions

2. **Heavy Operations on Request Path:**
   - LLM calls in request path (no queue)
   - Social summary generation blocks request

3. **Repeated LLM Calls:**
   - Same question might be asked multiple times
   - No caching of LLM responses

4. **Rate Limit Risks:**
   - Instagram refresh fetches insights with 200ms delay but no backoff
   - TikTok API calls have no rate limiting protection

---

### 2.10 Frontend UI/UX Issues

**Confirmed by code:** Main Studio page at `app/studio/page.tsx` (4143 lines - very large component)

#### Information Architecture:

**Current Pages:**
- `/studio` - Main editing interface with tabs/sections

**Navigation:**
- Studio accessible from main app sidebar
- No sub-navigation for "Analytics", "Calendar", "Drafts", etc.

#### UI Components:

1. **Studio Intelligence** (`components/studio/StudioIntelligence.tsx`)
   - Simple Q&A interface
   - Shows suggested assets
   - **Issue:** No conversation history, no context retention

2. **Main Studio Page** (`app/studio/page.tsx`)
   - Media upload
   - Rich editing (filters, adjustments, text, crop)
   - Social account connection UI
   - Posts/interactions table
   - Analytics charts

#### Issues:

1. **Confusing Flows:**
   - No clear "create post" flow
   - Editing and posting are separate, unclear how they connect
   - Social account connection happens in main page, not a dedicated settings area

2. **Too Many Steps:**
   - Upload → Edit → (no clear "post" action)
   - Must manually refresh to see new posts from platforms

3. **Low Discoverability:**
   - Studio Intelligence (AI chat) might be hidden
   - No onboarding or tooltips

4. **Poor Empty States:**
   - No guidance when no accounts connected
   - No "get started" flow

5. **No Content Calendar:**
   - No calendar view for scheduled posts
   - No drag-and-drop scheduling

6. **Analytics Fragmentation:**
   - Analytics scattered across different sections
   - No unified dashboard

7. **Mobile Experience:**
   - Large component (4143 lines) suggests poor mobile optimization
   - Mobile app exists (`ovrsee-mobile/src/screens/StudioScreen.tsx`) but unclear if feature parity

---

## 3. Intelligence Gaps

Based on actual implementation, Studio is "dumb" in these areas:

### Analytics Depth

**Confirmed by code:** Metrics are basic (views, likes, comments). Missing:
- Engagement rate calculation
- Audience growth trends
- Best posting times
- Content performance by type (image vs video vs carousel)
- Hashtag performance
- Competitor benchmarking

**Code reference:** `lib/social/summary.ts` only aggregates raw counts, no derived metrics.

### Trend Detection

**Missing:** No code for:
- Detecting engagement drops
- Identifying viral content patterns
- Seasonal trends
- Content fatigue detection

**Code reference:** `/api/studio/analytics/trends` returns raw time-series but no analysis.

### Competitor Analysis

**Missing:** No competitor tracking or comparison.

### Automatic Posting / Proactive Suggestions

**Missing:**
- No background job to suggest posts
- No "you haven't posted in X days" alerts
- No content calendar recommendations

**Code reference:** No cron jobs or background workers found.

### Content Calendar Intelligence

**Missing:**
- No optimal posting time suggestions
- No content spacing recommendations
- No holiday/event awareness

### Brand Voice Awareness

**Partial:** Brand facts from memory but:
- No structured brand voice profile
- No learning from past successful posts
- No tone consistency scoring

**Code reference:** `getMemoryFacts()` returns unstructured facts, no brand voice schema.

### Tone Control and Personalization

**Missing:**
- No tone slider or presets
- No per-platform tone variations
- No audience-specific tone

### Cross-Platform Optimization

**Partial:** Can analyze multiple platforms but:
- No "repurpose Instagram post for TikTok" logic
- No platform-specific format recommendations
- No cross-posting automation

### Drafting System Sophistication

**Basic:** Versioning exists but:
- No collaborative editing
- No approval workflows
- No template library
- No content blocks/reusable elements

### Repurposing Capabilities

**Missing:** No code for:
- Converting long-form to short-form
- Extracting clips from videos
- Resizing for different platforms
- Caption adaptation

### Learning from Past Performance

**Missing:**
- No ML model to predict post performance
- No "posts like this perform well" suggestions
- No A/B test analysis

---

## 4. Missing Core Features

### Autonomous Post Suggestions

**What's missing:** No background job or endpoint to proactively suggest posts.

**Groundwork:** Studio Ask can answer questions, but no scheduled suggestions.

**What's needed:**
- Background job (cron or queue) to analyze posting history
- LLM prompt to generate post ideas based on brand + performance
- Notification system to surface suggestions

### Trend Monitoring

**What's missing:** No code to fetch trending topics or hashtags.

**Groundwork:** None.

**What's needed:**
- Integration with trend APIs (Twitter Trends, Google Trends, TikTok Trends)
- Background job to fetch and store trends
- LLM analysis to match trends to brand

### Weekly Analytics Reports

**What's missing:** No automated report generation or email delivery.

**Groundwork:** Analytics endpoints exist but no aggregation or reporting.

**What's needed:**
- Weekly aggregation job
- Report template (HTML/PDF)
- Email delivery system

### Post Performance Prediction or Scoring

**What's missing:** No ML model or heuristic to predict engagement.

**Groundwork:** Historical metrics exist but not used for prediction.

**What's needed:**
- Feature engineering (time of day, day of week, content type, caption length, etc.)
- Simple regression model or LLM-based prediction
- Score display in UI before posting

### Auto Repurposing for Reels/Shorts/Tweets

**What's missing:** No code to transform content for different formats.

**Groundwork:** Video editing UI exists but no automation.

**What's needed:**
- Video trimming/clipping logic
- Caption adaptation (long to short)
- Aspect ratio conversion
- Platform-specific format detection

### Content Calendar with Drag-and-Drop

**What's missing:** No calendar UI or scheduling interface.

**Groundwork:** `scheduled_for` field exists but no UI.

**What's needed:**
- Calendar component (e.g., FullCalendar, react-big-calendar)
- Drag-and-drop scheduling
- Visual timeline of scheduled posts

### Hashtag Intelligence

**What's missing:** No hashtag extraction, analysis, or suggestions.

**Groundwork:** Captions stored but no hashtag parsing.

**What's needed:**
- Hashtag extraction from captions
- Hashtag performance tracking
- LLM-based hashtag suggestions
- Trending hashtag integration

### Audience Insights

**What's missing:** No demographic or audience data.

**Groundwork:** Platform APIs might provide this but not fetched.

**What's needed:**
- Instagram Insights API for demographics
- Audience growth tracking
- Follower activity patterns

### "Studio Chat" Conversational Agent

**Partial:** Studio Agent Chat exists but:
- No conversation history
- No context retention across sessions
- No ability to take actions (e.g., "schedule this post")

**What's needed:**
- Conversation storage
- Action execution (e.g., "post this to Instagram")
- Multi-turn context

### Post A/B Test Suggestions

**What's missing:** No A/B testing framework.

**Groundwork:** None.

**What's needed:**
- A/B test table schema
- Variant generation (captions, images, posting times)
- Statistical analysis of results

### Outbound Scheduling + Queueing with Autopilot Behavior

**What's missing:** No scheduling engine or autopilot.

**Groundwork:** `scheduled_for` field exists.

**What's needed:**
- Background job to publish scheduled posts
- Queue system (Bull/BullMQ or Supabase Edge Functions)
- Autopilot rules (e.g., "post 3x per week at optimal times")
- Best time calculation based on historical performance

---

## 5. User Experience Gaps

### Confusing or Fragmented Flows

1. **Post Creation Flow:**
   - User uploads asset → edits → (no clear "create post" button)
   - Must navigate to different section to schedule/post
   - **Code reference:** `app/studio/page.tsx` has editing UI but no explicit post creation flow

2. **Account Connection:**
   - OAuth happens in main Studio page, not a dedicated settings area
   - Connection status unclear (simulated vs real)
   - **Code reference:** `/api/studio/social/connect` simulates connection

3. **Analytics Discovery:**
   - Analytics scattered across page
   - No unified dashboard
   - **Code reference:** Multiple analytics endpoints but no dashboard page

### Extra Steps / Re-entry of Data

1. **Manual Refresh:**
   - Must manually trigger refresh to see new posts
   - No automatic sync
   - **Code reference:** Refresh endpoints are POST, not automatic

2. **No Draft Persistence:**
   - Edits might be lost if page refreshes
   - No "save draft" explicit action
   - **Code reference:** Edits stored in `studio_asset_versions` but no draft state

3. **Re-authentication:**
   - When token expires, must reconnect (no automatic refresh)
   - **Code reference:** No token refresh logic

### Missing Expected Features

1. **Content Calendar:**
   - Social media managers expect a calendar view
   - **Missing:** No calendar component

2. **Bulk Actions:**
   - No bulk scheduling or posting
   - **Missing:** No bulk endpoints

3. **Post Preview:**
   - No preview of how post will look on platform
   - **Missing:** No preview generation

4. **Analytics Export:**
   - No CSV/PDF export of analytics
   - **Missing:** No export endpoints

### Too Much Manual Work

1. **Content Generation:**
   - User must ask Studio for suggestions (not proactive)
   - **Code reference:** Studio Ask requires user to ask questions

2. **Scheduling:**
   - Must manually set `scheduled_for` (no UI)
   - **Code reference:** Field exists but no scheduling UI

3. **Hashtag Research:**
   - No hashtag suggestions or research
   - **Missing:** No hashtag intelligence

---

## 6. Recommendations (High Impact → Low Impact)

### Backend Architecture

#### 1. **Unify Social Service Abstraction** (HIGH IMPACT)

**Problem:** Instagram/TikTok logic scattered, no unified interface.

**Current state:** `lib/social/instagram.ts` and `lib/social/tiktok.ts` have different interfaces.

**Solution:**
- Create `lib/social/base.ts` with `SocialPlatform` interface
- Implement `InstagramPlatform`, `TikTokPlatform`, `FacebookPlatform`
- Unified methods: `fetchPosts()`, `publishPost()`, `fetchMetrics()`, `refreshToken()`

**Files to modify:**
- Create `lib/social/base.ts`
- Refactor `lib/social/instagram.ts` and `lib/social/tiktok.ts`
- Update refresh endpoints to use unified service

#### 2. **Fix Multi-Tenant Token Storage** (HIGH IMPACT)

**Problem:** Tokens in `social_connections` (user-scoped) but posts in workspace-scoped tables.

**Current state:** Disconnect between user tokens and workspace posts.

**Solution:**
- Option A: Move tokens to workspace-scoped table (requires migration)
- Option B: Add `workspace_id` to `social_connections` and enforce workspace access
- Option C: Create mapping table `workspace_social_connections(user_id, workspace_id, connection_id)`

**Files to modify:**
- Migration to add workspace mapping
- Update OAuth callbacks to link to workspace
- Update refresh endpoints to use workspace context

#### 3. **Implement Scheduling Engine** (HIGH IMPACT)

**Problem:** `scheduled_for` exists but no publishing job.

**Current state:** No background jobs found in codebase.

**Solution:**
- Use Supabase Edge Functions or external queue (Bull/BullMQ)
- Create `publish-scheduled-posts` job that runs every 5 minutes
- Add `status` field to `studio_social_posts`: `draft | scheduled | publishing | published | failed`
- Implement publishing logic for each platform

**Files to create:**
- `supabase/functions/publish-scheduled-posts/index.ts` (or external worker)
- `lib/social/publish.ts` with platform-specific publishing

**Files to modify:**
- Add `status` column to `studio_social_posts`
- Create publishing endpoints

#### 4. **Add Automatic Metric Refresh** (MEDIUM IMPACT)

**Problem:** Metrics only updated on manual refresh.

**Current state:** Refresh endpoints are POST, user-triggered.

**Solution:**
- Background job to refresh metrics daily for all connected accounts
- Store last refresh time in `studio_social_accounts.last_sync_at`
- Queue refresh jobs to avoid rate limits

**Files to create:**
- `supabase/functions/refresh-social-metrics/index.ts`
- Or use Vercel Cron Jobs

**Files to modify:**
- Update refresh endpoints to be idempotent
- Add rate limiting

#### 5. **Optimize Analytics Queries** (MEDIUM IMPACT)

**Problem:** N+1 queries in analytics endpoints.

**Current state:** `/api/studio/analytics/summary` loops through posts.

**Solution:**
- Use SQL window functions to get latest metric per post
- Add materialized view for daily aggregations
- Cache aggregated metrics

**Files to modify:**
- `app/api/studio/analytics/summary/route.ts` - use single query with LATERAL JOIN
- `app/api/studio/analytics/posts/route.ts` - batch fetch metrics

**Database:**
- Create materialized view `studio_daily_metrics`
- Refresh view daily via cron

### AI Intelligence Layers

#### 6. **Structured Brand Voice Profile** (HIGH IMPACT)

**Problem:** Brand voice stored in unstructured memory facts.

**Current state:** `getMemoryFacts()` returns unstructured JSON.

**Solution:**
- Create `studio_brand_profiles` table with structured fields:
  - `tone` (enum: professional, casual, friendly, etc.)
  - `voice_characteristics` (JSONB: keywords, phrases, style)
  - `content_themes` (array)
  - `audience_description` (text)
  - `example_posts` (JSONB: array of successful post examples)
- Update prompts to use structured profile

**Files to create:**
- Migration for `studio_brand_profiles`
- `lib/studio/brand-profile.ts` for CRUD operations

**Files to modify:**
- `app/api/studio/agent/chat/route.ts` - use brand profile
- `app/api/studio/ask/route.ts` - use brand profile

#### 7. **Content Generation Endpoint** (HIGH IMPACT)

**Problem:** No endpoint to generate content from scratch.

**Current state:** Studio Ask answers questions but doesn't generate posts.

**Solution:**
- `POST /api/studio/generate` endpoint
- Input: `type` (post, caption, hashtags), `platform`, `topic`, `tone`
- Output: Generated content with variants
- Use structured output (JSON schema)

**Files to create:**
- `app/api/studio/generate/route.ts`
- `lib/studio/content-generator.ts`

**Files to modify:**
- Add to Studio Agent Chat: "Generate a post about X"

#### 8. **Proactive Post Suggestions** (MEDIUM IMPACT)

**Problem:** No automatic suggestions.

**Current state:** User must ask Studio for suggestions.

**Solution:**
- Background job to generate suggestions daily
- Store in `studio_post_suggestions` table
- Notification system to surface suggestions

**Files to create:**
- `supabase/functions/generate-post-suggestions/index.ts`
- `studio_post_suggestions` table migration

**Files to modify:**
- Add suggestions UI to Studio page

#### 9. **Post Performance Prediction** (MEDIUM IMPACT)

**Problem:** No prediction before posting.

**Current state:** Historical metrics exist but not used for prediction.

**Solution:**
- Simple heuristic: average engagement by content type, time of day, day of week
- Or LLM-based prediction: "Given this post, predict engagement"
- Display score in UI before scheduling

**Files to create:**
- `lib/studio/prediction.ts`
- `app/api/studio/predict/route.ts`

**Files to modify:**
- Add prediction to post creation flow

### UI/UX Redesigns

#### 10. **Content Calendar View** (HIGH IMPACT)

**Problem:** No calendar for scheduled posts.

**Current state:** `scheduled_for` field but no UI.

**Solution:**
- New page `/studio/calendar`
- Use react-big-calendar or similar
- Drag-and-drop to schedule
- Visual timeline

**Files to create:**
- `app/studio/calendar/page.tsx`
- `components/studio/ContentCalendar.tsx`

**Files to modify:**
- Add calendar link to Studio navigation

#### 11. **Unified Analytics Dashboard** (MEDIUM IMPACT)

**Problem:** Analytics scattered across page.

**Current state:** Multiple analytics endpoints, no dashboard.

**Solution:**
- New page `/studio/analytics`
- Unified dashboard with charts, tables, insights
- Date range picker
- Export functionality

**Files to create:**
- `app/studio/analytics/page.tsx`
- `components/studio/AnalyticsDashboard.tsx`

#### 12. **Post Creation Wizard** (MEDIUM IMPACT)

**Problem:** Unclear how to create a post from asset.

**Current state:** Editing and posting are separate.

**Solution:**
- Multi-step wizard: Upload → Edit → Add Caption → Schedule → Review
- Clear CTA buttons
- Preview before publishing

**Files to modify:**
- `app/studio/page.tsx` - add wizard flow
- Or create `app/studio/create/page.tsx`

#### 13. **Studio Chat Improvements** (LOW IMPACT)

**Problem:** No conversation history, no actions.

**Current state:** Simple Q&A, no persistence.

**Solution:**
- Store conversations in `studio_conversations` table
- Add action execution: "Schedule this post", "Generate caption"
- Show conversation history

**Files to create:**
- `studio_conversations` table migration
- `components/studio/StudioChat.tsx` with history

**Files to modify:**
- `app/api/studio/agent/chat/route.ts` - store conversations

### Database Upgrades

#### 14. **Add Missing Indexes** (MEDIUM IMPACT)

**Problem:** Missing indexes for common queries.

**Solution:**
- Index on `studio_social_posts.scheduled_for` for scheduler queries
- Index on `social_media_posts.taken_at` for time-range queries
- Composite index on `studio_social_post_metrics(social_post_id, captured_at DESC)`

**Files to create:**
- Migration: `20250122000000_add_studio_indexes.sql`

#### 15. **Add Campaigns Table** (LOW IMPACT)

**Problem:** No way to group posts into campaigns.

**Solution:**
- `studio_campaigns` table
- Link posts to campaigns
- Campaign-level analytics

**Files to create:**
- Migration for `studio_campaigns`
- Update `studio_social_posts` to add `campaign_id`

### Automation / Job Queues

#### 16. **Token Refresh Automation** (HIGH IMPACT)

**Problem:** Tokens expire, user must reconnect.

**Current state:** No automatic refresh.

**Solution:**
- Background job to check token expiry
- Refresh tokens before expiry (where possible)
- Notify user if refresh fails

**Files to create:**
- `supabase/functions/refresh-tokens/index.ts`
- Or Vercel Cron Job

**Files to modify:**
- Add refresh token logic to `lib/social/instagram.ts` and `lib/social/tiktok.ts`

#### 17. **Metric Refresh Queue** (MEDIUM IMPACT)

**Problem:** Manual refresh, no queuing.

**Current state:** Refresh endpoints are synchronous.

**Solution:**
- Queue refresh jobs
- Process with rate limiting
- Retry on failure

**Files to create:**
- Queue system (Bull/BullMQ or Supabase Edge Functions with queue)
- `lib/social/refresh-queue.ts`

### Personalization

#### 18. **Best Time to Post Calculation** (MEDIUM IMPACT)

**Problem:** No optimal posting time suggestions.

**Current state:** No time analysis.

**Solution:**
- Analyze historical performance by hour/day
- Calculate best times per platform
- Suggest in scheduling UI

**Files to create:**
- `lib/studio/best-time.ts`
- `app/api/studio/best-time/route.ts`

#### 19. **Content Repurposing Engine** (MEDIUM IMPACT)

**Problem:** No auto-repurposing for different platforms.

**Current state:** Manual repurposing.

**Solution:**
- LLM-based repurposing: "Convert this Instagram post to TikTok"
- Video trimming for Shorts/Reels
- Caption adaptation

**Files to create:**
- `lib/studio/repurpose.ts`
- `app/api/studio/repurpose/route.ts`

### Onboarding

#### 20. **Studio Onboarding Flow** (LOW IMPACT)

**Problem:** No guidance for new users.

**Current state:** Empty states are basic.

**Solution:**
- Multi-step onboarding: Connect accounts → Upload first asset → Generate first post
- Tooltips and guided tours
- Sample data for demo

**Files to create:**
- `components/studio/Onboarding.tsx`
- `lib/studio/onboarding.ts`

---

## 7. What Phase 2 Should Look Like

### Phase 2 – Core Upgrades (Weeks 1-4)

**Goal:** Stabilize architecture, improve UX, build brand profile.

#### Week 1-2: Architecture Stabilization

1. **Unify Social Service Abstraction**
   - Create `lib/social/base.ts` with platform interface
   - Refactor Instagram/TikTok to implement interface
   - Update refresh endpoints

2. **Fix Multi-Tenant Token Storage**
   - Add workspace mapping to `social_connections`
   - Update OAuth callbacks
   - Migration to link existing connections

3. **Add Missing Indexes**
   - Migration for performance indexes
   - Test query performance

#### Week 3-4: UX & Brand Profile

4. **Content Calendar**
   - Create `/studio/calendar` page
   - Implement drag-and-drop scheduling
   - Visual timeline

5. **Structured Brand Voice Profile**
   - Create `studio_brand_profiles` table
   - Brand profile UI/editor
   - Update prompts to use profile

6. **Post Creation Wizard**
   - Multi-step flow: Upload → Edit → Caption → Schedule
   - Clear CTAs
   - Preview

**Deliverables:**
- Unified social service
- Working content calendar
- Brand profile system
- Improved post creation flow

**Dependencies:**
- Database migrations
- Frontend calendar component library

---

### Phase 3 – Intelligence + Automation (Weeks 5-8)

**Goal:** Analytics-powered suggestions, smarter scheduling, repurposing, Studio Chat actions.

#### Week 5-6: Scheduling & Automation

7. **Scheduling Engine**
   - Background job (Supabase Edge Function or external)
   - Publishing logic for each platform
   - Status field and state machine

8. **Token Refresh Automation**
   - Background job to refresh tokens
   - Notification on failure

9. **Automatic Metric Refresh**
   - Daily refresh job
   - Queue system with rate limiting

#### Week 7-8: Intelligence & Repurposing

10. **Content Generation Endpoint**
    - `POST /api/studio/generate`
    - Structured output
    - Integration with Studio Chat

11. **Proactive Post Suggestions**
    - Daily suggestion job
    - Notification system
    - Suggestions UI

12. **Content Repurposing Engine**
    - LLM-based repurposing
    - Video trimming
    - Caption adaptation

13. **Studio Chat Actions**
    - Conversation storage
    - Action execution ("schedule this post")
    - Multi-turn context

**Deliverables:**
- Working scheduler
- Automatic token/metric refresh
- Content generation
- Repurposing engine
- Actionable Studio Chat

**Dependencies:**
- Queue system (Bull/BullMQ or Supabase Edge Functions)
- Background job infrastructure

---

### Phase 4 – Premium AI Features (Weeks 9-12)

**Goal:** Advanced prediction, trend intelligence, experiments, deep personalization.

#### Week 9-10: Prediction & Trends

14. **Post Performance Prediction**
    - Heuristic or LLM-based prediction
    - Score display in UI
    - A/B test suggestions

15. **Best Time to Post**
    - Historical analysis
    - Per-platform recommendations
    - Integration with scheduler

16. **Trend Monitoring** (if APIs available)
    - Trend API integration
    - Background job to fetch trends
    - LLM analysis to match trends to brand

#### Week 11-12: Experiments & Personalization

17. **A/B Testing Framework**
    - A/B test table schema
    - Variant generation
    - Statistical analysis

18. **Hashtag Intelligence**
    - Hashtag extraction
    - Performance tracking
    - LLM-based suggestions

19. **Unified Analytics Dashboard**
    - `/studio/analytics` page
    - Charts, tables, insights
    - Export functionality

20. **Audience Insights** (if APIs available)
    - Demographics from platform APIs
    - Growth tracking
    - Activity patterns

**Deliverables:**
- Performance prediction
- Best time recommendations
- A/B testing
- Hashtag intelligence
- Unified analytics dashboard

**Dependencies:**
- Platform API access for trends/audience
- Statistical analysis library

---

## Summary

Studio has a solid foundation with:
- ✅ Media asset management
- ✅ OAuth integrations (Instagram, TikTok, Facebook)
- ✅ Basic analytics
- ✅ AI-powered chat

But it's missing critical features for a "real AI social agent":
- ❌ No scheduling/publishing engine
- ❌ No automatic suggestions
- ❌ No content calendar
- ❌ No repurposing
- ❌ No performance prediction
- ❌ No trend monitoring
- ❌ Fragmented UX

**Priority fixes:**
1. Scheduling engine (enables core value)
2. Unified social service (reduces technical debt)
3. Content calendar (expected UX)
4. Brand profile (improves AI quality)
5. Token refresh automation (reduces friction)

The architecture is sound but needs automation, intelligence, and UX polish to become a true AI social media agent.

