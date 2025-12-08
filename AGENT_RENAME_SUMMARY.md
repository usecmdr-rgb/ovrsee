# Agent Rename Migration Summary

## Overview
This document summarizes the refactoring of agent names from technical identifiers to user-friendly names across the entire stack.

## Agent Name Mapping
- `alpha` → `aloha` (voice & call agent)
- `mu` → `studio` (content, image editing & branding agent)
- `xi` → `sync` (email & calendar agent)
- `beta` → `insight` (analytics & business intelligence agent)

## Completed Changes

### 1. Central Agent Configuration
- ✅ Created `/lib/config/agents.ts` with:
  - `AgentId` type: `"aloha" | "studio" | "sync" | "insight"`
  - `AgentConfig` interface with id, label, description, icon, accent, route
  - `AGENTS` array with all agent configurations
  - `AGENT_BY_ID` lookup map
  - Legacy ID mapping helpers

### 2. Type System Updates
- ✅ Updated `types/index.ts`:
  - `AgentKey` now re-exports `AgentId` from central config
  - Updated `WorkflowAction` type to use new agent IDs
  - Note: `AgentStatsDaily` interface still uses old column names (e.g., `alpha_calls_total`) - these are database column names that will be updated via SQL migration

### 3. Frontend Routes & Navigation
- ✅ Updated `components/app/AppSidebar.tsx` to use `AGENTS` from central config
- ✅ Created new route directories:
  - `/app/aloha/` (replacing `/app/alpha/`)
  - `/app/app/aloha/` (replacing `/app/app/alpha/`)
- ✅ Updated all layout files to use new agent IDs:
  - `app/aloha/layout.tsx` → `activeAgent="aloha"`
  - `app/mu/layout.tsx` → `activeAgent="studio"`
  - `app/xi/layout.tsx` → `activeAgent="sync"`
  - `app/beta/layout.tsx` → `activeAgent="insight"`
  - Same for `/app/app/*` layouts

### 4. Page Components
- ✅ Updated page headers and function names:
  - `AlphaPage` → `AlohaPage` (with "Aloha agent" header)
  - `MuPage` → `StudioPage` (with "Studio agent" header)
  - `XiPage` → `SyncPage` (with "Sync agent" header)
  - `BetaPage` → `InsightPage` (with "Insight agent" header)
- ✅ Updated `app/app/page.tsx` dashboard to use new agent keys in data structures
- ✅ Updated `app/page.tsx` home page to use new agent keys and labels

### 5. Data & Configuration
- ✅ Updated `lib/data.ts`:
  - `agents` array now uses new keys (`aloha`, `studio`, `sync`, `insight`)
  - Updated agent names and descriptions
  - Updated mock data references (e.g., "Alpha" → "Aloha" in transcripts)
- ✅ Updated `lib/agents/config.ts`:
  - `AgentKey` now re-exports `AgentId`
  - `AGENT_CONFIG` updated with new keys and names

### 6. Translations
- ✅ Updated `lib/translations/index.ts`:
  - Added new translation keys: `agentAloha`, `agentStudio`, `agentSync`, `agentInsight`
  - Kept legacy keys (`agentAlpha`, etc.) for backward compatibility during migration
  - Updated all language variants

### 7. API Routes
- ✅ Updated `app/api/brain/route.ts`:
  - `FOLLOWUP_CONTEXT_SOURCES` now uses `["aloha", "sync"]`
  - `SYSTEM_PROMPTS` updated with new agent IDs and names
  - System prompts now reference "ALOHA", "SYNC", "STUDIO", "INSIGHT"

### 8. State Management
- ✅ Updated `context/AppStateContext.tsx`:
  - Subscription state now uses new agent keys

### 9. SQL Migration
- ✅ Created `supabase/migrations/20241125000000_rename_agent_types.sql`:
  - Section A: For ENUM type (commented out, ready to use)
  - Section B: For TEXT/VARCHAR type (active, ready to run)
  - Includes verification queries

## Remaining Tasks

### Route Directories
The following route directories still exist with old names but have been updated internally:
- `/app/alpha/` - Can be removed after migration (new `/app/aloha/` exists)
- `/app/mu/` - Should be renamed to `/app/studio/` or new directory created
- `/app/xi/` - Should be renamed to `/app/sync/` or new directory created
- `/app/beta/` - Should be renamed to `/app/insight/` or new directory created
- Same for `/app/app/*` directories

**Recommendation**: Create new route directories with new names and add redirects from old routes, or rename directories directly.

### Database Column Names
The following database columns still use old names (these are in `AgentStatsDaily` interface):
- `alpha_calls_total`, `alpha_calls_missed`, `alpha_appointments`
- `xi_important_emails`, `xi_missed_emails`, `xi_payments_bills`, `xi_invoices`
- `mu_media_edits`
- `beta_insights_count`

**Action Required**: 
1. Run the SQL migration to update `agent_type` column values
2. Optionally rename database columns (separate migration needed)
3. Update TypeScript interfaces after column rename

### Supabase Queries
- ⚠️ Check all Supabase queries in API routes and components for `agent_type` filters
- Update any `.eq("agent_type", "alpha")` to `.eq("agent_type", "aloha")`, etc.

### Testing Checklist
- [ ] Verify all routes work: `/aloha`, `/studio`, `/sync`, `/insight`
- [ ] Verify navigation sidebar highlights correct agent
- [ ] Verify dashboard page shows correct agent data
- [ ] Verify API routes work with new agent IDs
- [ ] Run SQL migration in Supabase
- [ ] Verify Supabase queries return correct data
- [ ] Test agent switching in UI
- [ ] Verify translations display correctly

## Migration Steps

1. **Frontend is ready** - All TypeScript/React code has been updated
2. **Run SQL migration** - Execute the migration file in Supabase SQL editor
3. **Test thoroughly** - Verify all functionality works with new agent IDs
4. **Optional cleanup** - Remove old route directories and legacy translation keys after confirming everything works

## Notes

- Legacy translation keys are kept for backward compatibility during migration
- Database column names in `AgentStatsDaily` interface remain unchanged (they reference actual DB columns)
- The central config (`lib/config/agents.ts`) is now the single source of truth for agent metadata
- All new code should import from `@/lib/config/agents` instead of hard-coding agent IDs

















