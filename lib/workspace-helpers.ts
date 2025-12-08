/**
 * Workspace helper functions
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Get workspace ID for a user (creates if doesn't exist)
 * @param userId - The user ID
 * @param supabaseClient - Optional authenticated Supabase client (for RLS). If not provided, uses service role client.
 */
export async function getWorkspaceIdForUser(
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<string | null> {
  const supabase = supabaseClient || getSupabaseServerClient();

  // Get user's workspace (create if doesn't exist)
  let { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("*")
    .eq("owner_user_id", userId)
    .single();

  if (workspaceError || !workspace) {
    // If workspace doesn't exist, create one
    const { data: newWorkspace, error: createError } = await supabase
      .from("workspaces")
      .insert({
        owner_user_id: userId,
        name: "My Workspace",
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating workspace:", createError);
      return null;
    }

    workspace = newWorkspace;

    // Create owner seat if it doesn't exist
    const { data: existingSeat } = await supabase
      .from("workspace_seats")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("user_id", userId)
      .single();

    if (!existingSeat) {
      await supabase
        .from("workspace_seats")
        .insert({
          workspace_id: workspace.id,
          user_id: userId,
          tier: "basic",
          status: "active",
          is_owner: true,
        });
    }
  }

  return workspace?.id || null;
}

/**
 * Get workspace ID from authenticated user
 */
export async function getWorkspaceIdFromAuth(): Promise<string | null> {
  const supabase = getSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  return getWorkspaceIdForUser(user.id);
}

/**
 * Get user's effective plan from workspace membership
 * Checks if user is a member of any workspace and returns their seat tier/plan
 * Returns null if user is not a workspace member
 * 
 * @param userId - The user ID
 * @param supabaseClient - Optional authenticated Supabase client
 * @returns The tier ("basic" | "advanced" | "elite") or null
 */
export async function getUserEffectivePlanFromWorkspace(
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<"basic" | "advanced" | "elite" | null> {
  const supabase = supabaseClient || getSupabaseServerClient();

  // Get user's active workspace seat
  const { data: seat } = await supabase
    .from("workspace_seats")
    .select("tier")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!seat || !seat.tier) {
    return null;
  }

  return seat.tier as "basic" | "advanced" | "elite";
}

/**
 * Check if user is a member of a workspace
 * 
 * @param userId - The user ID
 * @param workspaceId - The workspace ID
 * @param supabaseClient - Optional authenticated Supabase client
 * @returns true if user has an active seat in the workspace
 */
export async function isUserWorkspaceMember(
  userId: string,
  workspaceId: string,
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  const supabase = supabaseClient || getSupabaseServerClient();

  const { data: seat } = await supabase
    .from("workspace_seats")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  return !!seat;
}

