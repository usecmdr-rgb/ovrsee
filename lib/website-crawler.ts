/**
 * Website Crawler and Parser
 * 
 * Fetches and parses business websites to extract structured knowledge.
 * Stores results in business_knowledge_chunks for agents to use.
 * 
 * Behavior:
 * - Fetches main URL and important internal pages (homepage, about, services, pricing)
 * - Extracts and cleans text content
 * - Stores as knowledge chunks with source='website'
 * - Avoids re-scraping on every request (uses last_crawled_at)
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";

interface CrawlResult {
  url: string;
  title: string;
  content: string;
  success: boolean;
  error?: string;
}

/**
 * Extract text content from HTML
 * Removes navigation, footers, scripts, and other boilerplate
 */
function extractTextFromHTML(html: string): { title: string; content: string } {
  // Simple HTML parsing - in production, you might want to use a library like cheerio or jsdom
  // For now, we'll do basic regex-based extraction

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";

  // Remove script and style tags
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");

  // Remove HTML tags but keep text
  text = text.replace(/<[^>]+>/g, " ");

  // Decode HTML entities (basic)
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Clean up whitespace
  text = text
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();

  // Limit content length (keep first 5000 chars for now)
  const maxLength = 5000;
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + "...";
  }

  return { title, content: text };
}

/**
 * Get important internal links from a page
 * Returns URLs for common pages like /about, /services, /pricing, etc.
 */
function getImportantLinks(baseUrl: string, html: string): string[] {
  const url = new URL(baseUrl);
  const baseDomain = `${url.protocol}//${url.host}`;
  const links: Set<string> = new Set();

  // Extract all links
  const linkMatches = html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi);

  for (const match of linkMatches) {
    let href = match[1];

    // Convert relative URLs to absolute
    if (href.startsWith("/")) {
      href = baseDomain + href;
    } else if (href.startsWith("./") || href.startsWith("../")) {
      href = new URL(href, baseUrl).href;
    } else if (!href.startsWith("http")) {
      continue; // Skip mailto:, javascript:, etc.
    }

    // Only include same-domain links
    try {
      const linkUrl = new URL(href);
      if (linkUrl.host === url.host) {
        // Check if it's an important page
        const path = linkUrl.pathname.toLowerCase();
        if (
          path.includes("about") ||
          path.includes("services") ||
          path.includes("pricing") ||
          path.includes("contact") ||
          path.includes("faq") ||
          path === "/" ||
          path === ""
        ) {
          links.add(href);
        }
      }
    } catch (e) {
      // Invalid URL, skip
    }
  }

  return Array.from(links).slice(0, 10); // Limit to 10 pages
}

/**
 * Crawl a single URL and extract content
 */
async function crawlUrl(url: string): Promise<CrawlResult> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; OVRSEEBot/1.0; +https://ovrsee.com/bot)",
      },
      // Timeout after 10 seconds
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return {
        url,
        title: "",
        content: "",
        success: false,
        error: `HTTP ${response.status}`,
      };
    }

    const html = await response.text();
    const { title, content } = extractTextFromHTML(html);

    return {
      url,
      title,
      content,
      success: true,
    };
  } catch (error: any) {
    return {
      url,
      title: "",
      content: "",
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

/**
 * Crawl business website and store knowledge chunks
 * 
 * @param businessProfileId - Business profile ID
 * @param websiteUrl - Primary website URL to crawl
 * @param forceRefresh - If true, crawl even if recently crawled
 */
export async function crawlBusinessWebsite(
  businessProfileId: string,
  websiteUrl: string,
  forceRefresh: boolean = false
): Promise<{ success: boolean; chunksCreated: number; error?: string }> {
  const supabase = getSupabaseServerClient();

  // Check if we should skip crawling (not forced and recently crawled)
  if (!forceRefresh) {
    const { data: profile } = await supabase
      .from("business_profiles")
      .select("last_crawled_at, crawl_status")
      .eq("id", businessProfileId)
      .single();

    if (profile) {
      // If crawled in last 7 days and status is completed, skip
      if (profile.last_crawled_at && profile.crawl_status === "completed") {
        const lastCrawled = new Date(profile.last_crawled_at);
        const daysSinceCrawl =
          (Date.now() - lastCrawled.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceCrawl < 7) {
          return {
            success: true,
            chunksCreated: 0,
            error: "Website was recently crawled, skipping",
          };
        }
      }
    }
  }

  // Update crawl status to in_progress
  await supabase
    .from("business_profiles")
    .update({
      crawl_status: "in_progress",
      crawl_error: null,
    })
    .eq("id", businessProfileId);

  try {
    // Validate URL
    let url = websiteUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    new URL(url); // Validate URL format

    // Crawl main page
    const mainPageResult = await crawlUrl(url);
    const pagesToCrawl: string[] = [url];

    // If main page succeeded, find important links
    if (mainPageResult.success && mainPageResult.content) {
      const html = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; OVRSEEBot/1.0; +https://ovrsee.com/bot)",
        },
      }).then((r) => r.text());

      const importantLinks = getImportantLinks(url, html);
      pagesToCrawl.push(...importantLinks.slice(0, 5)); // Limit to 5 additional pages
    }

    // Remove duplicates
    const uniquePages = Array.from(new Set(pagesToCrawl));

    // Crawl all pages
    const crawlResults = await Promise.all(
      uniquePages.map((pageUrl) => crawlUrl(pageUrl))
    );

    // Delete old website knowledge chunks
    await supabase
      .from("business_knowledge_chunks")
      .delete()
      .eq("business_profile_id", businessProfileId)
      .eq("source", "website");

    // Store successful crawls as knowledge chunks
    const chunksToInsert = crawlResults
      .filter((result) => result.success && result.content)
      .map((result) => ({
        business_profile_id: businessProfileId,
        source: "website" as const,
        source_url: result.url,
        title: result.title || new URL(result.url).pathname,
        content: result.content,
        metadata: {
          crawled_at: new Date().toISOString(),
        },
      }));

    if (chunksToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("business_knowledge_chunks")
        .insert(chunksToInsert);

      if (insertError) {
        throw insertError;
      }
    }

    // Update crawl status
    await supabase
      .from("business_profiles")
      .update({
        last_crawled_at: new Date().toISOString(),
        crawl_status: "completed",
        crawl_error: null,
      })
      .eq("id", businessProfileId);

    return {
      success: true,
      chunksCreated: chunksToInsert.length,
    };
  } catch (error: any) {
    // Update crawl status with error
    await supabase
      .from("business_profiles")
      .update({
        crawl_status: "failed",
        crawl_error: error.message || "Unknown error",
      })
      .eq("id", businessProfileId);

    return {
      success: false,
      chunksCreated: 0,
      error: error.message || "Failed to crawl website",
    };
  }
}








