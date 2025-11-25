"use client";

import { FormEvent } from "react";
import Modal from "@/components/ui/Modal";
import { useAppState } from "@/context/AppStateContext";

const fields = [
  { id: "businessName", label: "Business name", placeholder: "CommanderX Studio" },
  { id: "businessType", label: "Business type / industry", placeholder: "Consulting" },
  { id: "location", label: "Location", placeholder: "San Francisco, CA" },
  { id: "operatingHours", label: "Operating hours", placeholder: "Mon-Fri, 8a-6p" },
  { id: "serviceName", label: "Service name / Product", placeholder: "Consulting Services" },
  { id: "website", label: "Website", placeholder: "https://" },
  { id: "contactEmail", label: "Contact email", placeholder: "ops@company.com" },
  { id: "contactPhone", label: "Contact phone", placeholder: "+1 (555) 123-4567" },
  { id: "language", label: "Preferred language", placeholder: "English" },
  { id: "timezone", label: "Timezone", placeholder: "EST" },
];

const BusinessInfoModal = () => {
  const { showBusinessModal, setShowBusinessModal, businessInfo, updateBusinessInfo } = useAppState();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowBusinessModal(false);
    // Mark as shown so it doesn't appear again
    if (typeof window !== "undefined") {
      window.localStorage.setItem("cx-business-modal-shown", "true");
    }
  };

  return (
    <Modal
      title="Help Us, Help You"
      description="This information will be given to the agents."
      open={showBusinessModal}
      onClose={() => {
        setShowBusinessModal(false);
        // Mark as shown so it doesn't appear again
        if (typeof window !== "undefined") {
          window.localStorage.setItem("cx-business-modal-shown", "true");
        }
      }}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((field) => (
            <label key={field.id} className="text-sm font-medium">
              {field.label}
              <input
                value={(businessInfo as any)[field.id] ?? ""}
                onChange={(event) =>
                  updateBusinessInfo({ [field.id]: event.target.value } as any)
                }
                placeholder={field.placeholder}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
              />
            </label>
          ))}
        </div>
        <label className="text-sm font-medium">
          Services / Products
          <textarea
            value={businessInfo.services}
            onChange={(event) => updateBusinessInfo({ services: event.target.value })}
            rows={6}
            placeholder="List all your services and products with details, pricing, and information..."
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
          />
        </label>
        <label className="text-sm font-medium">
          Notes / &quot;Help us, help you&quot;
          <textarea
            value={businessInfo.notes}
            onChange={(event) => updateBusinessInfo({ notes: event.target.value })}
            rows={4}
            placeholder="Remind callers we are closed on state holidays..."
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
          />
        </label>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setShowBusinessModal(false);
              // Mark as shown so it doesn't appear again
              if (typeof window !== "undefined") {
                window.localStorage.setItem("cx-business-modal-shown", "true");
              }
            }}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-slate-800 dark:bg-white dark:text-slate-900"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default BusinessInfoModal;
