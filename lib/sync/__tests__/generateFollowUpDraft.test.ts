/**
 * Unit tests for generateFollowUpDraft
 * Tests follow-up draft generation with tone preferences and lead context
 */

import { generateFollowUpDraft } from "../generateFollowUpDraft";
import { getThreadContext } from "../getThreadContext";
import { getBusinessContextForUser } from "../businessInfo";
import { openai } from "@/lib/openai";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { Lead, Contact } from "../crm";

// Mock dependencies
jest.mock("../getThreadContext");
jest.mock("../businessInfo");
jest.mock("@/lib/openai");
jest.mock("@/lib/supabaseServerClient");

const mockGetThreadContext = getThreadContext as jest.MockedFunction<typeof getThreadContext>;
const mockGetBusinessContextForUser = getBusinessContextForUser as jest.MockedFunction<typeof getBusinessContextForUser>;
const mockOpenai = openai as jest.Mocked<typeof openai>;
const mockGetSupabaseServerClient = getSupabaseServerClient as jest.MockedFunction<typeof getSupabaseServerClient>;

const mockLead: Lead = {
  id: "lead-1",
  user_id: "user-1",
  contact_id: "contact-1",
  lead_stage: "qualified",
  lead_score: 70,
  budget: "5000-10000",
  timeline: "Q2 2025",
  last_activity_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockContact: Contact = {
  id: "contact-1",
  user_id: "user-1",
  email: "contact@example.com",
  name: "John Doe",
  company: "Test Company",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("generateFollowUpDraft", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    mockGetBusinessContextForUser.mockResolvedValue({
      profile: {
        business_name: "Test Business",
        description: "A test business",
      },
      services: [],
      pricingTiers: [],
      hours: [],
      faqs: [],
    } as any);

    // Mock Supabase client for user preferences
    const mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { code: "PGRST116" }, // No rows found
      }),
    };
    mockGetSupabaseServerClient.mockReturnValue(mockSupabaseClient as any);

    mockOpenai.chat = {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: "Hi John, following up on our previous conversation. Would you like to schedule a call?",
              },
            },
          ],
        }),
      },
    } as any;
  });

  it("should generate follow-up draft with basic input", async () => {
    const result = await generateFollowUpDraft({
      userId: "user-1",
      emailId: "email-1",
      lead: mockLead,
      contact: mockContact,
    });

    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
    expect(mockOpenai.chat.completions.create).toHaveBeenCalled();
  });

  it("should include thread context when threadId is provided", async () => {
    mockGetThreadContext.mockResolvedValue({
      recentMessages: [
        {
          id: "email-1",
          sender: "contact@example.com",
          senderName: "John Doe",
          to: ["user@example.com"],
          cc: [],
          subject: "Previous email",
          bodyText: "Previous message",
          sentAt: "2025-01-20T10:00:00Z",
          isFromUser: false,
        },
      ],
      totalMessages: 1,
    } as any);

    await generateFollowUpDraft({
      userId: "user-1",
      emailId: "email-2",
      threadId: "thread-1",
      lead: mockLead,
      contact: mockContact,
    });

    expect(mockGetThreadContext).toHaveBeenCalledWith("user-1", "thread-1", "email-2");
    
    const createCall = mockOpenai.chat.completions.create as jest.Mock;
    expect(createCall).toHaveBeenCalled();
    const userMessage = createCall.mock.calls[0][0].messages.find((m: any) => m.role === "user");
    expect(userMessage.content).toContain("Thread Summary");
    expect(userMessage.content).toContain("Recent Messages");
  });

  it("should include lead context in prompt", async () => {
    await generateFollowUpDraft({
      userId: "user-1",
      emailId: "email-1",
      lead: mockLead,
      contact: mockContact,
    });

    const createCall = mockOpenai.chat.completions.create as jest.Mock;
    const userMessage = createCall.mock.calls[0][0].messages.find((m: any) => m.role === "user");
    expect(userMessage.content).toContain("Lead Information");
    expect(userMessage.content).toContain("qualified");
    expect(userMessage.content).toContain("70");
    expect(userMessage.content).toContain("5000-10000");
  });

  it("should include follow-up reason when provided", async () => {
    await generateFollowUpDraft({
      userId: "user-1",
      emailId: "email-1",
      lead: mockLead,
      contact: mockContact,
      followUpReason: "No reply after 3 days",
    });

    const createCall = mockOpenai.chat.completions.create as jest.Mock;
    const userMessage = createCall.mock.calls[0][0].messages.find((m: any) => m.role === "user");
    expect(userMessage.content).toContain("Follow-up Reason");
    expect(userMessage.content).toContain("No reply after 3 days");
  });

  describe("Tone Preferences Integration", () => {
    it("should include friendly tone instructions when user preference is friendly", async () => {
      const mockSupabaseClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            tone_preset: "friendly",
            tone_custom_instructions: null,
            follow_up_intensity: "normal",
          },
          error: null,
        }),
      };
      mockGetSupabaseServerClient.mockReturnValue(mockSupabaseClient as any);

      await generateFollowUpDraft({
        userId: "user-1",
        emailId: "email-1",
        lead: mockLead,
        contact: mockContact,
      });

      const createCall = mockOpenai.chat.completions.create as jest.Mock;
      const systemMessage = createCall.mock.calls[0][0].messages.find((m: any) => m.role === "system");
      expect(systemMessage.content).toContain("TONE & STYLE");
      expect(systemMessage.content).toContain("friendly");
    });

    it("should include professional tone instructions when user preference is professional", async () => {
      const mockSupabaseClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            tone_preset: "professional",
            tone_custom_instructions: null,
            follow_up_intensity: "normal",
          },
          error: null,
        }),
      };
      mockGetSupabaseServerClient.mockReturnValue(mockSupabaseClient as any);

      await generateFollowUpDraft({
        userId: "user-1",
        emailId: "email-1",
        lead: mockLead,
        contact: mockContact,
      });

      const createCall = mockOpenai.chat.completions.create as jest.Mock;
      const systemMessage = createCall.mock.calls[0][0].messages.find((m: any) => m.role === "system");
      expect(systemMessage.content).toContain("professional");
    });

    it("should include direct tone instructions when user preference is direct", async () => {
      const mockSupabaseClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            tone_preset: "direct",
            tone_custom_instructions: null,
            follow_up_intensity: "normal",
          },
          error: null,
        }),
      };
      mockGetSupabaseServerClient.mockReturnValue(mockSupabaseClient as any);

      await generateFollowUpDraft({
        userId: "user-1",
        emailId: "email-1",
        lead: mockLead,
        contact: mockContact,
      });

      const createCall = mockOpenai.chat.completions.create as jest.Mock;
      const systemMessage = createCall.mock.calls[0][0].messages.find((m: any) => m.role === "system");
      expect(systemMessage.content).toContain("direct");
      expect(systemMessage.content).toContain("concise");
    });

    it("should include custom tone instructions when user preference is custom", async () => {
      const customInstructions = "Be very formal and use British English";
      const mockSupabaseClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            tone_preset: "custom",
            tone_custom_instructions: customInstructions,
            follow_up_intensity: "normal",
          },
          error: null,
        }),
      };
      mockGetSupabaseServerClient.mockReturnValue(mockSupabaseClient as any);

      await generateFollowUpDraft({
        userId: "user-1",
        emailId: "email-1",
        lead: mockLead,
        contact: mockContact,
      });

      const createCall = mockOpenai.chat.completions.create as jest.Mock;
      const systemMessage = createCall.mock.calls[0][0].messages.find((m: any) => m.role === "system");
      expect(systemMessage.content).toContain("Custom tone instructions");
      expect(systemMessage.content).toContain(customInstructions);
    });

    it("should include follow-up intensity instructions when provided", async () => {
      const mockSupabaseClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            tone_preset: "professional",
            tone_custom_instructions: null,
            follow_up_intensity: "strong",
          },
          error: null,
        }),
      };
      mockGetSupabaseServerClient.mockReturnValue(mockSupabaseClient as any);

      await generateFollowUpDraft({
        userId: "user-1",
        emailId: "email-1",
        lead: mockLead,
        contact: mockContact,
      });

      const createCall = mockOpenai.chat.completions.create as jest.Mock;
      const systemMessage = createCall.mock.calls[0][0].messages.find((m: any) => m.role === "system");
      expect(systemMessage.content).toContain("FOLLOW-UP INTENSITY");
      expect(systemMessage.content).toContain("strong");
      expect(systemMessage.content).toContain("proactive");
    });

    it("should include light intensity instructions when follow-up intensity is light", async () => {
      const mockSupabaseClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            tone_preset: "friendly",
            tone_custom_instructions: null,
            follow_up_intensity: "light",
          },
          error: null,
        }),
      };
      mockGetSupabaseServerClient.mockReturnValue(mockSupabaseClient as any);

      await generateFollowUpDraft({
        userId: "user-1",
        emailId: "email-1",
        lead: mockLead,
        contact: mockContact,
      });

      const createCall = mockOpenai.chat.completions.create as jest.Mock;
      const systemMessage = createCall.mock.calls[0][0].messages.find((m: any) => m.role === "system");
      expect(systemMessage.content).toContain("soft language");
      expect(systemMessage.content).toContain("gentle");
    });

    it("should handle missing user preferences gracefully", async () => {
      const mockSupabaseClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST116" }, // No rows found
        }),
      };
      mockGetSupabaseServerClient.mockReturnValue(mockSupabaseClient as any);

      const result = await generateFollowUpDraft({
        userId: "user-1",
        emailId: "email-1",
        lead: mockLead,
        contact: mockContact,
      });

      // Should still generate draft successfully
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(mockOpenai.chat.completions.create).toHaveBeenCalled();
    });
  });

  describe("Lead Stage and CTA Logic", () => {
    it("should include advanced stage CTA instructions for ready_to_close leads", async () => {
      const advancedLead: Lead = {
        ...mockLead,
        lead_stage: "ready_to_close",
        lead_score: 95,
      };

      await generateFollowUpDraft({
        userId: "user-1",
        emailId: "email-1",
        lead: advancedLead,
        contact: mockContact,
      });

      const createCall = mockOpenai.chat.completions.create as jest.Mock;
      const systemMessage = createCall.mock.calls[0][0].messages.find((m: any) => m.role === "system");
      expect(systemMessage.content).toContain("ready_to_close");
      expect(systemMessage.content).toContain("CTA STRENGTH");
    });

    it("should include early stage CTA instructions for new leads", async () => {
      const newLead: Lead = {
        ...mockLead,
        lead_stage: "new",
        lead_score: 25,
      };

      await generateFollowUpDraft({
        userId: "user-1",
        emailId: "email-1",
        lead: newLead,
        contact: mockContact,
      });

      const createCall = mockOpenai.chat.completions.create as jest.Mock;
      const systemMessage = createCall.mock.calls[0][0].messages.find((m: any) => m.role === "system");
      expect(systemMessage.content).toContain("new");
      expect(systemMessage.content).toContain("early-stage lead");
    });

    it("should combine strong intensity with advanced stage for sharp CTA", async () => {
      const mockSupabaseClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            tone_preset: "professional",
            tone_custom_instructions: null,
            follow_up_intensity: "strong",
          },
          error: null,
        }),
      };
      mockGetSupabaseServerClient.mockReturnValue(mockSupabaseClient as any);

      const advancedLead: Lead = {
        ...mockLead,
        lead_stage: "negotiating",
        lead_score: 90,
      };

      await generateFollowUpDraft({
        userId: "user-1",
        emailId: "email-1",
        lead: advancedLead,
        contact: mockContact,
      });

      const createCall = mockOpenai.chat.completions.create as jest.Mock;
      const systemMessage = createCall.mock.calls[0][0].messages.find((m: any) => m.role === "system");
      expect(systemMessage.content).toContain("sharp, sales-ready CTA");
      expect(systemMessage.content).toContain("finalize details");
    });
  });

  it("should handle errors gracefully", async () => {
    mockOpenai.chat.completions.create = jest.fn().mockRejectedValue(new Error("OpenAI API error"));

    await expect(
      generateFollowUpDraft({
        userId: "user-1",
        emailId: "email-1",
        lead: mockLead,
        contact: mockContact,
      })
    ).rejects.toThrow();
  });
});


