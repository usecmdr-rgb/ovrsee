# Studio Platform Clients Implementation Summary

## Overview

Created centralized platform clients for Instagram, TikTok, and Facebook to abstract platform-specific API calls, provide consistent error handling and logging, and make the codebase more maintainable.

---

## Architecture

### Directory Structure

```
lib/studio/platform-clients/
├── index.ts              # Exports all clients and utilities
├── types.ts              # Shared TypeScript types
├── config.ts             # Environment variable configuration
├── http-helper.ts        # Shared HTTP request helper
├── instagram-client.ts   # Instagram Business API client
├── facebook-client.ts    # Facebook Graph API client
└── tiktok-client.ts      # TikTok Content Publishing API client
```

---

## Components

### 1. Shared Types (`types.ts`)

Defines common interfaces used across all platform clients:

- `PublishPostOptions` - Input for publishing posts
- `PublishPostResult` - Output from publishing operations
- `PostMetrics` - Standardized metrics structure
- `AccountHealth` - Account health check results
- `HTTPRequestOptions` / `HTTPResponse` - HTTP abstraction

### 2. Configuration (`config.ts`)

Centralized configuration management:

- Reads environment variables (`FACEBOOK_APP_ID`, `TIKTOK_CLIENT_KEY`, etc.)
- Validates required configuration at startup
- Provides typed config object with API versions and base URLs
- Supports environment-specific API versions via env vars

### 3. HTTP Helper (`http-helper.ts`)

Provides consistent HTTP request handling:

- **`callPlatformAPI()`** - Core HTTP request function
  - Handles authentication (query params for FB/IG, headers for TikTok)
  - Logs all API calls via `logPlatformAPICall`
  - Transforms errors into typed exceptions:
    - `TokenExpiredError` on 401
    - `RateLimitError` on 429 (with `Retry-After` parsing)
    - `PlatformAPIError` for other failures
  - Returns structured `HTTPResponse<T>`

- **Convenience helpers**: `getPlatformAPI()`, `postPlatformAPI()`, `putPlatformAPI()`

### 4. Platform Clients

Each client implements the same interface:

#### Instagram Client (`instagram-client.ts`)

- **`publishPost()`** - Two-step publishing:
  1. Create media container (`POST /{ig_business_id}/media`)
  2. Poll for video processing (videos only)
  3. Publish container (`POST /{ig_business_id}/media_publish`)
  4. Fetch permalink

- **`fetchPostMetrics()`** - Fetches insights via `GET /{media_id}/insights`
  - Parses metrics: impressions, reach, engagement, likes, saves, comments, shares

- **`checkAccountHealth()`** - Lightweight account verification
  - Uses `GET /{ig_business_id}?fields=id,username,name`

#### Facebook Client (`facebook-client.ts`)

- **`publishPost()`** - Direct POST to `/{page_id}/photos` or `/{page_id}/videos`
  - Simpler than Instagram (single API call)

- **`fetchPostMetrics()`** - Fetches insights via `GET /{post_id}/insights`
  - Parses Facebook-specific metrics

- **`checkAccountHealth()`** - Verifies page access via `GET /{page_id}?fields=id,name`

#### TikTok Client (`tiktok-client.ts`)

- **`publishPost()`** - Three-step publishing:
  1. Initialize upload (`POST /post/publish/video/init/`)
  2. Upload video chunks (`PUT` to upload URL)
  3. Publish (`POST /post/publish/video/publish/`)

- **`fetchPostMetrics()`** - Fetches metrics via Research API
  - Uses `POST /research/video/query/` with video ID filter

- **`checkAccountHealth()`** - Verifies account via `GET /user/info/`

---

## Key Features

### 1. Consistent Error Handling

All clients throw typed errors:
- `TokenExpiredError` - OAuth token expired/invalid
- `RateLimitError` - Rate limit exceeded (includes `retryAfter`)
- `PlatformAPIError` - Other API failures (includes `retryable` flag)

### 2. Automatic Logging

All API calls are logged via `logPlatformAPICall`:
- Platform name
- Endpoint path
- HTTP method
- Success/failure status
- Status code
- Duration
- Error details (if failed)

### 3. Type Safety

- Full TypeScript types for all inputs/outputs
- Platform-specific context types (`InstagramClientContext`, etc.)
- Shared types for common operations

### 4. Configuration Management

- Centralized env var access
- Validation at startup (throws if missing required vars)
- Supports environment-specific API versions

---

## Usage Example

```typescript
import { publishPost as publishInstagram } from "@/lib/studio/platform-clients/instagram-client";
import { getSocialAccountCredentials } from "@/lib/studio/social-account-service";

// Get credentials
const credentials = await getSocialAccountCredentials(workspaceId, "instagram");
const account = await getSocialAccount(workspaceId, "instagram");

// Publish post
const result = await publishInstagram(
  {
    caption: "Check out this post!",
    mediaUrl: "https://example.com/image.jpg",
    mediaType: "image",
    workspaceId,
    externalAccountId: account.external_account_id,
  },
  {
    workspaceId,
    accessToken: credentials.access_token,
    igBusinessId: account.external_account_id,
  }
);

if (result.success) {
  console.log(`Published: ${result.platformPostId}`);
} else {
  console.error(`Failed: ${result.error}`);
}
```

---

## Next Steps

### Phase 1: Refactor Existing Services (TODO)

1. **`publish-service.ts`**
   - Replace platform-specific functions with client calls
   - Keep `publishPost()` as the main entry point
   - Map `PublishPostData` to client `PublishPostOptions`

2. **`metrics-refresh-service.ts`**
   - Replace `fetchMediaInsights()` / `fetchVideoMetrics()` calls with client methods
   - Use `fetchPostMetrics()` from clients

3. **Add Health Checks**
   - Integrate `checkAccountHealth()` into account management flows
   - Add health check endpoint/UI

### Phase 2: Enhancements (Future)

1. **Token Refresh**
   - Implement automatic token refresh in clients
   - Store refresh tokens (TikTok has them)
   - Auto-refresh before expiry

2. **Rate Limiting**
   - Implement exponential backoff
   - Track rate limit windows per platform
   - Queue requests when rate limited

3. **Retry Logic**
   - Add automatic retry for retryable errors
   - Configurable retry attempts and delays

---

## Benefits

1. **Maintainability**: Platform-specific logic isolated in client modules
2. **Consistency**: Uniform error handling and logging across platforms
3. **Testability**: Clients can be mocked/tested independently
4. **Type Safety**: Full TypeScript support prevents runtime errors
5. **Observability**: All API calls logged with consistent format
6. **Extensibility**: Easy to add new platforms or features

---

## Migration Notes

- **Backward Compatible**: Existing services (`publish-service.ts`, `metrics-refresh-service.ts`) continue to work
- **Gradual Migration**: Can migrate one platform at a time
- **No Breaking Changes**: Client APIs match existing patterns

---

## Files Created

- `lib/studio/platform-clients/types.ts`
- `lib/studio/platform-clients/config.ts`
- `lib/studio/platform-clients/http-helper.ts`
- `lib/studio/platform-clients/instagram-client.ts`
- `lib/studio/platform-clients/facebook-client.ts`
- `lib/studio/platform-clients/tiktok-client.ts`
- `lib/studio/platform-clients/index.ts`
- `STUDIO_SOCIAL_APIS_DISCOVERY.md`
- `STUDIO_PLATFORM_CLIENTS_IMPLEMENTATION.md`

