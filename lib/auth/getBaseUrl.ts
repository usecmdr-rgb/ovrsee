/**
 * Get the base URL for the application based on environment
 * 
 * Priority:
 * 1. NEXT_PUBLIC_APP_URL environment variable
 * 2. NODE_ENV === 'development' ? localhost:3000 : https://ovrsee.ai
 * 3. Fallback to localhost:3000
 */

export function getBaseUrl(): string {
  // Check environment variable first
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Check if we're in development - default to port 3000
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }

  // Production fallback
  return 'https://ovrsee.ai';
}

/**
 * Get the base URL for client-side code
 * Uses window.location.origin in browser, falls back to getBaseUrl() on server
 */
export function getBaseUrlClient(): string {
  // Client-side: use current origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Server-side: use environment-based logic
  return getBaseUrl();
}

/**
 * Check if we're running on localhost
 */
export function isLocalhost(): boolean {
  if (typeof window !== 'undefined') {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1';
  }
  
  // Server-side check
  const baseUrl = getBaseUrl();
  return baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
}

