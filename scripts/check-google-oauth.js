#!/usr/bin/env node

/**
 * Diagnostic script to check Google OAuth configuration
 * Run with: node scripts/check-google-oauth.js
 */

const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_CLIENT_ID || '';
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET || '';
const redirectUrl = process.env.GOOGLE_OAUTH_REDIRECT_URL || 
  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sync/google/callback`;

console.log('🔍 Google OAuth Configuration Check\n');
console.log('='.repeat(60));

// Check Client ID
console.log('\n1. Client ID:');
if (!clientId) {
  console.log('   ❌ NOT SET');
  console.log('   → Add GOOGLE_CLIENT_ID to .env.local');
} else {
  console.log(`   ✅ Set: ${clientId.substring(0, 40)}...`);
  console.log(`   Length: ${clientId.length} characters`);
  
  // Validate format
  if (!clientId.includes('.apps.googleusercontent.com')) {
    console.log('   ⚠️  WARNING: Client ID format looks incorrect');
    console.log('   Expected format: xxxxxx-xxxxx.apps.googleusercontent.com');
  }
}

// Check Client Secret
console.log('\n2. Client Secret:');
if (!clientSecret) {
  console.log('   ❌ NOT SET');
  console.log('   → Add GOOGLE_CLIENT_SECRET to .env.local');
} else {
  console.log(`   ✅ Set: ${clientSecret.substring(0, 10)}...`);
  console.log(`   Length: ${clientSecret.length} characters`);
  
  // Validate format
  if (!clientSecret.startsWith('GOCSPX-')) {
    console.log('   ⚠️  WARNING: Client Secret format looks incorrect');
    console.log('   Expected format: GOCSPX-xxxxx');
  }
}

// Check Redirect URI
console.log('\n3. Redirect URI:');
console.log(`   ✅ ${redirectUrl}`);

// Expected redirect URIs
const expectedDev = 'http://localhost:3000/api/sync/google/callback';
const expectedProd = 'https://ovrsee.ai/api/sync/google/callback';

console.log('\n   Expected URIs in Google Cloud Console:');
console.log(`   - Development: ${expectedDev}`);
console.log(`   - Production:  ${expectedProd}`);

if (redirectUrl !== expectedDev && redirectUrl !== expectedProd) {
  console.log(`   ⚠️  WARNING: Redirect URI doesn't match expected values`);
}

// Check AUTH_SECRET
console.log('\n4. AUTH_SECRET (for OAuth state signing):');
const authSecret = process.env.AUTH_SECRET || process.env.JWT_SECRET || '';
if (!authSecret) {
  console.log('   ❌ NOT SET');
  console.log('   → Add AUTH_SECRET to .env.local (at least 32 characters)');
} else if (authSecret.length < 32) {
  console.log(`   ⚠️  TOO SHORT: ${authSecret.length} characters (need at least 32)`);
} else {
  console.log(`   ✅ Set: ${authSecret.length} characters`);
}

// Generate example OAuth URL
console.log('\n5. Example OAuth URL:');
if (clientId && redirectUrl) {
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar'
  ].join(' ');
  
  const exampleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  exampleUrl.searchParams.set('client_id', clientId);
  exampleUrl.searchParams.set('redirect_uri', redirectUrl);
  exampleUrl.searchParams.set('response_type', 'code');
  exampleUrl.searchParams.set('scope', scopes);
  exampleUrl.searchParams.set('access_type', 'offline');
  exampleUrl.searchParams.set('prompt', 'consent');
  exampleUrl.searchParams.set('state', 'example_state_here');
  
  console.log(`   ${exampleUrl.toString()}`);
  console.log('\n   ⚠️  Verify this URL in Google Cloud Console:');
  console.log(`   - Client ID matches: ${clientId.substring(0, 30)}...`);
  console.log(`   - Redirect URI matches exactly: ${redirectUrl}`);
}

// Common issues checklist
console.log('\n6. Common Issues Checklist:');
console.log('   □ Client ID exists in Google Cloud Console');
console.log('   □ Redirect URI is added EXACTLY as shown above (no trailing slash)');
console.log('   □ OAuth consent screen is configured');
console.log('   □ Gmail API and Calendar API are enabled');
console.log('   □ OAuth client type is "Web application"');
console.log('   □ Client is not disabled or restricted');

console.log('\n' + '='.repeat(60));
console.log('\n💡 Next Steps:');
console.log('1. Go to: https://console.cloud.google.com/apis/credentials');
console.log('2. Find your OAuth 2.0 Client ID');
console.log('3. Verify the Client ID matches:', clientId.substring(0, 30) + '...');
console.log('4. Check "Authorized redirect URIs" includes:', redirectUrl);
console.log('5. Ensure the OAuth consent screen is published (if needed)');
console.log('6. Restart your dev server after making changes\n');


