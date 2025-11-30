"use client";

import { useMemo, useState, FormEvent, useEffect, useCallback } from "react";
import { mockEmails } from "@/lib/data";
import { useAppState } from "@/context/AppStateContext";
import type { EmailRecord } from "@/types";
import { useAgentStats, emptyAgentStats } from "@/hooks/useAgentStats";
import { useAgentAccess } from "@/hooks/useAgentAccess";
import PreviewBanner from "@/components/agent/PreviewBanner";
import { AGENT_BY_ID } from "@/lib/config/agents";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { useTranslation } from "@/hooks/useTranslation";
import { getLanguageFromLocale } from "@/lib/localization";
import { Loader2, CheckCircle2, Mail, Calendar as CalendarIcon, Clock, MapPin, Users, FileText, Edit2, AlertTriangle, CalendarCheck, Info, CheckCircle, AlertCircle, Plus, X, Trash2 } from "lucide-react";
import SyncIntelligence from "@/components/sync/SyncIntelligence";
import {
  getLocalDateString,
  getEventLocalDate,
  getEventLocalDateString,
  getEventLocalTime,
  isMultiDayEvent,
  formatEventTime,
  formatEventDate,
  getWeekDays,
  getMonthDays,
  getHourPosition,
  isToday,
  isCurrentMonth,
} from "@/lib/calendar/date-utils";

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

interface EmailQueueItem {
  id: string;
  user_id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  gmail_history_id?: string | null;
  gmail_labels: string[];
  from_address: string;
  from_name?: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  subject: string;
  snippet?: string | null;
  body_html?: string | null;
  body_text?: string | null;
  internal_date: string;
  queue_status: "open" | "snoozed" | "done" | "archived";
  is_read: boolean;
  is_starred: boolean;
  category_id?: string | null;
  snoozed_until?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_source?: "ovrsee" | "gmail" | "both" | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface SyncStatus {
  connected: boolean;
  lastSyncAt?: string | null;
  syncStatus?: "idle" | "syncing" | "error";
  syncError?: string | null;
  lastHistoryId?: string | null;
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

interface CustomAlert {
  id: string;
  icon: string;
  title: string;
  description: string;
  date: string;
  time?: string;
  dateTime?: string;
  notes?: string;
  memo?: string;
  reminder?: string;
}

const SyncPage = () => {
  const [activeTab, setActiveTab] = useState<"email" | "calendar">("email");
  const { alertCategories, isAuthenticated, openAuthModal, language } = useAppState();
  const t = useTranslation();
  
  // Helper function to translate category names
  const getCategoryName = (categoryId: string): string => {
    const categoryNameMap: Record<string, string> = {
      important: t("important"),
      missed: t("syncMissedUnread"),
      payments: t("syncPaymentsBills"),
      invoices: t("invoices"),
      meetings: t("syncUpcomingMeetings"),
      subscriptions: t("syncSubscriptions"),
    };
    return categoryNameMap[categoryId] || categoryId;
  };
  
  // Email state
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [gmailEmails, setGmailEmails] = useState<GmailEmail[]>([]);
  const [emailQueueItems, setEmailQueueItems] = useState<EmailQueueItem[]>([]);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | GmailEmail | EmailQueueItem | null>(null);
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
  const [calendarView, setCalendarView] = useState<"month" | "week">("month");
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [memoText, setMemoText] = useState("");
  const [reminderText, setReminderText] = useState("");
  
  // Custom alerts state
  const [customAlerts, setCustomAlerts] = useState<CustomAlert[]>([]);
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [newAlert, setNewAlert] = useState<Partial<CustomAlert>>({
    icon: "AlertTriangle",
    title: "",
    description: "",
    date: "",
    time: "",
  });
  const [selectedAlert, setSelectedAlert] = useState<CustomAlert | null>(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [editingAlert, setEditingAlert] = useState(false);
  const [editedAlert, setEditedAlert] = useState<Partial<CustomAlert>>({});
  const [alertNoteText, setAlertNoteText] = useState("");
  const [alertMemoText, setAlertMemoText] = useState("");
  const [alertReminderText, setAlertReminderText] = useState("");
  const [editingAlertNote, setEditingAlertNote] = useState(false);

  // Mock calendar events for demo mode
  const mockCalendarEvents = useMemo(() => {
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();
    const today = new Date();
    const isCurrentMonth = currentMonth === today.getMonth() && currentYear === today.getFullYear();
    const baseDay = isCurrentMonth ? today.getDate() : 1;
    
    // Helper to get a valid date in the current month
    const getDate = (dayOffset: number) => {
      const targetDay = baseDay + dayOffset;
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const validDay = Math.max(1, Math.min(targetDay, daysInMonth));
      return new Date(currentYear, currentMonth, validDay);
    };
    
    // Generate events for the current month
    const mockEvents: CalendarEvent[] = [
      (() => {
        const date = getDate(0);
        date.setHours(9, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(9, 30, 0, 0);
        return {
          id: "demo-1",
          summary: "Team Standup",
          description: "Daily team sync meeting",
          start: { dateTime: date.toISOString() },
          end: { dateTime: endDate.toISOString() },
          location: "Conference Room A",
          attendees: [
            { email: "team@example.com", displayName: "Team" }
          ],
          createdByAloha: true,
        };
      })(),
      (() => {
        const date = getDate(2);
        date.setHours(14, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(15, 30, 0, 0);
        return {
          id: "demo-2",
          summary: "Client Presentation",
          description: "Quarterly review presentation",
          start: { dateTime: date.toISOString() },
          end: { dateTime: endDate.toISOString() },
          location: "Zoom",
          attendees: [
            { email: "client@example.com", displayName: "Client Team" }
          ],
        };
      })(),
      {
        id: "demo-3",
        summary: "Project Deadline",
        description: "Final deliverables due",
        start: { date: getDate(5).toISOString().split('T')[0] },
        end: { date: getDate(5).toISOString().split('T')[0] },
      },
      (() => {
        const date = getDate(1);
        date.setHours(12, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(13, 0, 0, 0);
        return {
          id: "demo-4",
          summary: "Lunch Meeting",
          description: "Catch up with stakeholders",
          start: { dateTime: date.toISOString() },
          end: { dateTime: endDate.toISOString() },
          location: "Restaurant",
        };
      })(),
      (() => {
        const date = getDate(7);
        date.setHours(10, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(12, 0, 0, 0);
        return {
          id: "demo-5",
          summary: "Sprint Planning",
          description: "Plan next sprint tasks",
          start: { dateTime: date.toISOString() },
          end: { dateTime: endDate.toISOString() },
          createdByAloha: true,
        };
      })(),
    ];
    
    return mockEvents;
  }, [selectedDate]);

  // Use demo mode when calendar is not connected
  const showDemoCalendar = !isCalendarConnected;
  const displayEvents = isCalendarConnected ? events : mockCalendarEvents;

  // Demo custom alerts state (persists during demo mode)
  const [demoAlertsState, setDemoAlertsState] = useState<CustomAlert[]>([]);

  // Demo custom alerts for demo mode
  const demoCustomAlerts = useMemo(() => {
    if (!showDemoCalendar) return [];
    
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Helper to get a specific day of the month, ensuring it's within bounds
    const getDateForDay = (dayOfMonth: number) => {
      const validDay = Math.max(1, Math.min(dayOfMonth, daysInMonth));
      const date = new Date(currentYear, currentMonth, validDay);
      return date.toISOString().split('T')[0];
    };
    
    // Use specific day numbers spread throughout the month
    // These will be different days regardless of what month it is
    // Adjust if month has fewer days
    const alertDays = [
      Math.min(3, daysInMonth),   // Day 3
      Math.min(8, daysInMonth),   // Day 8
      Math.min(12, daysInMonth),  // Day 12
      Math.min(17, daysInMonth),  // Day 17
      Math.min(22, daysInMonth), // Day 22
    ];
    
    // Ensure all days are unique
    const uniqueDays: number[] = [];
    alertDays.forEach(day => {
      if (!uniqueDays.includes(day)) {
        uniqueDays.push(day);
      } else {
        // If duplicate, find next available day
        let nextDay = day + 1;
        while (uniqueDays.includes(nextDay) && nextDay <= daysInMonth) {
          nextDay++;
        }
        if (nextDay <= daysInMonth) {
          uniqueDays.push(nextDay);
        }
      }
    });
    
    // Spread alerts across different days - like real appointments would be
    return [
      {
        id: "demo-alert-1",
        icon: "AlertTriangle",
        title: "Urgent Meeting",
        description: "Important client call",
        date: getDateForDay(uniqueDays[0] || 3),
        time: "14:00",
      },
      {
        id: "demo-alert-2",
        icon: "CalendarCheck",
        title: "Deadline",
        description: "Project due Friday",
        date: getDateForDay(uniqueDays[1] || 8),
        time: undefined,
      },
      {
        id: "demo-alert-3",
        icon: "Info",
        title: "New Event",
        description: "Team sync added",
        date: getDateForDay(uniqueDays[2] || 12),
        time: "10:30",
      },
      {
        id: "demo-alert-4",
        icon: "CheckCircle",
        title: "All Set",
        description: "3 events this week",
        date: getDateForDay(uniqueDays[3] || 17),
        time: undefined,
      },
      {
        id: "demo-alert-5",
        icon: "AlertCircle",
        title: "Time Conflict",
        description: "2 meetings overlap",
        date: getDateForDay(uniqueDays[4] || 22),
        time: "15:00",
      },
    ] as CustomAlert[];
  }, [showDemoCalendar, selectedDate]);

  // Initialize demo alerts state when entering demo mode
  useEffect(() => {
    if (showDemoCalendar && demoAlertsState.length === 0) {
      setDemoAlertsState(demoCustomAlerts);
    }
  }, [showDemoCalendar, demoCustomAlerts, demoAlertsState.length]);

  // Combine user custom alerts with demo alerts (use state if available, otherwise use memoized)
  const allCustomAlerts = useMemo(() => {
    return showDemoCalendar 
      ? [...(demoAlertsState.length > 0 ? demoAlertsState : demoCustomAlerts), ...customAlerts]
      : customAlerts;
  }, [showDemoCalendar, demoAlertsState, demoCustomAlerts, customAlerts]);

  const { hasAccess, isLoading: accessLoading } = useAgentAccess("sync");
  const { stats, loading, error } = useAgentStats();
  
  // Wait for access to be determined before showing stats to prevent flashing
  const isAccessReady = !accessLoading;
  
  // Use preview/mock data if user doesn't have access (only after access check is complete)
  const isPreview = isAccessReady && !hasAccess;
  
  // Fallback to realistic random numbers if no stats available or in preview mode
  // Only show fallback stats when access check is complete to prevent number flashing
  const fallbackStats = useMemo(() => {
    if (!isAccessReady) {
      // Return empty stats while loading to prevent flash
      return emptyAgentStats;
    }
    return {
      ...emptyAgentStats,
      xi_important_emails: isPreview ? 12 : 18,
      xi_payments_bills: isPreview ? 4 : 7,
      xi_invoices: isPreview ? 2 : 4,
      xi_missed_emails: isPreview ? 2 : 3,
    };
  }, [isPreview, isAccessReady]);
  
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
      // Switch to calendar tab if specified
      if (params.get("tab") === "calendar") {
        setActiveTab("calendar");
      }
      window.history.replaceState({}, "", "/sync");
    }
    
    // Show error messages if OAuth failed
    const error = params.get("error");
    if (error) {
      const errorDetails = params.get("details");
      let errorMessage = "Failed to connect Gmail";
      
      if (error === "invalid_request" || error === "access_denied") {
        errorMessage = "OAuth Access Blocked\n\n";
        errorMessage += "This usually means:\n";
        errorMessage += "1. OAuth consent screen is not configured\n";
        errorMessage += "2. Your email is not added as a test user\n";
        errorMessage += "3. Required scopes are not added\n\n";
        errorMessage += "Fix:\n";
        errorMessage += "1. Go to: https://console.cloud.google.com/apis/credentials/consent\n";
        errorMessage += "2. Configure OAuth consent screen\n";
        errorMessage += "3. Add Gmail scopes (gmail.readonly, gmail.modify)\n";
        errorMessage += "4. Add your email as a TEST USER\n";
        errorMessage += "5. Save and try again";
      } else if (error === "oauth_not_configured") {
        errorMessage = "Gmail OAuth is not configured.\n\n";
        errorMessage += "Please set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in your .env.local file.\n\n";
        errorMessage += "Visit /api/gmail/check-config to check your configuration.";
      } else if (error === "redirect_uri_mismatch" || error.includes("redirect_uri")) {
        errorMessage = "Redirect URI Mismatch Error\n\n";
        errorMessage += "The redirect URI doesn't match what's configured in Google Cloud Console.\n\n";
        errorMessage += "Fix:\n";
        errorMessage += "1. Visit /api/gmail/check-config to see your current redirect URI\n";
        errorMessage += "2. Go to: https://console.cloud.google.com/apis/credentials\n";
        errorMessage += "3. Click on your OAuth 2.0 Client ID\n";
        errorMessage += "4. Under 'Authorized redirect URIs', add the EXACT redirect URI shown in step 1\n";
        errorMessage += "5. Make sure there are NO trailing slashes\n";
        errorMessage += "6. Save and try again";
      } else if (error === "token_exchange_failed" || error.includes("token_exchange") || error.includes("invalid_client")) {
        errorMessage = "OAuth Configuration Error\n\n";
        errorMessage += "This usually means:\n";
        errorMessage += "1. The redirect URI doesn't match Google Cloud Console\n";
        errorMessage += "2. The Client ID or Secret is incorrect\n";
        errorMessage += "3. The authorization code expired\n\n";
        errorMessage += "Fix:\n";
        errorMessage += "1. Visit /api/gmail/check-config to see your current redirect URI\n";
        errorMessage += "2. Make sure this EXACT URI is in Google Cloud Console\n";
        errorMessage += "3. Verify GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env.local\n";
        errorMessage += "4. Restart your dev server";
        if (errorDetails) {
          errorMessage += "\n\nDetails: " + errorDetails;
        }
      } else if (error === "missing_code") {
        errorMessage = "OAuth callback error: Missing authorization code.\n\n";
        errorMessage += "Please try connecting Gmail again.";
      } else if (errorDetails) {
        errorMessage = errorDetails;
      } else {
        errorMessage = `OAuth error: ${error}\n\n`;
        errorMessage += "Visit /api/gmail/check-config to check your configuration.";
      }
      
      alert(errorMessage);
      window.history.replaceState({}, "", "/sync");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calendar functions - defined before useEffects that use them
  const loadCalendarEvents = useCallback(async () => {
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

      // Check if user logged in with Google OAuth provider
      const { data: { session: checkSession } } = await supabaseBrowserClient.auth.getSession();
      const isGoogleUser = checkSession?.user?.app_metadata?.provider === "google" || 
                          checkSession?.user?.identities?.some((identity: any) => identity.provider === "google");

      if (!res.ok) {
        if (res.status === 401) {
          // Only set to false if not a Google user (Google users stay "connected" in UI)
          if (!isGoogleUser) {
            setIsCalendarConnected(false);
          }
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
  }, [selectedDate]);

  const checkCalendarConnection = useCallback(async () => {
    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      // Check if user logged in with Google OAuth provider
      const isGoogleUser = session.user?.app_metadata?.provider === "google" || 
                          session.user?.identities?.some((identity: any) => identity.provider === "google");

      // If user logged in with Google, consider Calendar connected
      if (isGoogleUser) {
        setIsCalendarConnected(true);
        loadCalendarEvents();
        return;
      }

      // Otherwise, check for Calendar connection in database
      const res = await fetch("/api/calendar/events?check=true", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        setIsCalendarConnected(true);
        loadCalendarEvents();
      }
    } catch (error) {
      console.error("Error checking calendar connection:", error);
    }
  }, [loadCalendarEvents]);

  // Calendar connection and loading
  useEffect(() => {
    if (activeTab === "calendar") {
      checkCalendarConnection();
    }
  }, [activeTab, checkCalendarConnection]);

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
      if (!session?.access_token) return;

      // Check sync status (which also checks connection)
      const res = await fetch("/api/gmail/sync", {
        headers: { 
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const status: SyncStatus = await res.json();
        setSyncStatus(status);
        setIsGmailConnected(status.connected);
        
        if (status.connected) {
          loadGmailEmails();
        }
      } else if (res.status === 401) {
        setIsGmailConnected(false);
        setSyncStatus({ connected: false });
      }
    } catch (error) {
      console.error("Error checking Gmail connection:", error);
      setIsGmailConnected(false);
      setSyncStatus({ connected: false });
    }
  };

  const handleConnectGmail = async () => {
    // First check if user is authenticated
    if (!isAuthenticated) {
      openAuthModal("login");
      return;
    }

    try {
      setIsConnectingGmail(true);
      
      // Get session first
      const { data: { session }, error: sessionError } = await supabaseBrowserClient.auth.getSession();
      
      if (!session?.user) {
        setIsConnectingGmail(false);
        openAuthModal("login");
        return;
      }
      
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
      
      // Use session token - user must be authenticated
      const authToken = session.access_token;
      const userId = session.user.id;

      // Pass userId in a header so the API can use it for the OAuth state
      // Also pass the origin explicitly to ensure correct redirect URI
      const res = await fetch("/api/gmail/auth", {
        headers: { 
          Authorization: `Bearer ${authToken}`,
          "X-User-Id": userId,
          "Origin": window.location.origin,
        },
      });

      if (!res.ok) {
        setIsConnectingGmail(false);
        
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        
        if (res.status === 401 || data.error === "Unauthorized") {
          // User needs to log in
          alert("Please log in to connect Gmail.\n\nYou'll be redirected to the login page.");
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
            "Setup Steps:\n" +
            "1. Go to https://console.cloud.google.com/\n" +
            "2. Create or select a project\n" +
            "3. Enable Gmail API (APIs & Services → Library)\n" +
            "4. Go to APIs & Services → Credentials\n" +
            "5. Click + CREATE CREDENTIALS → OAuth client ID\n" +
            "6. Application type: Web application\n" +
            "7. Add redirect URI: " + redirectUri + "\n" +
            "8. Copy the Client ID and Client Secret\n" +
            "9. Open .env.local and add:\n" +
            "    GMAIL_CLIENT_ID=your_actual_client_id\n" +
            "    GMAIL_CLIENT_SECRET=your_actual_client_secret\n" +
            "10. Restart your dev server\n\n" +
            "See GMAIL_SETUP.md for detailed instructions."
          );
        } else {
          alert(`Failed to connect Gmail: ${errorMsg}${details}\n\nVisit /api/gmail/test to check your configuration.`);
        }
        return;
      }
      
      const data = await res.json();
      
      if (!data.authUrl) {
        setIsConnectingGmail(false);
        alert("Failed to get Gmail authorization URL. Please check your OAuth configuration.");
        return;
      }

      // Redirect directly to OAuth URL instead of using popup
      // This avoids popup blocker issues and is more reliable
      window.location.href = data.authUrl;
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
      if (!session?.access_token) {
        setIsLoadingEmails(false);
        return;
      }

      // Fetch from email queue API
      const res = await fetch("/api/email-queue?status=open&includeDeleted=false", {
        headers: { 
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          setIsGmailConnected(false);
        }
        return;
      }

      const data = await res.json();
      if (data.emails) {
        setEmailQueueItems(data.emails);
        // Also set gmailEmails for backward compatibility with existing UI
        const formattedEmails: GmailEmail[] = data.emails.map((item: EmailQueueItem) => ({
          id: item.id,
          sender: item.from_name || item.from_address,
          fromAddress: item.from_address,
          subject: item.subject,
          snippet: item.snippet || "",
          body: item.body_html || item.body_text || undefined,
          timestamp: new Date(item.internal_date).toISOString(),
          categoryId: item.category_id || undefined,
          status: item.queue_status === "done" ? "archived" : item.queue_status === "open" ? "needs_reply" : "drafted",
        }));
        setGmailEmails(formattedEmails);
        
        if (data.emails.length > 0 && !selectedEmail) {
          setSelectedEmail(data.emails[0]);
        }
      }
    } catch (error) {
      console.error("Error loading Gmail emails:", error);
    } finally {
      setIsLoadingEmails(false);
    }
  };

  const triggerSync = async () => {
    try {
      if (!isAuthenticated) return;
      
      setIsSyncing(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        setIsSyncing(false);
        return;
      }

      const res = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type: "incremental" }),
      });

      if (res.ok) {
        const result = await res.json();
        // Refresh sync status and emails
        await checkGmailConnection();
        await loadGmailEmails();
        return result;
      } else {
        throw new Error("Sync failed");
      }
    } catch (error) {
      console.error("Error triggering sync:", error);
      throw error;
    } finally {
      setIsSyncing(false);
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

      // Redirect directly to OAuth URL instead of using popup
      // This avoids popup blocker issues and is more reliable
      window.location.href = data.authUrl;
    } catch (error) {
      console.error("Error connecting calendar:", error);
      alert("Failed to connect Google Calendar. Please try again.");
      setIsConnectingCalendar(false);
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
          language: getLanguageFromLocale(language),
          emailContext: {
            emailId: selectedEmail.id,
            subject: getEmailSubject(selectedEmail),
            fromAddress: getEmailSender(selectedEmail),
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
      const currentDraft = getEmailDraft(selectedEmail);
      const updatedDraft = currentDraft 
        ? `${currentDraft}\n\n[Updated: ${aiResponse}]`
        : aiResponse;

      if (selectedEmail) {
        // Update draft - handle different email types
        if ("draft" in selectedEmail) {
          setSelectedEmail({ ...selectedEmail, draft: updatedDraft } as any);
        }
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

  const handleEmailSelect = (email: EmailRecord | GmailEmail | EmailQueueItem) => {
    setSelectedEmail(email);
    setChatMessages([{ role: "agent", text: t("syncTellSyncToChange") }]);
  };

  // Helper functions to extract properties from different email types
  const getEmailSender = (email: EmailRecord | GmailEmail | EmailQueueItem | null): string => {
    if (!email) return "";
    if ("sender" in email) return email.sender;
    if ("from_name" in email) return email.from_name || email.from_address;
    return "";
  };

  const getEmailSnippet = (email: EmailRecord | GmailEmail | EmailQueueItem | null): string => {
    if (!email) return "";
    if ("snippet" in email) return email.snippet || "";
    return "";
  };

  const getEmailDraft = (email: EmailRecord | GmailEmail | EmailQueueItem | null): string => {
    if (!email) return "";
    if ("draft" in email) return email.draft || "";
    return "";
  };

  const getEmailSubject = (email: EmailRecord | GmailEmail | EmailQueueItem | null): string => {
    if (!email) return "";
    if ("subject" in email) return email.subject;
    return "";
  };

  const formatSyncTime = (lastSyncAt: string): string => {
    const syncDate = new Date(lastSyncAt);
    const now = new Date();
    const diffMs = now.getTime() - syncDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    return syncDate.toLocaleDateString();
  };

  // Icon mapping for custom alerts
  const getIconComponent = (iconName: string) => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      AlertTriangle,
      CalendarCheck,
      Info,
      CheckCircle,
      AlertCircle,
      Clock,
      MapPin,
      Users,
    };
    return iconMap[iconName] || AlertTriangle;
  };

  // Handle adding custom alert
  const handleAddCustomAlert = () => {
    if (!newAlert.title || !newAlert.date) return;
    
    const dateTime = newAlert.time 
      ? new Date(`${newAlert.date}T${newAlert.time}`).toISOString()
      : undefined;
    
    const alert: CustomAlert = {
      id: `alert-${Date.now()}`,
      icon: newAlert.icon || "AlertTriangle",
      title: newAlert.title,
      description: newAlert.description || "",
      date: newAlert.date,
      time: newAlert.time,
      dateTime,
    };
    
    setCustomAlerts([...customAlerts, alert]);
    setNewAlert({
      icon: "AlertTriangle",
      title: "",
      description: "",
      date: "",
      time: "",
    });
    setShowAlertForm(false);
  };

  // Handle alert click - open modal
  const handleAlertClick = (alert: CustomAlert) => {
    setSelectedAlert(alert);
    setEditedAlert({ ...alert });
    setAlertNoteText((alert as any).notes || "");
    setAlertMemoText((alert as any).memo || "");
    setAlertReminderText((alert as any).reminder || "");
    setShowAlertModal(true);
    setEditingAlert(false);
    setEditingAlertNote(false);
  };

  // Handle updating alert
  const handleUpdateAlert = () => {
    if (!selectedAlert || !editedAlert.title || !editedAlert.date) return;
    
    const isDemo = selectedAlert.id.startsWith("demo-alert-");
    
    if (isDemo) {
      // In demo mode, update the demo alert in the state
      setDemoAlertsState(demoAlertsState.map(a => 
        a.id === selectedAlert.id 
          ? { ...a, ...editedAlert } as CustomAlert
          : a
      ));
      setSelectedAlert({ ...selectedAlert, ...editedAlert } as CustomAlert);
      setEditingAlert(false);
      return;
    }
    
    setCustomAlerts(customAlerts.map(a => 
      a.id === selectedAlert.id 
        ? { ...a, ...editedAlert } as CustomAlert
        : a
    ));
    setSelectedAlert({ ...selectedAlert, ...editedAlert } as CustomAlert);
    setEditingAlert(false);
  };

  // Handle deleting alert
  const handleDeleteAlert = () => {
    if (!selectedAlert) return;
    
    const isDemo = selectedAlert.id.startsWith("demo-alert-");
    
    if (isDemo) {
      // In demo mode, remove from demo alerts state
      setDemoAlertsState(demoAlertsState.filter(a => a.id !== selectedAlert.id));
      setShowAlertModal(false);
      setSelectedAlert(null);
      return;
    }
    
    setCustomAlerts(customAlerts.filter(a => a.id !== selectedAlert.id));
    setShowAlertModal(false);
    setSelectedAlert(null);
  };

  // Handle marking alert as complete
  const handleCompleteAlert = () => {
    if (!selectedAlert) return;
    
    const isDemo = selectedAlert.id.startsWith("demo-alert-");
    
    if (isDemo) {
      // In demo mode, remove from demo alerts state
      setDemoAlertsState(demoAlertsState.filter(a => a.id !== selectedAlert.id));
      setShowAlertModal(false);
      setSelectedAlert(null);
      return;
    }
    
    setCustomAlerts(customAlerts.filter(a => a.id !== selectedAlert.id));
    setShowAlertModal(false);
    setSelectedAlert(null);
  };

  // Calendar helpers - using date-fns utilities
  // All date/time operations now use date-fns for consistency and timezone handling

  // Group events by date (using local dates)
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    displayEvents.forEach((event) => {
      const localDateString = getEventLocalDateString(event);
      if (localDateString) {
        if (!grouped[localDateString]) {
          grouped[localDateString] = [];
        }
        grouped[localDateString].push(event);
        
        // For multi-day events, also add to subsequent days
        if (isMultiDayEvent(event)) {
          const startDate = getEventLocalDate(event);
          if (startDate) {
            let currentDate = new Date(startDate);
            currentDate.setDate(currentDate.getDate() + 1);
            
            let endDate: Date;
            if (event.end.dateTime) {
              endDate = new Date(event.end.dateTime);
            } else if (event.end.date) {
              const [year, month, day] = event.end.date.split('-').map(Number);
              endDate = new Date(year, month - 1, day - 1); // end is exclusive
            } else {
              endDate = startDate;
            }
            
            while (currentDate <= endDate) {
              const dateKey = getLocalDateString(currentDate);
              if (!grouped[dateKey]) {
                grouped[dateKey] = [];
              }
              grouped[dateKey].push(event);
              currentDate.setDate(currentDate.getDate() + 1);
            }
          }
        }
      }
    });
    return grouped;
  }, [displayEvents]);

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
      const dateKey = getLocalDateString(date);
      days.push({
        date,
        events: eventsByDate[dateKey] || [],
      });
    }

    return days;
  }, [selectedDate, eventsByDate]);

  // Weekly view days (using date-fns, week starts on Sunday)
  const weekDays = useMemo(() => {
    const days = getWeekDays(selectedDate, 0); // 0 = Sunday
    return days.map(date => ({
      date,
      events: eventsByDate[getLocalDateString(date)] || [],
    }));
  }, [selectedDate, eventsByDate]);

  // Get event category and color
  const getEventCategory = (event: CalendarEvent): { category: string; color: string; bgColor: string; borderColor: string } => {
    if (event.createdByAloha) {
      return {
        category: "aloha",
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-900/30",
        borderColor: "border-red-200 dark:border-red-800",
      };
    }
    // Default to sync (blue) for now, can be extended based on event properties
    return {
      category: "sync",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-900/30",
      borderColor: "border-blue-200 dark:border-blue-800",
    };
  };

  // Calculate active time range (earliest and latest events ± 2 hours) using local times
  const activeTimeRange = useMemo(() => {
    const allEvents = weekDays.flatMap(day => day.events);
    const allAlerts = allCustomAlerts.filter(alert => {
      const alertDateString = getLocalDateString(new Date(alert.date));
      return weekDays.some(day => getLocalDateString(day.date) === alertDateString);
    });

    let minHour = 6; // Default start at 6 AM
    let maxHour = 22; // Default end at 10 PM

    // Find earliest/latest event using local time
    allEvents.forEach(event => {
      const localTime = getEventLocalTime(event);
      if (localTime) {
        // Only consider events that are actually in the current week
        const eventLocalDateString = getEventLocalDateString(event);
        const isInWeek = weekDays.some(day => getLocalDateString(day.date) === eventLocalDateString);
        if (isInWeek) {
          minHour = Math.min(minHour, localTime.hour);
          maxHour = Math.max(maxHour, localTime.hour);
        }
      }
    });

    // Find earliest/latest alert
    allAlerts.forEach(alert => {
      if (alert.time) {
        const [hours] = alert.time.split(':').map(Number);
        minHour = Math.min(minHour, hours);
        maxHour = Math.max(maxHour, hours);
      }
    });

    // Expand ± 2 hours
    minHour = Math.max(0, minHour - 2);
    maxHour = Math.min(23, maxHour + 2);

    return { minHour, maxHour };
  }, [weekDays, allCustomAlerts]);

  // Get hour position in pixels (40px per hour)
  const getHourPosition = (hour: number, minute: number = 0) => {
    return (hour - activeTimeRange.minHour) * 40 + (minute / 60) * 40;
  };

  // Check if hour should show label (every 3 hours)
  const shouldShowHourLabel = (hour: number) => {
    return hour % 3 === 0;
  };

  // Auto-scroll to first event on load
  useEffect(() => {
    if (calendarView === "week" && weekDays.length > 0) {
      const allEvents = weekDays.flatMap(day => day.events);
      const allAlerts = allCustomAlerts.filter(alert => {
        const alertDate = new Date(alert.date);
        return weekDays.some(day => day.date.toDateString() === alertDate.toDateString());
      });

      let earliestHour = activeTimeRange.minHour;
      
      // Find earliest event time
      allEvents.forEach(event => {
        if (event.start.dateTime) {
          const eventDate = new Date(event.start.dateTime);
          const hour = eventDate.getHours();
          if (hour >= activeTimeRange.minHour && hour <= activeTimeRange.maxHour) {
            earliestHour = Math.min(earliestHour, hour);
          }
        }
      });

      allAlerts.forEach(alert => {
        if (alert.time) {
          const [hours] = alert.time.split(':').map(Number);
          if (hours >= activeTimeRange.minHour && hours <= activeTimeRange.maxHour) {
            earliestHour = Math.min(earliestHour, hours);
          }
        }
      });

      // Scroll to first event (with some offset)
      const scrollContainer = document.querySelector('[data-week-calendar-scroll]');
      if (scrollContainer) {
        const scrollPosition = (earliestHour - activeTimeRange.minHour) * 40 - 100;
        scrollContainer.scrollTop = Math.max(0, scrollPosition);
      }
    }
  }, [calendarView, weekDays, allCustomAlerts, activeTimeRange]);

  return (
    <div className="space-y-8">
      {isPreview && (
        <PreviewBanner 
          agentName={agentConfig.label} 
          requiredTier={agentConfig.requiredTier}
        />
      )}
      <header>
        <p className="text-sm uppercase tracking-widest text-slate-500">{t("syncAgent")}</p>
        <h1 className="text-3xl font-semibold">{t("syncTitle")}</h1>
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
            {t("syncEmailTab")}
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
            {t("syncCalendarTab")}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "email" && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1" />
              <div className="flex items-center gap-3">
                {/* Sync Status Indicator */}
                {isGmailConnected && syncStatus && (
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900/60">
                    {syncStatus.syncStatus === "syncing" || isSyncing ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                        <span className="text-slate-600 dark:text-slate-400">Syncing...</span>
                      </>
                    ) : syncStatus.syncStatus === "error" ? (
                      <>
                        <AlertCircle className="h-3 w-3 text-red-500" />
                        <span className="text-red-600 dark:text-red-400">Sync error</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        <span className="text-slate-600 dark:text-slate-400">
                          {syncStatus.lastSyncAt ? (
                            <>
                              Connected to Gmail • Last synced {formatSyncTime(syncStatus.lastSyncAt)}
                            </>
                          ) : (
                            "Connected to Gmail"
                          )}
                        </span>
                      </>
                    )}
                  </div>
                )}
                
                {/* Sync Now Button */}
                {isGmailConnected && (
                  <button
                    onClick={triggerSync}
                    disabled={isSyncing}
                    className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3" />
                        Sync Now
                      </>
                    )}
                  </button>
                )}
                
                {/* Connect/Disconnect Button */}
                {!isGmailConnected ? (
                  <button
                    onClick={handleConnectGmail}
                    disabled={isConnectingGmail}
                    className="flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isConnectingGmail ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("syncConnecting")}
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4" />
                        {t("syncConnectGmail")}
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      if (!isAuthenticated) return;
                      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
                      if (!session?.access_token) return;
                      
                      if (confirm("Are you sure you want to disconnect Gmail? Your email queue will remain but won't sync.")) {
                        try {
                          const res = await fetch("/api/gmail/disconnect", {
                            method: "DELETE",
                            headers: { Authorization: `Bearer ${session.access_token}` },
                          });
                          if (res.ok) {
                            setIsGmailConnected(false);
                            setSyncStatus(null);
                            setEmailQueueItems([]);
                            setGmailEmails([]);
                          }
                        } catch (error) {
                          console.error("Error disconnecting:", error);
                        }
                      }
                    }}
                    className="flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                  >
                    <X className="h-4 w-4" />
                    Disconnect
                  </button>
                )}
              </div>
            </div>
            
            {/* Sync Error Banner */}
            {isGmailConnected && syncStatus?.syncStatus === "error" && syncStatus.syncError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-800 dark:text-red-300">Sync Error</p>
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{syncStatus.syncError}</p>
                    </div>
                  </div>
                  <button
                    onClick={triggerSync}
                    className="text-xs font-semibold text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            <section className="rounded-3xl border border-slate-200 bg-white/80 p-5 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t("syncLatestInboxMetrics")}</p>
                {!isPreview && loading && <span className="text-xs text-slate-500">Loading stats…</span>}
                {!isPreview && error && <span className="text-xs text-red-500">Couldn&apos;t load stats</span>}
                {!isPreview && noStats && <span className="text-xs text-slate-500">No stats yet</span>}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: t("syncImportantEmails"), value: latestStats.xi_important_emails },
                  { label: t("syncPaymentsBills"), value: latestStats.xi_payments_bills },
                  { label: t("syncInvoices"), value: latestStats.xi_invoices },
                  { label: t("syncMissedEmails"), value: latestStats.xi_missed_emails },
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
                  <p>{getCategoryName(category.id)}</p>
                  <p className="text-xs opacity-80">{category.count} {t("alerts")}</p>
                </button>
              ))}
            </section>

            <div className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
              <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">{t("syncEmailQueue")}</h2>
                  {activeCategory && (
                    <button onClick={() => setActiveCategory(null)} className="text-xs uppercase tracking-wide text-brand-accent">
                      {t("syncClearFilter")}
                    </button>
                  )}
                </div>
                <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {isLoadingEmails ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                      <span className="ml-2 text-sm text-slate-500">{t("syncLoadingEmails")}</span>
                    </div>
                  ) : filteredEmails.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-500">
                      {isGmailConnected ? t("syncNoEmailsFound") : t("syncConnectGmailToView")}
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
                            {email.categoryId ? getCategoryName(email.categoryId) : t("syncUncategorized")}
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
                <h2 className="text-xl font-semibold">{t("syncDraftPreview")}</h2>
                {selectedEmail ? (
                  <div className="mt-4 space-y-4 text-slate-600 dark:text-slate-200">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">{t("syncOriginal")}</p>
                      <p className="mt-1 rounded-2xl bg-slate-100/70 p-3 text-sm dark:bg-slate-800/60">
                        {getEmailSnippet(selectedEmail) || "No preview available"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">{t("syncDraft")}</p>
                      <p className="mt-1 rounded-2xl bg-slate-900/90 p-3 text-sm text-white dark:bg-white/10 dark:text-white">
                        {getEmailDraft(selectedEmail) || t("syncPlaceholderDraft")}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 dark:bg-white dark:text-slate-900">
                        {t("syncAcceptDraft")}
                      </button>
                      <button className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                        {t("syncEditDraft")}
                      </button>
                    </div>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t("syncChatWithSync")}</h3>
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
                            {t("syncProcessing")}
                          </div>
                        )}
                      </div>
                      <form onSubmit={handleChat} className="mt-3 flex gap-2">
                        <input
                          name="message"
                          placeholder={t("syncPlaceholderChat")}
                          disabled={isProcessing}
                          className="flex-1 rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-xs focus:border-brand-accent focus:outline-none disabled:opacity-50 dark:border-slate-700"
                        />
                        <button
                          type="submit"
                          disabled={isProcessing}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
                        >
                          {t("syncSend")}
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">{t("syncSelectEmailToPreview")}</p>
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
                className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition ${
                  isCalendarConnected
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400"
                    : "border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isConnectingCalendar ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("syncConnecting")}
                  </>
                ) : isCalendarConnected ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {t("syncCalendarConnected")}
                  </>
                ) : (
                  <>
                    <CalendarIcon className="h-4 w-4" />
                    {t("syncConnectGoogleCalendar")}
                  </>
                )}
              </button>
            </div>

            <div className="space-y-6">
              {showDemoCalendar && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    <span className="font-semibold">Demo Mode:</span> Showing sample calendar events. Connect your Google Calendar to see your real events.
                  </p>
                </div>
              )}
                <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <button
                    onClick={() => {
                      const newDate = new Date(selectedDate);
                      if (calendarView === "month") {
                        newDate.setMonth(newDate.getMonth() - 1);
                      } else {
                        newDate.setDate(newDate.getDate() - 7);
                      }
                      setSelectedDate(newDate);
                    }}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    {t("syncPrevious")}
                  </button>
                  <div className="flex flex-col items-center gap-2">
                    <h2 className="text-xl font-semibold">
                      {calendarView === "month"
                        ? selectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
                        : (() => {
                            const startOfWeek = new Date(selectedDate);
                            const day = startOfWeek.getDay();
                            const diff = startOfWeek.getDate() - day;
                            const sunday = new Date(startOfWeek.setDate(diff));
                            const saturday = new Date(sunday);
                            saturday.setDate(sunday.getDate() + 6);
                            return `${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${saturday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
                          })()}
                    </h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCalendarView("week")}
                        className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                          calendarView === "week"
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                        }`}
                      >
                        {t("syncWeekView" as any)}
                      </button>
                      <button
                        onClick={() => setCalendarView("month")}
                        className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                          calendarView === "month"
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                        }`}
                      >
                        {t("syncMonthView" as any)}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const newDate = new Date(selectedDate);
                      if (calendarView === "month") {
                        newDate.setMonth(newDate.getMonth() + 1);
                      } else {
                        newDate.setDate(newDate.getDate() + 7);
                      }
                      setSelectedDate(newDate);
                    }}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    {t("syncNext")}
                  </button>
                </div>

                {isLoadingEvents && isCalendarConnected ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                    <span className="ml-2 text-sm text-slate-500">{t("syncLoadingCalendarEvents")}</span>
                  </div>
                ) : calendarView === "week" ? (
                  <div className="rounded-3xl border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/40 overflow-hidden">
                    {/* Header - Desktop/Tablet */}
                    <div className="hidden md:grid grid-cols-8 gap-2 px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-semibold uppercase text-slate-500"></div>
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => {
                        const dayDate = weekDays[idx]?.date;
                        const isToday = dayDate?.toDateString() === new Date().toDateString();
                        return (
                          <div key={day} className={`text-center text-xs font-semibold uppercase py-2 ${isToday ? "text-slate-900 dark:text-white" : "text-slate-500"}`}>
                            <div>{day}</div>
                            <div className={`text-sm mt-1 ${isToday ? "font-bold" : ""}`}>{dayDate?.getDate()}</div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Mobile Header */}
                    <div className="md:hidden px-4 pt-4 pb-2 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold uppercase text-slate-500">
                            {weekDays[0]?.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          </div>
                          <div className="text-sm font-semibold mt-1">Today</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const newDate = new Date(selectedDate);
                              newDate.setDate(newDate.getDate() - 1);
                              setSelectedDate(newDate);
                            }}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                          >
                            ←
                          </button>
                          <button
                            onClick={() => {
                              const newDate = new Date(selectedDate);
                              newDate.setDate(newDate.getDate() + 1);
                              setSelectedDate(newDate);
                            }}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                          >
                            →
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Scrollable calendar grid */}
                    <div 
                      data-week-calendar-scroll
                      className="relative overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)]"
                    >
                      {/* Desktop/Tablet: Full week view */}
                      <div className="hidden md:grid grid-cols-8 gap-2 min-w-[800px]">
                        {/* Sticky Time Column */}
                        <div className="sticky left-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-r border-slate-200 dark:border-slate-800">
                          <div className="relative" style={{ height: `${(activeTimeRange.maxHour - activeTimeRange.minHour + 1) * 40}px` }}>
                            {/* Early morning collapsed section */}
                            {activeTimeRange.minHour > 0 && (
                              <div className="h-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-end pr-2">
                                <span className="text-[9px] text-slate-400 dark:text-slate-600 opacity-60">Early Morning</span>
                              </div>
                            )}
                            
                            {/* Active time range hours */}
                            {Array.from({ length: activeTimeRange.maxHour - activeTimeRange.minHour + 1 }, (_, i) => {
                              const hour = activeTimeRange.minHour + i;
                              const showLabel = shouldShowHourLabel(hour);
                              return (
                                <div
                                  key={hour}
                                  className="h-10 border-b border-slate-200 dark:border-slate-800 flex items-start justify-end pr-2 pt-1"
                                >
                                  {showLabel && (
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 opacity-70">
                                      {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                            
                            {/* Late evening collapsed section */}
                            {activeTimeRange.maxHour < 23 && (
                              <div className="h-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-end pr-2">
                                <span className="text-[9px] text-slate-400 dark:text-slate-600 opacity-60">Late Evening</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Day Columns */}
                        {weekDays.map((day, dayIndex) => {
                          const isToday = day.date.toDateString() === new Date().toDateString();
                          const todayHour = currentTime.getHours();
                          const todayMinute = currentTime.getMinutes();
                          const isCurrentDay = isToday && currentTime.toDateString() === day.date.toDateString();
                          
                          return (
                            <div
                              key={dayIndex}
                              className={`relative border-r border-slate-200 dark:border-slate-800 ${
                                isToday ? "bg-slate-50/30 dark:bg-slate-800/20" : ""
                              }`}
                              style={{ height: `${(activeTimeRange.maxHour - activeTimeRange.minHour + 1) * 40}px` }}
                            >
                              {/* Early morning collapsed section */}
                              {activeTimeRange.minHour > 0 && (
                                <div className="h-8 border-b border-slate-200 dark:border-slate-800"></div>
                              )}
                              
                              {/* Time grid lines */}
                              <div className="absolute inset-0 pointer-events-none">
                                {Array.from({ length: activeTimeRange.maxHour - activeTimeRange.minHour + 1 }, (_, i) => {
                                  const hour = activeTimeRange.minHour + i;
                                  return (
                                    <div
                                      key={hour}
                                      className="h-10 border-b border-slate-200 dark:border-slate-800"
                                    />
                                  );
                                })}
                              </div>
                              
                              {/* "Now" indicator */}
                              {isCurrentDay && todayHour >= activeTimeRange.minHour && todayHour <= activeTimeRange.maxHour && (
                                <div
                                  className="absolute left-0 right-0 z-20 pointer-events-none"
                                  style={{
                                    top: `${getHourPosition(todayHour, todayMinute)}px`,
                                  }}
                                >
                                  <div className="h-0.5 bg-red-500 dark:bg-red-400 relative">
                                    <div className="absolute -left-1 -top-1 h-3 w-3 rounded-full bg-red-500 dark:bg-red-400"></div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Events and alerts */}
                              <div className="relative p-1">
                                {/* Custom alerts */}
                                {allCustomAlerts
                                  .filter((alert) => {
                                    const alertDateString = getLocalDateString(new Date(alert.date));
                                    const dayDateKey = getLocalDateString(day.date);
                                    return alertDateString === dayDateKey;
                                  })
                                  .map((alert) => {
                                    const IconComponent = getIconComponent(alert.icon);
                                    const iconColor = alert.icon === "AlertTriangle" || alert.icon === "AlertCircle"
                                      ? "text-orange-500"
                                      : alert.icon === "CheckCircle"
                                      ? "text-emerald-500"
                                      : "text-brand-accent";
                                    
                                    let topPosition = 0;
                                    if (alert.time) {
                                      const [hours, minutes] = alert.time.split(':').map(Number);
                                      if (hours >= activeTimeRange.minHour && hours <= activeTimeRange.maxHour) {
                                        topPosition = getHourPosition(hours, minutes);
                                      }
                                    }
                                    
                                    return (
                                      <button
                                        key={alert.id}
                                        onClick={() => handleAlertClick(alert)}
                                        className="absolute left-1 right-1 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 shadow-lg shadow-black/20 hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] z-10"
                                        style={{
                                          top: `${topPosition}px`,
                                        }}
                                      >
                                        <div className="flex items-center gap-2 px-2 py-1.5">
                                          <div className={`p-1 rounded-lg ${iconColor === "text-orange-500" ? "bg-orange-50 dark:bg-orange-900/20" : iconColor === "text-emerald-500" ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-brand-accent/10 dark:bg-brand-accent/20"}`}>
                                            <IconComponent className={`h-3 w-3 flex-shrink-0 ${iconColor}`} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                                              {alert.title}
                                            </p>
                                            {alert.time && (
                                              <p className="text-[9px] text-slate-500 dark:text-slate-400">
                                                {alert.time}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                
                                {/* Calendar events */}
                                {day.events.map((event) => {
                                  const category = getEventCategory(event);
                                  let topPosition = 0;
                                  const localTime = getEventLocalTime(event);
                                  if (localTime) {
                                    const { hour, minute } = localTime;
                                    // Only show if event is on this day (check local date)
                                    const eventLocalDateString = getEventLocalDateString(event);
                                    const dayDateKey = getLocalDateString(day.date);
                                    if (eventLocalDateString === dayDateKey && hour >= activeTimeRange.minHour && hour <= activeTimeRange.maxHour) {
                                      topPosition = getHourPosition(hour, minute);
                                    }
                                  }
                                  
                                  return (
                                    <button
                                      key={event.id}
                                      onClick={() => handleEventClick(event)}
                                      className={`absolute left-1 right-1 rounded-xl border shadow-lg shadow-black/20 hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] z-10 ${category.borderColor} ${category.bgColor} ${category.color}`}
                                      style={{
                                        top: `${topPosition}px`,
                                      }}
                                      title={event.summary}
                                    >
                                      <div className="flex items-center gap-2 px-2 py-1.5">
                                        <Clock className="h-3 w-3 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="font-semibold text-xs truncate">
                                            {event.summary}
                                          </p>
                                      <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        {formatEventTime(event, t("syncAllDay"))}
                                      </p>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                              
                              {/* Late evening collapsed section */}
                              {activeTimeRange.maxHour < 23 && (
                                <div className="absolute bottom-0 left-0 right-0 h-8 border-t border-slate-200 dark:border-slate-800"></div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Mobile: Single day view */}
                      <div className="md:hidden">
                        {weekDays.slice(0, 1).map((day, dayIndex) => {
                          const isToday = day.date.toDateString() === new Date().toDateString();
                          const todayHour = currentTime.getHours();
                          const todayMinute = currentTime.getMinutes();
                          const isCurrentDay = isToday && currentTime.toDateString() === day.date.toDateString();
                          
                          return (
                            <div key={dayIndex} className="flex">
                              {/* Sticky Time Column */}
                              <div className="sticky left-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-r border-slate-200 dark:border-slate-800 w-14 flex-shrink-0">
                                <div className="relative" style={{ height: `${(activeTimeRange.maxHour - activeTimeRange.minHour + 1) * 40}px` }}>
                                  {activeTimeRange.minHour > 0 && (
                                    <div className="h-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-end pr-1">
                                      <span className="text-[8px] text-slate-400 dark:text-slate-600 opacity-60">Early</span>
                                    </div>
                                  )}
                                  {Array.from({ length: activeTimeRange.maxHour - activeTimeRange.minHour + 1 }, (_, i) => {
                                    const hour = activeTimeRange.minHour + i;
                                    const showLabel = shouldShowHourLabel(hour);
                                    return (
                                      <div
                                        key={hour}
                                        className="h-10 border-b border-slate-200 dark:border-slate-800 flex items-start justify-end pr-1 pt-1"
                                      >
                                        {showLabel && (
                                          <span className="text-[9px] text-slate-500 dark:text-slate-400 opacity-70">
                                            {hour === 0 ? "12" : hour < 12 ? `${hour}` : hour === 12 ? "12" : `${hour - 12}`}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {activeTimeRange.maxHour < 23 && (
                                    <div className="h-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-end pr-1">
                                      <span className="text-[8px] text-slate-400 dark:text-slate-600 opacity-60">Late</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Day Column */}
                              <div
                                className={`relative border-r border-slate-200 dark:border-slate-800 flex-1 ${
                                  isToday ? "bg-slate-50/30 dark:bg-slate-800/20" : ""
                                }`}
                                style={{ height: `${(activeTimeRange.maxHour - activeTimeRange.minHour + 1) * 40}px` }}
                              >
                                {activeTimeRange.minHour > 0 && (
                                  <div className="h-8 border-b border-slate-200 dark:border-slate-800"></div>
                                )}
                                
                                <div className="absolute inset-0 pointer-events-none">
                                  {Array.from({ length: activeTimeRange.maxHour - activeTimeRange.minHour + 1 }, (_, i) => {
                                    const hour = activeTimeRange.minHour + i;
                                    return (
                                      <div
                                        key={hour}
                                        className="h-10 border-b border-slate-200 dark:border-slate-800"
                                      />
                                    );
                                  })}
                                </div>
                                
                                {isCurrentDay && todayHour >= activeTimeRange.minHour && todayHour <= activeTimeRange.maxHour && (
                                  <div
                                    className="absolute left-0 right-0 z-20 pointer-events-none"
                                    style={{
                                      top: `${getHourPosition(todayHour, todayMinute)}px`,
                                    }}
                                  >
                                    <div className="h-0.5 bg-red-500 dark:bg-red-400 relative">
                                      <div className="absolute -left-1 -top-1 h-3 w-3 rounded-full bg-red-500 dark:bg-red-400"></div>
                                    </div>
                                  </div>
                                )}
                                
                                <div className="relative p-1">
                                  {allCustomAlerts
                                    .filter((alert) => {
                                      const alertDateString = getLocalDateString(new Date(alert.date));
                                      const dayDateKey = getLocalDateString(day.date);
                                      return alertDateString === dayDateKey;
                                    })
                                    .map((alert) => {
                                      const IconComponent = getIconComponent(alert.icon);
                                      const iconColor = alert.icon === "AlertTriangle" || alert.icon === "AlertCircle"
                                        ? "text-orange-500"
                                        : alert.icon === "CheckCircle"
                                        ? "text-emerald-500"
                                        : "text-brand-accent";
                                      
                                      let topPosition = 0;
                                      if (alert.time) {
                                        const [hours, minutes] = alert.time.split(':').map(Number);
                                        if (hours >= activeTimeRange.minHour && hours <= activeTimeRange.maxHour) {
                                          topPosition = getHourPosition(hours, minutes);
                                        }
                                      }
                                      
                                      return (
                                        <button
                                          key={alert.id}
                                          onClick={() => handleAlertClick(alert)}
                                          className="absolute left-1 right-1 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 shadow-lg shadow-black/20 hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] z-10"
                                          style={{
                                            top: `${topPosition}px`,
                                          }}
                                        >
                                          <div className="flex items-center gap-2 px-2 py-1.5">
                                            <div className={`p-1 rounded-lg ${iconColor === "text-orange-500" ? "bg-orange-50 dark:bg-orange-900/20" : iconColor === "text-emerald-500" ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-brand-accent/10 dark:bg-brand-accent/20"}`}>
                                              <IconComponent className={`h-3 w-3 flex-shrink-0 ${iconColor}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                                                {alert.title}
                                              </p>
                                              {alert.time && (
                                                <p className="text-[9px] text-slate-500 dark:text-slate-400">
                                                  {alert.time}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  
                                  {day.events.map((event) => {
                                    const category = getEventCategory(event);
                                    let topPosition = 0;
                                    if (event.start.dateTime) {
                                      const eventDate = new Date(event.start.dateTime);
                                      const hour = eventDate.getHours();
                                      const minute = eventDate.getMinutes();
                                      if (hour >= activeTimeRange.minHour && hour <= activeTimeRange.maxHour) {
                                        topPosition = getHourPosition(hour, minute);
                                      }
                                    }
                                    
                                    return (
                                      <button
                                        key={event.id}
                                        onClick={() => handleEventClick(event)}
                                        className={`absolute left-1 right-1 rounded-xl border shadow-lg shadow-black/20 hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] z-10 ${category.borderColor} ${category.bgColor} ${category.color}`}
                                        style={{
                                          top: `${topPosition}px`,
                                        }}
                                        title={event.summary}
                                      >
                                        <div className="flex items-center gap-2 px-2 py-1.5">
                                          <Clock className="h-3 w-3 flex-shrink-0" />
                                          <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-xs truncate">
                                              {event.summary}
                                            </p>
                                      <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        {formatEventTime(event, t("syncAllDay"))}
                                      </p>
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                                
                                {activeTimeRange.maxHour < 23 && (
                                  <div className="absolute bottom-0 left-0 right-0 h-8 border-t border-slate-200 dark:border-slate-800"></div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
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
                        const isCurrentMonthDay = isCurrentMonth(day.date, selectedDate);
                        const isTodayDay = isToday(day.date);

                        return (
                          <div
                            key={index}
                            className={`min-h-[100px] rounded-2xl border p-2 ${
                              isCurrentMonthDay
                                ? "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60"
                                : "border-slate-100 bg-slate-50/50 dark:border-slate-900 dark:bg-slate-950/50"
                            } ${isTodayDay ? "ring-2 ring-slate-900 dark:ring-white" : ""}`}
                          >
                            <div
                              className={`text-sm font-semibold mb-1 ${
                                isCurrentMonthDay
                                  ? isTodayDay
                                    ? "text-slate-900 dark:text-white"
                                    : "text-slate-600 dark:text-slate-300"
                                  : "text-slate-400 dark:text-slate-600"
                              }`}
                            >
                              {day.date.getDate()}
                            </div>
                            <div className="space-y-1">
                              {/* Custom alerts for this day */}
                              {allCustomAlerts
                                .filter((alert) => {
                                  const alertDateString = getLocalDateString(new Date(alert.date));
                                  const dayDateKey = getLocalDateString(day.date);
                                  return alertDateString === dayDateKey;
                                })
                                .map((alert) => {
                                  const IconComponent = getIconComponent(alert.icon);
                                  const isDemo = alert.id.startsWith("demo-alert-");
                                  // Determine icon color based on icon type
                                  const iconColor = alert.icon === "AlertTriangle" || alert.icon === "AlertCircle"
                                    ? "text-orange-500"
                                    : alert.icon === "CheckCircle"
                                    ? "text-emerald-500"
                                    : "text-brand-accent";
                                  
                                  return (
                                    <button
                                      key={alert.id}
                                      onClick={() => handleAlertClick(alert)}
                                      className="w-full text-left px-3 py-2 rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 shadow-lg hover:shadow-xl transition-all duration-200 mb-1.5 transform hover:scale-[1.02]"
                                      style={{
                                        filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
                                      }}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className={`p-1 rounded-lg ${iconColor === "text-orange-500" ? "bg-orange-50 dark:bg-orange-900/20" : iconColor === "text-emerald-500" ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-brand-accent/10 dark:bg-brand-accent/20"}`}>
                                          <IconComponent className={`h-3.5 w-3.5 flex-shrink-0 ${iconColor}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                                            {alert.title}
                                          </p>
                                          {alert.time && (
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                              {alert.time}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              {/* Calendar events */}
                              {day.events.slice(0, 3).map((event) => (
                                <button
                                  key={event.id}
                                  onClick={() => handleEventClick(event)}
                                  className={`w-full text-left px-3 py-2 rounded-2xl border shadow-lg hover:shadow-xl transition-all duration-200 mb-1.5 transform hover:scale-[1.02] ${
                                    event.createdByAloha
                                      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
                                      : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                  }`}
                                  style={{
                                    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
                                  }}
                                  title={event.summary}
                                >
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-3.5 w-3.5 flex-shrink-0 text-slate-500 dark:text-slate-400" />
                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold text-xs truncate">
                                        {event.summary}
                                      </p>
                                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                            {formatEventTime(event, t("syncAllDay"))}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              ))}
                              {day.events.length > 3 && (
                                <div className="text-xs text-slate-500 px-2">
                                  +{day.events.length - 3} {t("syncMore")}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Custom Alert Form */}
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">{t("syncCustomAlerts" as any)}</h3>
                    <button
                      onClick={() => setShowAlertForm(!showAlertForm)}
                      className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      {showAlertForm ? (
                        <>
                          <X className="h-4 w-4" />
                          {t("syncCancel" as any)}
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          {t("syncAddAlert" as any)}
                        </>
                      )}
                    </button>
                  </div>

                  {showAlertForm && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAddCustomAlert();
                      }}
                      className="space-y-4"
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        {/* Icon Selection */}
                        <div>
                          <label className="block text-sm font-semibold mb-2">{t("syncAlertIcon" as any)}</label>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { name: "AlertTriangle", icon: AlertTriangle, color: "text-orange-500" },
                              { name: "CalendarCheck", icon: CalendarCheck, color: "text-brand-accent" },
                              { name: "Info", icon: Info, color: "text-brand-accent" },
                              { name: "CheckCircle", icon: CheckCircle, color: "text-emerald-500" },
                              { name: "AlertCircle", icon: AlertCircle, color: "text-orange-500" },
                              { name: "Clock", icon: Clock, color: "text-brand-accent" },
                              { name: "MapPin", icon: MapPin, color: "text-brand-accent" },
                              { name: "Users", icon: Users, color: "text-brand-accent" },
                            ].map(({ name, icon: Icon, color }) => (
                              <button
                                key={name}
                                type="button"
                                onClick={() => setNewAlert({ ...newAlert, icon: name })}
                                className={`p-3 rounded-2xl border transition ${
                                  newAlert.icon === name
                                    ? "border-brand-accent bg-brand-accent/10"
                                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                                }`}
                              >
                                <Icon className={`h-5 w-5 ${color} mx-auto`} />
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Title */}
                        <div>
                          <label className="block text-sm font-semibold mb-2">{t("syncAlertTitle" as any)}</label>
                          <input
                            type="text"
                            value={newAlert.title || ""}
                            onChange={(e) => setNewAlert({ ...newAlert, title: e.target.value })}
                            placeholder={t("syncAlertTitlePlaceholder" as any)}
                            required
                            className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                          />
                        </div>

                        {/* Description */}
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-semibold mb-2">{t("syncAlertDescription" as any)}</label>
                          <textarea
                            value={newAlert.description || ""}
                            onChange={(e) => setNewAlert({ ...newAlert, description: e.target.value })}
                            placeholder={t("syncAlertDescriptionPlaceholder" as any)}
                            rows={2}
                            className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                          />
                        </div>

                        {/* Date */}
                        <div>
                          <label className="block text-sm font-semibold mb-2">{t("syncAlertDate" as any)}</label>
                          <input
                            type="date"
                            value={newAlert.date || ""}
                            onChange={(e) => setNewAlert({ ...newAlert, date: e.target.value })}
                            required
                            className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                          />
                        </div>

                        {/* Time */}
                        <div>
                          <label className="block text-sm font-semibold mb-2">{t("syncAlertTime" as any)} ({t("syncOptional" as any)})</label>
                          <input
                            type="time"
                            value={newAlert.time || ""}
                            onChange={(e) => setNewAlert({ ...newAlert, time: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                          />
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="submit"
                          className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                        >
                          {t("syncAddAlert" as any)}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAlertForm(false);
                            setNewAlert({
                              icon: "AlertTriangle",
                              title: "",
                              description: "",
                              date: "",
                              time: "",
                            });
                          }}
                          className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          {t("syncCancel" as any)}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
            </div>

            {/* Alert Detail Modal */}
            {showAlertModal && selectedAlert && (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setShowAlertModal(false);
                    setEditingAlert(false);
                    setEditingAlertNote(false);
                    setSelectedAlert(null);
                  }
                }}
              >
                <div 
                  className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      {editingAlert ? (
                        <div className="space-y-4">
                          {/* Icon Selection */}
                          <div>
                            <label className="block text-sm font-semibold mb-2">{t("syncAlertIcon" as any)}</label>
                            <div className="grid grid-cols-4 gap-2">
                              {[
                                { name: "AlertTriangle", icon: AlertTriangle, color: "text-orange-500" },
                                { name: "CalendarCheck", icon: CalendarCheck, color: "text-brand-accent" },
                                { name: "Info", icon: Info, color: "text-brand-accent" },
                                { name: "CheckCircle", icon: CheckCircle, color: "text-emerald-500" },
                                { name: "AlertCircle", icon: AlertCircle, color: "text-orange-500" },
                                { name: "Clock", icon: Clock, color: "text-brand-accent" },
                                { name: "MapPin", icon: MapPin, color: "text-brand-accent" },
                                { name: "Users", icon: Users, color: "text-brand-accent" },
                              ].map(({ name, icon: Icon, color }) => (
                                <button
                                  key={name}
                                  type="button"
                                  onClick={() => setEditedAlert({ ...editedAlert, icon: name })}
                                  className={`p-3 rounded-2xl border transition ${
                                    editedAlert.icon === name
                                      ? "border-brand-accent bg-brand-accent/10"
                                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                                  }`}
                                >
                                  <Icon className={`h-5 w-5 ${color} mx-auto`} />
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Title */}
                          <div>
                            <label className="block text-sm font-semibold mb-2">{t("syncAlertTitle" as any)}</label>
                            <input
                              type="text"
                              value={editedAlert.title || ""}
                              onChange={(e) => setEditedAlert({ ...editedAlert, title: e.target.value })}
                              className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                            />
                          </div>

                          {/* Description */}
                          <div>
                            <label className="block text-sm font-semibold mb-2">{t("syncAlertDescription" as any)}</label>
                            <textarea
                              value={editedAlert.description || ""}
                              onChange={(e) => setEditedAlert({ ...editedAlert, description: e.target.value })}
                              rows={3}
                              className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                            />
                          </div>

                          {/* Date and Time */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-semibold mb-2">{t("syncAlertDate" as any)}</label>
                              <input
                                type="date"
                                value={editedAlert.date || ""}
                                onChange={(e) => setEditedAlert({ ...editedAlert, date: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold mb-2">{t("syncAlertTime" as any)}</label>
                              <input
                                type="time"
                                value={editedAlert.time || ""}
                                onChange={(e) => setEditedAlert({ ...editedAlert, time: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-4">
                            {(() => {
                              const IconComponent = getIconComponent(selectedAlert.icon);
                              const iconColor = selectedAlert.icon === "AlertTriangle" || selectedAlert.icon === "AlertCircle"
                                ? "text-orange-500"
                                : selectedAlert.icon === "CheckCircle"
                                ? "text-emerald-500"
                                : "text-brand-accent";
                              return (
                                <div className={`p-3 rounded-2xl ${iconColor === "text-orange-500" ? "bg-orange-50 dark:bg-orange-900/20" : iconColor === "text-emerald-500" ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-brand-accent/10 dark:bg-brand-accent/20"}`}>
                                  <IconComponent className={`h-6 w-6 ${iconColor}`} />
                                </div>
                              );
                            })()}
                            <div className="flex-1">
                              <h3 className="text-2xl font-semibold mb-1">{selectedAlert.title}</h3>
                              <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                                <div className="flex items-center gap-1">
                                  <CalendarIcon className="h-4 w-4" />
                                  <span>{new Date(selectedAlert.date).toLocaleDateString()}</span>
                                </div>
                                {selectedAlert.time && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    <span>{selectedAlert.time}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          {selectedAlert.description && (
                            <div className="mb-4 rounded-2xl bg-slate-100/70 p-4 text-sm dark:bg-slate-800/60">
                              <p className="text-slate-700 dark:text-slate-200">{selectedAlert.description}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setShowAlertModal(false);
                        setEditingAlert(false);
                        setEditingAlertNote(false);
                        setSelectedAlert(null);
                      }}
                      className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {!editingAlert && (
                    <div className="space-y-4 mb-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-semibold flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            {t("syncNotes")}
                          </label>
                          {!editingAlertNote && (
                            <button
                              onClick={() => setEditingAlertNote(true)}
                              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
                            >
                              <Edit2 className="h-3 w-3" />
                              {t("syncEdit")}
                            </button>
                          )}
                        </div>
                        {editingAlertNote ? (
                          <textarea
                            value={alertNoteText}
                            onChange={(e) => setAlertNoteText(e.target.value)}
                            placeholder={t("syncAddNotesPlaceholder")}
                            className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700 min-h-[100px]"
                          />
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60 min-h-[100px]">
                            {alertNoteText || <span className="text-slate-400">{t("syncNoNotesAdded")}</span>}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-sm font-semibold mb-2 block">{t("syncMemo")}</label>
                        {editingAlertNote ? (
                          <textarea
                            value={alertMemoText}
                            onChange={(e) => setAlertMemoText(e.target.value)}
                            placeholder={t("syncAddMemoPlaceholder")}
                            className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700 min-h-[80px]"
                          />
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60 min-h-[80px]">
                            {alertMemoText || <span className="text-slate-400">{t("syncNoMemo")}</span>}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-sm font-semibold mb-2 block">{t("syncReminder")}</label>
                        {editingAlertNote ? (
                          <input
                            type="text"
                            value={alertReminderText}
                            onChange={(e) => setAlertReminderText(e.target.value)}
                            placeholder={t("syncSetReminderPlaceholder")}
                            className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                          />
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                            {alertReminderText || <span className="text-slate-400">{t("syncNoReminderSet")}</span>}
                          </div>
                        )}
                      </div>

                      {editingAlertNote && (
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              const isDemo = selectedAlert?.id.startsWith("demo-alert-");
                              if (isDemo) {
                                setDemoAlertsState(demoAlertsState.map(a => 
                                  a.id === selectedAlert.id 
                                    ? { ...a, notes: alertNoteText, memo: alertMemoText, reminder: alertReminderText } as CustomAlert
                                    : a
                                ));
                                setSelectedAlert({ ...selectedAlert, notes: alertNoteText, memo: alertMemoText, reminder: alertReminderText } as CustomAlert);
                              } else {
                                setCustomAlerts(customAlerts.map(a => 
                                  a.id === selectedAlert.id 
                                    ? { ...a, notes: alertNoteText, memo: alertMemoText, reminder: alertReminderText } as CustomAlert
                                    : a
                                ));
                                setSelectedAlert({ ...selectedAlert, notes: alertNoteText, memo: alertMemoText, reminder: alertReminderText } as CustomAlert);
                              }
                              setEditingAlertNote(false);
                            }}
                            className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                          >
                            {t("save" as any)}
                          </button>
                          <button
                            onClick={() => {
                              setEditingAlertNote(false);
                              setAlertNoteText((selectedAlert as any)?.notes || "");
                              setAlertMemoText((selectedAlert as any)?.memo || "");
                              setAlertReminderText((selectedAlert as any)?.reminder || "");
                            }}
                            className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                          >
                            {t("syncCancel" as any)}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3">
                    {editingAlert ? (
                      <>
                        <button
                          onClick={handleUpdateAlert}
                          className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                        >
                          {t("save" as any)}
                        </button>
                        <button
                          onClick={() => {
                            setEditingAlert(false);
                            setEditedAlert({ ...selectedAlert });
                          }}
                          className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          {t("syncCancel" as any)}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={handleCompleteAlert}
                          className="flex-1 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          {t("syncMarkComplete" as any)}
                        </button>
                        <button
                          onClick={handleDeleteAlert}
                          className="flex-1 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 flex items-center justify-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          {t("syncDelete" as any)}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Event Detail Modal */}
            {showEventModal && selectedEvent && (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setShowEventModal(false);
                    setEditingNote(false);
                    setSelectedEvent(null);
                  }
                }}
              >
                <div 
                  className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
                  onClick={(e) => e.stopPropagation()}
                >
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
                            <span>{selectedEvent.attendees.length} {t("syncAttendees")}</span>
                          </div>
                        )}
                        {selectedEvent.createdByAloha && (
                          <div className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                            {t("syncCreatedByAloha")}
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
                          {t("syncNotes")}
                        </label>
                        {!editingNote && (
                          <button
                            onClick={() => setEditingNote(true)}
                            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                          >
                            <Edit2 className="h-3 w-3 inline mr-1" />
                            {t("syncEdit")}
                          </button>
                        )}
                      </div>
                      {editingNote ? (
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder={t("syncAddNotesPlaceholder")}
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700 min-h-[100px]"
                        />
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60 min-h-[100px]">
                          {noteText || <span className="text-slate-400">{t("syncNoNotesAdded")}</span>}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-semibold mb-2 block">{t("syncMemo")}</label>
                      {editingNote ? (
                        <textarea
                          value={memoText}
                          onChange={(e) => setMemoText(e.target.value)}
                          placeholder={t("syncAddMemoPlaceholder")}
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700 min-h-[80px]"
                        />
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60 min-h-[80px]">
                          {memoText || <span className="text-slate-400">{t("syncNoMemo")}</span>}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-semibold mb-2 block">{t("syncReminder")}</label>
                      {editingNote ? (
                        <input
                          type="text"
                          value={reminderText}
                          onChange={(e) => setReminderText(e.target.value)}
                          placeholder={t("syncSetReminderPlaceholder")}
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                        />
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                          {reminderText || <span className="text-slate-400">{t("syncNoReminderSet")}</span>}
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
