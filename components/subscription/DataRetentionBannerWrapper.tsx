"use client";

import { useEffect, useState } from "react";
import DataRetentionBanner from "./DataRetentionBanner";

/**
 * Wrapper component that renders the DataRetentionBanner and adjusts
 * main content padding when the banner is visible
 */
export default function DataRetentionBannerWrapper() {
  const [bannerHeight, setBannerHeight] = useState(0);

  useEffect(() => {
    // Check if banner is visible and measure its height
    const checkBanner = () => {
      const banner = document.querySelector('[data-retention-banner]');
      if (banner) {
        const height = banner.getBoundingClientRect().height;
        setBannerHeight(height);
        // Update CSS variable for main content padding
        document.documentElement.style.setProperty(
          '--banner-height',
          `${height}px`
        );
      } else {
        setBannerHeight(0);
        document.documentElement.style.setProperty('--banner-height', '0px');
      }
    };

    // Check initially
    checkBanner();

    // Use MutationObserver to watch for banner visibility changes
    const observer = new MutationObserver(checkBanner);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    // Also check on resize
    window.addEventListener('resize', checkBanner);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', checkBanner);
    };
  }, []);

  return (
    <div data-retention-banner>
      <DataRetentionBanner />
    </div>
  );
}

