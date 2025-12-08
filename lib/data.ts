import { AgentInfo, AlertCategory, BusinessInfo, CallRecord, EmailRecord, MediaItem } from "@/types";

export const agents: AgentInfo[] = [
  {
    key: "sync",
    name: "Sync",
    role: "Email & Calendar",
    description: "Drafts replies, prioritizes inboxes, and syncs schedules",
    price: 25,
    accent: "bg-orange-500",
  },
  {
    key: "aloha",
    name: "Aloha",
    role: "Voice & Call Assistant",
    description: "Answers calls, books appointments, and keeps calendars tidy",
    price: 25,
    accent: "bg-red-500",
  },
  {
    key: "studio",
    name: "Studio",
    role: "Media & Branding",
    description: "Edits images and videos, and provides social media performance insights",
    price: 25,
    accent: "bg-violet-500",
  },
  {
    key: "insight",
    name: "Insight",
    role: "Business Insights",
    description: "Rolls up every signal into clean, actionable insight",
    price: 25,
    accent: "bg-emerald-500",
  },
];

export const defaultBusinessInfo: BusinessInfo = {
  fullName: "",
  businessName: "",
  businessType: "",
  location: "",
  operatingHours: "",
  serviceName: "",
  services: "",
  website: "",
  contactEmail: "",
  contactPhone: "",
  language: "English",
  timezone: "EST",
  notes: "",
};

export const defaultAlertCategories: AlertCategory[] = [
  { id: "important", name: "Important", color: "#ef4444", defaultColor: "#ef4444", count: 6 },
  { id: "missed", name: "Missed / Unread", color: "#fb923c", defaultColor: "#fb923c", count: 4 },
  { id: "payments", name: "Payments / Bills", color: "#22c55e", defaultColor: "#22c55e", count: 3 },
  { id: "invoices", name: "Invoices", color: "#a855f7", defaultColor: "#a855f7", count: 2 },
  { id: "meetings", name: "Upcoming meetings", color: "#3b82f6", defaultColor: "#3b82f6", count: 5 },
  { id: "subscriptions", name: "Subscriptions", color: "#94a3b8", defaultColor: "#94a3b8", count: 8 },
];

export const mockCalls: CallRecord[] = [
  {
    id: "call-1",
    caller: "Maria Gomez",
    time: "09:15 AM",
    outcome: "answered",
    summary: "Requested follow-up demo and rescheduled for Friday.",
    appointmentLink: "https://calendar.google.com/demo",
    transcript: "Maria asked about onboarding timeline and next availability.",
    contact: "maria@example.com - +1 (415) 555-0132",
    followUp: "Send recap email with pricing deck.",
  },
  {
    id: "call-2",
    caller: "Greenline HVAC",
    time: "10:42 AM",
    outcome: "missed",
    summary: "Voicemail requesting urgent callback on billing error.",
    transcript: "Caller described a misapplied payment and asked for update.",
    contact: "support@greenline.com",
    followUp: "Assigned to finance queue.",
  },
  {
    id: "call-3",
    caller: "Alex Chen",
    time: "12:03 PM",
    outcome: "answered",
    summary: "Booked onboarding session for next Tuesday.",
    appointmentLink: "https://calendar.google.com/onboarding",
    transcript: "Aloha confirmed contact details and created new calendar event.",
    contact: "alex@acdesign.co",
    followUp: "Share prep checklist one day before.",
  },
];

export const mockEmails: EmailRecord[] = [
  {
    id: "email-1",
    sender: "Stripe Billing",
    subject: "Your payout is ready",
    timestamp: "Today, 8:05 AM",
    categoryId: "payments",
    status: "drafted",
    snippet: "Quick heads up that your ACH payout will settle...",
    draft: "Hi team, just confirming the payout schedule--looks good!",
  },
  {
    id: "email-2",
    sender: "Nadia - GrowthOps",
    subject: "Need a faster turn on proposal",
    timestamp: "Today, 9:48 AM",
    categoryId: "important",
    status: "needs_reply",
    snippet: "Can we tighten the proposal timeline?",
    draft: "Hi Nadia, Aloha confirmed we can share the updated proposal by tomorrow...",
  },
  {
    id: "email-3",
    sender: "ZenPayroll",
    subject: "Invoice ready",
    timestamp: "Yesterday, 4:17 PM",
    categoryId: "invoices",
    status: "archived",
    snippet: "Your invoice for March is ready...",
    draft: "",
  },
  {
    id: "email-4",
    sender: "Reminder Bot",
    subject: "Quarterly subscription roundup",
    timestamp: "Yesterday, 1:10 PM",
    categoryId: "subscriptions",
    status: "drafted",
    snippet: "Here is what renewed automatically...",
    draft: "Thanks! Logging these into Notion now.",
  },
];

export const mockMediaItems: MediaItem[] = [
  {
    id: "media-1",
    filename: "spring-campaign.png",
    type: "image",
    updatedAt: "Today, 11:10 AM",
    previewUrl: "https://placehold.co/200x140/png",
    impressions: 12500,
    likes: 342,
    reposts: 89,
    comments: 56,
    postedTo: [
      {
        platform: "instagram",
        postId: "ig_123456789",
        postedAt: "2024-01-15T10:30:00Z",
      },
      {
        platform: "facebook",
        postId: "fb_987654321",
        postedAt: "2024-01-15T11:00:00Z",
      },
    ],
    metricsLastUpdated: "2024-01-15T12:00:00Z",
  },
  {
    id: "media-2",
    filename: "testimonial-reel.mp4",
    type: "video",
    updatedAt: "Yesterday, 5:45 PM",
    previewUrl: "https://placehold.co/200x140/mp4",
    impressions: 18900,
    likes: 521,
    reposts: 134,
    comments: 78,
    postedTo: [
      {
        platform: "tiktok",
        postId: "tt_456789123",
        postedAt: "2024-01-14T17:45:00Z",
      },
      {
        platform: "instagram",
        postId: "ig_789123456",
        postedAt: "2024-01-14T18:00:00Z",
      },
    ],
    metricsLastUpdated: "2024-01-14T19:00:00Z",
  },
];
