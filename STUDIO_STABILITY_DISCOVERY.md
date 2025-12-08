# Studio Stability Discovery

## Background Jobs

### 1. Publish Cron (`/api/cron/studio/publish`)
- **Frequency**: Every minute (configured in `vercel.json`)
- **Purpose**: Find scheduled posts ready to publish and enqueue them
- **Process**:
  - Finds posts with `status = 'scheduled'` and `scheduled_for <= now`
  - Also checks for posts stuck in `'publishing'` state (older than 10 minutes)
  - Calls `/api/studio/publish/[postId]` for each post
  - Processes up to 50 posts per run
- **Failure Points**:
  - Database query failures
  - Publish endpoint failures
  - Network issues calling internal endpoints
  - Posts stuck in publishing state

### 2. Metrics Refresh Cron (`/api/cron/studio/metrics-refresh`)
- **Frequency**: Every 6 hours (configured in `vercel.json`)
- **Purpose**: Refresh metrics for recent posts (last 30 days)
- **Process**:
  - Iterates over all workspaces
  - For each workspace, refreshes metrics per platform (Instagram, TikTok, Facebook)
  - Processes posts in batches (10 at a time) with delays
  - Updates `studio_social_post_metrics` table
- **Failure Points**:
  - Token expiry during refresh
  - Rate limit hits from platform APIs
  - Partial failures (some posts succeed, others fail)
  - Network timeouts
  - Invalid external_post_id references

### 3. Weekly Report Cron (`/api/cron/studio/weekly-report`)
- **Frequency**: Weekly (Monday 9 AM, configured in `vercel.json`)
- **Purpose**: Generate weekly reports for all workspaces
- **Process**:
  - Iterates over all workspaces
  - Calls `generateWeeklyReport()` for each
  - Writes to `studio_reports` table
- **Failure Points**:
  - LLM API failures (OpenAI)
  - LLM output parsing errors (invalid JSON/markdown)
  - Database write failures
  - Workspaces with no posts (edge case handling)
  - Timeout on large workspaces

### 4. Competitors Refresh Cron (`/api/cron/studio/competitors-refresh`)
- **Frequency**: Daily (midnight, configured in `vercel.json`)
- **Purpose**: Refresh metrics for competitor accounts
- **Process**:
  - Calls `refreshAllCompetitorsMetrics()`
  - Iterates workspaces → competitors → fetches metrics
  - Currently stubbed (returns mock data)
- **Failure Points**:
  - Platform API stubs not implemented
  - Invalid competitor handles
  - Rate limits (when real APIs are connected)
  - Missing competitor accounts

## Tool-Calling Operations (Studio Agent)

### Tools Available (`lib/studio/agent-tools.ts`)

1. **createDraftPost**
   - Creates a new draft post
   - Validates platform, scheduled date (not past, max 3 months)
   - Failure: No connected account, invalid date, DB insert error

2. **schedulePost**
   - Updates post `scheduled_for` and `status`
   - Validates date constraints
   - Failure: Post not found, invalid date, DB update error

3. **movePostOnCalendar**
   - Moves post to new scheduled time
   - Validates date constraints
   - Failure: Post not found, invalid date, DB update error

4. **repurposePost**
   - Creates repurposed variants for other platforms
   - Calls repurposing service
   - Failure: Source post not found, LLM errors, DB insert errors

5. **generateWeeklyPlan**
   - Generates weekly content plan
   - Calls planner endpoint logic
   - Failure: LLM errors, schema mismatch, DB insert errors

6. **createExperiment**
   - Creates A/B test experiment
   - Links posts as variants
   - Failure: Invalid post IDs, DB insert errors

### Tool Call Flow
- Agent receives user message
- LLM decides which tools to call
- Tools execute and return results
- Agent summarizes actions for user
- All tool calls logged via `logToolCall()`

## LLM Entry Points & Cost Drivers

### 1. Weekly Planner (`/api/studio/plans/weekly`)
- **Model**: `gpt-4o`
- **Input**: Brand profile, metrics summary, competitor data, preferences
- **Output**: JSON schema with proposed posts
- **Cost**: ~2000-4000 tokens per request
- **Frequency**: User-triggered (button click)
- **Failure Points**: Invalid JSON, schema mismatch, timeout

### 2. Repurposing Engine (`/api/studio/repurpose`)
- **Model**: `gpt-4o`
- **Input**: Source post, brand profile, target platforms
- **Output**: Per-platform captions/hooks/CTAs/hashtags
- **Cost**: ~1500-3000 tokens per request
- **Frequency**: User-triggered (repurpose action)
- **Failure Points**: Invalid JSON, missing source post, timeout

### 3. Weekly Reports (`lib/studio/report-service.ts`)
- **Model**: `gpt-4o`
- **Input**: Metrics summary, brand profile, competitor data, preferences
- **Output**: Markdown report
- **Cost**: ~3000-6000 tokens per request
- **Frequency**: Weekly cron + manual trigger
- **Failure Points**: Invalid markdown, timeout, empty metrics

### 4. Experiment Summaries (`lib/studio/experiment-service.ts`)
- **Model**: `gpt-4o`
- **Input**: Experiment metadata, variant metrics
- **Output**: Markdown summary
- **Cost**: ~1000-2000 tokens per request
- **Frequency**: On-demand (when viewing experiment)
- **Failure Points**: Invalid markdown, missing metrics

### 5. Scoring Explanations (`lib/studio/scoring-service.ts`)
- **Model**: `gpt-4o` (optional, on-demand)
- **Input**: Draft features, brand profile
- **Output**: Human-readable explanation
- **Cost**: ~500-1000 tokens per request
- **Frequency**: On-demand (when viewing score details)
- **Failure Points**: Invalid explanation, timeout

### 6. Studio Agent Chat (`/api/studio/agent/chat`)
- **Model**: `gpt-4o` with function calling
- **Input**: User message, context (brand profile, preferences, etc.)
- **Output**: Text response + tool calls
- **Cost**: ~1000-5000 tokens per request (varies by complexity)
- **Frequency**: User-triggered (chat messages)
- **Failure Points**: Invalid tool calls, hallucinations, timeout

## Failure Cases

### Publish Flow
1. **Token Expiry**: Access token expired → Need refresh logic
2. **Platform API Errors**: Rate limits, invalid media, API changes
3. **Media Fetch Failures**: Asset URL inaccessible, wrong format
4. **Network Timeouts**: Platform API slow/unresponsive
5. **Partial Failures**: Post created but media upload fails

### Metrics Refresh Flow
1. **Rate Limits**: Too many requests → Need exponential backoff
2. **Token Expiry**: Mid-refresh token expires → Need refresh + retry
3. **Invalid Post IDs**: External post ID doesn't exist anymore
4. **Partial Failures**: Some posts succeed, others fail
5. **Network Timeouts**: Platform API slow

### Planner Flow
1. **LLM Errors**: API failure, timeout, rate limit
2. **Schema Mismatch**: LLM returns invalid JSON
3. **Empty Metrics**: No historical data → Should handle gracefully
4. **Missing Brand Profile**: Should use defaults
5. **DB Insert Errors**: Post creation fails after LLM succeeds

### Repurposer Flow
1. **Missing Source Post**: Post deleted or not found
2. **LLM Errors**: API failure, invalid JSON
3. **Invalid Platforms**: Target platform not supported
4. **DB Insert Errors**: Variants fail to create

### Competitor Fetch
1. **Stub Functions**: Currently return mock data
2. **Invalid Handles**: Competitor handle doesn't exist
3. **API Not Implemented**: Real APIs not connected yet
4. **Rate Limits**: When real APIs are connected

### Campaign Planner
1. **Invalid Dates**: End date before start date
2. **Date Range Too Large**: Campaign spans too long
3. **Missing Campaign**: Campaign deleted before planning

### Agent Tool Calls
1. **Invalid Tool Arguments**: LLM hallucinates wrong params
2. **Permission Errors**: User doesn't have access
3. **Validation Failures**: Date constraints, missing data
4. **Tool Execution Errors**: Underlying service fails

### Calendar Operations
1. **Invalid Scheduling**: Past dates, too far future
2. **Conflicting Posts**: Multiple posts at same time
3. **Missing Posts**: Post deleted during drag

### Edit Tracking
1. **Missing Original Caption**: Metadata not stored
2. **Large Diffs**: Very long captions cause performance issues
3. **Concurrent Edits**: Multiple edits at same time

