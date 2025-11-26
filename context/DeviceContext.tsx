"use client";

import { createContext, useContext, useEffect } from "react";
import { useDeviceType } from "@/hooks/useDeviceType";

type DeviceContextValue = ReturnType<typeof useDeviceType>;

const DeviceContext = createContext<DeviceContextValue | undefined>(undefined);

export const DeviceProvider = ({ children }: { children: React.ReactNode }) => {
  const value = useDeviceType();

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-device", value.deviceType);
  }, [value.deviceType]);

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
};

export const useDevice = () => {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error("useDevice must be used within a DeviceProvider");
  }
  return context;
};

