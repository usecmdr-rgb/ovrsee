/**
 * Studio Media API
 * 
 * POST /api/studio/media
 * 
 * Upload media to Studio
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";

export async function POST(request: NextRequest) {
  try {
    const { supabaseClient, user, responseHeaders } =
      await getAuthenticatedSupabaseFromRequest(request);

    const workspaceId = await getWorkspaceIdForUser(user.id, supabaseClient);
    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: "Workspace not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    const body = await request.json();
    
    // Support both camelCase and snake_case formats
    const url = body.url || body.storageUrl;
    const storage_path = body.storage_path || body.storagePath;
    const mime_type = body.mime_type || body.mimeType;
    const name = body.name || body.title || body.filename;
    const filename = body.filename || body.name || body.title;
    const preview_url = body.preview_url || body.previewUrl;
    const width = body.width;
    const height = body.height;
    const duration_seconds = body.duration_seconds || body.durationSeconds;
    
    // Handle tags and other metadata
    const tags = body.tags || [];
    const metadata = {
      ...(body.metadata || {}),
      ...(tags.length > 0 ? { tags } : {}),
    };

    if (!url && !storage_path) {
      return NextResponse.json(
        { ok: false, error: "Either url or storage_path (or storageUrl) is required" },
        { status: 400, headers: responseHeaders }
      );
    }

    // Create studio_assets row
    const { data: asset, error: assetError } = await supabaseClient
      .from("studio_assets")
      .insert({
        workspace_id: workspaceId,
        created_by: user.id,
        asset_type: "media",
        name: name || filename,
        filename,
        mime_type,
        storage_path,
        url,
        preview_url,
        width,
        height,
        duration_seconds,
        metadata,
      })
      .select()
      .single();

    if (assetError) {
      console.error("Error creating studio asset:", assetError);
      return NextResponse.json(
        { ok: false, error: "Failed to create asset", details: assetError.message },
        { status: 500, headers: responseHeaders }
      );
    }

    // Create initial studio_asset_versions row
    const { data: version, error: versionError } = await supabaseClient
      .from("studio_asset_versions")
      .insert({
        asset_id: asset.id,
        created_by: user.id,
        version_number: 1,
        is_current: true,
        storage_path,
        url,
        preview_url,
        edit_operations: [],
        metadata: {},
      })
      .select()
      .single();

    if (versionError) {
      console.error("Error creating asset version:", versionError);
      // Don't fail the request, asset was created successfully
    }

    // Insert studio_edit_events row with event_type = 'create'
    await supabaseClient
      .from("studio_edit_events")
      .insert({
        workspace_id: workspaceId,
        asset_id: asset.id,
        event_type: "create",
        created_by: user.id,
      });

    return NextResponse.json(
      {
        ok: true,
        data: {
          asset: {
            ...asset,
            version: version || null,
          },
        },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio media upload endpoint:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
