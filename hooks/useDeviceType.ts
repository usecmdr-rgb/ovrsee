"use client";

import { useEffect, useMemo, useState } from "react";

export type DeviceType = "mobile" | "tablet" | "desktop";

const getDeviceType = (width: number): DeviceType => {
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
};

export const useDeviceType = () => {
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    handleResize();
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const deviceType = useMemo(() => getDeviceType(viewportWidth), [viewportWidth]);

  return {
    deviceType,
    viewportWidth,
    isMobile: deviceType === "mobile",
    isTablet: deviceType === "tablet",
    isDesktop: deviceType === "desktop",
  };
};













