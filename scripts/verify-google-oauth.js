#!/usr/bin/env node

/**
 * Comprehensive Google OAuth verification script
 * Run with: node scripts/verify-google-oauth.js
 */

const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  });
}

const clientId = env.GOOGLE_CLIENT_ID || '';
const clientSecret = env.GOOGLE_CLIENT_SECRET || '';
const redirectUrl = env.GOOGLE_OAUTH_REDIRECT_URL || 
  `${env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sync/google/callback`;

console.log('🔍 Google OAuth Comprehensive Verification\n');
console.log('='.repeat(70));

// 1. Check Client ID
console.log('\n1️⃣  Client ID Verification:');
if (!clientId) {
  console.log('   ❌ NOT SET');
  console.log('   → Add GOOGLE_CLIENT_ID to .env.local');
} else {
  console.log(`   ✅ Set: ${clientId.substring(0, 40)}...`);
  console.log(`   Length: ${clientId.length} characters`);
  
  // Validate format
  if (!clientId.includes('.apps.googleusercontent.com')) {
    console.log('   ⚠️  WARNING: Format looks incorrect');
  } else {
    console.log('   ✅ Format looks correct');
  }
  
  // Extract numeric prefix
  const prefix = clientId.split('-')[0];
  console.log(`   Client ID prefix: ${prefix}`);
  console.log(`   → Verify this matches in Google Cloud Console`);
}

// 2. Check Client Secret
console.log('\n2️⃣  Client Secret Verification:');
if (!clientSecret) {
  console.log('   ❌ NOT SET');
} else {
  console.log(`   ✅ Set: ${clientSecret.substring(0, 10)}...`);
  console.log(`   Length: ${clientSecret.length} characters`);
  if (clientSecret.startsWith('GOCSPX-')) {
    console.log('   ✅ Format looks correct (GOCSPX-...)');
  } else {
    console.log('   ⚠️  WARNING: Format might be incorrect');
  }
}

// 3. Check Redirect URI
console.log('\n3️⃣  Redirect URI Verification:');
console.log(`   Current: ${redirectUrl}`);
console.log(`   Expected: http://localhost:3000/api/sync/google/callback`);
if (redirectUrl === 'http://localhost:3000/api/sync/google/callback') {
  console.log('   ✅ Matches expected value');
} else {
  console.log('   ⚠️  WARNING: Doesn\'t match expected value');
}

// 4. Generate OAuth URL
console.log('\n4️⃣  OAuth URL Generation:');
if (clientId && redirectUrl) {
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
  authUrl.searchParams.set('state', 'verify_test');
  
  console.log(`   Generated URL:`);
  console.log(`   ${authUrl.toString()}`);
  console.log(`\n   📋 URL Breakdown:`);
  console.log(`   - client_id: ${clientId.substring(0, 30)}...`);
  console.log(`   - redirect_uri: ${redirectUrl}`);
  console.log(`   - scopes: ${scopes.length} scopes`);
}

// 5. Checklist
console.log('\n5️⃣  Google Cloud Console Checklist:');
console.log('   □ Go to: https://console.cloud.google.com/apis/credentials');
console.log(`   □ Find OAuth client with ID: ${clientId.substring(0, 30)}...`);
console.log(`   □ Verify "Authorized redirect URIs" contains:`);
console.log(`     ${redirectUrl}`);
console.log('   □ Check for EXACT match (no trailing slash, correct protocol)');
console.log('   □ Verify OAuth consent screen is configured');
console.log('   □ Verify Gmail API and Calendar API are enabled');
console.log('   □ Check that client is not disabled');

// 6. Common Issues
console.log('\n6️⃣  Common Issues & Solutions:');
console.log('');
console.log('   Issue: "OAuth client was not found"');
console.log('   Solutions:');
console.log('   1. Client ID doesn\'t exist in Google Cloud Console');
console.log('      → Verify the Client ID exists');
console.log('   2. Redirect URI mismatch');
console.log('      → Copy EXACT redirect URI from error or this script');
console.log('      → Add it to Google Cloud Console');
console.log('   3. Client is disabled');
console.log('      → Check client status in Google Cloud Console');
console.log('   4. Wrong Google Cloud project');
console.log('      → Make sure you\'re in the correct project');
console.log('   5. Propagation delay');
console.log('      → Wait 5-10 minutes after making changes');
console.log('');

// 7. Test URL
console.log('7️⃣  Test the OAuth URL:');
if (clientId && redirectUrl) {
  const testUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUrl)}&response_type=code&scope=${encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar')}&access_type=offline&prompt=consent&state=test`;
  console.log(`   Copy and paste this URL in your browser:`);
  console.log(`   ${testUrl}`);
  console.log(`\n   If you get "OAuth client was not found":`);
  console.log(`   → The Client ID ${clientId.substring(0, 30)}... doesn't exist`);
  console.log(`   → OR the redirect URI doesn't match`);
}

console.log('\n' + '='.repeat(70));
console.log('\n💡 Next Steps:');
console.log('1. Verify Client ID exists in Google Cloud Console');
console.log('2. Verify redirect URI matches EXACTLY');
console.log('3. Restart dev server: npm run dev');
console.log('4. Try connecting again');
console.log('5. If still failing, wait 10 minutes and try again (propagation delay)\n');


