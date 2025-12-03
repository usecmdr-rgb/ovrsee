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

