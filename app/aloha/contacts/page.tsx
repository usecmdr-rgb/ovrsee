"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, Phone, Clock, X, Check, Search, Shield, Upload, Plus } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface ContactProfile {
  id: string;
  phone_number: string;
  name: string | null;
  notes: string | null;
  do_not_call: boolean;
  last_called_at: string | null;
  last_outcome: string | null;
  times_contacted: number;
  created_at: string;
}

export default function ContactsPage() {
  const router = useRouter();
  const t = useTranslation();
  const [contacts, setContacts] = useState<ContactProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "do_not_call" | "recent">("all");
  const [selectedContact, setSelectedContact] = useState<ContactProfile | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactNotes, setNewContactNotes] = useState("");
  const [newContactDoNotCall, setNewContactDoNotCall] = useState(false);
  const [savingNewContact, setSavingNewContact] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, [filter]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/aloha/contacts");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load contacts");
      }

      setContacts(data.contacts || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async () => {
    try {
      if (!newContactPhone.trim()) {
        setError("Phone number is required to add a contact.");
        return;
      }

      setSavingNewContact(true);
      setError(null);

      const res = await fetch("/api/aloha/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contact: {
            phoneNumber: newContactPhone.trim(),
            name: newContactName.trim() || null,
            notes: newContactNotes.trim() || null,
            doNotCall: newContactDoNotCall,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add contact");
      }

      await fetchContacts();

      setNewContactName("");
      setNewContactPhone("");
      setNewContactNotes("");
      setNewContactDoNotCall(false);
    } catch (err: any) {
      setError(err.message || "Failed to add contact");
    } finally {
      setSavingNewContact(false);
    }
  };

  const handleCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingCsv(true);
      setError(null);

      const text = await file.text();
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

      if (lines.length === 0) {
        throw new Error("CSV file is empty.");
      }

      const headerLine = lines[0];
      const headers = headerLine.split(",").map((h) => h.trim().toLowerCase());

      const phoneIndex =
        headers.indexOf("phone") >= 0
          ? headers.indexOf("phone")
          : headers.indexOf("phone_number") >= 0
          ? headers.indexOf("phone_number")
          : headers.indexOf("phonenumber");

      if (phoneIndex < 0) {
        throw new Error("CSV must include a 'phone' or 'phone_number' column.");
      }

      const nameIndex = headers.indexOf("name");
      const notesIndex = headers.indexOf("notes");
      const dncIndex =
        headers.indexOf("do_not_call") >= 0
          ? headers.indexOf("do_not_call")
          : headers.indexOf("donotcall");

      const contactsToUpload = lines
        .slice(1)
        .map((line) => line.split(","))
        .map((cols) => {
          const phone = cols[phoneIndex]?.trim();
          if (!phone) return null;

          const name = nameIndex >= 0 ? cols[nameIndex]?.trim() || undefined : undefined;
          const notes = notesIndex >= 0 ? cols[notesIndex]?.trim() || undefined : undefined;
          const dncRaw = dncIndex >= 0 ? cols[dncIndex]?.trim().toLowerCase() : "";
          const doNotCall =
            dncRaw === "true" || dncRaw === "1" || dncRaw === "yes" || dncRaw === "y";

          return {
            phoneNumber: phone,
            name,
            notes,
            doNotCall,
          };
        })
        .filter(Boolean) as {
        phoneNumber: string;
        name?: string;
        notes?: string;
        doNotCall?: boolean;
      }[];

      if (contactsToUpload.length === 0) {
        throw new Error("No valid contacts found in CSV.");
      }

      const res = await fetch("/api/aloha/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contacts: contactsToUpload,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to upload contacts");
      }

      await fetchContacts();
      event.target.value = "";
    } catch (err: any) {
      setError(err.message || "Failed to upload contacts from CSV.");
    } finally {
      setUploadingCsv(false);
    }
  };

  const handleToggleDoNotCall = async (contact: ContactProfile) => {
    try {
      setError(null);

      const res = await fetch("/api/aloha/contacts", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: contact.id,
          doNotCall: !contact.do_not_call,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update contact");
      }

      const updated = data.contact as ContactProfile;

      setContacts((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
      );
    } catch (err: any) {
      setError(err.message || "Failed to update contact");
    }
  };

  const handleUpdateNotes = async (contact: ContactProfile) => {
    try {
      setError(null);

      const res = await fetch("/api/aloha/contacts", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: contact.id,
          notes: notesValue,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update notes");
      }

      const updated = data.contact as ContactProfile;

      setContacts((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
      );
      setEditingNotes(false);
      setSelectedContact(null);
      setNotesValue("");
    } catch (err: any) {
      setError(err.message || "Failed to update notes");
    }
  };

  const getOutcomeLabel = (outcome: string | null) => {
    if (!outcome) return null;
    const labels: Record<string, string> = {
      feedback_collected: t("feedbackCollected"),
      rescheduled: t("rescheduled"),
      not_interested: t("notInterested"),
      asked_for_email: t("askedForEmail"),
      do_not_call: t("doNotCallLabel"),
      no_answer: t("noAnswer"),
    };
    return labels[outcome] || outcome;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t("never");
    const date = new Date(dateString);
    const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (daysAgo === 0) return t("today");
    if (daysAgo === 1) return t("yesterday");
    if (daysAgo < 7) return `${daysAgo} ${t("daysAgo")}`;
    return date.toLocaleDateString();
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = !searchQuery || 
      contact.phone_number.includes(searchQuery) ||
      (contact.name && contact.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = 
      filter === "all" ||
      (filter === "do_not_call" && contact.do_not_call) ||
      (filter === "recent" && contact.last_called_at && 
       new Date(contact.last_called_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-500">{t("loadingContacts")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <button
          onClick={() => router.back()}
          className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-4"
        >
          {t("back")}
        </button>
        <p className="text-sm uppercase tracking-widest text-slate-500">{t("alohaAgent")}</p>
        <h1 className="text-3xl font-semibold">{t("contactMemoryPage")}</h1>
        <p className="text-slate-600 dark:text-slate-300 mt-2">
          {t("manageContactProfiles")}
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Add Contacts */}
      <div className="grid gap-4 lg:grid-cols-[2fr,1.5fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Plus className="w-4 h-4" />
                {t("addContactForCalls")}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {t("addIndividualContacts")}
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                {t("nameOptional")}
              </label>
              <input
                type="text"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                placeholder="Maria Gomez"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                {t("phoneNumberRequired")}
              </label>
              <input
                type="tel"
                value={newContactPhone}
                onChange={(e) => setNewContactPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("notesOptional")}
            </label>
            <textarea
              value={newContactNotes}
              onChange={(e) => setNewContactNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              placeholder={t("notesPlaceholder")}
            />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={newContactDoNotCall}
                onChange={(e) => setNewContactDoNotCall(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-accent focus:ring-brand-accent"
              />
              {t("markAsDoNotCall")}
            </label>
            <button
              onClick={handleAddContact}
              disabled={savingNewContact}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-accent text-white hover:bg-brand-accent/90 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
            >
              {savingNewContact ? t("saving") : t("addContact")}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center gap-2 mb-2">
            <Upload className="w-4 h-4" />
            <h2 className="text-lg font-semibold">{t("uploadContactsCsv")}</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            {t("uploadCsvDescription")}{" "}
            <span className="font-mono">phone</span>,{" "}
            <span className="font-mono">name</span>,{" "}
            <span className="font-mono">notes</span>, {t("and")}{" "}
            <span className="font-mono">do_not_call</span>. {t("alohaWillNormalize")}
          </p>
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            <span>{uploadingCsv ? t("uploading") : t("chooseCsvFile")}</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              className="hidden"
              disabled={uploadingCsv}
            />
          </label>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">{t("totalContacts")}</p>
          <p className="text-2xl font-semibold">{contacts.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">{t("doNotCall")}</p>
          <p className="text-2xl font-semibold text-red-600">{contacts.filter(c => c.do_not_call).length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">{t("recentlyContacted")}</p>
          <p className="text-2xl font-semibold">{contacts.filter(c => c.last_called_at && new Date(c.last_called_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000).length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchByNameOrPhone")}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === "all"
                ? "bg-brand-accent text-white"
                : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
            }`}
          >
            {t("all")}
          </button>
          <button
            onClick={() => setFilter("do_not_call")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === "do_not_call"
                ? "bg-brand-accent text-white"
                : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
            }`}
          >
            {t("doNotCall")}
          </button>
          <button
            onClick={() => setFilter("recent")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === "recent"
                ? "bg-brand-accent text-white"
                : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
            }`}
          >
            {t("recent")}
          </button>
        </div>
      </div>

      {/* Contacts List */}
      {filteredContacts.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-12 text-center dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-slate-500">
            {searchQuery ? t("noContactsMatch") : t("noContactsFound")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">
                      {contact.name || t("unknownContact")}
                    </h3>
                    {contact.do_not_call && (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        {t("doNotCallLabel")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-300 mb-3">
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      <span>{contact.phone_number}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{t("lastCalled")} {formatDate(contact.last_called_at)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{t("contacted")} {contact.times_contacted} {contact.times_contacted !== 1 ? t("timesPlural") : t("times")}</span>
                    </div>
                  </div>
                  {contact.notes && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                      <strong>{t("notes")}</strong> {contact.notes}
                    </p>
                  )}
                  {contact.last_outcome && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{t("lastOutcome")}</span>
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {getOutcomeLabel(contact.last_outcome)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedContact(contact);
                      setEditingNotes(true);
                      setNotesValue(contact.notes || "");
                    }}
                    className="px-3 py-1.5 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    {t("editNotes")}
                  </button>
                  <button
                    onClick={() => handleToggleDoNotCall(contact)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      contact.do_not_call
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "bg-red-600 text-white hover:bg-red-700"
                    }`}
                  >
                    {contact.do_not_call ? (
                      <>
                        <Check className="w-4 h-4 inline mr-1" />
                        {t("allowCalls")}
                      </>
                    ) : (
                      <>
                        <X className="w-4 h-4 inline mr-1" />
                        {t("blockCalls")}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Notes Modal */}
      {selectedContact && editingNotes && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">{t("editNotesModal")}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t("notesOptional")}</label>
                <textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800"
                  placeholder={t("addShortNotes")}
                />
                <p className="text-xs text-slate-500 mt-1">
                  {t("keepNotesShort")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-6">
              <button
                onClick={() => handleUpdateNotes(selectedContact)}
                className="px-6 py-3 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 transition-colors"
              >
                {t("saveNotes")}
              </button>
              <button
                onClick={() => {
                  setEditingNotes(false);
                  setSelectedContact(null);
                  setNotesValue("");
                }}
                className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

