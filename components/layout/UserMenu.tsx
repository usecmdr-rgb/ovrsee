"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import { useAppState } from "@/context/AppStateContext";
import { useTranslation } from "@/hooks/useTranslation";

const UserMenu = () => {
  const router = useRouter();
  const {
    isAuthenticated,
    logout,
    setShowBusinessModal,
    setShowBillingModal,
    setShowSettingsModal,
    setShowTermsModal,
  } = useAppState();
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  
  const dropdownItems = [
    { id: "business", label: t("userMenuBusinessInfo") },
    { id: "billing", label: t("userMenuBilling") },
    { id: "settings", label: t("userMenuSettings") },
    { id: "terms", label: t("userMenuTerms") },
  ];

  if (!isAuthenticated) return null;

  const handleItemClick = (id: string) => {
    switch (id) {
      case "business":
        setShowBusinessModal(true);
        break;
      case "billing":
        router.push("/account/subscription");
        break;
      case "settings":
        setShowSettingsModal(true);
        break;
      case "terms":
        setShowTermsModal(true);
        break;
      default:
        break;
    }
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label="User menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center space-x-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:focus-visible:outline-white"
      >
        <UserRound size={18} aria-hidden="true" />
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div 
          className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          role="menu"
          aria-label="User menu options"
        >
          {dropdownItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              role="menuitem"
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:outline-white"
            >
              {item.label}
            </button>
          ))}
          <button
            onClick={() => {
              logout();
              setOpen(false);
            }}
            role="menuitem"
            className="mt-2 flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 dark:hover:bg-rose-950"
          >
            <LogOut size={16} aria-hidden="true" />
            <span>{t("userMenuLogout")}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
