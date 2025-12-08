-- Business Profile and Knowledge Layer
-- This migration creates tables for storing business information and knowledge chunks
-- that all AI agents can access and use

-- Business Profiles table
-- Stores the main business information for each user
CREATE TABLE IF NOT EXISTS business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic business information
  business_name TEXT,
  business_type TEXT, -- industry/type
  description TEXT,
  
  -- Contact and location
  primary_website_url TEXT,
  additional_urls JSONB DEFAULT '[]'::jsonb, -- Array of additional website URLs
  location TEXT,
  service_area TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  
  -- Services and operations
  services_offered JSONB, -- Can be array or structured object
  hours_of_operation TEXT, -- e.g., "Mon-Fri, 8a-6p"
  service_name TEXT, -- Product/service name
  
  -- Preferences (for Studio agent and others)
  image_watermark_enabled BOOLEAN DEFAULT FALSE,
  image_watermark_text TEXT,
  image_watermark_logo_url TEXT,
  image_watermark_position TEXT CHECK (image_watermark_position IN ('top_left', 'top_right', 'bottom_left', 'bottom_right', 'center', 'top_center', 'bottom_center')),
  
  -- Additional preferences (can be extended)
  preferences JSONB DEFAULT '{}'::jsonb,
  
  -- Language and timezone
  language TEXT DEFAULT 'English',
  timezone TEXT DEFAULT 'EST',
  
  -- Notes and special instructions
  notes TEXT, -- "Help us, help you" notes
  
  -- Website crawling metadata
  last_crawled_at TIMESTAMP WITH TIME ZONE,
  crawl_status TEXT DEFAULT 'pending' CHECK (crawl_status IN ('pending', 'in_progress', 'completed', 'failed')),
  crawl_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one profile per user
  UNIQUE(user_id)
);

-- Business Knowledge Chunks table
-- Stores structured knowledge extracted from forms and websites
CREATE TABLE IF NOT EXISTS business_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_profile_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  
  -- Source information
  source TEXT NOT NULL CHECK (source IN ('form', 'website', 'manual')),
  source_url TEXT, -- For website pages, nullable for form/manual entries
  
  -- Content
  title TEXT, -- Page title or chunk title
  content TEXT NOT NULL, -- Cleaned and summarized content
  
  -- Optional: Vector embeddings for semantic search (if RAG is added later)
  embedding vector(1536), -- OpenAI embedding dimension
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional metadata (page depth, crawl order, etc.)
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_profiles_user_id ON business_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_business_profiles_website ON business_profiles(primary_website_url) WHERE primary_website_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_business_knowledge_chunks_profile_id ON business_knowledge_chunks(business_profile_id);
CREATE INDEX IF NOT EXISTS idx_business_knowledge_chunks_source ON business_knowledge_chunks(source);
CREATE INDEX IF NOT EXISTS idx_business_knowledge_chunks_source_url ON business_knowledge_chunks(source_url) WHERE source_url IS NOT NULL;

-- GIN index for JSONB searches
CREATE INDEX IF NOT EXISTS idx_business_profiles_additional_urls ON business_profiles USING GIN(additional_urls);
CREATE INDEX IF NOT EXISTS idx_business_profiles_preferences ON business_profiles USING GIN(preferences);
CREATE INDEX IF NOT EXISTS idx_business_knowledge_chunks_metadata ON business_knowledge_chunks USING GIN(metadata);

-- Vector index for embeddings (if pgvector extension is available)
-- CREATE INDEX IF NOT EXISTS idx_business_knowledge_chunks_embedding ON business_knowledge_chunks USING ivfflat(embedding vector_cosine_ops);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_business_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_business_knowledge_chunks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_business_profiles_updated_at ON business_profiles;
CREATE TRIGGER trigger_update_business_profiles_updated_at
  BEFORE UPDATE ON business_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_business_profiles_updated_at();

DROP TRIGGER IF EXISTS trigger_update_business_knowledge_chunks_updated_at ON business_knowledge_chunks;
CREATE TRIGGER trigger_update_business_knowledge_chunks_updated_at
  BEFORE UPDATE ON business_knowledge_chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_business_knowledge_chunks_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own business profile
CREATE POLICY "Users can view their own business profile"
  ON business_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own business profile"
  ON business_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own business profile"
  ON business_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own business profile"
  ON business_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for knowledge chunks
CREATE POLICY "Users can view knowledge chunks for their business profile"
  ON business_knowledge_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM business_profiles
      WHERE business_profiles.id = business_knowledge_chunks.business_profile_id
      AND business_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert knowledge chunks for their business profile"
  ON business_knowledge_chunks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_profiles
      WHERE business_profiles.id = business_knowledge_chunks.business_profile_id
      AND business_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update knowledge chunks for their business profile"
  ON business_knowledge_chunks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM business_profiles
      WHERE business_profiles.id = business_knowledge_chunks.business_profile_id
      AND business_profiles.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_profiles
      WHERE business_profiles.id = business_knowledge_chunks.business_profile_id
      AND business_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete knowledge chunks for their business profile"
  ON business_knowledge_chunks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM business_profiles
      WHERE business_profiles.id = business_knowledge_chunks.business_profile_id
      AND business_profiles.user_id = auth.uid()
    )
  );

-- Comments for documentation
COMMENT ON TABLE business_profiles IS 'Stores business information and preferences for each user. All AI agents can access this data.';
COMMENT ON TABLE business_knowledge_chunks IS 'Stores structured knowledge extracted from business forms and websites. Used by AI agents for context.';
COMMENT ON COLUMN business_profiles.image_watermark_position IS 'Position for image watermark: top_left, top_right, bottom_left, bottom_right, center, top_center, bottom_center';
COMMENT ON COLUMN business_knowledge_chunks.source IS 'Source of knowledge: form (from business info form), website (crawled), or manual (admin-added)';
COMMENT ON COLUMN business_knowledge_chunks.embedding IS 'Vector embedding for semantic search (optional, requires pgvector extension)';














