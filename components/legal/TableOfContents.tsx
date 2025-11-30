"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { ChevronDown } from "lucide-react";

interface TOCItem {
  id: string;
  label: string;
  subItems?: TOCItem[];
}

interface TableOfContentsProps {
  items: TOCItem[];
  className?: string;
}

export default function TableOfContents({ items, className = "" }: TableOfContentsProps) {
  const t = useTranslation();
  const [activeSection, setActiveSection] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const sections = items.flatMap((item) => 
        item.subItems ? [item.id, ...item.subItems.map((sub) => sub.id)] : [item.id]
      );
      
      for (let i = sections.length - 1; i >= 0; i--) {
        const element = document.getElementById(sections[i]);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 100) {
            setActiveSection(sections[i]);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Initial check
    return () => window.removeEventListener("scroll", handleScroll);
  }, [items]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      setIsOpen(false);
    }
  };

  const renderItem = (item: TOCItem, level: number = 0) => {
    const isActive = activeSection === item.id;
    const paddingLeft = level === 0 ? "pl-0" : "pl-4";

    return (
      <div key={item.id} className={paddingLeft}>
        <button
          onClick={() => scrollToSection(item.id)}
          className={`w-full text-left py-2 px-3 rounded-lg text-sm transition-colors ${
            isActive
              ? "bg-slate-800 dark:bg-slate-800 text-white dark:text-white font-medium"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          {item.label}
        </button>
        {item.subItems && item.subItems.length > 0 && (
          <div className="mt-1 space-y-1">
            {item.subItems.map((subItem) => renderItem(subItem, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Mobile accordion version
  const mobileTOC = (
    <div className="lg:hidden mb-8">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 text-left"
      >
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {t("tableOfContents") || "Table of Contents"}
        </span>
        <ChevronDown
          className={`h-5 w-5 text-slate-600 dark:text-slate-400 transition-transform ${
            isOpen ? "transform rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="mt-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 space-y-1">
          {items.map((item) => renderItem(item))}
        </div>
      )}
    </div>
  );

  // Desktop sticky sidebar version
  const desktopTOC = (
    <aside className="hidden lg:block lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
      <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 uppercase tracking-wider">
          {t("tableOfContents") || "Table of Contents"}
        </h2>
        <nav className="space-y-1">
          {items.map((item) => renderItem(item))}
        </nav>
      </div>
    </aside>
  );

  return (
    <div className={className}>
      {mobileTOC}
      {desktopTOC}
    </div>
  );
}

