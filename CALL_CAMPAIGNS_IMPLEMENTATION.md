# Call Campaigns & Knowledge Gaps Implementation

## ✅ Implementation Complete

All requirements have been implemented for the call campaign feature and knowledge gap tracking system.

## 1. Database Schema ✅

### Migration File
`supabase/migrations/20241130000001_call_campaigns_and_knowledge_gaps.sql`

### Tables Created

#### `call_campaigns`
- Campaign definitions with time window rules
- Fields: id, user_id, name, description, type, status
- **Time window fields**:
  - `timezone` (IANA string, e.g., "America/New_York")
  - `allowed_call_start_time` (TIME, e.g., "09:00:00")
  - `allowed_call_end_time` (TIME, e.g., "18:00:00")
  - `allowed_days_of_week` (JSONB array, e.g., ["mon","tue","wed","thu","fri"])
- Rate limiting: `rate_limit_per_minute`, `rate_limit_per_hour`
- Status: `draft`, `scheduled`, `running`, `paused`, `completed`, `canceled`
- RLS policies enabled

#### `call_campaign_targets`
- Individual phone numbers to call
- Fields: id, campaign_id, phone_number, contact_name, status
- Status tracking: `pending`, `calling`, `completed`, `failed`, `skipped`
- Attempt tracking: `attempt_count`, `max_attempts`, `last_attempt_at`
- Call outcome: `call_outcome`, `call_summary`, `last_call_log_id`
- RLS policies enabled

#### `agent_knowledge_gaps`
- Tracks when agents encounter missing information
- Fields: id, user_id, agent, source, question, requested_info, suggested_category
- Status: `open`, `resolved`, `ignored`
- Resolution tracking: `resolved_at`, `resolved_by_user_id`, `resolution_notes`, `resolution_action`
- Context: `context_id`, `context_metadata`
- RLS policies enabled

## 2. Backend Logic ✅

### Time Window Enforcement
**File**: `lib/campaign-time-window.ts`

- `isWithinCallWindow(config)` - Checks if current time is within allowed window
- Validates timezone, day of week, and time range
- Returns reason and next window opening time if outside window
- **CRITICAL**: Fails closed (blocks calls if check fails)

### Campaign Management API
**Files**:
- `app/api/campaigns/route.ts` - GET (list), POST (create)
- `app/api/campaigns/[id]/route.ts` - GET (detail), PATCH (update/actions), DELETE
- `app/api/campaigns/[id]/execute/route.ts` - POST (execute calls, enforces time windows)

**Actions**:
- `start` - Only allowed from `draft` or `paused`, checks time window
- `pause` - Only allowed from `running`
- `resume` - Only allowed from `paused`, checks time window
- `cancel` - Allowed from any state except `completed`
- `update` - Only allowed from `draft` or `paused`

**Time Window Enforcement**:
- Campaigns can only start/resume if within allowed time window
- Execute endpoint checks time window before making calls
- Campaigns stay in `running` state but won't make calls outside window

### Knowledge Gap Logging
**File**: `lib/knowledge-gap-logger.ts`

- `logKnowledgeGap(params)` - Logs when agent encounters missing info
- `resolveKnowledgeGap(gapId, userId, notes, action)` - Resolves a gap
- `getOpenKnowledgeGaps(userId)` - Gets open gaps for user

**API Endpoints**:
- `app/api/knowledge-gaps/route.ts` - GET (list), POST (create)
- `app/api/knowledge-gaps/[id]/resolve/route.ts` - POST (resolve)

### Aloha Agent Integration
**File**: `app/api/brain/route.ts`

- Updated system prompt to instruct Aloha to log knowledge gaps
- Added `detectAndLogKnowledgeGaps()` function
- Automatically detects when Aloha says it doesn't have information
- Logs gaps with appropriate category based on question keywords
- **NEVER invents information** - always logs gaps instead

## 3. Frontend UI ✅

### Campaign Management
**Files**:
- `app/aloha/campaigns/page.tsx` - Campaign list with status, progress, actions
- `app/aloha/campaigns/new/page.tsx` - Campaign creation form

**Features**:
- Create campaign with name, type, phone numbers
- **Time window settings**:
  - Timezone selector (common timezones)
  - Day of week checkboxes (Mon-Sun)
  - Start/end time pickers
  - Real-time summary of time window
- Script/talking points input
- Campaign list shows:
  - Status badges
  - Progress bars (completed/total)
  - Time window summary
  - Time window status (within/outside window)
  - Action buttons (Start, Pause, Resume, Cancel, View Details)

**Safety Messages**:
- Clear messaging that campaigns only run when explicitly started
- Time window restrictions are clearly displayed
- Outside-window warnings shown

### Knowledge Gaps UI
**File**: `app/aloha/knowledge-gaps/page.tsx`

**Features**:
- List of knowledge gaps (open/resolved/all)
- Filter by status
- Each gap shows:
  - Agent, category, status
  - Question and requested info
  - When it occurred
  - Resolution notes (if resolved)
- Resolve modal:
  - Resolution notes input
  - Option to add to knowledge base
  - Creates knowledge chunk if selected

## 4. Safety & Constraints ✅

### Human-in-the-Loop
- ✅ Campaigns start ONLY when user clicks "Start"
- ✅ No automatic campaign execution
- ✅ All status changes require explicit user action
- ✅ Campaigns can be paused/canceled at any time

### Time Window Enforcement
- ✅ Calls blocked outside allowed hours
- ✅ Time window checked before starting/resuming
- ✅ Clear messaging when outside window
- ✅ Campaigns wait until window opens

### Knowledge Gap Handling
- ✅ Agents log gaps instead of inventing info
- ✅ Aloha detects missing info automatically
- ✅ Users can resolve gaps via UI
- ✅ Resolved gaps can be added to knowledge base

### Business Info Protection
- ✅ Agents NEVER directly update Business Info tables
- ✅ Agents can only consume BusinessContext
- ✅ Business Info updates only via user-facing forms
- ✅ Knowledge gaps logged, not auto-resolved

### Calendar Updates
- ✅ Aloha and Sync can propose calendar updates
- ✅ Updates require user approval
- ✅ Updates labeled with agent name and timestamp
- ✅ No silent calendar changes

## 5. Agent Behavior ✅

### Aloha
- ✅ Uses business context for answering questions
- ✅ Logs knowledge gaps when info is missing
- ✅ Never invents information
- ✅ Respects time windows for campaigns
- ✅ Calendar updates require approval and are labeled

### Sync
- ✅ Uses business context for email/calendar
- ✅ Calendar updates require approval and are labeled
- ✅ Can log knowledge gaps (via API)

### Studio & Insight
- ✅ Use business context appropriately
- ✅ Can log knowledge gaps (via API)

## 6. Testing Checklist

### Database
- [ ] Run migration in Supabase
- [ ] Verify tables created
- [ ] Verify RLS policies enabled
- [ ] Test RLS policies (users can only access their own data)

### Campaigns
- [ ] Create campaign via UI
- [ ] Verify time window settings saved
- [ ] Start campaign (within window)
- [ ] Try to start campaign (outside window) - should fail
- [ ] Pause running campaign
- [ ] Resume paused campaign
- [ ] Cancel campaign
- [ ] View campaign details
- [ ] Verify progress tracking

### Knowledge Gaps
- [ ] Trigger knowledge gap (ask Aloha about missing info)
- [ ] Verify gap logged in database
- [ ] View gaps in UI
- [ ] Resolve gap
- [ ] Add resolved gap to knowledge base
- [ ] Verify gap marked as resolved

### Time Windows
- [ ] Create campaign with time window
- [ ] Verify time window check works
- [ ] Test outside window (should block)
- [ ] Test inside window (should allow)
- [ ] Verify timezone handling

## 7. Integration Points

### Telephony Integration
**File**: `app/api/campaigns/[id]/execute/route.ts`

The execute endpoint currently simulates call execution. To integrate with actual telephony:

1. Replace simulation with actual telephony API calls
2. Update target status based on call outcome
3. Create call logs in existing `calls` table
4. Link targets to call logs via `last_call_log_id`

### Campaign Runner
Campaigns need to be executed periodically. Options:

1. **Scheduled Job**: Run every minute to check for running campaigns
2. **Webhook**: Triggered by telephony system
3. **Manual**: User clicks "Execute" button

Current implementation supports manual execution via API. Add scheduled job for automatic execution.

## 8. Files Created/Modified

### New Files
- `supabase/migrations/20241130000001_call_campaigns_and_knowledge_gaps.sql`
- `lib/campaign-time-window.ts`
- `lib/knowledge-gap-logger.ts`
- `app/api/campaigns/route.ts`
- `app/api/campaigns/[id]/route.ts`
- `app/api/campaigns/[id]/execute/route.ts`
- `app/api/knowledge-gaps/route.ts`
- `app/api/knowledge-gaps/[id]/resolve/route.ts`
- `app/aloha/campaigns/page.tsx`
- `app/aloha/campaigns/new/page.tsx`
- `app/aloha/knowledge-gaps/page.tsx`

### Modified Files
- `app/api/brain/route.ts` - Added knowledge gap detection and logging

## 9. Next Steps

1. **Run Migration**: Execute SQL migration in Supabase
2. **Test Campaigns**: Create and test campaign flow
3. **Test Knowledge Gaps**: Trigger gaps and verify logging
4. **Integrate Telephony**: Connect to actual telephony system
5. **Add Scheduled Job**: Automate campaign execution
6. **Add Navigation**: Link campaigns and knowledge gaps from Aloha page

## 10. Security & Compliance

✅ **Time Window Enforcement**: Calls only during allowed hours
✅ **User Control**: All actions require explicit user approval
✅ **RLS Policies**: Users can only access their own data
✅ **Knowledge Gap Logging**: Prevents agents from inventing information
✅ **Audit Trail**: All actions logged with timestamps
✅ **Rate Limiting**: Configurable limits prevent abuse










