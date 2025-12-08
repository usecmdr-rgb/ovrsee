/**
 * Unit tests for generateEmailDraft with thread context
 * Tests draft generation with and without thread context
 */

import { generateEmailDraft } from "../generateDraft";
import { getThreadContext } from "../getThreadContext";
import { isThreadContextForDraftsEnabled } from "../featureFlags";
import { getBusinessContext } from "@/lib/business-context";
import { openai } from "@/lib/openai";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";

// Mock dependencies
jest.mock("../getThreadContext");
jest.mock("../featureFlags");
jest.mock("@/lib/business-context");
jest.mock("@/lib/openai");
jest.mock("@/lib/supabaseServerClient");

const mockGetThreadContext = getThreadContext as jest.MockedFunction<typeof getThreadContext>;
const mockIsThreadContextEnabled = isThreadContextForDraftsEnabled as jest.MockedFunction<typeof isThreadContextForDraftsEnabled>;
const mockGetBusinessContext = getBusinessContext as jest.MockedFunction<typeof getBusinessContext>;
const mockOpenai = openai as jest.Mocked<typeof openai>;
const mockGetSupabaseServerClient = getSupabaseServerClient as jest.MockedFunction<typeof getSupabaseServerClient>;

describe("generateEmailDraft", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mocks
    mockGetBusinessContext.mockResolvedValue({
      businessName: "Test Business",
      servicesOffered: ["Service 1", "Service 2"],
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
                content: "Thank you for your email. I'll review it and get back to you soon.",
              },
            },
          ],
        }),
      },
    } as any;
  });

  it("should generate draft without thread context when feature is disabled", async () => {
    mockIsThreadContextEnabled.mockReturnValue(false);

    const result = await generateEmailDraft(
      "user-1",
      "sender@example.com",
      "Sender",
      "Test Subject",
      "Test body",
      null
    );

    expect(result.draft).toBeDefined();
    expect(mockGetThreadContext).not.toHaveBeenCalled();
    expect(mockOpenai.chat.completions.create).toHaveBeenCalled();
  });

  it("should generate draft without thread context when threadId is missing", async () => {
    mockIsThreadContextEnabled.mockReturnValue(true);

    const result = await generateEmailDraft(
      "user-1",
      "sender@example.com",
      "Sender",
      "Test Subject",
      "Test body",
      null,
      "email-1",
      undefined // No threadId
    );

    expect(result.draft).toBeDefined();
    expect(mockGetThreadContext).not.toHaveBeenCalled();
  });

  it("should include thread context when enabled and available", async () => {
    mockIsThreadContextEnabled.mockReturnValue(true);
    mockGetThreadContext.mockResolvedValue({
      recentMessages: [
        {
          id: "email-1",
          sender: "sender@example.com",
          senderName: "Sender",
          to: ["user@example.com"],
          cc: [],
          subject: "Previous email",
          bodyText: "Previous message",
          sentAt: "2025-01-20T10:00:00Z",
          isFromUser: false,
        },
      ],
      totalMessages: 1,
    });

    const result = await generateEmailDraft(
      "user-1",
      "sender@example.com",
      "Sender",
      "Test Subject",
      "Test body",
      null,
      "email-2",
      "thread-1"
    );

    expect(result.draft).toBeDefined();
    expect(mockGetThreadContext).toHaveBeenCalledWith("user-1", "thread-1", "email-2");
    
    // Verify OpenAI was called with thread context in prompt
    const createCall = mockOpenai.chat.completions.create as jest.Mock;
    expect(createCall).toHaveBeenCalled();
    const userMessage = createCall.mock.calls[0][0].messages.find((m: any) => m.role === "user");
    expect(userMessage.content).toContain("THREAD CONTEXT");
    expect(userMessage.content).toContain("Previous email");
  });

  it("should include thread summary for long threads", async () => {
    mockIsThreadContextEnabled.mockReturnValue(true);
    mockGetThreadContext.mockResolvedValue({
      threadSummary: "Previous conversation about project timeline and deliverables",
      recentMessages: [
        {
          id: "email-10",
          sender: "sender@example.com",
          to: ["user@example.com"],
          cc: [],
          subject: "Latest email",
          bodyText: "Latest message",
          sentAt: "2025-01-20T20:00:00Z",
          isFromUser: false,
        },
      ],
      totalMessages: 15,
    });

    const result = await generateEmailDraft(
      "user-1",
      "sender@example.com",
      "Sender",
      "Test Subject",
      "Test body",
      null,
      "email-11",
      "thread-1"
    );

    expect(result.draft).toBeDefined();
    const createCall = mockOpenai.chat.completions.create as jest.Mock;
    const userMessage = createCall.mock.calls[0][0].messages.find((m: any) => m.role === "user");
    expect(userMessage.content).toContain("Previous conversation");
    expect(userMessage.content).toContain("project timeline");
  });

  it("should include intent metadata (appointments, tasks) in prompt", async () => {
    mockIsThreadContextEnabled.mockReturnValue(true);
    mockGetThreadContext.mockResolvedValue({
      recentMessages: [],
      intentMetadata: {
        appointments: [
          {
            id: "apt-1",
            title: "Team Meeting",
            appointment_date: "2025-01-25",
            appointment_time: "14:00",
            location: "Office",
            status: "detected",
          },
        ],
        tasks: [
          {
            id: "task-1",
            description: "Review proposal",
            due_date: "2025-01-30",
            priority: "high",
            status: "open",
          },
        ],
      },
      totalMessages: 1,
    });

    const result = await generateEmailDraft(
      "user-1",
      "sender@example.com",
      "Sender",
      "Test Subject",
      "Test body",
      null,
      "email-2",
      "thread-1"
    );

    expect(result.draft).toBeDefined();
    const createCall = mockOpenai.chat.completions.create as jest.Mock;
    const userMessage = createCall.mock.calls[0][0].messages.find((m: any) => m.role === "user");
    expect(userMessage.content).toContain("Appointments mentioned");
    expect(userMessage.content).toContain("Team Meeting");
    expect(userMessage.content).toContain("Tasks/action items");
    expect(userMessage.content).toContain("Review proposal");
  });

  it("should fall back gracefully when thread context fetch fails", async () => {
    mockIsThreadContextEnabled.mockReturnValue(true);
    mockGetThreadContext.mockRejectedValue(new Error("Database error"));

    const result = await generateEmailDraft(
      "user-1",
      "sender@example.com",
      "Sender",
      "Test Subject",
      "Test body",
      null,
      "email-2",
      "thread-1"
    );

    // Should still generate draft without thread context
    expect(result.draft).toBeDefined();
    expect(mockOpenai.chat.completions.create).toHaveBeenCalled();
  });

  it("should use thread-aware system prompt when context is available", async () => {
    mockIsThreadContextEnabled.mockReturnValue(true);
    mockGetThreadContext.mockResolvedValue({
      recentMessages: [
        {
          id: "email-1",
          sender: "sender@example.com",
          to: ["user@example.com"],
          cc: [],
          subject: "Previous",
          bodyText: "Previous message",
          sentAt: "2025-01-20T10:00:00Z",
          isFromUser: false,
        },
      ],
      totalMessages: 1,
    });

    await generateEmailDraft(
      "user-1",
      "sender@example.com",
      "Sender",
      "Test Subject",
      "Test body",
      null,
      "email-2",
      "thread-1"
    );

    const createCall = mockOpenai.chat.completions.create as jest.Mock;
    const systemMessage = createCall.mock.calls[0][0].messages.find((m: any) => m.role === "system");
    expect(systemMessage.content).toContain("THREAD CONTEXT AWARENESS");
    expect(systemMessage.content).toContain("previous commitments");
  });

  it("should use base system prompt when no thread context", async () => {
    mockIsThreadContextEnabled.mockReturnValue(false);

    await generateEmailDraft(
      "user-1",
      "sender@example.com",
      "Sender",
      "Test Subject",
      "Test body",
      null
    );

    const createCall = mockOpenai.chat.completions.create as jest.Mock;
    const systemMessage = createCall.mock.calls[0][0].messages.find((m: any) => m.role === "system");
    expect(systemMessage.content).not.toContain("THREAD CONTEXT AWARENESS");
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

      await generateEmailDraft(
        "user-1",
        "sender@example.com",
        "Sender",
        "Test Subject",
        "Test body",
        null
      );

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

      await generateEmailDraft(
        "user-1",
        "sender@example.com",
        "Sender",
        "Test Subject",
        "Test body",
        null
      );

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

      await generateEmailDraft(
        "user-1",
        "sender@example.com",
        "Sender",
        "Test Subject",
        "Test body",
        null
      );

      const createCall = mockOpenai.chat.completions.create as jest.Mock;
      const systemMessage = createCall.mock.calls[0][0].messages.find((m: any) => m.role === "system");
      expect(systemMessage.content).toContain("direct");
      expect(systemMessage.content).toContain("concise");
    });

    it("should include custom tone instructions when user preference is custom", async () => {
      const customInstructions = "Use formal British English and be very polite";
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

      await generateEmailDraft(
        "user-1",
        "sender@example.com",
        "Sender",
        "Test Subject",
        "Test body",
        null
      );

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

      await generateEmailDraft(
        "user-1",
        "sender@example.com",
        "Sender",
        "Test Subject",
        "Test body",
        null
      );

      const createCall = mockOpenai.chat.completions.create as jest.Mock;
      const systemMessage = createCall.mock.calls[0][0].messages.find((m: any) => m.role === "system");
      expect(systemMessage.content).toContain("FOLLOW-UP INTENSITY");
      expect(systemMessage.content).toContain("strong");
      expect(systemMessage.content).toContain("proactive");
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

      const result = await generateEmailDraft(
        "user-1",
        "sender@example.com",
        "Sender",
        "Test Subject",
        "Test body",
        null
      );

      // Should still generate draft successfully
      expect(result.draft).toBeDefined();
      expect(mockOpenai.chat.completions.create).toHaveBeenCalled();
    });

    it("should include lead-aware CTA instructions when lead info is available", async () => {
      const mockSupabaseClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({
            data: {
              tone_preset: "professional",
              tone_custom_instructions: null,
              follow_up_intensity: "normal",
            },
            error: null,
          })
          .mockResolvedValueOnce({
            data: { id: "contact-1" },
            error: null,
          })
          .mockResolvedValueOnce({
            data: {
              lead_stage: "ready_to_close",
              lead_score: 90,
            },
            error: null,
          }),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: "contact-1" },
          error: null,
        }),
      };
      mockGetSupabaseServerClient.mockReturnValue(mockSupabaseClient as any);

      await generateEmailDraft(
        "user-1",
        "sender@example.com",
        "Sender",
        "Test Subject",
        "Test body",
        null
      );

      const createCall = mockOpenai.chat.completions.create as jest.Mock;
      const systemMessage = createCall.mock.calls[0][0].messages.find((m: any) => m.role === "system");
      expect(systemMessage.content).toContain("CTA STRENGTH");
      expect(systemMessage.content).toContain("ready_to_close");
    });
  });
});

