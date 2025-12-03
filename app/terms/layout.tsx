import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - OVRSEE",
  description: "OVRSEE Terms of Service - Please review these terms carefully before using our services.",
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}



