"use client";

import { X } from "lucide-react";
import { ReactNode, useEffect, useRef, useId } from "react";
import { useTranslation } from "@/hooks/useTranslation";

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  description?: string;
  size?: "md" | "lg";
  children: ReactNode;
}

const Modal = ({ title, open, onClose, description, size = "md", children }: ModalProps) => {
  const t = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Focus management: save previous focus and focus modal when opened
  useEffect(() => {
    if (open) {
      // Save the currently focused element
      previousActiveElementRef.current = document.activeElement as HTMLElement;
      
      // Focus the close button after a brief delay to ensure modal is rendered
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 0);
    } else {
      // Restore focus to the previously focused element when modal closes
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
        previousActiveElementRef.current = null;
      }
    }
  }, [open]);

  // Keyboard trap: handle Tab key to cycle focus within modal
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const modalElement = modalRef.current;
      if (!modalElement) return;

      // Get all focusable elements within the modal
      const focusableElements = modalElement.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift + Tab: go backwards
        if (document.activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        // Tab: go forwards
        if (document.activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div 
      className="modal-overlay" 
      role="dialog" 
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={(e) => {
        // Close modal when clicking overlay
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className={`modal-panel w-full max-w-[calc(100vw-2rem)] sm:max-w-2xl ${size === "lg" ? "lg:max-w-3xl" : ""}`}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
            )}
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label={t("modalCloseDialog")}
            className="rounded-full border border-transparent p-1 text-slate-500 hover:border-slate-200 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:hover:border-slate-700 dark:focus-visible:outline-white"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
