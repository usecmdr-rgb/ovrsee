"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { Loader2, Save, Plus, Trash2, Edit2, X } from "lucide-react";
import type { BusinessProfile, BusinessService, BusinessPricingTier, BusinessHours, BusinessFAQ } from "@/lib/sync/businessInfo";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const BRAND_VOICES = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "direct", label: "Direct & Concise" },
  { value: "casual_professional", label: "Casual Professional" },
  { value: "formal", label: "Formal" },
];

const BILLING_INTERVALS = [
  { value: "one_time", label: "One-time" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

export default function BusinessSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "services" | "hours" | "faqs">("profile");

  // Profile state
  const [profile, setProfile] = useState<Partial<BusinessProfile>>({
    business_name: "",
    website_url: "",
    description: "",
    default_currency: "USD",
    brand_voice: "professional",
  });

  // Services & Pricing state
  const [services, setServices] = useState<BusinessService[]>([]);
  const [pricingTiers, setPricingTiers] = useState<BusinessPricingTier[]>([]);
  const [editingService, setEditingService] = useState<string | null>(null);
  const [editingTier, setEditingTier] = useState<string | null>(null);

  // Hours state
  const [hours, setHours] = useState<Record<number, Partial<BusinessHours>>>({});
  const [timezone, setTimezone] = useState("America/New_York");

  // FAQs state
  const [faqs, setFaqs] = useState<BusinessFAQ[]>([]);
  const [editingFaq, setEditingFaq] = useState<string | null>(null);

  // Load business data
  useEffect(() => {
    loadBusinessData();
  }, []);

  const loadBusinessData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        router.push("/");
        return;
      }

      const res = await fetch("/api/settings/business", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load business data");
      }

      const data = await res.json();

      if (data.profile) {
        setProfile(data.profile);
      }

      setServices(data.services || []);
      setPricingTiers(data.pricingTiers || []);

      // Initialize hours
      const hoursMap: Record<number, Partial<BusinessHours>> = {};
      if (data.hours && data.hours.length > 0) {
        data.hours.forEach((h: BusinessHours) => {
          hoursMap[h.day_of_week] = h;
          if (h.timezone) setTimezone(h.timezone);
        });
      }
      // Initialize all days
      DAYS_OF_WEEK.forEach((day) => {
        if (!hoursMap[day.value]) {
          hoursMap[day.value] = {
            day_of_week: day.value,
            is_closed: false,
            open_time: "09:00",
            close_time: "17:00",
            timezone: timezone,
          };
        }
      });
      setHours(hoursMap);

      setFaqs(data.faqs || []);
    } catch (error) {
      console.error("Error loading business data:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/settings/business/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(profile),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save profile");
      }

      const data = await res.json();
      setProfile(data.profile);
      alert("Profile saved successfully!");
    } catch (error: any) {
      console.error("Error saving profile:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveService = async (service: Partial<BusinessService>) => {
    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/settings/business/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(service),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save service");
      }

      const data = await res.json();
      if (service.id) {
        setServices(services.map((s) => (s.id === service.id ? data.service : s)));
      } else {
        setServices([...services, data.service]);
      }
      setEditingService(null);
    } catch (error: any) {
      console.error("Error saving service:", error);
      alert(`Error: ${error.message}`);
    }
  };

  const deleteService = async (serviceId: string) => {
    if (!confirm("Are you sure you want to delete this service?")) return;

    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`/api/settings/business/services?id=${serviceId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to delete service");
      }

      setServices(services.filter((s) => s.id !== serviceId));
      setPricingTiers(pricingTiers.filter((t) => t.service_id !== serviceId));
    } catch (error: any) {
      console.error("Error deleting service:", error);
      alert(`Error: ${error.message}`);
    }
  };

  const savePricingTier = async (tier: Partial<BusinessPricingTier>) => {
    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/settings/business/pricing-tiers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(tier),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save pricing tier");
      }

      const data = await res.json();
      if (tier.id) {
        setPricingTiers(pricingTiers.map((t) => (t.id === tier.id ? data.tier : t)));
      } else {
        setPricingTiers([...pricingTiers, data.tier]);
      }
      setEditingTier(null);
    } catch (error: any) {
      console.error("Error saving pricing tier:", error);
      alert(`Error: ${error.message}`);
    }
  };

  const deletePricingTier = async (tierId: string) => {
    if (!confirm("Are you sure you want to delete this pricing tier?")) return;

    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`/api/settings/business/pricing-tiers?id=${tierId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to delete pricing tier");
      }

      setPricingTiers(pricingTiers.filter((t) => t.id !== tierId));
    } catch (error: any) {
      console.error("Error deleting pricing tier:", error);
      alert(`Error: ${error.message}`);
    }
  };

  const saveHours = async () => {
    try {
      setSaving(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const hoursArray = Object.values(hours).map((h) => ({
        ...h,
        timezone,
      }));

      const res = await fetch("/api/settings/business/hours", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ hours: hoursArray, timezone }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save business hours");
      }

      alert("Business hours saved successfully!");
    } catch (error: any) {
      console.error("Error saving hours:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveFAQ = async (faq: Partial<BusinessFAQ>) => {
    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/settings/business/faqs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(faq),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save FAQ");
      }

      const data = await res.json();
      if (faq.id) {
        setFaqs(faqs.map((f) => (f.id === faq.id ? data.faq : f)));
      } else {
        setFaqs([...faqs, data.faq]);
      }
      setEditingFaq(null);
    } catch (error: any) {
      console.error("Error saving FAQ:", error);
      alert(`Error: ${error.message}`);
    }
  };

  const deleteFAQ = async (faqId: string) => {
    if (!confirm("Are you sure you want to delete this FAQ?")) return;

    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`/api/settings/business/faqs?id=${faqId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to delete FAQ");
      }

      setFaqs(faqs.filter((f) => f.id !== faqId));
    } catch (error: any) {
      console.error("Error deleting FAQ:", error);
      alert(`Error: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
        <h1 className="text-2xl font-semibold">Business Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure your business information to help Sync answer emails accurately
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {(["profile", "services", "hours", "faqs"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab
                ? "border-b-2 border-slate-900 text-slate-900 dark:border-white dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <div className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Business Name *</label>
              <input
                type="text"
                value={profile.business_name || ""}
                onChange={(e) => setProfile({ ...profile, business_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                placeholder="Your Business Name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Website URL</label>
              <input
                type="url"
                value={profile.website_url || ""}
                onChange={(e) => setProfile({ ...profile, website_url: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                placeholder="https://example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Description</label>
              <textarea
                value={profile.description || ""}
                onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                rows={3}
                placeholder="Brief description of your business"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Default Currency</label>
                <select
                  value={profile.default_currency || "USD"}
                  onChange={(e) => setProfile({ ...profile, default_currency: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Brand Voice</label>
                <select
                  value={profile.brand_voice || "professional"}
                  onChange={(e) => setProfile({ ...profile, brand_voice: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                >
                  {BRAND_VOICES.map((voice) => (
                    <option key={voice.value} value={voice.value}>
                      {voice.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={saveProfile}
            disabled={saving || !profile.business_name?.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Profile
          </button>
        </div>
      )}

      {/* Services & Pricing Tab */}
      {activeTab === "services" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Services & Pricing</h2>
            <button
              onClick={() => setEditingService("new")}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              <Plus className="h-4 w-4" />
              Add Service
            </button>
          </div>

          {/* Services List */}
          <div className="space-y-4">
            {services.map((service) => (
              <div key={service.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold">{service.name}</h3>
                    {service.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{service.description}</p>
                    )}
                    {service.category && (
                      <span className="inline-block mt-2 px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 rounded">
                        {service.category}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingService(service.id)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteService(service.id)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Pricing Tiers for this service */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Pricing Tiers</span>
                    <button
                      onClick={() => setEditingTier(`new-${service.id}`)}
                      className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    >
                      + Add Tier
                    </button>
                  </div>
                  {pricingTiers
                    .filter((t) => t.service_id === service.id)
                    .map((tier) => (
                      <div key={tier.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded text-sm">
                        <div>
                          <span className="font-semibold">{tier.name}</span>
                          <span className="ml-2 text-slate-600 dark:text-slate-400">
                            {tier.price_currency} {tier.price_amount} / {BILLING_INTERVALS.find((i) => i.value === tier.billing_interval)?.label}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingTier(tier.id)}
                            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => deletePricingTier(tier.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}

            {services.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">No services yet. Add your first service to get started.</p>
            )}
          </div>

          {/* Service Edit Modal */}
          {editingService && (
            <ServiceEditModal
              service={editingService === "new" ? null : services.find((s) => s.id === editingService) || null}
              onSave={(service) => {
                saveService(service);
              }}
              onClose={() => setEditingService(null)}
            />
          )}

          {/* Pricing Tier Edit Modal */}
          {editingTier && (
            <PricingTierEditModal
              tier={
                editingTier.startsWith("new-")
                  ? { service_id: editingTier.split("-")[1] }
                  : pricingTiers.find((t) => t.id === editingTier) || null
              }
              defaultCurrency={profile.default_currency || "USD"}
              onSave={(tier) => {
                savePricingTier(tier);
              }}
              onClose={() => setEditingTier(null)}
            />
          )}
        </div>
      )}

      {/* Hours Tab */}
      {activeTab === "hours" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => {
                setTimezone(e.target.value);
                setHours(
                  Object.fromEntries(
                    Object.entries(hours).map(([day, h]) => [day, { ...h, timezone: e.target.value }])
                  )
                );
              }}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
            >
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="Europe/London">London (GMT)</option>
              <option value="Europe/Paris">Paris (CET)</option>
            </select>
          </div>

          <div className="space-y-2">
            {DAYS_OF_WEEK.map((day) => {
              const dayHours = hours[day.value] || {
                day_of_week: day.value,
                is_closed: false,
                open_time: "09:00",
                close_time: "17:00",
                timezone,
              };

              return (
                <div key={day.value} className="flex items-center gap-4 p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <div className="w-24 font-semibold">{day.label}</div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={dayHours.is_closed || false}
                      onChange={(e) => {
                        setHours({
                          ...hours,
                          [day.value]: { ...dayHours, is_closed: e.target.checked },
                        });
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">Closed</span>
                  </label>
                  {!dayHours.is_closed && (
                    <>
                      <input
                        type="time"
                        value={dayHours.open_time || "09:00"}
                        onChange={(e) => {
                          setHours({
                            ...hours,
                            [day.value]: { ...dayHours, open_time: e.target.value },
                          });
                        }}
                        className="px-2 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                      />
                      <span className="text-slate-500">to</span>
                      <input
                        type="time"
                        value={dayHours.close_time || "17:00"}
                        onChange={(e) => {
                          setHours({
                            ...hours,
                            [day.value]: { ...dayHours, close_time: e.target.value },
                          });
                        }}
                        className="px-2 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={saveHours}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Hours
          </button>
        </div>
      )}

      {/* FAQs Tab */}
      {activeTab === "faqs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Frequently Asked Questions</h2>
            <button
              onClick={() => setEditingFaq("new")}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              <Plus className="h-4 w-4" />
              Add FAQ
            </button>
          </div>

          <div className="space-y-3">
            {faqs.map((faq) => (
              <div key={faq.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{faq.question}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{faq.answer}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingFaq(faq.id)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteFAQ(faq.id)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {faqs.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">No FAQs yet. Add common questions to help Sync answer inquiries.</p>
            )}
          </div>

          {/* FAQ Edit Modal */}
          {editingFaq && (
            <FAQEditModal
              faq={editingFaq === "new" ? null : faqs.find((f) => f.id === editingFaq) || null}
              onSave={(faq) => {
                saveFAQ(faq);
              }}
              onClose={() => setEditingFaq(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Service Edit Modal Component
function ServiceEditModal({
  service,
  onSave,
  onClose,
}: {
  service: BusinessService | null;
  onSave: (service: Partial<BusinessService>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(service?.name || "");
  const [description, setDescription] = useState(service?.description || "");
  const [category, setCategory] = useState(service?.category || "");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{service ? "Edit Service" : "Add Service"}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
              placeholder="e.g., Consulting, Software, Marketing"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onSave({ id: service?.id, name, description, category })}
              disabled={!name.trim()}
              className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              Save
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Pricing Tier Edit Modal Component
function PricingTierEditModal({
  tier,
  defaultCurrency,
  onSave,
  onClose,
}: {
  tier: Partial<BusinessPricingTier> | null;
  defaultCurrency: string;
  onSave: (tier: Partial<BusinessPricingTier>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(tier?.name || "");
  const [description, setDescription] = useState(tier?.description || "");
  const [priceAmount, setPriceAmount] = useState(tier?.price_amount?.toString() || "");
  const [priceCurrency, setPriceCurrency] = useState(tier?.price_currency || defaultCurrency);
  const [billingInterval, setBillingInterval] = useState<BusinessPricingTier["billing_interval"]>(
    tier?.billing_interval || "one_time"
  );
  const [isDefault, setIsDefault] = useState(tier?.is_default || false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{tier?.id ? "Edit Pricing Tier" : "Add Pricing Tier"}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Price *</label>
              <input
                type="number"
                step="0.01"
                value={priceAmount}
                onChange={(e) => setPriceAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Currency</label>
              <select
                value={priceCurrency}
                onChange={(e) => setPriceCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Billing Interval</label>
            <select
              value={billingInterval}
              onChange={(e) => setBillingInterval(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
            >
              {BILLING_INTERVALS.map((interval) => (
                <option key={interval.value} value={interval.value}>
                  {interval.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Set as default pricing tier</span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={() =>
                onSave({
                  id: tier?.id,
                  service_id: tier?.service_id,
                  name,
                  description,
                  price_amount: parseFloat(priceAmount) || 0,
                  price_currency: priceCurrency,
                  billing_interval: billingInterval,
                  is_default: isDefault,
                })
              }
              disabled={!name.trim() || !priceAmount}
              className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              Save
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// FAQ Edit Modal Component
function FAQEditModal({
  faq,
  onSave,
  onClose,
}: {
  faq: BusinessFAQ | null;
  onSave: (faq: Partial<BusinessFAQ>) => void;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState(faq?.question || "");
  const [answer, setAnswer] = useState(faq?.answer || "");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{faq ? "Edit FAQ" : "Add FAQ"}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Question *</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Answer *</label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
              rows={4}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onSave({ id: faq?.id, question, answer })}
              disabled={!question.trim() || !answer.trim()}
              className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              Save
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


