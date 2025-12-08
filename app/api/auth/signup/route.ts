import { NextRequest, NextResponse } from "next/server";
import { createUserAccount } from "@/lib/auth/signup";
import { getUserSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";

/**
 * POST /api/auth/signup
 * Creates a new user account with profile and default subscription
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, fullName, companyName } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Check if email already exists in Supabase Auth
    const supabase = getSupabaseServerClient();
    try {
      // Use admin API to check if user exists
      const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
      
      if (!listError && existingUsers?.users) {
        const emailExists = existingUsers.users.some(
          (user) => user.email?.toLowerCase() === email.toLowerCase()
        );
        
        if (emailExists) {
          return NextResponse.json(
            { error: "An account with this email already exists" },
            { status: 409 }
          );
        }
      }
    } catch (checkError: any) {
      console.error("Error checking for existing email:", checkError);
      // Continue with signup attempt - Supabase will also check and return appropriate error
    }

    // Create user account (this will trigger database triggers to create profile and subscription)
    const { user } = await createUserAccount({
      email,
      password,
      fullName,
      companyName,
    });

    // Get complete session data
    const session = await getUserSession(user.id, user.email);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
      session,
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    console.error("Signup error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause,
    });

    // Handle specific Supabase errors
    if (error.message?.includes("already registered") || error.message?.includes("already exists")) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Check for database/constraint errors
    if (error.message?.includes("violates") || error.message?.includes("constraint")) {
      console.error("Database constraint violation:", error);
      return NextResponse.json(
        { error: "Account creation failed due to a database error. Please contact support." },
        { status: 500 }
      );
    }

    // Check for missing service role key
    if (error.message?.includes("Supabase configuration is missing") || error.message?.includes("SERVICE_ROLE_KEY")) {
      console.error("Missing Supabase configuration:", error);
      return NextResponse.json(
        { error: "Server configuration error. Please contact support." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to create account" },
      { status: 500 }
    );
  }
}

