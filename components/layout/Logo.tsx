"use client";

import Link from "next/link";
import Image from "next/image";

interface LogoProps {
  className?: string;
}

export default function Logo({ className = "" }: LogoProps) {
  return (
    <Link 
      href="/" 
      className={`inline-flex items-center justify-center pointer-events-auto ${className}`}
      style={{ minHeight: '48px', display: 'flex' }}
    >
      {/* Light mode: dark logo */}
      <div className="dark:hidden" style={{ filter: 'brightness(0)' }}>
        <Image
          src="/ovrsee_stacked_transparent.png"
          alt="OVRSEE"
          width={48}
          height={0}
          priority
          className="h-auto"
          style={{ width: '48px', height: 'auto' }}
        />
      </div>
      
      {/* Dark mode: white logo */}
      <div className="hidden dark:block" style={{ filter: 'brightness(0) invert(1)' }}>
        <Image
          src="/ovrsee_stacked_transparent.png"
          alt="OVRSEE"
          width={48}
          height={0}
          priority
          className="h-auto"
          style={{ width: '48px', height: 'auto' }}
        />
      </div>
    </Link>
  );
}
