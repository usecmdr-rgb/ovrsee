#!/usr/bin/env node

/**
 * Test script to generate and verify OAuth URL
 * Run with: node scripts/test-oauth-url.js
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

const clientId = process.env.GOOGLE_CLIENT_ID || '';
const redirectUrl = process.env.GOOGLE_OAUTH_REDIRECT_URL || 
  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sync/google/callback`;

console.log('🔍 OAuth URL Generator\n');
console.log('='.repeat(60));
console.log('\nConfiguration:');
console.log('Client ID:', clientId ? `${clientId.substring(0, 40)}...` : '❌ NOT SET');
console.log('Redirect URI:', redirectUrl);
console.log('\n' + '='.repeat(60));

if (!clientId) {
  console.log('\n❌ ERROR: GOOGLE_CLIENT_ID is not set in .env.local');
  process.exit(1);
}

const scopes = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar'
];

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('redirect_uri', redirectUrl);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', scopes.join(' '));
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');
authUrl.searchParams.set('state', 'test_state_12345');

console.log('\n📋 Generated OAuth URL:');
console.log(authUrl.toString());
console.log('\n' + '='.repeat(60));
console.log('\n✅ Next Steps:');
console.log('1. Copy the URL above');
console.log('2. Paste it in your browser');
console.log('3. If you get "OAuth client was not found":');
console.log('   - Go to: https://console.cloud.google.com/apis/credentials');
console.log('   - Find client ID:', clientId.substring(0, 30) + '...');
console.log('   - Verify redirect URI:', redirectUrl);
console.log('   - Make sure it matches EXACTLY (no trailing slash, correct protocol)');
console.log('\n');


