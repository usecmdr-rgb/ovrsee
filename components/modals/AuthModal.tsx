"use client";

import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { useAppState } from "@/context/AppStateContext";
import { Mail } from "lucide-react";
import { FormEvent } from "react";

const AuthModal = () => {
  const { authModalMode, closeAuthModal, login } = useAppState();
  const router = useRouter();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Call login first to update state and save to localStorage
    login();
    // Close modal
    closeAuthModal();
    // Wait a moment for state updates and localStorage to be written
    await new Promise(resolve => setTimeout(resolve, 150));
    // Navigate to dashboard with all agents
    router.push("/app");
  };

  return (
    <Modal
      title={authModalMode === "signup" ? "Create your CommanderX account" : "Welcome back to CommanderX"}
      description="Authentication is simulated for this preview build."
      open={Boolean(authModalMode)}
      onClose={closeAuthModal}
    >
      <div className="space-y-4">
        <button
          className="flex w-full items-center justify-center space-x-2 rounded-full border border-slate-200 px-4 py-2 font-medium shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          <Mail size={18} />
          <span>Continue with Google (Gmail)</span>
        </button>
        <div className="text-center text-xs uppercase tracking-widest text-slate-400">
          or use email
        </div>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              required
              className="mt-1 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 focus:border-brand-accent focus:outline-none dark:border-slate-700"
              placeholder="you@business.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <input
              type="password"
              required
              className="mt-1 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 focus:border-brand-accent focus:outline-none dark:border-slate-700"
              placeholder="********"
            />
          </div>
          {authModalMode === "signup" && (
            <div>
              <label className="text-sm font-medium">Company name</label>
              <input
                type="text"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 focus:border-brand-accent focus:outline-none dark:border-slate-700"
                placeholder="CommanderX Studio"
              />
            </div>
          )}
          <button
            type="submit"
            className="mt-2 w-full rounded-full bg-slate-900 px-4 py-2 font-semibold text-white shadow-lg hover:bg-slate-800 dark:bg-white dark:text-slate-900"
          >
            Continue
          </button>
        </form>
      </div>
    </Modal>
  );
};

export default AuthModal;
