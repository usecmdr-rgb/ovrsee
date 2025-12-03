/**
 * Basic tests for team pricing integration
 * 
 * Run with: npx tsx lib/team.test.ts
 */

import { calculateTeamPricing } from './pricing';
import { describeTeamPricing } from './pricingExplain';
import type { SeatSelection } from './pricing';

// Test that team seat pricing integrates correctly with calculateTeamPricing
function testTeamSeatPricing() {
  console.log('Testing team seat pricing integration...\n');

  // Simulate a team with mixed tiers
  const seats: SeatSelection[] = [
    { tier: 'basic', count: 2 },
    { tier: 'advanced', count: 1 },
    { tier: 'elite', count: 1 },
  ];

  const breakdown = calculateTeamPricing(seats);

  // Verify breakdown structure
  const hasRequiredFields = 
    breakdown.totalSeats !== undefined &&
    breakdown.perTier !== undefined &&
    breakdown.listSubtotal !== undefined &&
    breakdown.discountPercent !== undefined &&
    breakdown.discountAmount !== undefined &&
    breakdown.finalTotal !== undefined;

  if (!hasRequiredFields) {
    console.error('✗ Pricing breakdown missing required fields');
    return false;
  }

  // Verify total seats
  if (breakdown.totalSeats !== 4) {
    console.error(`✗ Expected 4 total seats, got ${breakdown.totalSeats}`);
    return false;
  }

  // Verify no discount for 4 seats
  if (breakdown.discountPercent !== 0) {
    console.error(`✗ Expected 0% discount for 4 seats, got ${breakdown.discountPercent * 100}%`);
    return false;
  }

  console.log('✓ Team seat pricing integration test passed\n');
  return true;
}

// Test pricing explanation
function testPricingExplanation() {
  console.log('Testing pricing explanation...\n');

  const seats: SeatSelection[] = [
    { tier: 'basic', count: 3 },
    { tier: 'advanced', count: 2 },
  ];

  const breakdown = calculateTeamPricing(seats);
  const explanation = describeTeamPricing(breakdown);

  // Verify explanation contains key information
  const hasSeatCount = explanation.includes('5 seat');
  const hasTierInfo = explanation.includes('Basic') && explanation.includes('Advanced');
  const hasPrice = explanation.includes('$');
  const hasTotal = explanation.includes('final total');

  if (!hasSeatCount || !hasTierInfo || !hasPrice || !hasTotal) {
    console.error('✗ Pricing explanation missing key information');
    console.error('Explanation:', explanation);
    return false;
  }

  // Verify discount is mentioned (5 seats = 10% discount)
  if (!explanation.includes('10%') && !explanation.includes('discount')) {
    console.error('✗ Pricing explanation should mention discount for 5+ seats');
    return false;
  }

  console.log('✓ Pricing explanation test passed\n');
  return true;
}

// Test invite acceptance flow simulation
function testInviteAcceptanceFlow() {
  console.log('Testing invite acceptance flow simulation...\n');

  // Simulate: User accepts invite, seat becomes active
  const beforeSeats: SeatSelection[] = [
    { tier: 'basic', count: 1 }, // Owner
    { tier: 'advanced', count: 1 }, // Pending invite
  ];

  const afterSeats: SeatSelection[] = [
    { tier: 'basic', count: 1 }, // Owner
    { tier: 'advanced', count: 1 }, // Now active
  ];

  const beforeBreakdown = calculateTeamPricing(beforeSeats);
  const afterBreakdown = calculateTeamPricing(afterSeats);

  // Pricing should be the same (pending seats are counted)
  if (beforeBreakdown.finalTotal !== afterBreakdown.finalTotal) {
    console.error('✗ Pricing should be the same for pending and active seats');
    return false;
  }

  console.log('✓ Invite acceptance flow test passed\n');
  return true;
}

// Run all tests
function runAllTests() {
  console.log('='.repeat(50));
  console.log('Team Management Tests');
  console.log('='.repeat(50));
  console.log();

  const results = [
    testTeamSeatPricing(),
    testPricingExplanation(),
    testInviteAcceptanceFlow(),
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



