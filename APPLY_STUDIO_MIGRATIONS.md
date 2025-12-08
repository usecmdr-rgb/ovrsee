# Apply Studio Migrations

The errors you're seeing indicate that Studio tables haven't been created yet. To fix this:

## Option 1: Apply All Migrations (Recommended)

Run this command from the project root:

```bash
supabase db push
```

This will apply all pending migrations in `supabase/migrations/`, including the consolidated Studio migration.

## Option 2: Apply Just the Consolidated Migration

If you want to apply just the Studio tables migration:

1. Make sure you're linked to your Supabase project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

2. Apply the migration:
   ```bash
   supabase db push
   ```

## What Gets Created

The consolidated migration (`20250202000000_studio_all_tables_consolidated.sql`) creates:

- ✅ `studio_hashtags` & `studio_post_hashtags` (Hashtag Intelligence)
- ✅ `studio_reports` (Weekly Reports)
- ✅ Scoring fields on `studio_social_posts` (Performance Prediction)
- ✅ `studio_experiments` (A/B Testing)
- ✅ `studio_competitors` & `studio_competitor_metrics` (Competitor Tracking)
- ✅ `studio_ai_feedback_events` (Personalization)
- ✅ `studio_campaigns` (Campaign Planning)

All tables include proper RLS policies and indexes.

## Verify After Applying

After running `supabase db push`, refresh your Studio overview page. The errors should disappear and all features should work.
