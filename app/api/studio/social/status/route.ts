/**
 * Studio Social Account Status API
 * 
 * GET /api/studio/social/status
 * 
 * Returns health status for all connected social accounts in the workspace.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { getSocialAccounts } from "@/lib/studio/social-account-service";
import { checkAccountHealth as checkInstagramHealth } from "@/lib/studio/platform-clients/instagram-client";
import { checkAccountHealth as checkFacebookHealth } from "@/lib/studio/platform-clients/facebook-client";
import { checkAccountHealth as checkTikTokHealth } from "@/lib/studio/platform-clients/tiktok-client";
import { ensureFreshAccessToken } from "@/lib/studio/social-account-service";
import { logInfo, logError } from "@/lib/studio/logging";
import { handleApiError } from "@/lib/studio/api-error-response";

export interface AccountStatus {
  accountId: string;
  platform: "instagram" | "tiktok" | "facebook";
  handle: string | null;
  status: "ok" | "token_expiring" | "token_expired" | "permissions_missing" | "unknown_error";
  message: string;
  lastCheckedAt: string;
}

export async function GET(request: NextRequest) {
  const { supabase, response } = await getAuthenticatedSupabaseFromRequest(request);
  const user = await supabase.auth.getUser();

  if (user.error || !user.data?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdForUser(supabase, user.data.user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  try {
    // Get all connected accounts
    const accounts = await getSocialAccounts(workspaceId, {
      includeCredentials: false,
      supabaseClient: supabase,
    });

    const connectedAccounts = accounts.filter((acc) => acc.status === "connected");
    const statuses: AccountStatus[] = [];

    // Check health for each account
    for (const account of connectedAccounts) {
      try {
        // First, try to ensure fresh token (this will refresh if needed)
        let tokenStatus: "ok" | "token_expiring" | "token_expired" = "ok";
        try {
          await ensureFreshAccessToken(account, supabase);
        } catch (error: any) {
          if (error.message?.includes("expired") || error.message?.includes("Token expired")) {
            tokenStatus = "token_expired";
          } else if (error.message?.includes("expiring")) {
            tokenStatus = "token_expiring";
          }
        }

        // Then check account health
        let health;
        let accessToken: string | undefined;

        try {
          accessToken = await ensureFreshAccessToken(account, supabase);
        } catch {
          // Token refresh failed, but we'll still try health check
        }

        if (!accessToken || tokenStatus === "token_expired") {
          statuses.push({
            accountId: account.id,
            platform: account.platform,
            handle: account.handle,
            status: "token_expired",
            message: "Token expired. Please reconnect your account.",
            lastCheckedAt: new Date().toISOString(),
          });
          continue;
        }

        // Call platform-specific health check
        switch (account.platform) {
          case "instagram":
            if (!account.external_account_id) {
              statuses.push({
                accountId: account.id,
                platform: account.platform,
                handle: account.handle,
                status: "unknown_error",
                message: "Account ID not found",
                lastCheckedAt: new Date().toISOString(),
              });
              continue;
            }
            health = await checkInstagramHealth({
              workspaceId,
              accessToken,
              igBusinessId: account.external_account_id,
            });
            break;

          case "facebook":
            if (!account.external_account_id) {
              statuses.push({
                accountId: account.id,
                platform: account.platform,
                handle: account.handle,
                status: "unknown_error",
                message: "Account ID not found",
                lastCheckedAt: new Date().toISOString(),
              });
              continue;
            }
            health = await checkFacebookHealth({
              workspaceId,
              accessToken,
              pageId: account.external_account_id,
            });
            break;

          case "tiktok":
            if (!account.external_account_id) {
              statuses.push({
                accountId: account.id,
                platform: account.platform,
                handle: account.handle,
                status: "unknown_error",
                message: "Account ID not found",
                lastCheckedAt: new Date().toISOString(),
              });
              continue;
            }
            health = await checkTikTokHealth({
              workspaceId,
              accessToken,
              openId: account.external_account_id,
            });
            break;

          default:
            statuses.push({
              accountId: account.id,
              platform: account.platform as any,
              handle: account.handle,
              status: "unknown_error",
              message: "Unsupported platform",
              lastCheckedAt: new Date().toISOString(),
            });
            continue;
        }

        // Determine status based on health check and token status
        let status: AccountStatus["status"] = "ok";
        let message = "Account is healthy";

        if (!health.healthy) {
          if (health.error?.includes("expired") || health.error?.includes("token")) {
            status = "token_expired";
            message = health.error || "Token expired";
          } else if (health.error?.includes("permission") || health.error?.includes("access")) {
            status = "permissions_missing";
            message = health.error || "Permissions missing";
          } else {
            status = "unknown_error";
            message = health.error || "Unknown error";
          }
        } else if (tokenStatus === "token_expiring") {
          status = "token_expiring";
          message = "Token expiring soon. Will auto-refresh when needed.";
        }

        statuses.push({
          accountId: account.id,
          platform: account.platform,
          handle: account.handle || health.accountName || null,
          status,
          message,
          lastCheckedAt: new Date().toISOString(),
        });

        await logInfo("account_health_check", {
          workspace_id: workspaceId,
          platform: account.platform,
          account_id: account.id,
          status,
        });
      } catch (error: any) {
        await logError("account_health_check_error", error, {
          workspace_id: workspaceId,
          platform: account.platform,
          account_id: account.id,
        });

        statuses.push({
          accountId: account.id,
          platform: account.platform,
          handle: account.handle,
          status: "unknown_error",
          message: error.message || "Failed to check account health",
          lastCheckedAt: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        accounts: statuses,
      },
    });
  } catch (e) {
    return handleApiError(e, { workspaceId, route: "/api/studio/social/status" });
  }
}
