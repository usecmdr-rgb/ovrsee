-- ============================================================================
-- Migration: 20250202000000_studio_all_tables_consolidated.sql
-- ============================================================================
-- Consolidated Studio tables migration
-- 
-- This ensures all Studio feature tables exist:
-- 1. Hashtags (studio_hashtags, studio_post_hashtags)
-- 2. Reports (studio_reports)
-- 3. Scoring (predicted_score fields on studio_social_posts)
-- 4. Experiments (studio_experiments)
-- 5. Competitors (studio_competitors, studio_competitor_metrics)
-- 6. Personalization (studio_ai_feedback_events)
-- 7. Campaigns (studio_campaigns)
-- ============================================================================

-- ============================================================================
-- 1. HASHTAGS TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_hashtag_per_workspace UNIQUE (workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_studio_hashtags_workspace_id ON public.studio_hashtags (workspace_id);
CREATE INDEX IF NOT EXISTS idx_studio_hashtags_name ON public.studio_hashtags (name);

CREATE TABLE IF NOT EXISTS public.studio_post_hashtags (
  post_id UUID NOT NULL REFERENCES public.studio_social_posts(id) ON DELETE CASCADE,
  hashtag_id UUID NOT NULL REFERENCES public.studio_hashtags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, hashtag_id)
);

CREATE INDEX IF NOT EXISTS idx_studio_post_hashtags_post_id ON public.studio_post_hashtags (post_id);
CREATE INDEX IF NOT EXISTS idx_studio_post_hashtags_hashtag_id ON public.studio_post_hashtags (hashtag_id);

ALTER TABLE public.studio_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_post_hashtags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view their hashtags" ON public.studio_hashtags;
CREATE POLICY "Workspace members can view their hashtags" ON public.studio_hashtags
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_hashtags.workspace_id
    )
  );

DROP POLICY IF EXISTS "Workspace members can insert their hashtags" ON public.studio_hashtags;
CREATE POLICY "Workspace members can insert their hashtags" ON public.studio_hashtags
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_hashtags.workspace_id
    )
  );

DROP POLICY IF EXISTS "Workspace members can update their hashtags" ON public.studio_hashtags;
CREATE POLICY "Workspace members can update their hashtags" ON public.studio_hashtags
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_hashtags.workspace_id
    )
  );

DROP POLICY IF EXISTS "Workspace members can view their post hashtags" ON public.studio_post_hashtags;
CREATE POLICY "Workspace members can view their post hashtags" ON public.studio_post_hashtags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.studio_social_posts p
      WHERE p.id = public.studio_post_hashtags.post_id
        AND auth.uid() IN (
          SELECT user_id FROM public.workspace_members 
          WHERE workspace_id = p.workspace_id
        )
    )
  );

DROP POLICY IF EXISTS "Workspace members can insert their post hashtags" ON public.studio_post_hashtags;
CREATE POLICY "Workspace members can insert their post hashtags" ON public.studio_post_hashtags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.studio_social_posts p
      WHERE p.id = public.studio_post_hashtags.post_id
        AND auth.uid() IN (
          SELECT user_id FROM public.workspace_members 
          WHERE workspace_id = p.workspace_id
        )
    )
  );

DROP POLICY IF EXISTS "Workspace members can delete their post hashtags" ON public.studio_post_hashtags;
CREATE POLICY "Workspace members can delete their post hashtags" ON public.studio_post_hashtags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.studio_social_posts p
      WHERE p.id = public.studio_post_hashtags.post_id
        AND auth.uid() IN (
          SELECT user_id FROM public.workspace_members 
          WHERE workspace_id = p.workspace_id
        )
    )
  );

CREATE OR REPLACE FUNCTION update_hashtag_last_used()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.studio_hashtags
  SET last_used_at = NOW()
  WHERE id = NEW.hashtag_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_hashtag_last_used ON public.studio_post_hashtags;
CREATE TRIGGER trigger_update_hashtag_last_used
  AFTER INSERT ON public.studio_post_hashtags
  FOR EACH ROW
  EXECUTE FUNCTION update_hashtag_last_used();

-- ============================================================================
-- 2. REPORTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  summary_markdown TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT unique_workspace_period UNIQUE (workspace_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_studio_reports_workspace_id ON public.studio_reports (workspace_id);
CREATE INDEX IF NOT EXISTS idx_studio_reports_period ON public.studio_reports (workspace_id, period_start DESC, period_end DESC);

ALTER TABLE public.studio_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view their reports" ON public.studio_reports;
CREATE POLICY "Workspace members can view their reports" ON public.studio_reports
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_reports.workspace_id
    )
  );

DROP POLICY IF EXISTS "Workspace members can insert their reports" ON public.studio_reports;
CREATE POLICY "Workspace members can insert their reports" ON public.studio_reports
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_reports.workspace_id
    )
  );

-- ============================================================================
-- 3. SCORING FIELDS (on studio_social_posts)
-- ============================================================================

ALTER TABLE public.studio_social_posts
  ADD COLUMN IF NOT EXISTS predicted_score_label TEXT
    CONSTRAINT studio_social_posts_score_label_chk
    CHECK (predicted_score_label IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS predicted_score_numeric FLOAT
    CONSTRAINT studio_social_posts_score_numeric_chk
    CHECK (predicted_score_numeric >= 0.0 AND predicted_score_numeric <= 1.0),
  ADD COLUMN IF NOT EXISTS predicted_score_explanation TEXT,
  ADD COLUMN IF NOT EXISTS predicted_score_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_studio_social_posts_score_label
  ON public.studio_social_posts (workspace_id, predicted_score_label)
  WHERE predicted_score_label IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_studio_social_posts_score_numeric
  ON public.studio_social_posts (workspace_id, predicted_score_numeric DESC)
  WHERE predicted_score_numeric IS NOT NULL;

-- ============================================================================
-- 4. EXPERIMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL
    CONSTRAINT studio_experiments_type_chk
    CHECK (type IN ('caption', 'hook', 'time', 'hashtags', 'media', 'other')),
  status TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT studio_experiments_status_chk
    CHECK (status IN ('pending', 'running', 'completed', 'cancelled')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  winner_variant_label TEXT,
  summary_markdown TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_experiments_workspace_id ON public.studio_experiments (workspace_id);
CREATE INDEX IF NOT EXISTS idx_studio_experiments_status ON public.studio_experiments (workspace_id, status);

ALTER TABLE public.studio_social_posts
  ADD COLUMN IF NOT EXISTS experiment_id UUID REFERENCES public.studio_experiments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS experiment_variant_label TEXT
    CONSTRAINT studio_social_posts_variant_label_chk
    CHECK (experiment_variant_label IN ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'));

CREATE INDEX IF NOT EXISTS idx_studio_social_posts_experiment_id
  ON public.studio_social_posts (experiment_id)
  WHERE experiment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_studio_social_posts_experiment_variant
  ON public.studio_social_posts (experiment_id, experiment_variant_label)
  WHERE experiment_id IS NOT NULL;

ALTER TABLE public.studio_experiments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view their experiments" ON public.studio_experiments;
CREATE POLICY "Workspace members can view their experiments" ON public.studio_experiments
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_experiments.workspace_id
    )
  );

DROP POLICY IF EXISTS "Workspace members can insert their experiments" ON public.studio_experiments;
CREATE POLICY "Workspace members can insert their experiments" ON public.studio_experiments
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_experiments.workspace_id
    )
  );

DROP POLICY IF EXISTS "Workspace members can update their experiments" ON public.studio_experiments;
CREATE POLICY "Workspace members can update their experiments" ON public.studio_experiments
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_experiments.workspace_id
    )
  );

-- ============================================================================
-- 5. COMPETITORS TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL
    CONSTRAINT studio_competitors_platform_chk
    CHECK (platform IN ('instagram', 'tiktok', 'facebook')),
  handle TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT unique_competitor_per_workspace UNIQUE (workspace_id, platform, handle)
);

CREATE INDEX IF NOT EXISTS idx_studio_competitors_workspace_id ON public.studio_competitors (workspace_id);
CREATE INDEX IF NOT EXISTS idx_studio_competitors_platform ON public.studio_competitors (workspace_id, platform);

CREATE TABLE IF NOT EXISTS public.studio_competitor_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES public.studio_competitors(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  followers BIGINT,
  posts_count BIGINT,
  avg_engagement_estimate NUMERIC(10, 2),
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT unique_competitor_metric_snapshot UNIQUE (competitor_id, captured_at)
);

CREATE INDEX IF NOT EXISTS idx_studio_competitor_metrics_competitor_captured
  ON public.studio_competitor_metrics (competitor_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_studio_competitor_metrics_latest
  ON public.studio_competitor_metrics (competitor_id, captured_at DESC)
  WHERE captured_at IS NOT NULL;

ALTER TABLE public.studio_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_competitor_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view their competitors" ON public.studio_competitors;
CREATE POLICY "Workspace members can view their competitors" ON public.studio_competitors
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_competitors.workspace_id
    )
  );

DROP POLICY IF EXISTS "Workspace members can insert their competitors" ON public.studio_competitors;
CREATE POLICY "Workspace members can insert their competitors" ON public.studio_competitors
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_competitors.workspace_id
    )
  );

DROP POLICY IF EXISTS "Workspace members can update their competitors" ON public.studio_competitors;
CREATE POLICY "Workspace members can update their competitors" ON public.studio_competitors
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_competitors.workspace_id
    )
  );

DROP POLICY IF EXISTS "Workspace members can delete their competitors" ON public.studio_competitors;
CREATE POLICY "Workspace members can delete their competitors" ON public.studio_competitors
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_competitors.workspace_id
    )
  );

DROP POLICY IF EXISTS "Workspace members can view competitor metrics" ON public.studio_competitor_metrics;
CREATE POLICY "Workspace members can view competitor metrics" ON public.studio_competitor_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.studio_competitors c
      WHERE c.id = competitor_id
      AND auth.uid() IN (
        SELECT user_id FROM public.workspace_members 
        WHERE workspace_id = c.workspace_id
      )
    )
  );

DROP POLICY IF EXISTS "Workspace members can insert competitor metrics" ON public.studio_competitor_metrics;
CREATE POLICY "Workspace members can insert competitor metrics" ON public.studio_competitor_metrics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.studio_competitors c
      WHERE c.id = competitor_id
      AND auth.uid() IN (
        SELECT user_id FROM public.workspace_members 
        WHERE workspace_id = c.workspace_id
      )
    )
  );

-- ============================================================================
-- 6. PERSONALIZATION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_ai_feedback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.studio_social_posts(id) ON DELETE CASCADE,
  source TEXT NOT NULL
    CONSTRAINT studio_ai_feedback_events_source_chk
    CHECK (source IN ('planner', 'agent', 'repurpose', 'manual', 'unknown')),
  event_type TEXT NOT NULL
    CONSTRAINT studio_ai_feedback_events_type_chk
    CHECK (event_type IN ('accepted', 'deleted', 'heavily_edited', 'lightly_edited')),
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_studio_ai_feedback_events_workspace_id
  ON public.studio_ai_feedback_events (workspace_id);
CREATE INDEX IF NOT EXISTS idx_studio_ai_feedback_events_post_id
  ON public.studio_ai_feedback_events (post_id);
CREATE INDEX IF NOT EXISTS idx_studio_ai_feedback_events_type
  ON public.studio_ai_feedback_events (workspace_id, event_type);
CREATE INDEX IF NOT EXISTS idx_studio_ai_feedback_events_workspace_source
  ON public.studio_ai_feedback_events (workspace_id, source, event_type);

ALTER TABLE public.studio_ai_feedback_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view their feedback events" ON public.studio_ai_feedback_events;
CREATE POLICY "Workspace members can view their feedback events" ON public.studio_ai_feedback_events
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_ai_feedback_events.workspace_id
    )
  );

DROP POLICY IF EXISTS "Workspace members can insert their feedback events" ON public.studio_ai_feedback_events;
CREATE POLICY "Workspace members can insert their feedback events" ON public.studio_ai_feedback_events
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_ai_feedback_events.workspace_id
    )
  );

-- ============================================================================
-- 7. CAMPAIGNS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  objective TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT studio_campaigns_dates_chk CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_studio_campaigns_workspace_id ON public.studio_campaigns (workspace_id);
CREATE INDEX IF NOT EXISTS idx_studio_campaigns_dates ON public.studio_campaigns (workspace_id, start_date, end_date);

ALTER TABLE public.studio_social_posts
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.studio_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_studio_social_posts_campaign_id
  ON public.studio_social_posts (campaign_id)
  WHERE campaign_id IS NOT NULL;

ALTER TABLE public.studio_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view their campaigns" ON public.studio_campaigns;
CREATE POLICY "Workspace members can view their campaigns" ON public.studio_campaigns
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_campaigns.workspace_id
    )
  );

DROP POLICY IF EXISTS "Workspace members can insert their campaigns" ON public.studio_campaigns;
CREATE POLICY "Workspace members can insert their campaigns" ON public.studio_campaigns
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_campaigns.workspace_id
    )
  );

DROP POLICY IF EXISTS "Workspace members can update their campaigns" ON public.studio_campaigns;
CREATE POLICY "Workspace members can update their campaigns" ON public.studio_campaigns
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_campaigns.workspace_id
    )
  );

DROP POLICY IF EXISTS "Workspace members can delete their campaigns" ON public.studio_campaigns;
CREATE POLICY "Workspace members can delete their campaigns" ON public.studio_campaigns
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_campaigns.workspace_id
    )
  );

