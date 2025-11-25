import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js Middleware
 * 
 * This middleware runs on every request and can:
 * - Add security headers (CSP, HSTS, etc.)
 * - Handle authentication/authorization
 * - Rewrite URLs
 * - Redirect requests
 * 
 * Note: Some security headers may also be configured in Cloudflare
 * (see SECURITY.md for Cloudflare configuration details)
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

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

