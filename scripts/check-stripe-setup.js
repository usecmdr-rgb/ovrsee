#!/usr/bin/env node
/**
 * Quick check of Stripe Price ID setup
 * Reads directly from .env.local file to avoid caching issues
 */

const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');

// Read .env.local directly
const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local file not found');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
    envVars[key] = value;
  }
});

const stripeSecretKey = envVars.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error('❌ STRIPE_SECRET_KEY not found in .env.local');
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey);
const isTestMode = stripeSecretKey.startsWith('sk_test_');

console.log(`🔍 Stripe Mode: ${isTestMode ? 'TEST' : 'LIVE'}\n`);
console.log('Checking Price IDs from .env.local...\n');
console.log('=' .repeat(80));

const priceIdVars = [
  'STRIPE_PRICE_ID_ESSENTIALS_MONTHLY',
  'STRIPE_PRICE_ID_ESSENTIALS_YEARLY',
  'STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY',
  'STRIPE_PRICE_ID_PROFESSIONAL_YEARLY',
  'STRIPE_PRICE_ID_EXECUTIVE_MONTHLY',
  'STRIPE_PRICE_ID_EXECUTIVE_YEARLY',
];

async function checkAll() {
  const results = [];
  
  for (const varName of priceIdVars) {
    const priceId = envVars[varName];
    
    if (!priceId) {
      results.push({ varName, priceId: null, status: 'missing', message: 'Not set in .env.local' });
      continue;
    }
    
    if (!priceId.startsWith('price_')) {
      results.push({ varName, priceId, status: 'invalid', message: `Invalid format: "${priceId}" (should start with "price_")` });
      continue;
    }
    
    try {
      const price = await stripe.prices.retrieve(priceId);
      const amount = price.unit_amount ? (price.unit_amount / 100).toFixed(2) : 'N/A';
      const interval = price.recurring?.interval || 'one-time';
      const active = price.active;
      
      results.push({ 
        varName, 
        priceId, 
        status: active ? 'ok' : 'inactive',
        message: `$${amount} / ${interval}${active ? '' : ' (NOT ACTIVE)'}` 
      });
    } catch (error) {
      if (error.code === 'resource_missing') {
        results.push({ varName, priceId, status: 'not_found', message: 'Price ID does not exist in Stripe' });
      } else {
        results.push({ varName, priceId, status: 'error', message: error.message });
      }
    }
  }
  
  // Display results
  results.forEach(result => {
    const icon = result.status === 'ok' ? '✅' : result.status === 'missing' || result.status === 'not_found' ? '❌' : '⚠️';
    console.log(`${icon} ${result.varName}`);
    console.log(`   ${result.priceId || 'NOT SET'}`);
    console.log(`   ${result.message}`);
    console.log('');
  });
  
  console.log('=' .repeat(80));
  
  const problems = results.filter(r => r.status !== 'ok');
  if (problems.length === 0) {
    console.log('\n✅ All Price IDs are correctly configured and exist in Stripe!');
    console.log('\n💡 If you\'re still seeing errors:');
    console.log('   1. RESTART YOUR DEV SERVER (Ctrl+C then npm run dev)');
    console.log('   2. Environment variables are cached - restart is required');
    console.log('   3. Clear browser cache if testing in browser');
    process.exit(0);
  } else {
    console.log(`\n❌ Found ${problems.length} issue(s)`);
    console.log('\n💡 To fix:');
    console.log('   Run: node scripts/update-env-stripe-prices.js');
    process.exit(1);
  }
}

checkAll().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});


