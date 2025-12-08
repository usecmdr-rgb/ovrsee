import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { createErrorResponse } from "@/lib/validation";
import { crawlBusinessWebsite } from "@/lib/website-crawler";
import { getBusinessContext } from "@/lib/business-context";

/**
 * GET /api/business-profile
 * 
 * Get business profile and knowledge chunks for the authenticated user
 * 
 * Query params:
 * - query: Optional filter for knowledge chunks (e.g., "pricing", "services")
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || undefined;

    const context = await getBusinessContext(user.id, undefined, query);

    if (!context) {
      return NextResponse.json({
        profile: null,
        knowledgeChunks: [],
      });
    }

    return NextResponse.json(context);
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return createErrorResponse("Authentication required", 401);
    }
    return createErrorResponse("Failed to fetch business profile", 500, error);
  }
}

/**
 * POST /api/business-profile
 * 
 * Create or update business profile from "Help us, help you" form
 * 
 * Body:
 * - All business profile fields (businessName, website, services, etc.)
 * - watermarkSettings (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const body = await request.json();

    const supabase = getSupabaseServerClient();

    // Prepare profile data
    const profileData: any = {
      user_id: user.id,
      full_name: body.fullName || null,
      business_name: body.businessName || null,
      business_type: body.businessType || null,
      description: body.description || null,
      primary_website_url: body.website || null,
      location: body.location || null,
      service_area: body.serviceArea || null,
      contact_email: body.contactEmail || null,
      contact_phone: body.contactPhone || null,
      services_offered: body.services || null, // Can be string or JSONB
      hours_of_operation: body.operatingHours || null,
      service_name: body.serviceName || null,
      language: body.language || "English",
      timezone: body.timezone || "EST",
      notes: body.notes || null,
    };

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from("business_profiles")
      .select("id, primary_website_url")
      .eq("user_id", user.id)
      .single();

    let profileId: string;
    let websiteUrlChanged = false;

    if (existingProfile) {
      // Update existing profile
      profileId = existingProfile.id;

      // Check if website URL changed
      if (body.website && existingProfile.primary_website_url !== body.website) {
        websiteUrlChanged = true;
      }

      const { error: updateError } = await supabase
        .from("business_profiles")
        .update(profileData)
        .eq("id", profileId);

      if (updateError) {
        console.error("[Business Profile] Update error:", updateError);
        console.error("[Business Profile] Profile data:", JSON.stringify(profileData, null, 2));
        throw updateError;
      }
    } else {
      // Create new profile
      const { data: newProfile, error: insertError } = await supabase
        .from("business_profiles")
        .insert(profileData)
        .select("id")
        .single();

      if (insertError) {
        console.error("[Business Profile] Insert error:", insertError);
        throw insertError;
      }

      profileId = newProfile.id;
      websiteUrlChanged = !!body.website;
    }

    // Store form data as knowledge chunk
    const formKnowledgeContent = [
      body.businessName && `Business Name: ${body.businessName}`,
      body.businessType && `Industry: ${body.businessType}`,
      body.description && `Description: ${body.description}`,
      body.services && `Services: ${body.services}`,
      body.operatingHours && `Operating Hours: ${body.operatingHours}`,
      body.location && `Location: ${body.location}`,
      body.notes && `Special Instructions: ${body.notes}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    if (formKnowledgeContent) {
      // Delete old form knowledge chunks
      await supabase
        .from("business_knowledge_chunks")
        .delete()
        .eq("business_profile_id", profileId)
        .eq("source", "form");

      // Insert new form knowledge chunk
      await supabase.from("business_knowledge_chunks").insert({
        business_profile_id: profileId,
        source: "form",
        title: "Business Information Form",
        content: formKnowledgeContent,
        metadata: {
          submitted_at: new Date().toISOString(),
        },
      });
    }

    // If website URL is provided and (new profile or URL changed), trigger crawl
    if (body.website && websiteUrlChanged) {
      // Trigger crawl asynchronously (don't wait for it)
      crawlBusinessWebsite(profileId, body.website, true).catch((error) => {
        console.error("Error crawling website:", error);
      });
    }

    // Return updated context
    const context = await getBusinessContext(undefined, profileId);

    return NextResponse.json({
      success: true,
      profileId,
      context,
    });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return createErrorResponse("Authentication required", 401);
    }
    return createErrorResponse("Failed to save business profile", 500, error);
  }
}

