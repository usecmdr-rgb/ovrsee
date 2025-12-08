/**
 * Website Knowledge Integration
 * Fetches and stores website content for AI context
 * Optional feature - can be enabled via feature flag
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { isBusinessWebsiteContextEnabled } from "./featureFlags";

/**
 * Fetch website content and store as snapshot
 * This is a minimal implementation - can be extended with full scraping
 * 
 * @param businessId - Business profile ID
 * @param url - Website URL to fetch
 * @param snapshotType - Type of snapshot (homepage, pricing, services, etc.)
 */
export async function fetchAndStoreWebsiteSnapshot(
  businessId: string,
  url: string,
  snapshotType: "homepage" | "pricing" | "services" | "about" | "contact" | "other" = "homepage"
): Promise<void> {
  if (!isBusinessWebsiteContextEnabled()) {
    console.log("[WebsiteKnowledge] Feature disabled, skipping");
    return;
  }

  try {
    // TODO: Implement actual website fetching/scraping
    // For now, this is a stub that can be extended
    // Options:
    // 1. Use a headless browser (Puppeteer, Playwright)
    // 2. Use a simple HTTP fetch and parse HTML
    // 3. Use a third-party service
    
    console.log(`[WebsiteKnowledge] Would fetch ${url} for business ${businessId}`);
    
    // Placeholder: In a real implementation, you would:
    // 1. Fetch the URL
    // 2. Extract main text content (strip HTML, scripts, etc.)
    // 3. Clean and summarize if needed
    // 4. Store in business_website_snapshots table
    
    const supabase = getSupabaseServerClient();
    
    // Example: Store a placeholder (replace with actual content)
    const contentText = `Website content from ${url} - [TODO: Implement actual scraping]`;
    
    const { error } = await supabase
      .from("business_website_snapshots")
      .upsert(
        {
          business_id: businessId,
          snapshot_type: snapshotType,
          content_text: contentText,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "business_id,snapshot_type",
        }
      );

    if (error) {
      console.error("[WebsiteKnowledge] Error storing snapshot:", error);
      throw error;
    }
  } catch (error: any) {
    console.error("[WebsiteKnowledge] Error fetching website snapshot:", error);
    // Don't throw - website knowledge is optional
  }
}

/**
 * Get website context for a business
 * Returns combined text from all snapshots
 */
export async function getBusinessWebsiteContext(
  businessId: string
): Promise<string | null> {
  if (!isBusinessWebsiteContextEnabled()) {
    return null;
  }

  const supabase = getSupabaseServerClient();

  const { data: snapshots, error } = await supabase
    .from("business_website_snapshots")
    .select("content_text, snapshot_type")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[WebsiteKnowledge] Error fetching snapshots:", error);
    return null;
  }

  if (!snapshots || snapshots.length === 0) {
    return null;
  }

  // Combine all snapshots into a single context string
  return snapshots
    .map((s) => `[${s.snapshot_type}]: ${s.content_text}`)
    .join("\n\n");
}


