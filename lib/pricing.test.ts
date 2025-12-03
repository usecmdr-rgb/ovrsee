/**
 * Unit tests for pricing calculations
 * 
 * Run with: npx tsx lib/pricing.test.ts
 * Or add to your test suite
 */

import {
  TIERS,
  getTeamDiscountPercent,
  calculateTeamPricing,
  validatePricingMargins,
  SeatSelection,
} from './pricing';

// Test discount thresholds
console.log('Testing discount thresholds...');

function testDiscountThresholds() {
  const testCases = [
    { seats: 1, expected: 0 },
    { seats: 4, expected: 0 },
    { seats: 5, expected: 0.10 },
    { seats: 9, expected: 0.10 },
    { seats: 10, expected: 0.20 },
    { seats: 19, expected: 0.20 },
    { seats: 20, expected: 0.25 },
    { seats: 25, expected: 0.25 },
    { seats: 100, expected: 0.25 },
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = getTeamDiscountPercent(testCase.seats);
    if (result === testCase.expected) {
      console.log(`✓ ${testCase.seats} seats: ${result * 100}% discount`);
      passed++;
    } else {
      console.error(
        `✗ ${testCase.seats} seats: expected ${testCase.expected * 100}%, got ${result * 100}%`
      );
      failed++;
    }
  }

  console.log(`\nDiscount threshold tests: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

// Test pricing calculations with mixed tiers
function testMixedTierPricing() {
  console.log('Testing mixed tier pricing...');

  const testCases: Array<{
    name: string;
    seats: SeatSelection[];
    expectedTotal: number;
    expectedDiscount: number;
  }> = [
    {
      name: 'Single Basic seat',
      seats: [{ tier: 'basic', count: 1 }],
      expectedTotal: 39.99,
      expectedDiscount: 0,
    },
    {
      name: '4 Basic seats (no discount)',
      seats: [{ tier: 'basic', count: 4 }],
      expectedTotal: 39.99 * 4,
      expectedDiscount: 0,
    },
    {
      name: '5 Basic seats (10% discount)',
      seats: [{ tier: 'basic', count: 5 }],
      expectedTotal: 39.99 * 5 * 0.9,
      expectedDiscount: 0.10,
    },
    {
      name: 'Mixed: 2 Basic, 1 Advanced, 1 Elite (4 total, no discount)',
      seats: [
        { tier: 'basic', count: 2 },
        { tier: 'advanced', count: 1 },
        { tier: 'elite', count: 1 },
      ],
      expectedTotal: 2 * 39.99 + 79.99 + 129.99, // Updated prices: Professional 79.99, Executive 129.99
      expectedDiscount: 0,
    },
    {
      name: 'Mixed: 3 Basic, 2 Advanced, 1 Elite (6 total, 10% discount)',
      seats: [
        { tier: 'basic', count: 3 },
        { tier: 'advanced', count: 2 },
        { tier: 'elite', count: 1 },
      ],
      expectedTotal: (3 * 39.99 + 2 * 79.99 + 129.99) * 0.9, // Updated prices: Professional 79.99, Executive 129.99
      expectedDiscount: 0.10,
    },
    {
      name: '10 seats (20% discount)',
      seats: [{ tier: 'basic', count: 10 }],
      expectedTotal: 39.99 * 10 * 0.8,
      expectedDiscount: 0.20,
    },
    {
      name: '20 seats (25% discount)',
      seats: [{ tier: 'elite', count: 20 }],
      expectedTotal: 129.99 * 20 * 0.75, // Updated price: Executive 129.99
      expectedDiscount: 0.25,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = calculateTeamPricing(testCase.seats);
    const totalMatches =
      Math.abs(result.finalTotal - testCase.expectedTotal) < 0.01;
    const discountMatches = result.discountPercent === testCase.expectedDiscount;

    if (totalMatches && discountMatches) {
      console.log(`✓ ${testCase.name}`);
      passed++;
    } else {
      console.error(`✗ ${testCase.name}`);
      if (!totalMatches) {
        console.error(
          `  Total mismatch: expected ${testCase.expectedTotal.toFixed(2)}, got ${result.finalTotal.toFixed(2)}`
        );
      }
      if (!discountMatches) {
        console.error(
          `  Discount mismatch: expected ${testCase.expectedDiscount * 100}%, got ${result.discountPercent * 100}%`
        );
      }
      failed++;
    }
  }

  console.log(`\nMixed tier pricing tests: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

// Test margin validation
function testMarginValidation() {
  console.log('Testing margin validation...');

  const isValid = validatePricingMargins();

  if (isValid) {
    console.log('✓ All margins are valid (meet minimum requirements)\n');
  } else {
    console.error('✗ Margin validation failed\n');
  }

  return isValid;
}

// Test margin calculations explicitly
function testMarginCalculations() {
  console.log('Testing margin calculations with max discount...');

  const maxDiscount = 0.25;
  const tierCosts = {
    basic: 0.20,
    advanced: 0.35,
    elite: 0.45,
  };
  const minMargins = {
    basic: 0.70,
    advanced: 0.50,
    elite: 0.40,
  };

  let passed = 0;
  let failed = 0;

  for (const [tierId, tier] of Object.entries(TIERS)) {
    const costPercent = tierCosts[tierId as keyof typeof tierCosts];
    const minMargin = minMargins[tierId as keyof typeof minMargins];

    const effectivePrice = tier.priceMonthly * (1 - maxDiscount);
    const cost = tier.priceMonthly * costPercent;
    const effectiveMargin = (effectivePrice - cost) / effectivePrice;

    if (effectiveMargin >= minMargin) {
      console.log(
        `✓ ${tierId}: margin ${(effectiveMargin * 100).toFixed(2)}% >= minimum ${(minMargin * 100).toFixed(2)}%`
      );
      passed++;
    } else {
      console.error(
        `✗ ${tierId}: margin ${(effectiveMargin * 100).toFixed(2)}% < minimum ${(minMargin * 100).toFixed(2)}%`
      );
      failed++;
    }
  }

  console.log(`\nMargin calculation tests: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

// Run all tests
function runAllTests() {
  console.log('='.repeat(50));
  console.log('Pricing Calculation Tests');
  console.log('='.repeat(50));
  console.log();

  const results = [
    testDiscountThresholds(),
    testMixedTierPricing(),
    testMarginValidation(),
    testMarginCalculations(),
  ];

  const allPassed = results.every((r) => r);

  console.log('='.repeat(50));
  if (allPassed) {
    console.log('✓ All tests passed!');
  } else {
    console.log('✗ Some tests failed');
    process.exit(1);
  }
  console.log('='.repeat(50));
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

export { runAllTests };

