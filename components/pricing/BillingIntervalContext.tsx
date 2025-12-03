"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { BillingInterval } from "@/lib/pricingConfig";

type BillingIntervalContextValue = {
  billingInterval: BillingInterval;
  setBillingInterval: (value: BillingInterval) => void;
};

const BillingIntervalContext = createContext<BillingIntervalContextValue | undefined>(undefined);

export function BillingIntervalProvider({ children }: { children: ReactNode }) {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");

  return (
    <BillingIntervalContext.Provider value={{ billingInterval, setBillingInterval }}>
      {children}
    </BillingIntervalContext.Provider>
  );
}

export function useBillingInterval(): BillingIntervalContextValue {
  const ctx = useContext(BillingIntervalContext);
  if (!ctx) {
    throw new Error("useBillingInterval must be used within BillingIntervalProvider");
  }
  return ctx;
}


