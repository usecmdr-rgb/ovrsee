#!/usr/bin/env node
/**
 * Verify that all configured Price IDs actually exist in Stripe
 */

try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {}

const Stripe = require('stripe');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error('❌ STRIPE_SECRET_KEY not found');
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey);

// Detect test vs live mode
const isTestMode = stripeSecretKey.startsWith('sk_test_');
console.log(`🔍 Stripe Mode: ${isTestMode ? 'TEST' : 'LIVE'}\n`);

const priceIdVars = [
  'STRIPE_PRICE_ID_ESSENTIALS_MONTHLY',
  'STRIPE_PRICE_ID_ESSENTIALS_YEARLY',
  'STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY',
  'STRIPE_PRICE_ID_PROFESSIONAL_YEARLY',
  'STRIPE_PRICE_ID_EXECUTIVE_MONTHLY',
  'STRIPE_PRICE_ID_EXECUTIVE_YEARLY',
];

async function verifyPriceIds() {
  console.log('Verifying Price IDs exist in Stripe...\n');
  console.log('=' .repeat(80));
  
  const results = [];
  
  for (const varName of priceIdVars) {
    const priceId = process.env[varName];
    
    if (!priceId) {
      results.push({ varName, priceId: null, exists: false, error: 'Not set in environment' });
      continue;
    }
    
    if (!priceId.startsWith('price_')) {
      results.push({ varName, priceId, exists: false, error: 'Invalid format (does not start with price_)' });
      continue;
    }
    
    try {
      const price = await stripe.prices.retrieve(priceId);
      const amount = price.unit_amount ? (price.unit_amount / 100).toFixed(2) : 'N/A';
      const interval = price.recurring?.interval || 'one-time';
      results.push({ 
        varName, 
        priceId, 
        exists: true, 
        amount: `$${amount}`, 
        interval,
        active: price.active 
      });
    } catch (error) {
      if (error.code === 'resource_missing') {
        results.push({ varName, priceId, exists: false, error: 'Price ID does not exist in Stripe' });
      } else {
        results.push({ varName, priceId, exists: false, error: error.message });
      }
    }
  }
  
  // Display results
  results.forEach(result => {
    console.log(`\n📋 ${result.varName}`);
    console.log(`   Price ID: ${result.priceId || 'NOT SET'}`);
    
    if (result.exists) {
      console.log(`   ✅ EXISTS: ${result.amount} / ${result.interval}`);
      if (!result.active) {
        console.log(`   ⚠️  WARNING: Price is not active`);
      }
    } else {
      console.log(`   ❌ ERROR: ${result.error}`);
    }
  });
  
  console.log('\n' + '=' .repeat(80));
  
  const missing = results.filter(r => !r.exists);
  if (missing.length > 0) {
    console.log(`\n❌ ${missing.length} Price ID(s) are missing or invalid`);
    console.log('\nPossible causes:');
    console.log('  1. Price IDs are from a different Stripe account (test vs live)');
    console.log('  2. Prices were deleted or never created');
    console.log('  3. STRIPE_SECRET_KEY is pointing to wrong account');
    console.log('\n💡 Solution:');
    console.log('  Run: node scripts/update-env-stripe-prices.js');
    console.log('  This will fetch prices from your current Stripe account and update .env.local');
    process.exit(1);
  } else {
    console.log('\n✅ All Price IDs are valid and exist in Stripe!');
    console.log('\n💡 If you\'re still getting errors:');
    console.log('  1. Restart your dev server to reload environment variables');
    console.log('  2. Check that STRIPE_SECRET_KEY matches the account where prices exist');
    process.exit(0);
  }
}

verifyPriceIds().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});


