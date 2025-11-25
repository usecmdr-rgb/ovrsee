"use client";

import { useMemo, useState, FormEvent, useEffect } from "react";
import { mockEmails } from "@/lib/data";
import { useAppState } from "@/context/AppStateContext";
import type { EmailRecord } from "@/types";
import { useAgentStats, emptyAgentStats } from "@/hooks/useAgentStats";
import { useAgentAccess } from "@/hooks/useAgentAccess";
import PreviewBanner from "@/components/agent/PreviewBanner";
import { AGENT_BY_ID } from "@/lib/config/agents";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { Loader2, CheckCircle2, Mail, Calendar as CalendarIcon, Clock, MapPin, Users, FileText, Edit2 } from "lucide-react";

interface ChatMessage {
  role: "user" | "agent";
  text: string;
}

interface GmailEmail {
  id: string;
  sender: string;
  fromAddress: string;
  subject: string;
  snippet: string;
  body?: string;
  timestamp: string;
  categoryId?: string;
  status?: "drafted" | "needs_reply" | "archived";
  draft?: string;
}

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
  attendees?: Array<{ email: string; displayName?: string }>;
  notes?: string;
  memo?: string;
  reminder?: string;
  createdByAloha?: boolean;
  alohaCallId?: string;
}

const SyncPage = () => {
  const [activeTab, setActiveTab] = useState<"email" | "calendar">("email");
  const { alertCategories, isAuthenticated, openAuthModal } = useAppState();
  
  // Email state
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [gmailEmails, setGmailEmails] = useState<GmailEmail[]>([]);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | GmailEmail | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "agent", text: "Tell me how you'd like to change or edit the draft." },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Calendar state
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [isConnectingCalendar, setIsConnectingCalendar] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [memoText, setMemoText] = useState("");
  const [reminderText, setReminderText] = useState("");

  const { hasAccess, isLoading: accessLoading } = useAgentAccess("sync");
  const { stats, loading, error } = useAgentStats();
  
  // Use preview/mock data if user doesn't have access
  const isPreview = !hasAccess && !accessLoading;
  
  // Fallback to realistic random numbers if no stats available or in preview mode
  const fallbackStats = {
    ...emptyAgentStats,
    xi_important_emails: isPreview ? 12 : 18,
    xi_payments_bills: isPreview ? 4 : 7,
    xi_invoices: isPreview ? 2 : 4,
    xi_missed_emails: isPreview ? 2 : 3,
  };
  const latestStats = stats ?? fallbackStats;
  const noStats = !stats && !loading && !error;
  
  const agentConfig = AGENT_BY_ID["sync"];

  // Email connection and loading
  useEffect(() => {
    if (activeTab === "email") {
      checkGmailConnection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail_connected") === "true") {
      setIsGmailConnected(true);
      loadGmailEmails();
      window.history.replaceState({}, "", "/sync");
    }
    if (params.get("calendar_connected") === "true") {
      setIsCalendarConnected(true);
      loadCalendarEvents();
      window.history.replaceState({}, "", "/sync");
    }
    
    // Show error messages if OAuth failed
    const error = params.get("error");
    if (error) {
      const errorDetails = params.get("details");
      let errorMessage = "Failed to connect Gmail";
      let showSetupInstructions = false;
      
      if (error === "invalid_request" || error === "access_denied") {
        errorMessage = "OAuth Access Blocked - OAuth Consent Screen Issue\n\n";
        errorMessage += "This usually means:\n";
        errorMessage += "1. OAuth consent screen is not configured\n";
        errorMessage += "2. Your email is not added as a test user\n";
        errorMessage += "3. Required scopes are not added\n\n";
        errorMessage += "🔴 FIX:\n";
        errorMessage += "1. Go to: https://console.cloud.google.com/apis/credentials/consent\n";
        errorMessage += "2. Configure OAuth consent screen (if not done)\n";
        errorMessage += "3. Add Gmail scopes:\n";
        errorMessage += "   - https://www.googleapis.com/auth/gmail.readonly\n";
        errorMessage += "   - https://www.googleapis.com/auth/gmail.modify\n";
        errorMessage += "4. Add your email as TEST USER: nematollah.cas@gmail.com\n";
        errorMessage += "5. Save and try again\n\n";
        errorMessage += "See OAUTH_FIX_CHECKLIST.md for detailed steps.";
        showSetupInstructions = true;
      } else if (error === "oauth_not_configured") {
        errorMessage = "Gmail OAuth is not configured.\n\n";
        errorMessage += "Please set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in your .env.local file.";
        showSetupInstructions = true;
      } else if (error === "token_exchange_failed" || error.includes("token_exchange")) {
        errorMessage = "Failed to exchange authorization code.\n\n";
        errorMessage += "This usually means:\n";
        errorMessage += "1. The redirect URI doesn't match\n";
        errorMessage += "2. The authorization code expired\n";
        errorMessage += "3. Client secret is incorrect\n\n";
        errorMessage += "Details: " + (errorDetails || "Unknown error");
        showSetupInstructions = true;
      } else if (errorDetails) {
        errorMessage = errorDetails;
      } else {
        errorMessage = `OAuth error: ${error}`;
        if (error === "access_denied" || error.includes("blocked")) {
          errorMessage += "\n\nThis is usually an OAuth consent screen configuration issue.";
          showSetupInstructions = true;
        }
      }
      
      if (showSetupInstructions && error !== "invalid_request" && error !== "access_denied") {
        errorMessage += "\n\nSetup instructions:\n";
        errorMessage += "1. Go to https://console.cloud.google.com/\n";
        errorMessage += "2. Create/select a project\n";
        errorMessage += "3. Enable Gmail API\n";
        errorMessage += "4. Create OAuth 2.0 Client ID (Web application)\n";
        errorMessage += "5. Add redirect URI: " + window.location.origin + "/api/gmail/callback\n";
        errorMessage += "6. Copy Client ID and Secret to .env.local";
      }
      
      alert(errorMessage);
      window.history.replaceState({}, "", "/sync");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calendar connection and loading
  useEffect(() => {
    if (activeTab === "calendar") {
      checkCalendarConnection();
    }
  }, [activeTab]);

  useEffect(() => {
    if (isCalendarConnected && activeTab === "calendar") {
      loadCalendarEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCalendarConnected, selectedDate, activeTab]);

  // Gmail functions
  const checkGmailConnection = async () => {
    try {
      if (!isAuthenticated) return;
      
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      const authToken = session?.access_token || (process.env.NODE_ENV !== "production" ? "dev-token" : null);
      if (!authToken && process.env.NODE_ENV === "production") return;

      const res = await fetch("/api/gmail/emails?check=true", {
        headers: { 
          Authorization: `Bearer ${authToken}`,
          ...(process.env.NODE_ENV !== "production" && !session?.access_token && {
            "X-Dev-User": "true"
          })
        },
      });

      if (res.ok) {
        setIsGmailConnected(true);
        loadGmailEmails();
      }
    } catch (error) {
      console.error("Error checking Gmail connection:", error);
    }
  };

  const handleConnectGmail = async () => {
    try {
      setIsConnectingGmail(true);
      
      // First, check if OAuth is configured
      try {
        const configCheck = await fetch("/api/gmail/check-config");
        const configData = await configCheck.json();
        if (!configData.ok && configData.issues && configData.issues.length > 0) {
          setIsConnectingGmail(false);
          let errorMsg = "Gmail OAuth is not properly configured:\n\n";
          errorMsg += configData.issues.join("\n");
          if (configData.setupInstructions) {
            errorMsg += "\n\nSetup Instructions:\n";
            errorMsg += Object.values(configData.setupInstructions).join("\n");
          }
          alert(errorMsg);
          return;
        }
      } catch (configError) {
        console.warn("Could not check Gmail config:", configError);
        // Continue anyway - might be a network issue
      }
      
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      
      // Use session token if available, otherwise use a placeholder for dev mode
      // Gmail OAuth can proceed without Supabase session - we'll use a dev user ID
      const authToken = session?.access_token || (process.env.NODE_ENV !== "production" ? "dev-token" : null);
      
      // In production, we still want to try - the OAuth flow itself doesn't require our auth
      // We just need a user ID to store the tokens
      const userId = session?.user?.id || (process.env.NODE_ENV !== "production" ? "dev-user" : `temp-${Date.now()}`);

      // Pass userId in a header so the API can use it for the OAuth state
      const res = await fetch("/api/gmail/auth", {
        headers: { 
          Authorization: `Bearer ${authToken || "dev-token"}`,
          "X-User-Id": userId,
          ...(process.env.NODE_ENV !== "production" && !session?.access_token && {
            "X-Dev-User": "true"
          })
        },
      });

      const data = await res.json();
      if (!data.ok) {
        setIsConnectingGmail(false);
        
        if (data.error === "Unauthorized" && !isAuthenticated) {
          // If not authenticated and got unauthorized, open auth modal
          openAuthModal("login");
          return;
        }
        
        // Show specific error message
        const errorMsg = data.error || "Failed to connect Gmail";
        const details = data.details ? `\n\nDetails: ${data.details}` : "";
        const redirectUri = data.redirectUri || window.location.origin + "/api/gmail/callback";
        
        if (errorMsg.includes("not configured") || errorMsg.includes("GMAIL_CLIENT_ID") || errorMsg.includes("Invalid Gmail Client ID") || data.setupRequired) {
          alert(
            "Gmail OAuth is not properly configured.\n\n" +
            "The error 'invalid_client' means your Client ID is missing or incorrect.\n\n" +
            "Setup Steps:\n" +
            "1. Go to https://console.cloud.google.com/\n" +
            "2. Create or select a project\n" +
            "3. Enable Gmail API (APIs & Services → Library)\n" +
            "4. Go to APIs & Services → Credentials\n" +
            "5. Click + CREATE CREDENTIALS → OAuth client ID\n" +
            "6. Application type: Web application\n" +
            "7. Add redirect URI: " + redirectUri + "\n" +
            "8. Copy the Client ID (long string)\n" +
            "9. Copy the Client Secret\n" +
            "10. Open .env.local and replace:\n" +
            "    GMAIL_CLIENT_ID=your_actual_client_id_here\n" +
            "    GMAIL_CLIENT_SECRET=your_actual_client_secret_here\n" +
            "11. Restart your dev server (npm run dev)\n\n" +
            "Important: Make sure you're using the actual Client ID from Google Cloud Console, not a placeholder!\n\n" +
            "See GMAIL_SETUP.md for detailed instructions."
          );
        } else {
          alert(`Failed to connect Gmail: ${errorMsg}${details}\n\nIf you see "invalid_client", your GMAIL_CLIENT_ID in .env.local is incorrect or missing.`);
        }
        return;
      }
      
      if (!data.authUrl) {
        setIsConnectingGmail(false);
        alert("Failed to get Gmail authorization URL. Please check your OAuth configuration.");
        return;
      }

      // Open popup window for OAuth
      const width = 500;
      const height = 600;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;

      const popup = window.open(
        data.authUrl,
        "Gmail Authentication",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      // Check if popup was blocked
      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        setIsConnectingGmail(false);
        alert(
          "Popup window was blocked!\n\n" +
          "Please:\n" +
          "1. Allow popups for this site in your browser settings\n" +
          "2. Try clicking 'Connect your Gmail' again\n" +
          "3. Or manually visit: " + data.authUrl.substring(0, 100) + "..."
        );
        return;
      }

      // Monitor popup for completion
      const pollTimer = setInterval(() => {
        try {
          // Check if popup was closed
          if (popup.closed) {
            clearInterval(pollTimer);
            setIsConnectingGmail(false);
            
            // Check if connection was successful
            setTimeout(async () => {
              await checkGmailConnection();
              // Also check URL params in case redirect happened in main window
              const params = new URLSearchParams(window.location.search);
              if (params.get("gmail_connected") === "true") {
                setIsGmailConnected(true);
                loadGmailEmails();
                window.history.replaceState({}, "", "/sync");
              }
            }, 1000);
          }
          
          // Check if popup redirected to our callback (try to read URL)
          try {
            if (popup.location.href.includes("/api/gmail/callback")) {
              clearInterval(pollTimer);
              popup.close();
              setIsConnectingGmail(false);
              setTimeout(async () => {
                await checkGmailConnection();
              }, 1000);
            }
          } catch (e) {
            // Cross-origin error is expected until redirect happens
            // This is normal, just continue polling
          }
        } catch (error) {
          console.error("Error checking popup status:", error);
        }
      }, 500);

      // Timeout after 5 minutes
      setTimeout(() => {
        if (!popup.closed) {
          clearInterval(pollTimer);
          popup.close();
          setIsConnectingGmail(false);
          alert("Gmail authentication timed out. Please try again.");
        }
      }, 5 * 60 * 1000);
    } catch (error) {
      console.error("Error connecting Gmail:", error);
      setIsConnectingGmail(false);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
        alert(
          "Network error connecting to Gmail.\n\n" +
          "Please check:\n" +
          "1. Your internet connection\n" +
          "2. That the server is running\n" +
          "3. That Gmail OAuth is configured in Google Cloud Console"
        );
      } else {
        alert(`Failed to connect Gmail: ${errorMessage}\n\nCheck the browser console for more details.`);
      }
    }
  };

  const loadGmailEmails = async () => {
    try {
      if (!isAuthenticated) return;
      
      setIsLoadingEmails(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      const authToken = session?.access_token || (process.env.NODE_ENV !== "production" ? "dev-token" : null);
      if (!authToken && process.env.NODE_ENV === "production") {
        setIsLoadingEmails(false);
        return;
      }

      const res = await fetch("/api/gmail/emails", {
        headers: { 
          Authorization: `Bearer ${authToken}`,
          ...(process.env.NODE_ENV !== "production" && !session?.access_token && {
            "X-Dev-User": "true"
          })
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          setIsGmailConnected(false);
          return;
        }
        throw new Error("Failed to fetch emails");
      }

      const data = await res.json();
      if (data.ok && data.emails) {
        const categorizeRes = await fetch("/api/gmail/categorize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
            ...(process.env.NODE_ENV !== "production" && !session?.access_token && {
              "X-Dev-User": "true"
            })
          },
          body: JSON.stringify({ emails: data.emails }),
        });

        if (categorizeRes.ok) {
          const categorizeData = await categorizeRes.json();
          if (categorizeData.ok && categorizeData.emails) {
            setGmailEmails(categorizeData.emails);
            if (categorizeData.emails.length > 0 && !selectedEmail) {
              setSelectedEmail(categorizeData.emails[0] as any);
            }
          }
        } else {
          setGmailEmails(data.emails);
          if (data.emails.length > 0 && !selectedEmail) {
            setSelectedEmail(data.emails[0] as any);
          }
        }
      }
    } catch (error) {
      console.error("Error loading Gmail emails:", error);
    } finally {
      setIsLoadingEmails(false);
    }
  };

  // Calendar functions
  const checkCalendarConnection = async () => {
    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/calendar/events?check=true", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        setIsCalendarConnected(true);
      }
    } catch (error) {
      console.error("Error checking calendar connection:", error);
    }
  };

  const handleConnectCalendar = async () => {
    // Check if user is authenticated via app state
    if (!isAuthenticated) {
      openAuthModal("login");
      return;
    }

    try {
      setIsConnectingCalendar(true);
      const { data: { session }, error: sessionError } = await supabaseBrowserClient.auth.getSession();
      
      // If no session, try to get or create one
      // In development, we can proceed without a real session
      if (!session?.access_token && process.env.NODE_ENV === "production") {
        // In production, require real authentication
        openAuthModal("login");
        setIsConnectingCalendar(false);
        return;
      }

      const res = await fetch("/api/calendar/auth", {
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
      });

      const data = await res.json();
      if (!data.ok || !data.authUrl) throw new Error("Failed to get auth URL");

      const width = 500;
      const height = 600;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;

      const popup = window.open(
        data.authUrl,
        "Google Calendar Authentication",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      const pollTimer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollTimer);
          setIsConnectingCalendar(false);
          setTimeout(() => checkCalendarConnection(), 1000);
        }
      }, 500);
    } catch (error) {
      console.error("Error connecting calendar:", error);
      alert("Failed to connect Google Calendar. Please try again.");
      setIsConnectingCalendar(false);
    }
  };

  const loadCalendarEvents = async () => {
    try {
      setIsLoadingEvents(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const startDate = new Date(selectedDate);
      startDate.setDate(1);
      const endDate = new Date(selectedDate);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);

      const res = await fetch(
        `/api/calendar/events?start=${startDate.toISOString()}&end=${endDate.toISOString()}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (!res.ok) {
        if (res.status === 401) {
          setIsCalendarConnected(false);
          return;
        }
        throw new Error("Failed to fetch events");
      }

      const data = await res.json();
      if (data.ok && data.events) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error("Error loading calendar events:", error);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setNoteText(event.notes || "");
    setMemoText(event.memo || "");
    setReminderText(event.reminder || "");
    setShowEventModal(true);
  };

  const handleSaveNotes = async () => {
    if (!selectedEvent) return;

    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/calendar/events/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          eventId: selectedEvent.id,
          notes: noteText,
          memo: memoText,
          reminder: reminderText,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setEvents((prev) =>
            prev.map((e) =>
              e.id === selectedEvent.id
                ? { ...e, notes: noteText, memo: memoText, reminder: reminderText }
                : e
            )
          );
          setSelectedEvent({ ...selectedEvent, notes: noteText, memo: memoText, reminder: reminderText });
          setEditingNote(false);
        }
      }
    } catch (error) {
      console.error("Error saving notes:", error);
      alert("Failed to save notes");
    }
  };

  // Email handlers
  const displayEmails = isGmailConnected && gmailEmails.length > 0 
    ? gmailEmails.map((email) => ({
        id: email.id,
        sender: email.sender,
        subject: email.subject,
        timestamp: new Date(email.timestamp).toLocaleDateString(),
        categoryId: email.categoryId || "other",
        status: email.status || "needs_reply",
        snippet: email.snippet,
        draft: email.draft || "",
      }))
    : mockEmails;

  const filteredEmails = useMemo(() => {
    if (!activeCategory) return displayEmails;
    return displayEmails.filter((email) => email.categoryId === activeCategory);
  }, [activeCategory, displayEmails]);

  const categoryMap = Object.fromEntries(alertCategories.map((cat) => [cat.id, cat]));

  const handleChat = async (event: FormEvent<HTMLFormElement>) => {
    // Disable in preview mode
    if (isPreview) {
      event.preventDefault();
      setChatMessages((prev) => [
        ...prev,
        { role: "agent", text: "This feature requires a Basic or higher subscription. Upgrade to unlock full Sync agent access." },
      ]);
      return;
    }
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("message") as HTMLInputElement;
    if (!input.value.trim() || !selectedEmail) return;

    const userMessage = input.value.trim();
    setChatMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    input.value = "";
    setIsProcessing(true);

    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      const accessToken = session?.access_token || (process.env.NODE_ENV !== "production" ? "dev-token" : null);

      const res = await fetch("/api/brain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({
          agent: "sync",
          message: userMessage,
          taskType: "reply_draft",
          emailContext: {
            emailId: selectedEmail.id,
            subject: selectedEmail.subject,
            fromAddress: selectedEmail.sender,
          },
        }),
      });

      const json = await res.json();
      const isOk = res.ok && !json.error;

      if (!isOk) {
        console.error("Sync API error:", json);
        setChatMessages((prev) => [
          ...prev,
          { role: "agent", text: `Sorry, I encountered an error: ${json.error || "Unknown error"}` },
        ]);
        setIsProcessing(false);
        return;
      }

      const aiResponse = json.reply || "I've processed your request.";
      const updatedDraft = selectedEmail.draft 
        ? `${selectedEmail.draft}\n\n[Updated: ${aiResponse}]`
        : aiResponse;

      if (selectedEmail) {
        setSelectedEmail({ ...selectedEmail, draft: updatedDraft });
      }

      setChatMessages((prev) => [
        ...prev,
        { role: "agent", text: aiResponse },
      ]);
    } catch (err) {
      console.error("Error calling Sync API:", err);
      setChatMessages((prev) => [
        ...prev,
        { role: "agent", text: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEmailSelect = (email: EmailRecord) => {
    setSelectedEmail(email);
    setChatMessages([{ role: "agent", text: "Tell me how you'd like to change or edit the draft." }]);
  };

  // Calendar helpers
  const formatEventTime = (event: CalendarEvent) => {
    const start = event.start.dateTime || event.start.date;
    if (!start) return "All day";
    const date = new Date(start);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatEventDate = (event: CalendarEvent) => {
    const start = event.start.dateTime || event.start.date;
    if (!start) return "";
    const date = new Date(start);
    return date.toLocaleDateString();
  };

  const eventsByDate = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    events.forEach((event) => {
      const date = event.start.dateTime || event.start.date;
      if (date) {
        const dateKey = new Date(date).toISOString().split("T")[0];
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(event);
      }
    });
    return grouped;
  }, [events]);

  const monthDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Array<{ date: Date; events: CalendarEvent[] }> = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ date: new Date(year, month, -startingDayOfWeek + i + 1), events: [] });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateKey = date.toISOString().split("T")[0];
      days.push({
        date,
        events: eventsByDate[dateKey] || [],
      });
    }

    return days;
  }, [selectedDate, eventsByDate]);

  return (
    <div className="space-y-8">
      {isPreview && (
        <PreviewBanner 
          agentName={agentConfig.label} 
          requiredTier={agentConfig.requiredTier}
        />
      )}
      <header>
        <p className="text-sm uppercase tracking-widest text-slate-500">Sync agent</p>
        <h1 className="text-3xl font-semibold">Inbox & calendar command board</h1>
      </header>

      {/* Tab Bar */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("email")}
            className={`px-4 py-2 text-sm font-semibold transition ${
              activeTab === "email"
                ? "border-b-2 border-slate-900 text-slate-900 dark:border-white dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("calendar")}
            className={`px-4 py-2 text-sm font-semibold transition ${
              activeTab === "calendar"
                ? "border-b-2 border-slate-900 text-slate-900 dark:border-white dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
          >
            Calendar
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "email" && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1" />
              <button
                onClick={handleConnectGmail}
                disabled={isConnectingGmail || isGmailConnected}
                className="flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnectingGmail ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : isGmailConnected ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Gmail Connected
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Connect your Gmail
                  </>
                )}
              </button>
            </div>

            <section className="rounded-3xl border border-slate-200 bg-white/80 p-5 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Latest inbox metrics</p>
                {loading && <span className="text-xs text-slate-500">Loading stats…</span>}
                {error && <span className="text-xs text-red-500">Couldn&apos;t load stats</span>}
                {noStats && <span className="text-xs text-slate-500">No stats yet</span>}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Important emails", value: latestStats.xi_important_emails },
                  { label: "Payments / bills", value: latestStats.xi_payments_bills },
                  { label: "Invoices", value: latestStats.xi_invoices },
                  { label: "Missed emails", value: latestStats.xi_missed_emails },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900/60 min-w-0">
                    <p className="text-xs uppercase tracking-widest text-slate-500 break-words leading-tight">{metric.label}</p>
                    <p className="mt-2 text-2xl">{metric.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              {alertCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory((prev) => (prev === category.id ? null : category.id))}
                  style={{ backgroundColor: category.color }}
                  className={`rounded-2xl p-3 text-left text-sm font-semibold text-white shadow-sm transition ${
                    activeCategory === category.id ? "ring-2 ring-white/70" : "opacity-90"
                  }`}
                >
                  <p>{category.name}</p>
                  <p className="text-xs opacity-80">{category.count} alerts</p>
                </button>
              ))}
            </section>

            <div className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
              <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Email queue</h2>
                  {activeCategory && (
                    <button onClick={() => setActiveCategory(null)} className="text-xs uppercase tracking-wide text-brand-accent">
                      Clear filter
                    </button>
                  )}
                </div>
                <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {isLoadingEmails ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                      <span className="ml-2 text-sm text-slate-500">Loading emails...</span>
                    </div>
                  ) : filteredEmails.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-500">
                      {isGmailConnected ? "No emails found" : "Connect Gmail to view your emails"}
                    </div>
                  ) : (
                    filteredEmails.map((email) => (
                      <button
                        key={email.id}
                        onClick={() => handleEmailSelect(email)}
                        className={`w-full py-3 text-left ${
                          selectedEmail?.id === email.id ? "bg-slate-100 dark:bg-slate-800/60" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">{email.sender}</p>
                          <span className="text-xs text-slate-500">{email.timestamp}</span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{email.subject}</p>
                        <div className="mt-2 flex items-center space-x-2 text-xs">
                          <span
                            className="rounded-full px-2 py-1 text-white"
                            style={{ backgroundColor: categoryMap[email.categoryId]?.color || "#0f172a" }}
                          >
                            {categoryMap[email.categoryId]?.name ?? "Uncategorized"}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-500 dark:bg-slate-800">
                            {email.status.replace("_", " ")}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
                <h2 className="text-xl font-semibold">Draft preview</h2>
                {selectedEmail ? (
                  <div className="mt-4 space-y-4 text-slate-600 dark:text-slate-200">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Original</p>
                      <p className="mt-1 rounded-2xl bg-slate-100/70 p-3 text-sm dark:bg-slate-800/60">
                        {selectedEmail.snippet}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Sync draft</p>
                      <p className="mt-1 rounded-2xl bg-slate-900/90 p-3 text-sm text-white dark:bg-white/10 dark:text-white">
                        {selectedEmail.draft || "Placeholder draft goes here."}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 dark:bg-white dark:text-slate-900">
                        Accept draft
                      </button>
                      <button className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                        Edit draft
                      </button>
                    </div>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Chat with Sync</h3>
                      <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                        {chatMessages.map((message, index) => (
                          <div
                            key={index}
                            className={`rounded-2xl px-3 py-2 text-xs ${
                              message.role === "agent"
                                ? "bg-slate-900/90 text-white dark:bg-slate-800"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
                            }`}
                          >
                            {message.text}
                          </div>
                        ))}
                        {isProcessing && (
                          <div className="rounded-2xl bg-slate-900/90 px-3 py-2 text-xs text-white dark:bg-slate-800">
                            Processing your request...
                          </div>
                        )}
                      </div>
                      <form onSubmit={handleChat} className="mt-3 flex gap-2">
                        <input
                          name="message"
                          placeholder="Tell Sync how to change or edit the draft..."
                          disabled={isProcessing}
                          className="flex-1 rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-xs focus:border-brand-accent focus:outline-none disabled:opacity-50 dark:border-slate-700"
                        />
                        <button
                          type="submit"
                          disabled={isProcessing}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
                        >
                          Send
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">Select an email to preview Sync&apos;s draft.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "calendar" && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1" />
              <button
                onClick={handleConnectCalendar}
                disabled={isConnectingCalendar || isCalendarConnected}
                className="flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnectingCalendar ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : isCalendarConnected ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Calendar Connected
                  </>
                ) : (
                  <>
                    <CalendarIcon className="h-4 w-4" />
                    Connect Google Calendar
                  </>
                )}
              </button>
            </div>

            {isCalendarConnected ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <button
                    onClick={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setMonth(newDate.getMonth() - 1);
                      setSelectedDate(newDate);
                    }}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    ← Previous
                  </button>
                  <h2 className="text-xl font-semibold">
                    {selectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </h2>
                  <button
                    onClick={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setMonth(newDate.getMonth() + 1);
                      setSelectedDate(newDate);
                    }}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    Next →
                  </button>
                </div>

                {isLoadingEvents ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                    <span className="ml-2 text-sm text-slate-500">Loading calendar events...</span>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
                    <div className="grid grid-cols-7 gap-2 mb-4">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                        <div key={day} className="text-center text-xs font-semibold uppercase text-slate-500 py-2">
                          {day}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {monthDays.map((day, index) => {
                        const isCurrentMonth = day.date.getMonth() === selectedDate.getMonth();
                        const isToday = day.date.toDateString() === new Date().toDateString();

                        return (
                          <div
                            key={index}
                            className={`min-h-[100px] rounded-2xl border p-2 ${
                              isCurrentMonth
                                ? "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60"
                                : "border-slate-100 bg-slate-50/50 dark:border-slate-900 dark:bg-slate-950/50"
                            } ${isToday ? "ring-2 ring-slate-900 dark:ring-white" : ""}`}
                          >
                            <div
                              className={`text-sm font-semibold mb-1 ${
                                isCurrentMonth
                                  ? isToday
                                    ? "text-slate-900 dark:text-white"
                                    : "text-slate-600 dark:text-slate-300"
                                  : "text-slate-400 dark:text-slate-600"
                              }`}
                            >
                              {day.date.getDate()}
                            </div>
                            <div className="space-y-1">
                              {day.events.slice(0, 3).map((event) => (
                                <button
                                  key={event.id}
                                  onClick={() => handleEventClick(event)}
                                  className={`w-full text-left text-xs px-2 py-1 rounded truncate ${
                                    event.createdByAloha
                                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                  } hover:opacity-80`}
                                  title={event.summary}
                                >
                                  {formatEventTime(event)} {event.summary}
                                </button>
                              ))}
                              {day.events.length > 3 && (
                                <div className="text-xs text-slate-500 px-2">
                                  +{day.events.length - 3} more
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-white/80 p-12 text-center dark:border-slate-800 dark:bg-slate-900/40">
                <CalendarIcon className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Connect your Google Calendar</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Sync your calendar events, add notes and reminders, and integrate with Aloha for automatic appointment management.
                </p>
                <button
                  onClick={handleConnectCalendar}
                  className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                >
                  Connect Google Calendar
                </button>
              </div>
            )}

            {/* Event Detail Modal */}
            {showEventModal && selectedEvent && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-2xl font-semibold mb-2">{selectedEvent.summary}</h3>
                      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>
                            {formatEventDate(selectedEvent)} at {formatEventTime(selectedEvent)}
                          </span>
                        </div>
                        {selectedEvent.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{selectedEvent.location}</span>
                          </div>
                        )}
                        {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span>{selectedEvent.attendees.length} attendee(s)</span>
                          </div>
                        )}
                        {selectedEvent.createdByAloha && (
                          <div className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                            Created by Aloha
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowEventModal(false)}
                      className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      ✕
                    </button>
                  </div>

                  {selectedEvent.description && (
                    <div className="mb-4 rounded-2xl bg-slate-100/70 p-4 text-sm dark:bg-slate-800/60">
                      <p className="text-slate-700 dark:text-slate-200">{selectedEvent.description}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Notes
                        </label>
                        {!editingNote && (
                          <button
                            onClick={() => setEditingNote(true)}
                            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                          >
                            <Edit2 className="h-3 w-3 inline mr-1" />
                            Edit
                          </button>
                        )}
                      </div>
                      {editingNote ? (
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Add your notes here..."
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700 min-h-[100px]"
                        />
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60 min-h-[100px]">
                          {noteText || <span className="text-slate-400">No notes added</span>}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-semibold mb-2 block">Memo</label>
                      {editingNote ? (
                        <textarea
                          value={memoText}
                          onChange={(e) => setMemoText(e.target.value)}
                          placeholder="Add a memo or reminder..."
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700 min-h-[80px]"
                        />
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60 min-h-[80px]">
                          {memoText || <span className="text-slate-400">No memo</span>}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-semibold mb-2 block">Reminder</label>
                      {editingNote ? (
                        <input
                          type="text"
                          value={reminderText}
                          onChange={(e) => setReminderText(e.target.value)}
                          placeholder="Set a reminder..."
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                        />
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                          {reminderText || <span className="text-slate-400">No reminder set</span>}
                        </div>
                      )}
                    </div>

                    {editingNote && (
                      <div className="flex gap-3">
                        <button
                          onClick={handleSaveNotes}
                          className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingNote(false);
                            setNoteText(selectedEvent.notes || "");
                            setMemoText(selectedEvent.memo || "");
                            setReminderText(selectedEvent.reminder || "");
                          }}
                          className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncPage;
