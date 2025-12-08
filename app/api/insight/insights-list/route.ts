import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getTimeRangeBounds } from "@/lib/insight/utils";
import type { Insight, TimeRange } from "@/types";

/**
 * GET /api/insight/insights-list
 * 
 * Fetch insights for the current user with optional filters
 * 
 * Query params:
 * - range: 'daily' | 'weekly' | 'monthly' (default: 'daily')
 * - source: filter by source (optional)
 * - category: filter by category (optional)
 * - severity: filter by severity (optional)
 * - filter: 'all' | 'important' | 'warnings' | 'critical' (default: 'all')
 * - limit: number of results (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    
    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const range = (searchParams.get("range") || "daily") as TimeRange;
    const source = searchParams.get("source");
    const category = searchParams.get("category");
    const severity = searchParams.get("severity");
    const filter = searchParams.get("filter") || "all";
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // Calculate time range bounds
    const { start, end } = getTimeRangeBounds(range);

    // Build query
    let query = supabase
      .from("insights")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false })
      .limit(limit);

    // Apply filters
    if (source) {
      query = query.eq("source", source);
    }
    if (category) {
      query = query.eq("category", category);
    }
    if (severity) {
      query = query.eq("severity", severity);
    }

    // Apply filter presets
    if (filter === "important") {
      query = query.in("severity", ["warning", "critical"]);
    } else if (filter === "warnings") {
      query = query.eq("severity", "warning");
    } else if (filter === "critical") {
      query = query.eq("severity", "critical");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching insights:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Transform data to match Insight type
    const insights: Insight[] = (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      source: row.source,
      category: row.category,
      severity: row.severity,
      title: row.title,
      description: row.description,
      timeRange: row.time_range,
      tags: row.tags || [],
      actions: row.actions || [],
      isRead: row.is_read || false,
      dismissedAt: row.dismissed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata || {},
    }));

    return NextResponse.json({ ok: true, data: insights });
  } catch (error: any) {
    console.error("Error in insights-list endpoint:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/insight/insights-list
 * 
 * Create a new insight
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      source,
      category,
      severity = "info",
      title,
      description,
      timeRange,
      tags = [],
      actions = [],
      metadata = {},
    } = body;

    if (!source || !category || !title || !description) {
      return NextResponse.json(
        { error: "Missing required fields: source, category, title, description" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("insights")
      .insert({
        user_id: user.id,
        source,
        category,
        severity,
        title,
        description,
        time_range: timeRange,
        tags,
        actions,
        metadata,
        is_read: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating insight:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const insight: Insight = {
      id: data.id,
      userId: data.user_id,
      source: data.source,
      category: data.category,
      severity: data.severity,
      title: data.title,
      description: data.description,
      timeRange: data.time_range,
      tags: data.tags || [],
      actions: data.actions || [],
      isRead: data.is_read || false,
      dismissedAt: data.dismissed_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      metadata: data.metadata || {},
    };

    return NextResponse.json({ ok: true, data: insight });
  } catch (error: any) {
    console.error("Error in insights-list POST endpoint:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}




