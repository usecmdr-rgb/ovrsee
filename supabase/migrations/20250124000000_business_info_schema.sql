-- Migration: Business Info & Pricing Schema
-- Creates tables for business profiles, services, pricing, hours, and FAQs
-- Supports Sync's business-aware email drafting and smart scheduling

-- ============================================================================
-- 1) Business Profiles
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  business_name TEXT NOT NULL,
  website_url TEXT,
  description TEXT,
  default_currency TEXT DEFAULT 'USD',
  brand_voice TEXT CHECK (brand_voice IN ('formal', 'friendly', 'casual_professional', 'professional', 'casual')) DEFAULT 'professional',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One business profile per user
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_business_profiles_user_id
  ON public.business_profiles(user_id);

-- ============================================================================
-- 2) Business Services
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.business_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- Generic category (e.g., "Consulting", "Products", "Support")
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_services_business_id
  ON public.business_services(business_id);

CREATE INDEX IF NOT EXISTS idx_business_services_is_active
  ON public.business_services(is_active) WHERE is_active = true;

-- ============================================================================
-- 3) Business Pricing Tiers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.business_pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.business_services(id) ON DELETE CASCADE, -- Nullable for bundle-level pricing
  
  name TEXT NOT NULL,
  description TEXT,
  price_amount NUMERIC(10, 2) NOT NULL,
  price_currency TEXT DEFAULT 'USD',
  billing_interval TEXT CHECK (billing_interval IN ('one_time', 'monthly', 'yearly', 'hourly', 'daily', 'weekly')) DEFAULT 'one_time',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_pricing_tiers_business_id
  ON public.business_pricing_tiers(business_id);

CREATE INDEX IF NOT EXISTS idx_business_pricing_tiers_service_id
  ON public.business_pricing_tiers(service_id);

CREATE INDEX IF NOT EXISTS idx_business_pricing_tiers_is_active
  ON public.business_pricing_tiers(is_active) WHERE is_active = true;

-- ============================================================================
-- 4) Business Hours
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  open_time TIME,
  close_time TIME,
  timezone TEXT DEFAULT 'America/New_York',
  is_closed BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One entry per day per business
  UNIQUE(business_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_business_hours_business_id
  ON public.business_hours(business_id);

-- ============================================================================
-- 5) Business FAQs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.business_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_faqs_business_id
  ON public.business_faqs(business_id);

-- ============================================================================
-- 6) Business Website Snapshots (Optional)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.business_website_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('homepage', 'pricing', 'services', 'about', 'contact', 'other')),
  content_text TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_website_snapshots_business_id
  ON public.business_website_snapshots(business_id);

CREATE INDEX IF NOT EXISTS idx_business_website_snapshots_type
  ON public.business_website_snapshots(business_id, snapshot_type);

-- ============================================================================
-- 7) Updated_at Triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_business_profiles_updated_at
  BEFORE UPDATE ON public.business_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_services_updated_at
  BEFORE UPDATE ON public.business_services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_pricing_tiers_updated_at
  BEFORE UPDATE ON public.business_pricing_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_hours_updated_at
  BEFORE UPDATE ON public.business_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_faqs_updated_at
  BEFORE UPDATE ON public.business_faqs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_website_snapshots_updated_at
  BEFORE UPDATE ON public.business_website_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8) Row Level Security (RLS)
-- ============================================================================
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_website_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can only access their own business data
CREATE POLICY "users_can_view_own_business_profiles"
  ON public.business_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_can_modify_own_business_profiles"
  ON public.business_profiles FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "users_can_view_own_business_services"
  ON public.business_services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.business_profiles
      WHERE business_profiles.id = business_services.business_id
      AND business_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "users_can_modify_own_business_services"
  ON public.business_services FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_profiles
      WHERE business_profiles.id = business_services.business_id
      AND business_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "users_can_view_own_business_pricing_tiers"
  ON public.business_pricing_tiers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.business_profiles
      WHERE business_profiles.id = business_pricing_tiers.business_id
      AND business_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "users_can_modify_own_business_pricing_tiers"
  ON public.business_pricing_tiers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_profiles
      WHERE business_profiles.id = business_pricing_tiers.business_id
      AND business_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "users_can_view_own_business_hours"
  ON public.business_hours FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.business_profiles
      WHERE business_profiles.id = business_hours.business_id
      AND business_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "users_can_modify_own_business_hours"
  ON public.business_hours FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_profiles
      WHERE business_profiles.id = business_hours.business_id
      AND business_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "users_can_view_own_business_faqs"
  ON public.business_faqs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.business_profiles
      WHERE business_profiles.id = business_faqs.business_id
      AND business_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "users_can_modify_own_business_faqs"
  ON public.business_faqs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_profiles
      WHERE business_profiles.id = business_faqs.business_id
      AND business_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "users_can_view_own_business_website_snapshots"
  ON public.business_website_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.business_profiles
      WHERE business_profiles.id = business_website_snapshots.business_id
      AND business_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "users_can_modify_own_business_website_snapshots"
  ON public.business_website_snapshots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_profiles
      WHERE business_profiles.id = business_website_snapshots.business_id
      AND business_profiles.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 9) Comments
-- ============================================================================
COMMENT ON TABLE public.business_profiles IS 'Business profile information for each user, used by Sync for business-aware email drafting';
COMMENT ON TABLE public.business_services IS 'Services offered by the business';
COMMENT ON TABLE public.business_pricing_tiers IS 'Pricing tiers for services or bundles';
COMMENT ON TABLE public.business_hours IS 'Business operating hours by day of week';
COMMENT ON TABLE public.business_faqs IS 'Frequently asked questions and answers';
COMMENT ON TABLE public.business_website_snapshots IS 'Snapshots of website content for AI context';


