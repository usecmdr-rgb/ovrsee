/**
 * Tests for Stripe workspace subscription sync
 * 
 * Run with: npx tsx lib/stripeWorkspace.test.ts
 * 
 * Note: These tests use mocks/stubs. For integration tests, use Stripe test mode.
 */

import { getTeamDiscountPercent } from './pricing';

// Mock Stripe subscription structure
interface MockSubscriptionItem {
  id: string;
  price: { id: string };
  quantity: number;
}

interface MockSubscription {
  id: string;
  items: { data: MockSubscriptionItem[] };
  discount?: { coupon: { id: string } } | null;
}

// Test seat aggregation logic
function testSeatAggregation() {
  console.log('Testing seat aggregation logic...\n');

  const seats = [
    { tier: 'basic', status: 'active' },
    { tier: 'basic', status: 'active' },
    { tier: 'advanced', status: 'pending' },
    { tier: 'elite', status: 'active' },
    { tier: 'basic', status: 'removed' }, // Should not count
  ];

  const seatCounts: Record<string, number> = {
    basic: 0,
    advanced: 0,
    elite: 0,
  };

  seats
    .filter((s) => s.status === 'active' || s.status === 'pending')
    .forEach((seat) => {
      if (seat.tier in seatCounts) {
        seatCounts[seat.tier as keyof typeof seatCounts]++;
      }
    });

  const expected = { basic: 2, advanced: 1, elite: 1 };
  const passed =
    seatCounts.basic === expected.basic &&
    seatCounts.advanced === expected.advanced &&
    seatCounts.elite === expected.elite;

  if (passed) {
    console.log('✓ Seat aggregation test passed');
  } else {
    console.error('✗ Seat aggregation test failed');
    console.error('Expected:', expected);
    console.error('Got:', seatCounts);
  }

  console.log();
  return passed;
}

// Test subscription item update logic
function testSubscriptionItemUpdates() {
  console.log('Testing subscription item update logic...\n');

  // Mock existing subscription
  const existingSubscription: MockSubscription = {
    id: 'sub_123',
    items: {
      data: [
        { id: 'si_1', price: { id: 'price_basic' }, quantity: 1 },
        { id: 'si_2', price: { id: 'price_advanced' }, quantity: 2 },
      ],
    },
  };

  // New seat counts
  const newSeatCounts = {
    basic: 3, // Increased from 1
    advanced: 1, // Decreased from 2
    elite: 1, // New tier
  };

  const tierPriceIds = {
    basic: 'price_basic',
    advanced: 'price_advanced',
    elite: 'price_elite',
  };

  const lineItems: any[] = [];
  const handledPriceIds = new Set<string>();

  // Add/update items
  for (const [tier, count] of Object.entries(newSeatCounts)) {
    const priceId = tierPriceIds[tier as keyof typeof tierPriceIds];
    if (count > 0 && priceId) {
      const existingItem = existingSubscription.items.data.find(
        (item) => item.price.id === priceId
      );

      if (existingItem) {
        if (existingItem.quantity !== count) {
          lineItems.push({
            id: existingItem.id,
            price: priceId,
            quantity: count,
          });
        }
        handledPriceIds.add(priceId);
      } else {
        lineItems.push({
          price: priceId,
          quantity: count,
        });
        handledPriceIds.add(priceId);
      }
    }
  }

  // Remove items for tiers with 0 seats
  existingSubscription.items.data.forEach((item) => {
    if (!handledPriceIds.has(item.price.id)) {
      lineItems.push({
        id: item.id,
        deleted: true,
      });
    }
  });

  // Verify expected updates
  const hasBasicUpdate = lineItems.some(
    (item) => item.id === 'si_1' && item.quantity === 3
  );
  const hasAdvancedUpdate = lineItems.some(
    (item) => item.id === 'si_2' && item.quantity === 1
  );
  const hasEliteAdd = lineItems.some(
    (item) => item.price === 'price_elite' && item.quantity === 1 && !item.id
  );

  const passed = hasBasicUpdate && hasAdvancedUpdate && hasEliteAdd;

  if (passed) {
    console.log('✓ Subscription item update logic test passed');
  } else {
    console.error('✗ Subscription item update logic test failed');
    console.error('Line items:', lineItems);
  }

  console.log();
  return passed;
}

// Test discount coupon logic
function testDiscountCouponLogic() {
  console.log('Testing discount coupon logic...\n');

  const testCases = [
    { seats: 4, expectedDiscount: 0, expectedCoupon: null },
    { seats: 5, expectedDiscount: 0.10, expectedCoupon: 'team_discount_10' },
    { seats: 10, expectedDiscount: 0.20, expectedCoupon: 'team_discount_20' },
    { seats: 20, expectedDiscount: 0.25, expectedCoupon: 'team_discount_25' },
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const discount = getTeamDiscountPercent(testCase.seats);
    const couponId = discount > 0 ? `team_discount_${Math.round(discount * 100)}` : null;

    if (discount === testCase.expectedDiscount && couponId === testCase.expectedCoupon) {
      console.log(`✓ ${testCase.seats} seats: ${discount * 100}% discount, coupon: ${couponId || 'none'}`);
      passed++;
    } else {
      console.error(
        `✗ ${testCase.seats} seats: expected ${testCase.expectedDiscount * 100}%/${testCase.expectedCoupon}, got ${discount * 100}%/${couponId}`
      );
      failed++;
    }
  }

  console.log();
  return failed === 0;
}

// Run all tests
function runAllTests() {
  console.log('='.repeat(50));
  console.log('Stripe Workspace Sync Tests');
  console.log('='.repeat(50));
  console.log();

  const results = [
    testSeatAggregation(),
    testSubscriptionItemUpdates(),
    testDiscountCouponLogic(),
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




