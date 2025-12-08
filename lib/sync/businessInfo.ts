/**
 * Business Info Management Service
 * Manages business profiles, services, pricing, hours, and FAQs
 * Used by Sync for business-aware email drafting
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";

export interface BusinessProfile {
  id: string;
  user_id: string;
  business_name: string;
  website_url?: string | null;
  description?: string | null;
  default_currency: string;
  brand_voice: "formal" | "friendly" | "casual_professional" | "professional" | "casual";
  created_at: string;
  updated_at: string;
}

export interface BusinessService {
  id: string;
  business_id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessPricingTier {
  id: string;
  business_id: string;
  service_id?: string | null;
  name: string;
  description?: string | null;
  price_amount: number;
  price_currency: string;
  billing_interval: "one_time" | "monthly" | "yearly" | "hourly" | "daily" | "weekly";
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessHours {
  id: string;
  business_id: string;
  day_of_week: number; // 0 = Sunday, 6 = Saturday
  open_time?: string | null; // TIME format
  close_time?: string | null; // TIME format
  timezone: string;
  is_closed: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessFAQ {
  id: string;
  business_id: string;
  question: string;
  answer: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessContextBundle {
  profile: BusinessProfile | null;
  services: BusinessService[];
  pricingTiers: BusinessPricingTier[];
  hours: BusinessHours[];
  faqs: BusinessFAQ[];
  websiteSummary?: string | null;
}

/**
 * Upsert business profile for a user
 */
export async function upsertBusinessProfile(
  userId: string,
  data: {
    business_name: string;
    website_url?: string | null;
    description?: string | null;
    default_currency?: string;
    brand_voice?: BusinessProfile["brand_voice"];
  }
): Promise<BusinessProfile> {
  const supabase = getSupabaseServerClient();

  const { data: profile, error } = await supabase
    .from("business_profiles")
    .upsert(
      {
        user_id: userId,
        ...data,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert business profile: ${error.message}`);
  }

  return profile;
}

/**
 * Get business profile by user ID
 */
export async function getBusinessProfileByUserId(
  userId: string
): Promise<BusinessProfile | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // Not found
      return null;
    }
    throw new Error(`Failed to fetch business profile: ${error.message}`);
  }

  return data;
}

/**
 * Create or update a business service
 */
export async function upsertBusinessService(
  businessId: string,
  serviceId: string | undefined,
  data: {
    name: string;
    description?: string | null;
    category?: string | null;
    is_active?: boolean;
  }
): Promise<BusinessService> {
  const supabase = getSupabaseServerClient();

  const payload = {
    business_id: businessId,
    ...data,
    updated_at: new Date().toISOString(),
  };

  if (serviceId) {
    // Update existing
    const { data: service, error } = await supabase
      .from("business_services")
      .update(payload)
      .eq("id", serviceId)
      .eq("business_id", businessId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update business service: ${error.message}`);
    }

    return service;
  } else {
    // Create new
    const { data: service, error } = await supabase
      .from("business_services")
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create business service: ${error.message}`);
    }

    return service;
  }
}

/**
 * Delete a business service
 */
export async function deleteBusinessService(
  businessId: string,
  serviceId: string
): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase
    .from("business_services")
    .delete()
    .eq("id", serviceId)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(`Failed to delete business service: ${error.message}`);
  }
}

/**
 * Create or update a business pricing tier
 */
export async function upsertBusinessPricingTier(
  businessId: string,
  tierId: string | undefined,
  data: {
    service_id?: string | null;
    name: string;
    description?: string | null;
    price_amount: number;
    price_currency?: string;
    billing_interval?: BusinessPricingTier["billing_interval"];
    is_default?: boolean;
    is_active?: boolean;
  }
): Promise<BusinessPricingTier> {
  const supabase = getSupabaseServerClient();

  const payload = {
    business_id: businessId,
    ...data,
    updated_at: new Date().toISOString(),
  };

  if (tierId) {
    // Update existing
    const { data: tier, error } = await supabase
      .from("business_pricing_tiers")
      .update(payload)
      .eq("id", tierId)
      .eq("business_id", businessId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update pricing tier: ${error.message}`);
    }

    return tier;
  } else {
    // Create new
    const { data: tier, error } = await supabase
      .from("business_pricing_tiers")
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create pricing tier: ${error.message}`);
    }

    return tier;
  }
}

/**
 * Delete a business pricing tier
 */
export async function deleteBusinessPricingTier(
  businessId: string,
  tierId: string
): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase
    .from("business_pricing_tiers")
    .delete()
    .eq("id", tierId)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(`Failed to delete pricing tier: ${error.message}`);
  }
}

/**
 * Set business hours for a day
 */
export async function setBusinessHours(
  businessId: string,
  dayOfWeek: number,
  data: {
    open_time?: string | null;
    close_time?: string | null;
    timezone?: string;
    is_closed?: boolean;
  }
): Promise<BusinessHours> {
  const supabase = getSupabaseServerClient();

  const { data: hours, error } = await supabase
    .from("business_hours")
    .upsert(
      {
        business_id: businessId,
        day_of_week: dayOfWeek,
        ...data,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "business_id,day_of_week",
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to set business hours: ${error.message}`);
  }

  return hours;
}

/**
 * Create or update a business FAQ
 */
export async function upsertBusinessFAQ(
  businessId: string,
  faqId: string | undefined,
  data: {
    question: string;
    answer: string;
  }
): Promise<BusinessFAQ> {
  const supabase = getSupabaseServerClient();

  const payload = {
    business_id: businessId,
    ...data,
    updated_at: new Date().toISOString(),
  };

  if (faqId) {
    // Update existing
    const { data: faq, error } = await supabase
      .from("business_faqs")
      .update(payload)
      .eq("id", faqId)
      .eq("business_id", businessId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update FAQ: ${error.message}`);
    }

    return faq;
  } else {
    // Create new
    const { data: faq, error } = await supabase
      .from("business_faqs")
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create FAQ: ${error.message}`);
    }

    return faq;
  }
}

/**
 * Get complete business context bundle for a user
 * This is the main function used by AI draft generation
 */
export async function getBusinessContextForUser(
  userId: string
): Promise<BusinessContextBundle | null> {
  const supabase = getSupabaseServerClient();

  // Get business profile
  const profile = await getBusinessProfileByUserId(userId);
  if (!profile) {
    return null;
  }

  // Fetch all related data in parallel
  const [servicesResult, pricingResult, hoursResult, faqsResult, websiteResult] = await Promise.all([
    supabase
      .from("business_services")
      .select("*")
      .eq("business_id", profile.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("business_pricing_tiers")
      .select("*")
      .eq("business_id", profile.id)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("price_amount"),
    supabase
      .from("business_hours")
      .select("*")
      .eq("business_id", profile.id)
      .order("day_of_week"),
    supabase
      .from("business_faqs")
      .select("*")
      .eq("business_id", profile.id)
      .order("created_at"),
    supabase
      .from("business_website_snapshots")
      .select("content_text")
      .eq("business_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
  ]);

  // Combine website snapshots into summary
  let websiteSummary: string | null = null;
  if (websiteResult.data) {
    websiteSummary = websiteResult.data.content_text;
  } else if (websiteResult.error && websiteResult.error.code !== "PGRST116") {
    console.warn("[BusinessInfo] Error fetching website snapshot:", websiteResult.error);
  }

  return {
    profile,
    services: servicesResult.data || [],
    pricingTiers: pricingResult.data || [],
    hours: hoursResult.data || [],
    faqs: faqsResult.data || [],
    websiteSummary,
  };
}


