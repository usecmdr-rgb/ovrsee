#!/usr/bin/env node

/**
 * Diagnostic script to troubleshoot "OAuth client was not found" error
 * 
 * This error (401: invalid_client) means Google can't find the OAuth client
 * with the Client ID you're using. This script helps identify the issue.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 OAuth Client Diagnostic Tool\n');
console.log('=' .repeat(60));
console.log('');

// Read .env.local
const envPath = path.join(process.cwd(), '.env.local');
let envVars = {};

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      envVars[key] = value;
    }
  });
} else {
  console.log('❌ .env.local file not found!\n');
  process.exit(1);
}

const clientId = envVars.GOOGLE_CLIENT_ID || envVars.GMAIL_CLIENT_ID || '';
const clientSecret = envVars.GOOGLE_CLIENT_SECRET || envVars.GMAIL_CLIENT_SECRET || '';
const redirectUrl = envVars.GOOGLE_OAUTH_REDIRECT_URL || envVars.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/sync/google/callback';

console.log('📋 Current Configuration:');
console.log('');
console.log(`Client ID: ${clientId ? clientId.substring(0, 30) + '...' : '❌ NOT SET'}`);
console.log(`Client Secret: ${clientSecret ? clientSecret.substring(0, 15) + '...' : '❌ NOT SET'}`);
console.log(`Redirect URI: ${redirectUrl}`);
console.log('');

// Check if Client ID format is valid
if (!clientId) {
  console.log('❌ ERROR: GOOGLE_CLIENT_ID is not set in .env.local');
  console.log('');
  process.exit(1);
}

if (!clientId.includes('.apps.googleusercontent.com')) {
  console.log('⚠️  WARNING: Client ID format looks incorrect');
  console.log('   Expected format: xxxxxx-xxxxx.apps.googleusercontent.com');
  console.log('');
}

// Extract project number from Client ID (if possible)
const projectMatch = clientId.match(/^(\d+)-/);
const projectNumber = projectMatch ? projectMatch[1] : null;

console.log('🔍 Diagnostic Steps:');
console.log('');
console.log('1. VERIFY CLIENT ID EXISTS IN GOOGLE CLOUD CONSOLE:');
console.log('   → Go to: https://console.cloud.google.com/apis/credentials');
console.log('   → Look for OAuth 2.0 Client IDs');
console.log('   → Check if this Client ID exists:');
console.log(`      ${clientId}`);
console.log('');

if (projectNumber) {
  console.log(`   → Project number from Client ID: ${projectNumber}`);
  console.log('   → Make sure you\'re in the correct Google Cloud project');
  console.log('');
}

console.log('2. CHECK REDIRECT URI MATCHES EXACTLY:');
console.log('   → In Google Cloud Console, open your OAuth client');
console.log('   → Go to "Authorized redirect URIs"');
console.log('   → Verify this URI is listed EXACTLY (no trailing slash, exact match):');
console.log(`      ${redirectUrl}`);
console.log('   → Common issues:');
console.log('      - Missing http:// or https://');
console.log('      - Trailing slash (/)');
console.log('      - Wrong port number');
console.log('      - Wrong path');
console.log('');

console.log('3. VERIFY OAUTH CLIENT IS ENABLED:');
console.log('   → In Google Cloud Console, check that the OAuth client is not disabled');
console.log('   → Status should be "Enabled"');
console.log('');

console.log('4. CHECK OAUTH CONSENT SCREEN:');
console.log('   → Go to: https://console.cloud.google.com/apis/credentials/consent');
console.log('   → Verify "Publishing status" is set to "Testing"');
console.log('   → Verify your email is added as a test user');
console.log('   → Verify the 3 scopes are added:');
console.log('      - https://www.googleapis.com/auth/gmail.readonly');
console.log('      - https://www.googleapis.com/auth/gmail.send');
console.log('      - https://www.googleapis.com/auth/calendar');
console.log('');

console.log('5. VERIFY YOU\'RE IN THE CORRECT PROJECT:');
console.log('   → Check the project dropdown at the top of Google Cloud Console');
console.log('   → Make sure you\'re in the project where you created the OAuth client');
console.log('');

console.log('6. COMMON FIXES:');
console.log('');
console.log('   Option A: Create a NEW OAuth Client:');
console.log('   → Go to: https://console.cloud.google.com/apis/credentials');
console.log('   → Click "Create Credentials" → "OAuth client ID"');
console.log('   → Application type: "Web application"');
console.log('   → Name: "OVRSEE Sync OAuth Client"');
console.log('   → Authorized redirect URIs:');
console.log(`      ${redirectUrl}`);
console.log('   → Copy the NEW Client ID and Client Secret');
console.log('   → Update .env.local with the new values');
console.log('   → Restart your dev server');
console.log('');

console.log('   Option B: Verify Existing Client:');
console.log('   → Double-check the Client ID matches exactly');
console.log('   → Double-check the redirect URI matches exactly');
console.log('   → Make sure the client is enabled');
console.log('   → Make sure you\'re in the correct project');
console.log('');

console.log('7. TEST THE OAUTH URL:');
console.log('   → The OAuth URL should look like:');
console.log('   → https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&...');
console.log('   → Check browser console/network tab for the exact URL being used');
console.log('');

console.log('💡 TIP: If you created a new OAuth client, make sure to:');
console.log('   1. Update .env.local with the new Client ID and Secret');
console.log('   2. Restart your Next.js dev server (npm run dev)');
console.log('   3. Clear browser cache/cookies');
console.log('   4. Try connecting again');
console.log('');

console.log('=' .repeat(60));
console.log('');


