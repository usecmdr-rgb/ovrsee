/**
 * User signup utilities
 * Handles creating user, profile, and default subscription in Supabase
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { ProfileInsert } from "@/types/database";

export interface SignupData {
  email: string;
  password: string;
  fullName?: string;
  companyName?: string;
}

/**
 * Create a new user account in Supabase Auth
 * The database trigger will automatically create profile and subscription
 * But we can also ensure it happens here for safety
 */
export async function createUserAccount(data: SignupData) {
  const supabase = getSupabaseServerClient();
  
  // Verify service role key is available (required for admin.createUser)
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is missing - cannot create user");
    throw new Error("Server configuration error: Missing service role key");
  }

  console.log("=== SIGNUP DEBUG START ===");
  console.log("Email:", data.email);
  console.log("Has service key:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log("Service key length:", process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0);
  console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Missing");
  console.log("Supabase URL value:", process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + "...");
  
  // Verify Supabase client is working
  try {
    const testQuery = await supabase.from("profiles").select("id").limit(1);
    console.log("Supabase connection test:", testQuery.error ? "Failed" : "OK");
    if (testQuery.error) {
      console.error("Supabase connection error:", testQuery.error);
    }
  } catch (testErr: any) {
    console.error("Supabase client test failed:", testErr);
  }

  // Create user in Supabase Auth
  let authData, authError;
  try {
    console.log("Calling Supabase admin.createUser...");
    const result = await supabase.auth.admin.createUser({
      email: data.email.toLowerCase().trim(),
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName || "",
        company_name: data.companyName || "",
      },
    });
    
    authData = result.data;
    authError = result.error;
    
    console.log("=== SUPABASE RESPONSE ===");
    console.log("Result:", result);
    console.log("Result.data:", result.data);
    console.log("Result.error:", result.error);
    console.log("authData:", authData);
    console.log("authError:", authError);
    
    if (authError) {
      console.log("authError type:", typeof authError);
      console.log("authError.constructor:", authError.constructor?.name);
      console.log("authError.message:", authError.message);
      console.log("authError.status:", authError.status);
      console.log("authError.statusCode:", (authError as any).statusCode);
      console.log("authError.code:", authError.code);
      console.log("authError.name:", authError.name);
      console.log("authError.toString():", authError.toString());
      
      // Try to get all enumerable properties
      try {
        const errorProps: Record<string, any> = {};
        for (const key in authError) {
          errorProps[key] = (authError as any)[key];
        }
        console.log("authError properties:", errorProps);
      } catch (e) {
        console.log("Could not enumerate error properties:", e);
      }
    }
    
    console.log("Has user:", !!authData?.user);
    console.log("User ID:", authData?.user?.id);
    console.log("=== END SUPABASE RESPONSE ===");
  } catch (err: any) {
    console.error("=== EXCEPTION DURING admin.createUser ===");
    console.error("Error object:", err);
    console.error("Error message:", err?.message);
    console.error("Error stack:", err?.stack);
    console.error("Error name:", err?.name);
    console.error("Error cause:", err?.cause);
    try {
      console.error("Full error JSON:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    } catch (e) {
      console.error("Could not stringify error:", e);
    }
    console.error("=== END EXCEPTION ===");
    throw new Error(`Failed to create user: ${err?.message || 'Unknown error'}`);
  }

  console.log("=== CHECKING RESULT ===");
  console.log("authError exists:", !!authError);
  console.log("authData.user exists:", !!authData?.user);
  
  if (authError || !authData?.user) {
    // Log detailed error for debugging - log raw error first
    console.error("=== SIGNUP ERROR DEBUG ===");
    console.error("Raw authError:", authError);
    if (authError) {
      console.error("authError type:", typeof authError);
      console.error("authError message:", authError?.message);
      console.error("authError status:", authError?.status);
      console.error("authError code:", authError?.code);
      console.error("authError name:", authError?.name);
      console.error("authError toString:", authError?.toString());
      
      // Try to get all properties
      if (typeof authError === 'object') {
        console.error("authError keys:", Object.keys(authError));
        for (const key in authError) {
          console.error(`authError.${key}:`, authError[key]);
        }
      }
    }
    console.error("authData:", authData);
    console.error("authData.user:", authData?.user);
    console.error("hasError:", !!authError);
    console.error("hasUser:", !!authData?.user);
    
    // Try to stringify safely
    try {
      const errorDetails: any = {
        hasError: !!authError,
        hasUser: !!authData?.user,
      };
      if (authError) {
        errorDetails.message = authError?.message;
        errorDetails.status = authError?.status;
        errorDetails.code = authError?.code;
        errorDetails.name = authError?.name;
      }
      console.error("Error details (JSON):", JSON.stringify(errorDetails, null, 2));
    } catch (e) {
      console.error("Could not stringify error:", e);
    }
    console.error("=== END SIGNUP ERROR DEBUG ===");
    
    // Provide more specific error messages based on error code/message
    if (authError) {
      const errorMsg = authError.message || authError.toString() || "";
      const errorStatus = authError.status;
      const errorCode = authError.code;
      
      console.error("Processing error:", { errorMsg, errorStatus, errorCode });
      
      // Check for specific Supabase error codes
      if (errorStatus === 422 || errorMsg.includes("already registered") || errorMsg.includes("already exists")) {
        throw new Error("An account with this email already exists");
      }
      
      if (errorMsg.includes("password") || errorCode === "weak_password") {
        throw new Error("Invalid password. Please ensure it meets the requirements.");
      }
      
      if (errorMsg.includes("email") || errorCode === "invalid_email") {
        throw new Error("Invalid email address");
      }
      
      // Check for service role key issues
      if (errorMsg.includes("JWT") || errorMsg.includes("token") || errorStatus === 401 || errorStatus === 403) {
        console.error("Possible service role key issue:", authError);
        throw new Error("Server configuration error. Please contact support.");
      }
      
      // Return the actual error message if available
      const finalErrorMsg = errorMsg || 
        (errorStatus ? `Failed to create user account (status: ${errorStatus})` : null) ||
        (errorCode ? `Failed to create user account (code: ${errorCode})` : null) ||
        "Database error creating new user";
      throw new Error(finalErrorMsg);
    }
    
    // If no error but also no user, something went wrong
    if (!authData?.user) {
      console.error("No error but no user created - this is unexpected");
      throw new Error("User account was not created. Please try again.");
    }
  }
  
  console.log("=== USER CREATED SUCCESSFULLY ===");
  console.log("User ID:", authData.user.id);
  console.log("User email:", authData.user.email);

  const userId = authData.user.id;

  // Ensure profile exists (trigger should create it, but ensure for safety)
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!existingProfile) {
    console.log("Profile not found, creating fallback profile...");
    // Use minimal fields like the trigger does to avoid constraint issues
    const profileData = {
      id: userId,
      email: data.email.toLowerCase().trim(),
      full_name: data.fullName || null,
      company_name: data.companyName || null,
      // Don't set subscription_tier/subscription_status - let subscriptions table handle it
      // These fields may have constraints that could fail
    };

    const { data: newProfile, error: profileError } = await supabase
      .from("profiles")
      .insert(profileData)
      .select()
      .single();

    if (profileError) {
      console.error("Error creating profile fallback:", profileError);
      console.error("Profile error details:", {
        message: profileError.message,
        code: profileError.code,
        details: profileError.details,
        hint: profileError.hint,
      });
      // Don't throw - user is created, profile can be fixed later
    } else {
      console.log("Fallback profile created successfully:", newProfile?.id);
    }
  } else {
    console.log("Profile already exists (created by trigger):", existingProfile.id);
  }

  // Ensure subscription exists (trigger should create it, but ensure for safety)
  const { data: existingSubscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!existingSubscription) {
    // Create 3-day free trial subscription
    const trialStart = new Date();
    const trialEnd = new Date(trialStart);
    trialEnd.setDate(trialEnd.getDate() + 3);

    const { error: subError } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId,
        tier: "trial",
        status: "active",
        trial_started_at: trialStart.toISOString(),
        trial_ends_at: trialEnd.toISOString(),
      });

    if (subError) {
      console.error("Error creating subscription:", subError);
      // Don't throw - trigger might have created it
    }
  }

  return {
    user: authData.user,
    profile: existingProfile || null,
  };
}

/**
 * Ensure user has profile and subscription (idempotent)
 * Useful for migrating existing users or fixing data inconsistencies
 */
export async function ensureUserProfileAndSubscription(userId: string, email: string) {
  const supabase = getSupabaseServerClient();

  // Check if profile exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!existingProfile) {
    const profileData: ProfileInsert = {
      id: userId,
      email,
      full_name: null,
      avatar_url: null,
      company_name: null,
      subscription_tier: "trial",
      subscription_status: "active",
      stripe_customer_id: null,
      stripe_subscription_id: null,
      trial_started_at: null,
      trial_ends_at: null,
      trial_ended_at: null,
      data_retention_expires_at: null,
      data_retention_reason: null,
      paid_canceled_at: null,
    };

    await supabase.from("profiles").insert(profileData);
  }

  // Check if subscription exists
  const { data: existingSubscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!existingSubscription) {
    // Create 3-day free trial
    const trialStart = new Date();
    const trialEnd = new Date(trialStart);
    trialEnd.setDate(trialEnd.getDate() + 3);

    await supabase.from("subscriptions").insert({
      user_id: userId,
      tier: "trial",
      status: "active",
      trial_started_at: trialStart.toISOString(),
      trial_ends_at: trialEnd.toISOString(),
    });
  }
}

