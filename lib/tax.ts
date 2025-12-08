/**
 * Sales tax calculation utilities
 * Note: Actual tax calculation is handled by Stripe based on customer location
 * This is for UI display purposes only
 */

// Default tax rate (can be overridden based on customer location)
// This is a placeholder - actual tax rates vary by jurisdiction
export const DEFAULT_TAX_RATE = 0.0; // 0% default - Stripe will calculate actual tax

/**
 * Calculate sales tax amount
 * @param subtotal - Subtotal before tax
 * @param taxRate - Tax rate as decimal (e.g., 0.08 for 8%)
 * @returns Tax amount
 */
export function calculateTax(subtotal: number, taxRate: number = DEFAULT_TAX_RATE): number {
  return subtotal * taxRate;
}

/**
 * Calculate total with tax
 * @param subtotal - Subtotal before tax
 * @param taxRate - Tax rate as decimal (e.g., 0.08 for 8%)
 * @returns Total amount including tax
 */
export function calculateTotalWithTax(subtotal: number, taxRate: number = DEFAULT_TAX_RATE): number {
  return subtotal + calculateTax(subtotal, taxRate);
}

/**
 * Format tax rate as percentage
 * @param taxRate - Tax rate as decimal
 * @returns Formatted percentage string (e.g., "8.0%")
 */
export function formatTaxRate(taxRate: number): string {
  return `${(taxRate * 100).toFixed(1)}%`;
}

/**
 * Get tax disclaimer text
 */
export function getTaxDisclaimer(): string {
  return "Taxes are calculated by Stripe based on your billing address and local tax regulations.";
}


