import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js Middleware
 * 
 * This middleware runs on every request and can:
 * - Add security headers (CSP, HSTS, etc.)
 * - Handle authentication/authorization
 * - Handle Supabase OAuth callbacks
 * - Rewrite URLs
 * - Redirect requests
 * 
 * Note: Some security headers may also be configured in Cloudflare
 * (see SECURITY.md for Cloudflare configuration details)
 */
export async function middleware(request: NextRequest) {
  // Handle Supabase OAuth callback first
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            
            // Determine if we're on localhost or production
            const isLocalhost = request.nextUrl.hostname === 'localhost' || 
                               request.nextUrl.hostname === '127.0.0.1';
            const isHttps = request.nextUrl.protocol === 'https:';
            const hostname = request.nextUrl.hostname;
            
            // Configure cookie options based on environment
            const cookieOptions: any = {
              ...options,
              path: options?.path || '/',
              // Secure: true for HTTPS (production), false for HTTP (localhost)
              secure: isHttps,
              // SameSite: 'lax' for same-site OAuth, 'none' for cross-site (requires secure)
              // Use 'lax' for most cases, 'none' only if needed for cross-site OAuth
              sameSite: options?.sameSite || (isHttps ? 'lax' : 'lax'),
              // HttpOnly: preserve if set, otherwise let Supabase SSR handle it
              httpOnly: options?.httpOnly !== undefined ? options.httpOnly : undefined,
            };
            
            // Domain configuration for production
            if (!isLocalhost && isHttps) {
              // For production, set domain to work across subdomains
              // Extract root domain (e.g., 'ovrsee.ai' from 'www.ovrsee.ai' or 'ovrsee.ai')
              const domainParts = hostname.split('.');
              if (domainParts.length >= 2) {
                // Get the last two parts (e.g., 'ovrsee.ai')
                const rootDomain = domainParts.slice(-2).join('.');
                // Set domain with leading dot to work across subdomains
                cookieOptions.domain = `.${rootDomain}`;
              } else {
                // Fallback: use hostname as-is
                cookieOptions.domain = hostname;
              }
            } else if (isLocalhost) {
              // For localhost, explicitly don't set domain (browser handles it)
              // This ensures cookies work on localhost
              if (cookieOptions.domain) {
                delete cookieOptions.domain;
              }
            }
            
            // Remove undefined values to avoid issues
            Object.keys(cookieOptions).forEach(key => {
              if (cookieOptions[key] === undefined) {
                delete cookieOptions[key];
              }
            });
            
            console.log(`[Middleware] Setting cookie: ${name}, domain: ${cookieOptions.domain || 'default'}, secure: ${cookieOptions.secure}, sameSite: ${cookieOptions.sameSite}, localhost: ${isLocalhost}`);
            response.cookies.set(name, value, cookieOptions);
          });
        },
      },
    });

    // Check for OAuth callback (has code parameter in URL)
    const url = request.nextUrl;
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const isOAuthCallback = !!code || !!error;

    // Log OAuth callback detection
    if (isOAuthCallback) {
      console.log("[Middleware] OAuth callback detected");
      console.log("[Middleware] URL:", url.toString());
      console.log("[Middleware] Has code:", !!code);
      console.log("[Middleware] Has error:", !!error);
      console.log("[Middleware] Hostname:", url.hostname);
    }

    // getSession() will automatically exchange the OAuth code for tokens
    // This is the correct way to handle OAuth callbacks with Supabase SSR
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    // Log session status
    if (isOAuthCallback) {
      if (session) {
        console.log("[Middleware] OAuth callback processed successfully");
        console.log("[Middleware] Session user ID:", session.user?.id);
        console.log("[Middleware] Session email:", session.user?.email);
      } else if (sessionError) {
        console.error("[Middleware] OAuth callback error:", sessionError);
      } else {
        console.warn("[Middleware] OAuth callback but no session found");
      }
    }
  }

  // ============================================================================
  // Security Headers
  // ============================================================================
  // Note: Some headers may conflict with Cloudflare settings
  // If using Cloudflare, configure headers there instead for better performance

  // Content Security Policy
  // Adjust based on your needs - this is a basic secure configuration
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://hooks.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://api.stripe.com https://hooks.stripe.com",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com",
    "frame-ancestors 'none'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);

  // X-Content-Type-Options: Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // X-Frame-Options: Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");

  // X-XSS-Protection: Enable browser XSS protection (legacy, but still helpful)
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Referrer-Policy: Control referrer information
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions-Policy: Restrict browser features
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=()"
  );

  // Strict-Transport-Security (HSTS)
  // Only set in production and if using HTTPS
  if (process.env.NODE_ENV === "production" && request.url.startsWith("https://")) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // ============================================================================
  // CORS Headers (if needed)
  // ============================================================================
  // Only set CORS if you have a specific use case
  // Most Next.js apps don't need CORS headers

  // ============================================================================
  // Rate Limiting Headers (informational)
  // ============================================================================
  // Actual rate limiting should be done in Cloudflare or your API gateway
  // These headers just inform clients about rate limits
  if (request.nextUrl.pathname.startsWith("/api/")) {
    response.headers.set("X-RateLimit-Limit", "100");
    response.headers.set("X-RateLimit-Window", "60");
  }

  return response;
}

/**
 * Middleware matcher
 * Configure which routes should run through middleware
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

