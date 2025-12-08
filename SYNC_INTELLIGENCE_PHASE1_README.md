# Sync Intelligence Phase 1 Implementation

## Overview

Phase 1 implements automatic background processing for email intelligence:
- Automatic email classification
- Appointment detection
- Task and reminder extraction

All processing is controlled by the `SYNC_INTELLIGENCE_ENABLED` feature flag.

## Database Migrations

Run these migrations in order:

1. `20250123000000_add_sync_intelligence_schema.sql`
   - Adds processing status fields to `email_queue`
   - Creates `email_appointments`, `email_tasks`, `email_reminders`, `user_sync_preferences` tables

2. `20250123000001_consolidate_sync_email_messages.sql`
   - Backfills data from `sync_email_messages` to `email_queue`
   - Marks `sync_email_messages` as deprecated

## Environment Variables

Add to your `.env.local`:

```bash
# Enable Sync Intelligence features
SYNC_INTELLIGENCE_ENABLED=true

# Optional: Configure batch processing
SYNC_CLASSIFICATION_BATCH_SIZE=50
SYNC_CLASSIFICATION_MAX_RETRIES=3
SYNC_CLASSIFICATION_INTERVAL_MINUTES=2

# Optional: Secret token for job endpoint (for cron/webhooks)
SYNC_JOB_SECRET_TOKEN=your-secret-token-here
```

## Background Jobs

### Manual Trigger

Call the job endpoint manually:

```bash
# With authentication
curl -X POST http://localhost:3000/api/sync/jobs/process-intelligence \
  -H "Authorization: Bearer YOUR_TOKEN"

# With secret token (if configured)
curl -X POST "http://localhost:3000/api/sync/jobs/process-intelligence?token=your-secret-token"
```

### Scheduled Jobs (Cron)

Set up a cron job to run every 2 minutes:

```bash
# Example cron entry
*/2 * * * * curl -X POST "https://your-domain.com/api/sync/jobs/process-intelligence?token=your-secret-token"
```

Or use a service like Vercel Cron, GitHub Actions, or a dedicated job runner.

## Processing Flow

1. **Email Arrival**: Gmail sync stores emails with `classification_status = 'pending'`
2. **Classification Job**: Processes emails with `classification_status = 'pending'`
   - Calls OpenAI to classify email
   - Updates `category` and `classification_status = 'completed'`
3. **Appointment Detection Job**: Processes classified emails
   - Detects appointments with confidence >= 0.7
   - Stores in `email_appointments` table
   - Updates `has_appointment = true`
4. **Task Extraction Job**: Processes important/missed emails
   - Extracts tasks and reminders
   - Stores in `email_tasks` and `email_reminders` tables
   - Updates `has_tasks = true`

## API Endpoints

### Get Email Intent Metadata

```bash
GET /api/sync/email/[id]/intent
```

Returns:
- Email classification info
- Appointment data (if detected)
- Tasks (if extracted)
- Reminders (if extracted)

### Process Intelligence Jobs

```bash
POST /api/sync/jobs/process-intelligence
```

Runs all intelligence jobs:
- Classification
- Appointment detection
- Task extraction

## Code Structure

```
lib/sync/
├── featureFlags.ts              # Feature flag and config
├── classifyEmail.ts             # Existing classification (reused)
├── detectAppointment.ts         # NEW: Appointment detection AI
├── extractTasks.ts              # NEW: Task extraction AI
└── jobs/
    ├── classifyEmailsJob.ts     # Classification job processor
    ├── detectAppointmentsJob.ts  # Appointment detection job
    ├── extractTasksJob.ts        # Task extraction job
    └── processEmailIntelligence.ts # Orchestrator

app/api/sync/
├── jobs/
│   └── process-intelligence/route.ts  # Job endpoint
└── email/
    └── [id]/
        └── intent/route.ts      # Intent metadata API
```

## Database Schema

### email_queue (updated)
- `classification_status`: 'pending' | 'processing' | 'completed' | 'failed'
- `classification_attempted_at`: timestamp
- `has_appointment`: boolean
- `appointment_detected_at`: timestamp
- `has_tasks`: boolean
- `tasks_detected_at`: timestamp

### email_appointments (new)
- Stores detected appointments with date, time, location, attendees
- Links to `email_queue` via `email_id`

### email_tasks (new)
- Stores extracted tasks with due dates, priorities
- Links to `email_queue` via `email_id`

### email_reminders (new)
- Stores reminders with `remind_at` timestamps
- Links to `email_queue` and optionally `email_tasks`

## Testing

### Manual Testing

1. Enable feature flag: `SYNC_INTELLIGENCE_ENABLED=true`
2. Sync some emails via Gmail sync
3. Call job endpoint: `POST /api/sync/jobs/process-intelligence`
4. Check database:
   ```sql
   -- Check classification
   SELECT id, category, classification_status FROM email_queue WHERE classification_status = 'completed';
   
   -- Check appointments
   SELECT * FROM email_appointments;
   
   -- Check tasks
   SELECT * FROM email_tasks;
   ```

### Unit Tests (Future)

Tests should mock OpenAI API calls:
- `lib/sync/__tests__/detectAppointment.test.ts`
- `lib/sync/__tests__/extractTasks.test.ts`
- `lib/sync/jobs/__tests__/classifyEmailsJob.test.ts`

## Monitoring

Check logs for:
- `[ClassifyEmailsJob]` - Classification processing
- `[DetectAppointmentsJob]` - Appointment detection
- `[ExtractTasksJob]` - Task extraction
- `[ProcessEmailIntelligence]` - Overall orchestration

## Troubleshooting

### Jobs not running
- Check `SYNC_INTELLIGENCE_ENABLED=true`
- Verify job endpoint is accessible
- Check database for `classification_status = 'pending'` emails

### Classification failing
- Check OpenAI API key is set
- Verify API rate limits
- Check error logs for specific failures

### Duplicate processing
- Database-level locks prevent duplicates
- Check `classification_status` field is being updated atomically

## Next Steps (Phase 2+)

- UI integration for displaying appointments/tasks
- Draft mode triggers for calendar/task creation
- Reminder notification system
- Webhook infrastructure for real-time processing


