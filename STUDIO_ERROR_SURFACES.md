# Studio Error Surfaces & Solutions

## Publish Service

### Platform API Failures
- **Error**: Instagram/TikTok/Facebook API returns error
- **Solution Pattern**:
  - **Retry**: Yes, with exponential backoff (3 attempts)
  - **User-facing**: "Failed to publish to [platform]. Please try again."
  - **Log**: Error level with platform, post ID, error code
  - **Agent explanation**: "I tried to publish your post but [platform] returned an error. You can retry from the calendar."

### Token Expiry
- **Error**: Access token expired during publish
- **Solution Pattern**:
  - **Retry**: Yes, after token refresh (1 attempt)
  - **User-facing**: "Your [platform] connection expired. Please reconnect in Settings."
  - **Log**: Warn level with platform, workspace ID
  - **Agent explanation**: "Your [platform] connection needs to be refreshed. Go to Settings → Social Accounts."

### Media Fetch Issues
- **Error**: Asset URL inaccessible or wrong format
- **Solution Pattern**:
  - **Retry**: No (permanent failure)
  - **User-facing**: "Media file not found. Please upload a new image/video."
  - **Log**: Error level with asset ID, post ID
  - **Agent explanation**: "The media file for this post couldn't be found. Please upload a new one."

## Metrics Refresh

### Rate Limits
- **Error**: Platform API rate limit hit
- **Solution Pattern**:
  - **Retry**: Yes, with exponential backoff (wait for reset window)
  - **User-facing**: "Metrics refresh delayed due to rate limits. Will retry automatically."
  - **Log**: Warn level with platform, reset time
  - **Agent explanation**: N/A (background job)

### Partial Failures
- **Error**: Some posts succeed, others fail
- **Solution Pattern**:
  - **Retry**: Yes, for failed posts only (next run)
  - **User-facing**: "Some metrics updated successfully. Others will retry automatically."
  - **Log**: Warn level with success/failure counts
  - **Agent explanation**: N/A (background job)

### Invalid Post IDs
- **Error**: External post ID doesn't exist on platform
- **Solution Pattern**:
  - **Retry**: No (post deleted on platform)
  - **User-facing**: N/A (background job)
  - **Log**: Warn level with post ID, platform
  - **Agent explanation**: N/A

## Planner

### LLM Errors
- **Error**: OpenAI API failure, timeout, rate limit
- **Solution Pattern**:
  - **Retry**: Yes, with exponential backoff (2 attempts)
  - **User-facing**: "Failed to generate plan. Please try again in a moment."
  - **Log**: Error level with workspace ID, error details
  - **Agent explanation**: "I had trouble generating your plan. Please try again."

### Schema Mismatch
- **Error**: LLM returns invalid JSON or missing fields
- **Solution Pattern**:
  - **Retry**: Yes, with more explicit prompt (1 attempt)
  - **User-facing**: "Plan generation failed. Please try again."
  - **Log**: Error level with raw LLM output, expected schema
  - **Agent explanation**: "I generated a plan but it wasn't in the right format. Let me try again."

### Bad Outputs
- **Error**: LLM generates posts with invalid dates/platforms
- **Solution Pattern**:
  - **Retry**: No (validate and filter invalid posts)
  - **User-facing**: "Plan generated with [X] posts. Some were filtered due to invalid data."
  - **Log**: Warn level with filtered post count, reasons
  - **Agent explanation**: "I created your plan, but had to skip some posts that had invalid dates."

## Repurposer

### LLM Errors
- **Error**: OpenAI API failure
- **Solution Pattern**:
  - **Retry**: Yes, with exponential backoff (2 attempts)
  - **User-facing**: "Failed to repurpose post. Please try again."
  - **Log**: Error level with source post ID
  - **Agent explanation**: "I couldn't repurpose that post. Please try again."

### Missing Source Posts
- **Error**: Source post deleted or not found
- **Solution Pattern**:
  - **Retry**: No (permanent failure)
  - **User-facing**: "Source post not found. It may have been deleted."
  - **Log**: Error level with source post ID
  - **Agent explanation**: "I couldn't find the original post. It may have been deleted."

## Competitor Fetch

### Unsupported Handles
- **Error**: Competitor handle doesn't exist on platform
- **Solution Pattern**:
  - **Retry**: No (invalid handle)
  - **User-facing**: "Competitor handle '@[handle]' not found on [platform]."
  - **Log**: Warn level with handle, platform
  - **Agent explanation**: "That competitor handle doesn't exist on [platform]."

### API Stubs
- **Error**: Real API not implemented (currently stubbed)
- **Solution Pattern**:
  - **Retry**: No (not implemented)
  - **User-facing**: "Competitor metrics not available yet. Coming soon."
  - **Log**: Info level (expected behavior)
  - **Agent explanation**: "Competitor tracking is coming soon."

## Campaign Planner

### Invalid Dates
- **Error**: End date before start date
- **Solution Pattern**:
  - **Retry**: No (validation error)
  - **User-facing**: "Campaign end date must be after start date."
  - **Log**: Warn level with dates
  - **Agent explanation**: "The campaign dates are invalid. End date must be after start date."

## Agent

### Invalid Tool Calls
- **Error**: LLM calls tool with wrong parameters
- **Solution Pattern**:
  - **Retry**: Yes, with corrected prompt (1 attempt)
  - **User-facing**: "I had trouble with that request. Let me try again."
  - **Log**: Warn level with tool name, invalid params
  - **Agent explanation**: "I misunderstood. Let me try that again."

### LLM Hallucinations
- **Error**: LLM makes up data or calls non-existent tools
- **Solution Pattern**:
  - **Retry**: No (filter invalid calls)
  - **User-facing**: "I couldn't complete that request. Please try rephrasing."
  - **Log**: Warn level with hallucination details
  - **Agent explanation**: "I'm not sure how to do that. Could you rephrase?"

### Bad User Input
- **Error**: User provides invalid input (e.g., past dates)
- **Solution Pattern**:
  - **Retry**: No (user error)
  - **User-facing**: "I can't schedule posts in the past. Please choose a future date."
  - **Log**: Info level (user error, not system error)
  - **Agent explanation**: "I can't do that because [reason]. Here's what I can do instead..."

## Calendar

### Invalid Scheduling
- **Error**: User tries to schedule in past or too far future
- **Solution Pattern**:
  - **Retry**: No (validation error)
  - **User-facing**: "Cannot schedule posts in the past or more than 3 months ahead."
  - **Log**: Info level (user error)
  - **Agent explanation**: "I can only schedule posts for the next 3 months."

## Edit Tracking

### Failure to Load Old Caption
- **Error**: Original caption not in metadata
- **Solution Pattern**:
  - **Retry**: No (missing data)
  - **User-facing**: N/A (background tracking)
  - **Log**: Warn level with post ID
  - **Agent explanation**: N/A

### Large Diffs
- **Error**: Very long captions cause performance issues
- **Solution Pattern**:
  - **Retry**: No (truncate for comparison)
  - **User-facing**: N/A (background tracking)
  - **Log**: Info level (expected for long content)
  - **Agent explanation**: N/A

## General Patterns

### Retry Strategy
- **Transient errors** (network, rate limits): Exponential backoff, max 3 attempts
- **Permanent errors** (invalid data, missing resources): No retry
- **LLM errors**: Retry with more explicit prompt, max 2 attempts

### User-Facing Messages
- **Be specific**: Mention platform, action, and next steps
- **Be helpful**: Suggest what user can do
- **Be concise**: One sentence when possible

### Logging Levels
- **Error**: System failures, unexpected errors
- **Warn**: Recoverable issues, validation failures
- **Info**: Normal operations, user actions

### Agent Explanations
- **Be conversational**: Use "I" language
- **Be helpful**: Suggest alternatives
- **Be honest**: Admit when something went wrong

