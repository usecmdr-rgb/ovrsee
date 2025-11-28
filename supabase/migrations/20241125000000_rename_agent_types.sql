-- Migration: Rename agent types from old names to new user-friendly names
-- 
-- Agent name mapping (old → new):
--   alpha → aloha (voice & call agent)
--   mu    → studio (content, image editing & branding agent)
--   xi    → sync (email & calendar agent)
--   beta  → insight (analytics & business intelligence agent)
--
-- IMPORTANT: Choose the appropriate section below based on your database schema.
-- Do NOT run both sections. Check your database schema first.

-- ============================================================================
-- SECTION A: For ENUM agent_type (if agent_type is a Postgres ENUM type)
-- ============================================================================
-- 
-- Use this section if agent_type is defined as an ENUM type, e.g.:
--   CREATE TYPE agent_type AS ENUM ('alpha', 'mu', 'xi', 'beta');
--
-- Run this inside Supabase SQL editor or as a migration.
--
-- BEGIN;
--
-- ALTER TYPE agent_type RENAME VALUE 'alpha' TO 'aloha';
-- ALTER TYPE agent_type RENAME VALUE 'mu'    TO 'studio';
-- ALTER TYPE agent_type RENAME VALUE 'xi'    TO 'sync';
-- ALTER TYPE agent_type RENAME VALUE 'beta'  TO 'insight';
--
-- COMMIT;

-- ============================================================================
-- SECTION B: For TEXT/VARCHAR agent_type (if agent_type is TEXT/VARCHAR)
-- ============================================================================
--
-- Use this section if agent_type is TEXT, VARCHAR, or similar (not an ENUM).
-- Adjust table names as needed. If you have multiple tables with agent_type,
-- copy the UPDATE pattern for each table.
--
-- Common table names to check:
--   - agents
--   - agent_sessions
--   - agent_memory
--   - workflows
--   - Any other tables that reference agent_type

BEGIN;

-- Update agents table (adjust table name if different)
UPDATE agents 
SET agent_type = 'aloha' 
WHERE agent_type = 'alpha';

UPDATE agents 
SET agent_type = 'studio' 
WHERE agent_type = 'mu';

UPDATE agents 
SET agent_type = 'sync' 
WHERE agent_type = 'xi';

UPDATE agents 
SET agent_type = 'insight' 
WHERE agent_type = 'beta';

-- Update agent_sessions table (if it exists)
-- UPDATE agent_sessions 
-- SET agent_type = 'aloha' 
-- WHERE agent_type = 'alpha';
-- 
-- UPDATE agent_sessions 
-- SET agent_type = 'studio' 
-- WHERE agent_type = 'mu';
-- 
-- UPDATE agent_sessions 
-- SET agent_type = 'sync' 
-- WHERE agent_type = 'xi';
-- 
-- UPDATE agent_sessions 
-- SET agent_type = 'insight' 
-- WHERE agent_type = 'beta';

-- Update agent_memory table (if it exists)
-- UPDATE agent_memory 
-- SET agent_type = 'aloha' 
-- WHERE agent_type = 'alpha';
-- 
-- UPDATE agent_memory 
-- SET agent_type = 'studio' 
-- WHERE agent_type = 'mu';
-- 
-- UPDATE agent_memory 
-- SET agent_type = 'sync' 
-- WHERE agent_type = 'xi';
-- 
-- UPDATE agent_memory 
-- SET agent_type = 'insight' 
-- WHERE agent_type = 'beta';

-- Update workflows table (if it exists and has agent_type column)
-- UPDATE workflows 
-- SET agent_type = 'aloha' 
-- WHERE agent_type = 'alpha';
-- 
-- UPDATE workflows 
-- SET agent_type = 'studio' 
-- WHERE agent_type = 'mu';
-- 
-- UPDATE workflows 
-- SET agent_type = 'sync' 
-- WHERE agent_type = 'xi';
-- 
-- UPDATE workflows 
-- SET agent_type = 'insight' 
-- WHERE agent_type = 'beta';

COMMIT;

-- ============================================================================
-- Verification queries (run after migration to verify)
-- ============================================================================
--
-- SELECT DISTINCT agent_type FROM agents;
-- SELECT COUNT(*) FROM agents WHERE agent_type IN ('alpha', 'mu', 'xi', 'beta');
-- -- Should return 0 if migration was successful
--
-- SELECT COUNT(*) FROM agents WHERE agent_type IN ('aloha', 'studio', 'sync', 'insight');
-- -- Should return total count of agent records











