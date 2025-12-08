# Business Profile / Knowledge Layer Documentation

## Overview

The Business Profile / Knowledge Layer is a shared system that all AI agents use to access business information. This ensures consistency and prevents each agent from implementing its own business-info fetching logic.

## Architecture

### Database Schema

**Tables:**
- `business_profiles`: Main business information and preferences
- `business_knowledge_chunks`: Structured knowledge from forms and websites

See migration: `supabase/migrations/20241129000000_business_profile_knowledge.sql`

### Core Components

1. **Shared Helper**: `lib/business-context.ts`
   - `getBusinessContext(userId, businessProfileId?, query?)` - Primary function all agents use
   - `getBusinessContextByUserId(userId, query?)` - Convenience wrapper
   - `getBusinessContextByProfileId(businessProfileId, query?)` - Convenience wrapper
   - `hasBusinessProfile(userId)` - Check if profile exists

2. **Website Crawler**: `lib/website-crawler.ts`
   - `crawlBusinessWebsite(businessProfileId, websiteUrl, forceRefresh?)` - Crawls and stores website content

3. **API Endpoints**:
   - `GET /api/business-profile` - Get business profile and knowledge chunks
   - `POST /api/business-profile` - Create/update business profile from form
   - `POST /api/business-profile/crawl` - Manually trigger website crawl

## How Agents Use Business Context

### All Agents MUST Use the Shared Helper

**DO:**
```typescript
import { getBusinessContext } from "@/lib/business-context";

// In your agent code
const context = await getBusinessContext(userId);
if (context) {
  // Use context.profile and context.knowledgeChunks
}
```

**DON'T:**
- ❌ Implement your own business-info fetching
- ❌ Query `business_profiles` directly
- ❌ Create separate business-info helpers

### Agent-Specific Usage

#### Studio Agent (Image/Watermark)

Studio automatically uses watermark settings from business profile:

```typescript
// In /api/brain route (already implemented)
const businessContext = await getBusinessContext(userId);

if (businessContext?.profile.watermarkSettings?.enabled) {
  // Watermark settings are automatically included in:
  // 1. System prompt
  // 2. Context passed to Studio
  // 3. Tool calls can apply watermark automatically
}
```

**Watermark Settings:**
- `enabled`: Boolean - Whether watermark is enabled
- `text`: String - Watermark text (optional)
- `logoUrl`: String - Watermark logo URL (optional)
- `position`: String - Position: `top_left`, `top_right`, `bottom_left`, `bottom_right`, `center`, `top_center`, `bottom_center`

#### Aloha Agent (Phone/Call Assistant)

Aloha uses business context to answer questions:

```typescript
// In /api/brain route (already implemented)
const businessContext = await getBusinessContext(userId);

if (businessContext) {
  // Business context is automatically included in:
  // 1. System prompt with business name, services, hours, location
  // 2. Knowledge chunks from website and form
  // 3. Aloha can answer questions about:
  //    - Services and pricing
  //    - Operating hours
  //    - Location and service areas
  //    - Policies and special instructions
}
```

## Data Flow

### 1. Form Submission → Database

**User fills "Help us, help you" form:**
1. Form data is sent to `POST /api/business-profile`
2. Profile is created/updated in `business_profiles` table
3. Form content is stored as knowledge chunk with `source='form'`
4. If website URL is provided, crawl is triggered (async)

### 2. Website Crawling → Knowledge Chunks

**Website crawl process:**
1. Triggered when:
   - Business profile is first created with website URL
   - Website URL is updated
   - User clicks "Refresh website info" button
   - Manual API call to `/api/business-profile/crawl`

2. Crawler:
   - Fetches main page
   - Finds important internal links (about, services, pricing, etc.)
   - Extracts and cleans text content
   - Stores as knowledge chunks with `source='website'`

3. Avoids re-scraping:
   - Checks `last_crawled_at` timestamp
   - Only crawls if > 7 days old (unless forced)

### 3. Agent Access → Business Context

**When agent needs business info:**
1. Agent calls `getBusinessContext(userId)`
2. Helper queries `business_profiles` and `business_knowledge_chunks`
3. Returns structured `BusinessContext` object
4. Agent uses context in prompts/responses

## Storage Locations

### Business Profile Data
- **Location**: `business_profiles` table
- **Fields**: Business name, website, services, hours, location, watermark settings, etc.
- **Access**: Via `getBusinessContext()` helper

### Knowledge Chunks
- **Location**: `business_knowledge_chunks` table
- **Sources**:
  - `form`: Data from "Help us, help you" form
  - `website`: Crawled website content
  - `manual`: Admin-added content (future)
- **Access**: Included in `BusinessContext.knowledgeChunks`

## Website Crawling

### When Website is Crawled

1. **Automatic**:
   - When business profile is first created with website URL
   - When website URL is updated

2. **Manual**:
   - User clicks "Refresh website info" button
   - API call to `POST /api/business-profile/crawl?force=true`

### Crawl Behavior

- **Pages Crawled**: Main page + important internal links (about, services, pricing, contact, FAQ)
- **Limit**: ~6 pages total
- **Frequency**: Once per 7 days (unless forced)
- **Storage**: Each page stored as separate knowledge chunk

### Crawl Status

- `pending`: Not yet crawled
- `in_progress`: Currently crawling
- `completed`: Successfully crawled
- `failed`: Crawl failed (error stored in `crawl_error`)

## Frontend Integration

### Business Info Form

**Location**: `components/modals/BusinessInfoModal.tsx`

**Features**:
- Saves to database via `POST /api/business-profile`
- Includes watermark settings section
- Loads existing profile on open
- Triggers website crawl if URL provided

### Watermark Settings UI

Users can configure:
- Enable/disable watermark
- Watermark text
- Watermark position
- (Future: Logo upload)

## Security & RLS

### Row Level Security (RLS)

- Users can only access their own business profile
- Knowledge chunks are scoped to business profile
- All queries respect RLS policies

### Service Role Access

- Agents use service role to access business context
- Service role bypasses RLS for agent operations
- User data is still scoped by `user_id`

## Future Enhancements

### Potential Additions

1. **Vector Embeddings**:
   - Add `embedding` column to `business_knowledge_chunks`
   - Enable semantic search across knowledge chunks
   - Use for better context retrieval

2. **Manual Knowledge Entry**:
   - Admin UI to add manual knowledge chunks
   - Support for `source='manual'`

3. **Multi-Language Support**:
   - Store knowledge in multiple languages
   - Agent selects appropriate language based on user preference

4. **Knowledge Chunk Versioning**:
   - Track changes to knowledge chunks
   - Support for updating/refining knowledge over time

## Troubleshooting

### Agent Not Getting Business Context

1. Check if business profile exists: `hasBusinessProfile(userId)`
2. Verify RLS policies allow access
3. Check server logs for errors in `getBusinessContext()`

### Website Not Crawling

1. Check `crawl_status` in `business_profiles` table
2. Review `crawl_error` for error messages
3. Verify website URL is valid and accessible
4. Check if `last_crawled_at` is recent (may skip if < 7 days)

### Watermark Not Applying

1. Verify `image_watermark_enabled = true` in profile
2. Check Studio agent is receiving business context
3. Review system prompt includes watermark settings
4. Verify watermark settings in context object

## Examples

### Example: Studio Agent Using Watermark

```typescript
// In /api/brain route
const businessContext = await getBusinessContext(userId);

if (businessContext?.profile.watermarkSettings?.enabled) {
  // Watermark is automatically included in Studio's context
  // Studio will apply watermark unless user explicitly opts out
}
```

### Example: Aloha Answering Questions

```typescript
// In /api/brain route
const businessContext = await getBusinessContext(userId);

// Business context is included in Aloha's system prompt
// Aloha can now answer:
// - "What are your hours?" → Uses businessContext.profile.hours
// - "What services do you offer?" → Uses businessContext.profile.services
// - "Where are you located?" → Uses businessContext.profile.location
```

### Example: Filtering Knowledge by Query

```typescript
// Get only pricing-related knowledge
const context = await getBusinessContext(userId, undefined, "pricing");

// Returns knowledge chunks containing "pricing" in content
```

## Migration

To set up the Business Profile system:

1. **Run Migration**:
   ```sql
   -- Run: supabase/migrations/20241129000000_business_profile_knowledge.sql
   ```

2. **Verify Tables**:
   - `business_profiles` table exists
   - `business_knowledge_chunks` table exists
   - RLS policies are enabled

3. **Test**:
   - Submit business info form
   - Verify profile is created
   - Trigger website crawl
   - Verify knowledge chunks are created
   - Test agent access to business context














