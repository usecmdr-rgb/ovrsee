"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

export default function LogoIntro() {
  // Light mode glow sequence (dark logo with white glow)
  const lightGlowFilter = [
    "brightness(0) drop-shadow(0 0 0px rgba(255,255,255,0))",
    "brightness(0) drop-shadow(0 0 20px rgba(255,255,255,0.25))",
    "brightness(0) drop-shadow(0 0 8px rgba(255,255,255,0.15))",
    "brightness(0) drop-shadow(0 0 25px rgba(255,255,255,0.2))",
    "brightness(0) drop-shadow(0 0 10px rgba(255,255,255,0.1))",
    "brightness(0) drop-shadow(0 0 0px rgba(255,255,255,0))",
  ];

  // Dark mode glow sequence (white logo with blue glow)
  const darkGlowFilter = [
    "brightness(0) invert(1) drop-shadow(0 0 0px rgba(0,160,255,0))",
    "brightness(0) invert(1) drop-shadow(0 0 25px rgba(0,160,255,0.35))",
    "brightness(0) invert(1) drop-shadow(0 0 10px rgba(0,160,255,0.25))",
    "brightness(0) invert(1) drop-shadow(0 0 30px rgba(0,160,255,0.4))",
    "brightness(0) invert(1) drop-shadow(0 0 15px rgba(0,160,255,0.3))",
    "brightness(0) invert(1) drop-shadow(0 0 0px rgba(0,160,255,0))",
  ];

  // Flickering opacity sequence for glitch effect
  const flickerOpacity = [
    0,      // Start invisible
    0.3,    // Quick flash
    0,      // Off
    0.7,    // Stronger flash
    0.2,    // Dim
    0.9,    // Bright
    0.1,    // Quick dim
    1,      // Full on
    0.4,    // Flicker
    1,      // Final stable
  ];

  return (
    <Link href="/" className="flex items-center pointer-events-auto min-h-[48px]">
      <motion.div
        initial={{ opacity: 0, filter: "blur(4px)" }}
        animate={{
          opacity: flickerOpacity,
          filter: [
            "blur(4px)",
            "blur(0px)",
            "blur(1px)",
            "blur(0px)",
            "blur(0.5px)",
            "blur(0px)",
            "blur(0px)",
            "blur(0px)",
            "blur(0px)",
            "blur(0px)",
          ],
        }}
        transition={{ 
          duration: 1.2, 
          ease: "easeOut",
          times: [0, 0.1, 0.15, 0.25, 0.35, 0.5, 0.6, 0.75, 0.85, 1]
        }}
        className="relative"
      >
        {/* Light mode logo with white glow and flicker */}
        <motion.div
          className="relative dark:hidden"
          animate={{ 
            filter: lightGlowFilter,
            opacity: [0.3, 1, 0.5, 1, 0.7, 1]
          }}
          transition={{ 
            duration: 1.2, 
            ease: "easeOut",
            times: [0, 0.2, 0.4, 0.6, 0.8, 1]
          }}
        >
          <Image
            src="/ovrsee_stacked_transparent.png"
            alt="OVRSEE"
            width={48}
            height={0}
            priority
            className="h-auto"
            style={{ width: '48px', height: 'auto' }}
          />
        </motion.div>
        
        {/* Dark mode logo with blue glow and flicker */}
        <motion.div
          className="relative hidden dark:block"
          animate={{ 
            filter: darkGlowFilter,
            opacity: [0.3, 1, 0.5, 1, 0.7, 1]
          }}
          transition={{ 
            duration: 1.2, 
            ease: "easeOut",
            times: [0, 0.2, 0.4, 0.6, 0.8, 1]
          }}
        >
          <Image
            src="/ovrsee_stacked_transparent.png"
            alt="OVRSEE"
            width={48}
            height={0}
            priority
            className="h-auto"
            style={{ width: '48px', height: 'auto' }}
          />
        </motion.div>
      </motion.div>
    </Link>
  );
}
