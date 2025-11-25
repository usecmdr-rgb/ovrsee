"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import { useAppState } from "@/context/AppStateContext";

const dropdownItems = [
  { id: "business", label: "Business Info" },
  { id: "billing", label: "Billing & Subscription" },
  { id: "settings", label: "Settings" },
  { id: "terms", label: "Terms of Service" },
];

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
  const [open, setOpen] = useState(false);

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
        className="flex items-center space-x-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
      >
        <UserRound size={18} />
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {dropdownItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {item.label}
            </button>
          ))}
          <button
            onClick={() => {
              logout();
              setOpen(false);
            }}
            className="mt-2 flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
