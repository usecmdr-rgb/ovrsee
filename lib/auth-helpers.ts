/**
 * Server-side authentication helpers for Next.js API routes
 * These functions help verify user authentication and extract user information
 * from Supabase sessions in server-side contexts.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "./supabaseServerClient";
import type { User } from "@supabase/supabase-js";

/**
 * Get an authenticated Supabase client from Next.js cookies
 * This respects RLS policies based on the authenticated user
 */
export async function getAuthenticatedSupabaseClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing required Supabase environment variables for authenticated client"
    );
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        try {
          cookieStore.set(name, value, options);
        } catch (error) {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
      remove(name: string, options: any) {
        try {
          cookieStore.set(name, "", { ...options, maxAge: 0 });
        } catch (error) {
          // The `delete` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}

/**
 * Get authenticated user from Next.js request
 * Extracts user session from cookies
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  try {
    const supabase = await getAuthenticatedSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error("Error getting authenticated user:", error);
    return null;
  }
}

/**
 * Verify that a request is authenticated and return the user
 * Throws an error if the user is not authenticated
 */
export async function requireAuth(): Promise<User> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error("Unauthorized: Authentication required");
  }
  return user;
}

/**
 * Verify that a request is authenticated and verify the userId matches
 * This prevents users from accessing/modifying other users' data
 */
export async function requireAuthAndMatchUserId(userId: string): Promise<User> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error("Unauthorized: Authentication required");
  }
  if (user.id !== userId) {
    throw new Error("Forbidden: You can only access your own data");
  }
  return user;
}

/**
 * Get authenticated Supabase client from a Next.js request
 * Useful for route handlers that need access to the request object
 */
export async function getAuthenticatedSupabaseFromRequest(
  request: NextRequest
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing required Supabase environment variables for authenticated client"
    );
  }

  let response = NextResponse.next();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        request.cookies.set({
          name,
          value,
          ...options,
        });
        response.cookies.set({
          name,
          value,
          ...options,
        });
      },
      remove(name: string, options: any) {
        request.cookies.set({
          name,
          value: "",
          ...options,
        });
        response.cookies.set({
          name,
          value: "",
          ...options,
        });
      },
    },
  });

  return { supabase, response };
}

/**
 * Get authenticated user from a Next.js request
 */
export async function getAuthenticatedUserFromRequest(
  request: NextRequest
): Promise<User | null> {
  try {
    const { supabase } = await getAuthenticatedSupabaseFromRequest(request);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error("Error getting authenticated user from request:", error);
    return null;
  }
}

/**
 * Verify that a request is authenticated and return the user
 * Throws an error if the user is not authenticated
 */
export async function requireAuthFromRequest(request: NextRequest): Promise<User> {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) {
    throw new Error("Unauthorized: Authentication required");
  }
  return user;
}

/**
 * Verify that a request is authenticated and verify the userId matches
 */
export async function requireAuthAndMatchUserIdFromRequest(
  request: NextRequest,
  userId: string
): Promise<User> {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) {
    throw new Error("Unauthorized: Authentication required");
  }
  if (user.id !== userId) {
    throw new Error("Forbidden: You can only access your own data");
  }
  return user;
}

