import { NextRequest, NextResponse } from "next/server";
import { createUserAccount } from "@/lib/auth/signup";
import { getUserSession } from "@/lib/auth/session";

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

    // Handle specific Supabase errors
    if (error.message?.includes("already registered")) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to create account" },
      { status: 500 }
    );
  }
}

