import Stripe from "stripe";

// Lazy initialization - only creates client when actually accessed
let _stripe: Stripe | undefined;

function createStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key, {
    apiVersion: "2024-06-20",
    typescript: true,
  });
}

// Use a getter function that's called only when stripe is accessed
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = createStripe();
  }
  return _stripe;
}

// Export stripe - will only initialize when first property is accessed via Proxy
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    const instance = getStripe();
    const value = Reflect.get(instance, prop, receiver);
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});

export type TierId = "basic" | "advanced" | "elite";

import { TIERS } from './pricing';

export const tierConfig: Record<
  TierId,
  {
    priceId: string; // Stripe Price ID - set these in your .env or Stripe dashboard
    amount: number;
    currency: string;
  }
> = {
  basic: {
    priceId: process.env.STRIPE_PRICE_ID_BASIC || "",
    amount: Math.round(TIERS.basic.priceMonthly * 100), // Convert to cents
    currency: "eur",
  },
  advanced: {
    priceId: process.env.STRIPE_PRICE_ID_ADVANCED || "",
    amount: Math.round(TIERS.advanced.priceMonthly * 100), // Convert to cents
    currency: "eur",
  },
  elite: {
    priceId: process.env.STRIPE_PRICE_ID_ELITE || "",
    amount: Math.round(TIERS.elite.priceMonthly * 100), // Convert to cents
    currency: "eur",
  },
};

