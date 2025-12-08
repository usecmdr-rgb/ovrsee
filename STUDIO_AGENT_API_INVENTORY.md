# Studio Agent API Inventory

## Overview

This document lists all Studio APIs that the agent can use to perform operations.

## Post Management

### POST /api/studio/posts
**Purpose**: Create a new post (draft, scheduled, or publish immediately)

**Request Body**:
```json
{
  "platform": "instagram" | "tiktok" | "facebook",
  "social_account_id": "uuid",
  "asset_id": "uuid" (optional),
  "caption": "string",
  "scheduled_for": "ISO timestamp" (optional),
  "publish_now": boolean (default: false),
  "media_url": "string" (optional, if no asset_id),
  "media_type": "image" | "video" (default: "image")
}
```

**Response**:
```json
{
  "ok": true,
  "data": { post object }
}
```

### PATCH /api/studio/posts/[postId]
**Purpose**: Update a post (caption, scheduled_for, status)

**Request Body**:
```json
{
  "caption": "string" (optional),
  "scheduled_for": "ISO timestamp" (optional),
  "status": "draft" | "scheduled" | "publishing" | "posted" | "failed" (optional)
}
```

**Response**:
```json
{
  "ok": true,
  "data": { updated post }
}
```

### GET /api/studio/posts
**Purpose**: List posts for workspace

**Query Params**:
- `limit` (default: 50)
- `platform` (optional)
- `status` (optional)

**Response**:
```json
{
  "ok": true,
  "data": { posts: [...] }
}
```

## Calendar

### GET /api/studio/calendar
**Purpose**: Get posts for calendar view within date range

**Query Params**:
- `from` (required): ISO date
- `to` (required): ISO date
- `platform` (optional)
- `status` (optional)

**Response**:
```json
{
  "ok": true,
  "data": { posts: [...] }
}
```

## Repurposing

### POST /api/studio/repurpose
**Purpose**: Repurpose a source post to target platforms

**Request Body**:
```json
{
  "source_post_id": "uuid",
  "target_platforms": ["instagram", "tiktok", "facebook"],
  "scheduled_for": "ISO timestamp" (optional)
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "source_post_id": "uuid",
    "created_posts": [{ id, platform, caption }],
    "content_group_id": "uuid"
  }
}
```

## Weekly Planning

### POST /api/studio/plans/weekly
**Purpose**: Generate weekly content plan and create draft posts

**Request Body**:
```json
{
  "week_start": "ISO date" (optional, defaults to next Monday),
  "preferences": {
    "desired_cadence": { "instagram": 5, "tiktok": 3 },
    "preferred_days": ["Monday", "Wednesday"],
    "preferred_times": ["9-12", "15-18"]
  },
  "avoid_duplicates": boolean (default: true)
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "week_start": "2024-01-15",
    "week_end": "2024-01-21",
    "proposed_posts": [...],
    "created_post_ids": ["uuid1", "uuid2"]
  }
}
```

## Social Accounts

### GET /api/studio/social/status
**Purpose**: Get connected social accounts status

**Response**:
```json
{
  "ok": true,
  "data": {
    "instagram": { name, connected: boolean },
    "tiktok": { name, connected: boolean },
    "facebook": { name, connected: boolean }
  }
}
```

## Notes

- All endpoints require authentication
- All operations are workspace-scoped
- Posts are automatically linked to hashtags when captions are set
- Scheduling respects the post state machine (draft → scheduled → publishing → posted)

