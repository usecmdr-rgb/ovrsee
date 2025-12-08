# Studio Agent Tool-Using Operator Implementation Summary

## Overview

Upgraded the Studio Agent from a conversational assistant to a tool-using operator that can perform actual operations: creating posts, scheduling content, repurposing posts, and generating weekly plans.

## What Changed

### 1. API Inventory

**Document**: `STUDIO_AGENT_API_INVENTORY.md`

Created comprehensive inventory of Studio APIs:

- **Post Management**:
  - `POST /api/studio/posts` - Create posts
  - `PATCH /api/studio/posts/[postId]` - Update posts
  - `GET /api/studio/posts` - List posts

- **Calendar**:
  - `GET /api/studio/calendar` - Get posts for date range

- **Repurposing**:
  - `POST /api/studio/repurpose` - Repurpose posts to other platforms

- **Weekly Planning**:
  - `POST /api/studio/plans/weekly` - Generate weekly content plan

- **Social Accounts**:
  - `GET /api/studio/social/status` - Get connected accounts

### 2. Agent Tools

**File**: `lib/studio/agent-tools.ts`

Created tool functions that wrap existing APIs:

- **`createDraftPost(workspaceId, userId, args)`**:
  - Creates draft or scheduled post
  - Validates social account exists
  - Validates date range (not past, not >3 months future)
  - Parses and stores hashtags
  - Returns structured result

- **`schedulePost(workspaceId, args)`**:
  - Schedules or reschedules existing post
  - Validates date range
  - Verifies post belongs to workspace
  - Updates post status to "scheduled"

- **`movePostOnCalendar(workspaceId, args)`**:
  - Moves post to new date (sets time to noon)
  - Validates date range
  - Verifies workspace ownership

- **`repurposePost(workspaceId, userId, args)`**:
  - Repurposes source post to target platforms
  - Filters out source platform
  - Creates draft posts with repurposed content
  - Links posts via content_group_id
  - Parses hashtags

- **`generateWeeklyPlan(workspaceId, userId, args)`**:
  - Generates weekly content plan
  - Creates draft posts for the week
  - Uses brand profile, metrics, and hashtag intelligence
  - Checks for existing posts (prevents duplicates)
  - Returns created post IDs

- **`logToolCall(workspaceId, userId, toolName, args, result)`**:
  - Logs all tool calls for auditing
  - Currently logs to console
  - TODO: Store in database table

**Tool Results**:
All tools return `ToolResult` with:
- `success`: boolean
- `message`: Human-readable message
- `data`: Structured data (post IDs, etc.)
- `error`: Error code if failed

### 3. Updated Agent Prompt & Logic

**File**: `app/api/studio/agent/chat/route.ts` (completely rewritten)

**Key Changes**:

1. **Tool Definitions**:
   - Defined 5 tools using OpenAI function calling format
   - Each tool has name, description, and parameter schema
   - Tools are passed to LLM via `tools` parameter

2. **System Prompt Updates**:
   - Explains available tools and when to use them
   - Provides examples: "Create a post" → use createDraftPost
   - Emphasizes brand profile adherence
   - Instructs to summarize actions taken

3. **Tool Calling Logic**:
   - Uses OpenAI's `tool_choice: "auto"` to let model decide
   - Handles multiple tool calls in sequence
   - Executes tools and adds results to conversation
   - Continues until model provides final answer
   - Supports conversation history for context

4. **Response Format**:
   - Returns `answer` (final LLM response)
   - Returns `actions_taken` (array of tool results)
   - Returns `links` (helpful navigation links)

### 4. Guardrails

**Date Validation**:
- Cannot schedule posts in the past
- Cannot schedule posts more than 3 months in advance
- Validates dates in all scheduling tools

**Workspace Validation**:
- All tools verify workspace ownership
- Posts must belong to workspace before updating
- Social accounts must be connected before creating posts

**Error Handling**:
- All tool calls wrapped in try-catch
- Errors are logged and returned to user
- Agent explains errors clearly
- No silent failures

**Audit Logging**:
- All tool calls logged with:
  - Workspace ID
  - User ID
  - Tool name
  - Arguments
  - Result (success/failure)
  - Timestamp

**Mass Operations Prevention**:
- Weekly planner checks for existing posts (prevents duplicates)
- Can be overridden with `avoid_duplicates: false`
- No bulk delete operations (not implemented)

### 5. UX Updates

**File**: `components/studio/StudioIntelligence.tsx` (modified)

**Changes**:

1. **Actions Display**:
   - Shows "Actions Taken" section when tools are used
   - Displays success/failure status for each action
   - Shows tool name and result message
   - Includes post IDs or counts when relevant

2. **Navigation Links**:
   - Shows "View in Calendar" button when posts are created
   - Links appear after actions are taken
   - Clickable buttons to navigate to relevant pages

3. **Visual Feedback**:
   - Green background for successful actions
   - Red background for failed actions
   - Icons (CheckCircle) for visual clarity
   - Clear separation between answer and actions

## Files Created

1. `STUDIO_AGENT_API_INVENTORY.md` - API inventory document
2. `lib/studio/agent-tools.ts` - Tool functions
3. `STUDIO_AGENT_TOOLS_IMPLEMENTATION_SUMMARY.md` - This file

## Files Modified

1. `app/api/studio/agent/chat/route.ts` - Complete rewrite with tool calling
2. `components/studio/StudioIntelligence.tsx` - Added actions display and links

## Tool Definitions

### createDraftPost

**When to use**: User wants to create a new post

**Parameters**:
- `platform` (required): instagram | tiktok | facebook
- `caption` (required): Post caption
- `scheduled_for` (optional): ISO timestamp
- `asset_id` (optional): Existing asset ID
- `media_url` (optional): Media URL
- `media_type` (optional): image | video

**Example**:
```json
{
  "platform": "instagram",
  "caption": "Check out our new product! #newproduct #launch",
  "scheduled_for": "2024-01-20T10:00:00Z"
}
```

### schedulePost

**When to use**: User wants to schedule an existing post

**Parameters**:
- `post_id` (required): Post ID
- `scheduled_for` (required): ISO timestamp

**Example**:
```json
{
  "post_id": "uuid",
  "scheduled_for": "2024-01-20T14:00:00Z"
}
```

### movePostOnCalendar

**When to use**: User wants to move a post to a different date

**Parameters**:
- `post_id` (required): Post ID
- `new_date` (required): ISO date string

**Example**:
```json
{
  "post_id": "uuid",
  "new_date": "2024-01-25"
}
```

### repurposePost

**When to use**: User wants to repurpose a post to other platforms

**Parameters**:
- `source_post_id` (required): Source post ID
- `target_platforms` (required): Array of platforms
- `scheduled_for` (optional): ISO timestamp

**Example**:
```json
{
  "source_post_id": "uuid",
  "target_platforms": ["tiktok", "facebook"]
}
```

### generateWeeklyPlan

**When to use**: User asks to plan posts for a week

**Parameters**:
- `week_start` (optional): ISO date
- `preferences` (optional): User preferences object

**Example**:
```json
{
  "week_start": "2024-01-15",
  "preferences": {
    "desired_cadence": { "instagram": 5, "tiktok": 3 },
    "preferred_days": ["Monday", "Wednesday", "Friday"]
  }
}
```

## Example User Journeys

### Journey 1: "Create a post for Instagram"

1. User: "Create an Instagram post about our new product launch"
2. Agent calls `createDraftPost` with:
   - platform: "instagram"
   - caption: Generated based on brand profile
3. Tool returns: Success, post created
4. Agent responds: "I've created a draft Instagram post about your new product launch. The post is ready for you to review and schedule. [View in Calendar]"

### Journey 2: "Plan my posts for next week"

1. User: "Plan my posts for next week"
2. Agent calls `generateWeeklyPlan` with:
   - week_start: Next Monday
   - preferences: None (uses defaults)
3. Tool returns: Success, 7 posts created
4. Agent responds: "I've generated a weekly plan for next week with 7 draft posts distributed across your connected platforms. The posts are scheduled based on your best-performing times. [View in Calendar]"

### Journey 3: "Repurpose this post to TikTok"

1. User: "Repurpose this post to TikTok" (with post selected)
2. Agent calls `repurposePost` with:
   - source_post_id: Selected post ID
   - target_platforms: ["tiktok"]
3. Tool returns: Success, TikTok post created
4. Agent responds: "I've repurposed your post for TikTok. The content has been adapted for TikTok's format with a video script and optimized caption. [View in Calendar]"

### Journey 4: "Move this post to Friday"

1. User: "Move this post to Friday"
2. Agent calls `movePostOnCalendar` with:
   - post_id: Selected post ID
   - new_date: Next Friday
3. Tool returns: Success, post moved
4. Agent responds: "I've moved the post to Friday, January 26th at 12:00 PM. [View in Calendar]"

## Guardrails Implemented

### Date Validation
- ✅ Cannot schedule in past
- ✅ Cannot schedule >3 months in advance
- ✅ Validates in all scheduling tools

### Workspace Security
- ✅ All tools verify workspace ownership
- ✅ Posts must belong to workspace
- ✅ Social accounts must be connected

### Error Handling
- ✅ All tool calls wrapped in try-catch
- ✅ Errors logged and returned
- ✅ Agent explains errors clearly
- ✅ No silent failures

### Audit Logging
- ✅ All tool calls logged
- ✅ Includes workspace, user, tool, args, result
- ✅ Timestamped

### Mass Operations
- ✅ Weekly planner checks for duplicates
- ✅ No bulk delete operations
- ✅ Limits on batch operations

## UI Enhancements

### Actions Display
- Shows when tools are executed
- Displays success/failure status
- Includes post IDs and counts
- Color-coded (green/red)

### Navigation Links
- "View in Calendar" after post creation
- Links to relevant pages
- Clickable buttons

### Visual Feedback
- Clear separation of answer vs actions
- Icons for visual clarity
- Responsive design

## Prompt Structure

### System Prompt
```
You are the Studio Agent, an intelligent social media assistant that can help users create, schedule, and manage their content.

OPERATIONAL CAPABILITIES:
You have access to tools that allow you to:
1. createDraftPost - Create new draft posts
2. schedulePost - Schedule existing posts
3. movePostOnCalendar - Move posts to different dates
4. repurposePost - Repurpose posts to other platforms
5. generateWeeklyPlan - Generate weekly content plans

When users ask you to:
- "Create a post" → Use createDraftPost
- "Schedule this post" → Use schedulePost
- "Move this post to Friday" → Use movePostOnCalendar
- "Repurpose this to TikTok" → Use repurposePost
- "Plan my posts for next week" → Use generateWeeklyPlan

IMPORTANT RULES:
- Always validate that social accounts are connected
- Never schedule posts more than 3 months in advance
- Never schedule posts in the past
- If a tool call fails, explain the error clearly
- After performing actions, summarize what you did
- Include links to where users can view results
```

### Tool Calling Flow

1. User sends message
2. LLM analyzes intent
3. LLM decides to call tool(s)
4. Tools execute
5. Results added to conversation
6. LLM generates final answer
7. Response includes answer + actions + links

## Error Scenarios

### No Connected Account
- Tool returns: `{ success: false, error: "NO_ACCOUNT", message: "No connected instagram account found..." }`
- Agent explains: "I can't create an Instagram post because you don't have an Instagram account connected. Please connect your account first."

### Invalid Date
- Tool returns: `{ success: false, error: "INVALID_DATE", message: "Cannot schedule posts in the past" }`
- Agent explains: "I can't schedule that post because the date is in the past. Please provide a future date."

### Post Not Found
- Tool returns: `{ success: false, error: "NOT_FOUND", message: "Post not found" }`
- Agent explains: "I couldn't find that post. It may have been deleted or doesn't belong to your workspace."

## Follow-up Ideas

### Short-term Enhancements

1. **Tool Call History**:
   - Store tool calls in database
   - Show history in UI
   - Allow undo/redo

2. **Confirmation for Destructive Operations**:
   - Ask for confirmation before bulk operations
   - "Are you sure you want to delete 10 posts?"

3. **Better Error Messages**:
   - More specific error explanations
   - Suggestions for fixing errors
   - Links to relevant settings

### Medium-term Enhancements

1. **More Tools**:
   - `deletePost` - Delete a post
   - `updatePostCaption` - Update post caption
   - `publishPostNow` - Publish immediately
   - `getPostMetrics` - Fetch post performance

2. **Batch Operations**:
   - Create multiple posts at once
   - Schedule multiple posts
   - Bulk repurpose

3. **Smart Suggestions**:
   - Suggest actions based on context
   - "I notice you haven't posted this week. Would you like me to generate a plan?"

### Long-term Vision

1. **Autonomous Operations**:
   - Agent can act proactively
   - Auto-generate content when needed
   - Auto-schedule based on performance

2. **Learning from Actions**:
   - Learn user preferences
   - Improve suggestions over time
   - Personalize tool usage

3. **Multi-step Workflows**:
   - "Create a post, schedule it for Friday, and repurpose it to TikTok"
   - Complex multi-tool operations
   - Workflow orchestration

## Testing Recommendations

1. **Unit Tests**:
   - Test each tool function
   - Test date validation
   - Test error handling

2. **Integration Tests**:
   - Test full tool calling flow
   - Test with various user intents
   - Test error scenarios

3. **E2E Tests**:
   - Test complete user journeys
   - Test UI updates
   - Test navigation links

## Security Considerations

- All tools verify workspace ownership
- User authentication required
- Tool calls logged for auditing
- No cross-workspace access
- Date validation prevents abuse

## Next Steps

1. **Test the implementation**:
   - Try various user intents
   - Verify tool execution
   - Check error handling

2. **Monitor tool usage**:
   - Track which tools are used most
   - Identify common errors
   - Refine prompts based on usage

3. **Add more tools**:
   - Implement additional operations
   - Expand agent capabilities
   - Improve user experience

4. **Enhance UI**:
   - Better action display
   - More navigation options
   - Action history view

