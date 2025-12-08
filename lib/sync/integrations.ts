/**
 * Integration persistence helpers for Sync
 * Handles storing and retrieving Google OAuth tokens in public.integrations table
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";

/**
 * Google OAuth Integration object shape
 * 
 * Stored in public.integrations table with:
 * - provider: "gmail" | "google_calendar"
 * - integration_type: "oauth"
 * - access_token: string (encrypted at rest by Supabase)
 * - refresh_token: string | null (encrypted at rest by Supabase)
 * - token_expires_at: timestamp | null
 * - scopes: string[] (array of granted OAuth scopes)
 * - metadata: { email: string } (user's Google email)
 * - sync_status: "connected" | "error" | "disconnected"
 * - is_active: boolean (only one active integration per workspace/provider)
 */
export interface GoogleIntegration {
  id: string;
  workspace_id: string;
  user_id: string;
  provider: "gmail" | "google_calendar";
  integration_type: "oauth";
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string[];
  metadata: {
    email: string;
  };
  sync_status: "connected" | "error" | "disconnected";
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertGoogleIntegrationParams {
  workspaceId: string;
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string | null; // null if not provided (preserve existing)
  expiresAt: Date | null;
  scopes: string[];
  preserveRefreshToken?: boolean; // If true, preserve existing refresh token if new one is null
}

/**
 * Upsert Google integration (Gmail and/or Calendar)
 * Creates separate integration rows for each service based on scopes
 */
export async function upsertGoogleIntegration(
  params: UpsertGoogleIntegrationParams
): Promise<{ integrationId: string }> {
  const supabase = getSupabaseServerClient();

  const hasGmailScope = params.scopes.some((scope) =>
    scope.includes("gmail")
  );
  const hasCalendarScope = params.scopes.some((scope) =>
    scope.includes("calendar")
  );

  if (!hasGmailScope && !hasCalendarScope) {
    throw new Error("No valid Gmail or Calendar scopes found");
  }

  const integrationIds: string[] = [];

  // Upsert Gmail integration if scope is present
  if (hasGmailScope) {
    // Get existing integration to preserve refresh token if new one is null
    const { data: existingIntegration } = await supabase
      .from("integrations")
      .select("refresh_token")
      .eq("workspace_id", params.workspaceId)
      .eq("provider", "gmail")
      .eq("integration_type", "oauth")
      .eq("is_active", true)
      .single();

    // Preserve existing refresh token if new one is not provided and preserveRefreshToken is true
    const refreshTokenToStore = 
      params.refreshToken || 
      (params.preserveRefreshToken && existingIntegration?.refresh_token) || 
      null;

    // First, deactivate any existing active integration for this workspace/provider
    await supabase
      .from("integrations")
      .update({ is_active: false })
      .eq("workspace_id", params.workspaceId)
      .eq("provider", "gmail")
      .eq("integration_type", "oauth")
      .eq("is_active", true);

    // Then insert new active integration
    const { data: gmailIntegration, error: gmailError } = await supabase
      .from("integrations")
      .insert({
        workspace_id: params.workspaceId,
        user_id: params.userId,
        provider: "gmail",
        integration_type: "oauth",
        access_token: params.accessToken,
        refresh_token: refreshTokenToStore,
        token_expires_at: params.expiresAt?.toISOString() || null,
        scopes: params.scopes.filter((s) => s.includes("gmail")),
        is_active: true,
        sync_status: "connected",
        last_synced_at: null, // Will be updated after first sync
        metadata: {
          email: params.email,
        },
      })
      .select("id")
      .single();

    if (gmailError) {
      throw new Error(`Failed to upsert Gmail integration: ${gmailError.message}`);
    }

    if (gmailIntegration?.id) {
      integrationIds.push(gmailIntegration.id);
    }
  }

  // Upsert Calendar integration if scope is present
  if (hasCalendarScope) {
    // Get existing integration to preserve refresh token if new one is null
    const { data: existingIntegration } = await supabase
      .from("integrations")
      .select("refresh_token")
      .eq("workspace_id", params.workspaceId)
      .eq("provider", "google_calendar")
      .eq("integration_type", "oauth")
      .eq("is_active", true)
      .single();

    // Preserve existing refresh token if new one is not provided and preserveRefreshToken is true
    const refreshTokenToStore = 
      params.refreshToken || 
      (params.preserveRefreshToken && existingIntegration?.refresh_token) || 
      null;

    // First, deactivate any existing active integration for this workspace/provider
    await supabase
      .from("integrations")
      .update({ is_active: false })
      .eq("workspace_id", params.workspaceId)
      .eq("provider", "google_calendar")
      .eq("integration_type", "oauth")
      .eq("is_active", true);

    // Then insert new active integration
    const { data: calendarIntegration, error: calendarError } = await supabase
      .from("integrations")
      .insert({
        workspace_id: params.workspaceId,
        user_id: params.userId,
        provider: "google_calendar",
        integration_type: "oauth",
        access_token: params.accessToken,
        refresh_token: refreshTokenToStore,
        token_expires_at: params.expiresAt?.toISOString() || null,
        scopes: params.scopes.filter((s) => s.includes("calendar")),
        is_active: true,
        sync_status: "connected",
        last_synced_at: null, // Will be updated after first sync
        metadata: {
          email: params.email,
        },
      })
      .select("id")
      .single();

    if (calendarError) {
      throw new Error(
        `Failed to upsert Calendar integration: ${calendarError.message}`
      );
    }

    if (calendarIntegration?.id) {
      integrationIds.push(calendarIntegration.id);
    }
  }

  if (integrationIds.length === 0) {
    throw new Error("No integrations were created");
  }

  // Return the first integration ID (typically Gmail if both exist)
  return { integrationId: integrationIds[0] };
}

/**
 * Get workspace integration by provider
 */
export async function getWorkspaceIntegration(
  workspaceId: string,
  provider: "gmail" | "google_calendar"
) {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .eq("integration_type", "oauth")
    .eq("is_active", true)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = not found, which is okay
    throw new Error(`Failed to get integration: ${error.message}`);
  }

  return data;
}

/**
 * Get user's workspace (create if doesn't exist)
 */
export async function getOrCreateWorkspace(userId: string): Promise<{
  id: string;
  owner_user_id: string;
}> {
  const supabase = getSupabaseServerClient();

  // Try to get existing workspace
  let { data: workspace, error: fetchError } = await supabase
    .from("workspaces")
    .select("id, owner_user_id")
    .eq("owner_user_id", userId)
    .single();

  if (fetchError && fetchError.code === "PGRST116") {
    // Workspace doesn't exist, create it
    const { data: newWorkspace, error: createError } = await supabase
      .from("workspaces")
      .insert({
        owner_user_id: userId,
        name: null, // Can be set later
      })
      .select("id, owner_user_id")
      .single();

    if (createError || !newWorkspace) {
      throw new Error(
        `Failed to create workspace: ${createError?.message || "Unknown error"}`
      );
    }

    return newWorkspace;
  }

  if (fetchError || !workspace) {
    throw new Error(
      `Failed to get workspace: ${fetchError?.message || "Unknown error"}`
    );
  }

  return workspace;
}

