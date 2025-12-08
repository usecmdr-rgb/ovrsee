/**
 * Unit tests for buildAIVoiceProfile
 * Tests tone behaviors and CTA logic based on lead stage and follow-up intensity
 */

import { buildAIVoiceProfile } from "../aiVoiceProfile";
import type { VoiceProfileInput } from "../aiVoiceProfile";

describe("buildAIVoiceProfile", () => {
  describe("Tone Presets", () => {
    it("should generate friendly tone instructions", () => {
      const result = buildAIVoiceProfile({
        tonePreset: "friendly",
      });

      expect(result).toContain("warm, friendly tone");
      expect(result).toContain("approachable and conversational");
      expect(result).toContain("brief greeting");
      expect(result).toContain("soft close");
      expect(result).toContain("contractions naturally");
    });

    it("should generate professional tone instructions", () => {
      const result = buildAIVoiceProfile({
        tonePreset: "professional",
      });

      expect(result).toContain("concise, professional tone");
      expect(result).toContain("clear and direct");
      expect(result).toContain("brief greeting");
      expect(result).toContain("structured and polished");
    });

    it("should generate direct tone instructions", () => {
      const result = buildAIVoiceProfile({
        tonePreset: "direct",
      });

      expect(result).toContain("direct and concise");
      expect(result).toContain("avoid unnecessary fluff");
      expect(result).toContain("Get to the point quickly");
      expect(result).toContain("Skip greetings unless contextually necessary");
    });

    it("should use custom instructions when preset is custom", () => {
      const customInstructions = "Be very formal and use British English spelling";
      const result = buildAIVoiceProfile({
        tonePreset: "custom",
        toneCustomInstructions: customInstructions,
      });

      expect(result).toContain("Custom tone instructions");
      expect(result).toContain(customInstructions);
    });

    it("should default to professional tone when no preset is provided", () => {
      const result = buildAIVoiceProfile({});

      expect(result).toContain("concise, professional tone");
    });

    it("should not include custom instructions when preset is not custom", () => {
      const result = buildAIVoiceProfile({
        tonePreset: "friendly",
        toneCustomInstructions: "This should be ignored",
      });

      expect(result).not.toContain("This should be ignored");
      expect(result).toContain("friendly");
    });
  });

  describe("Follow-Up Intensity", () => {
    it("should generate light intensity instructions", () => {
      const result = buildAIVoiceProfile({
        followUpIntensity: "light",
      });

      expect(result).toContain("soft language");
      expect(result).toContain("only nudge after longer gaps");
      expect(result).toContain("gentle and non-pushy");
      expect(result).toContain("helpful check-ins");
    });

    it("should generate strong intensity instructions", () => {
      const result = buildAIVoiceProfile({
        followUpIntensity: "strong",
      });

      expect(result).toContain("more proactive");
      expect(result).toContain("firmer language");
      expect(result).toContain("urgency when needed");
      expect(result).toContain("stronger CTAs");
    });

    it("should generate normal intensity instructions", () => {
      const result = buildAIVoiceProfile({
        followUpIntensity: "normal",
      });

      expect(result).toContain("balanced approach");
      expect(result).toContain("helpful but not pushy");
    });

    it("should default to normal intensity when not specified", () => {
      const result = buildAIVoiceProfile({});

      expect(result).toContain("balanced approach");
    });
  });

  describe("Lead Stage Awareness", () => {
    it("should include advanced stage instructions for warm leads", () => {
      const result = buildAIVoiceProfile({
        lead: {
          stage: "warm",
          score: 75,
        },
      });

      expect(result).toContain("Lead stage: warm");
      expect(result).toContain("advanced stage");
      expect(result).toContain("sales-ready approach");
      expect(result).toContain("clear, actionable CTA");
    });

    it("should include advanced stage instructions for negotiating leads", () => {
      const result = buildAIVoiceProfile({
        lead: {
          stage: "negotiating",
          score: 85,
        },
      });

      expect(result).toContain("Lead stage: negotiating");
      expect(result).toContain("advanced stage");
      expect(result).toContain("clear, actionable CTA");
      expect(result).toContain("schedule meeting");
    });

    it("should include advanced stage instructions for ready_to_close leads", () => {
      const result = buildAIVoiceProfile({
        lead: {
          stage: "ready_to_close",
          score: 90,
        },
      });

      expect(result).toContain("Lead stage: ready_to_close");
      expect(result).toContain("advanced stage");
      expect(result).toContain("close deal");
    });

    it("should include qualified stage instructions", () => {
      const result = buildAIVoiceProfile({
        lead: {
          stage: "qualified",
          score: 65,
        },
      });

      expect(result).toContain("Lead stage: qualified");
      expect(result).toContain("qualified");
      expect(result).toContain("moving them forward");
      expect(result).toContain("moderate CTA");
    });

    it("should include early stage instructions for new leads", () => {
      const result = buildAIVoiceProfile({
        lead: {
          stage: "new",
          score: 30,
        },
      });

      expect(result).toContain("Lead stage: new");
      expect(result).toContain("early-stage lead");
      expect(result).toContain("building rapport");
      expect(result).toContain("softer CTA");
    });

    it("should include early stage instructions for cold leads", () => {
      const result = buildAIVoiceProfile({
        lead: {
          stage: "cold",
          score: 20,
        },
      });

      expect(result).toContain("Lead stage: cold");
      expect(result).toContain("early-stage lead");
    });

    it("should not include lead context when lead is not provided", () => {
      const result = buildAIVoiceProfile({});

      expect(result).not.toContain("Lead stage:");
      expect(result).not.toContain("Lead score");
    });
  });

  describe("Lead Score Awareness", () => {
    it("should include hot lead instructions for high scores (>=80)", () => {
      const result = buildAIVoiceProfile({
        lead: {
          stage: "warm",
          score: 85,
        },
      });

      expect(result).toContain("Lead score is high (hot lead)");
      expect(result).toContain("Prioritize urgency");
      expect(result).toContain("stronger CTAs");
    });

    it("should include warm lead instructions for medium scores (60-79)", () => {
      const result = buildAIVoiceProfile({
        lead: {
          stage: "qualified",
          score: 70,
        },
      });

      expect(result).toContain("Lead score is warm");
      expect(result).toContain("value-focused messaging");
    });

    it("should not include score-specific instructions for low scores (<60)", () => {
      const result = buildAIVoiceProfile({
        lead: {
          stage: "new",
          score: 40,
        },
      });

      expect(result).not.toContain("Lead score is high");
      expect(result).not.toContain("Lead score is warm");
    });
  });

  describe("Urgency Level Awareness", () => {
    it("should include high urgency instructions", () => {
      const result = buildAIVoiceProfile({
        lead: {
          stage: "warm",
          score: 85,
          urgencyLevel: "high",
        },
      });

      expect(result).toContain("High urgency detected");
      expect(result).toContain("Emphasize timely response");
    });

    it("should include medium urgency instructions", () => {
      const result = buildAIVoiceProfile({
        lead: {
          stage: "qualified",
          score: 65,
          urgencyLevel: "medium",
        },
      });

      expect(result).toContain("Moderate urgency");
      expect(result).toContain("Balance helpfulness");
    });

    it("should not include urgency instructions for low or unknown urgency", () => {
      const result = buildAIVoiceProfile({
        lead: {
          stage: "new",
          score: 30,
          urgencyLevel: "low",
        },
      });

      expect(result).not.toContain("High urgency");
      expect(result).not.toContain("Moderate urgency");
    });
  });

  describe("CTA Strength Logic", () => {
    it("should use sharp CTA for advanced stage + strong intensity", () => {
      const result = buildAIVoiceProfile({
        lead: {
          stage: "ready_to_close",
          score: 90,
        },
        followUpIntensity: "strong",
      });

      expect(result).toContain("sharp, sales-ready CTA");
      expect(result).toContain("finalize details");
      expect(result).toContain("direct about closing");
    });

    it("should use clear CTA for advanced stage + normal intensity", () => {
      const result = buildAIVoiceProfile({
        lead: {
          stage: "negotiating",
          score: 85,
        },
        followUpIntensity: "normal",
      });

      expect(result).toContain("clear, professional CTA");
      expect(result).toContain("schedule a call to discuss");
    });

    it("should use assertive CTA for early stage + strong intensity", () => {
      const result = buildAIVoiceProfile({
        lead: {
          stage: "qualified",
          score: 60,
        },
        followUpIntensity: "strong",
      });

      expect(result).toContain("more assertive CTA");
      expect(result).toContain("Let's connect this week");
    });

    it("should use standard CTA for early stage + normal/light intensity", () => {
      const result = buildAIVoiceProfile({
        lead: {
          stage: "new",
          score: 30,
        },
        followUpIntensity: "normal",
      });

      expect(result).toContain("standard, helpful CTA");
      expect(result).toContain("Feel free to reach out");
    });

    it("should use standard CTA when no lead is provided", () => {
      const result = buildAIVoiceProfile({
        followUpIntensity: "normal",
      });

      expect(result).toContain("standard, helpful CTA");
    });
  });

  describe("Business Context", () => {
    it("should include business context reminders when provided", () => {
      const businessContext = {
        profile: {
          business_name: "Test Business",
          description: "A test business",
        },
        services: [],
        pricingTiers: [],
        hours: [],
        faqs: [],
      };

      const result = buildAIVoiceProfile({
        businessContext,
      });

      expect(result).toContain("BUSINESS INFORMATION");
      expect(result).toContain("Use ONLY the pricing and services");
      expect(result).toContain("NEVER invent or guess");
    });

    it("should not include business context section when not provided", () => {
      const result = buildAIVoiceProfile({});

      expect(result).not.toContain("BUSINESS INFORMATION");
    });
  });

  describe("Email Structure Guidelines", () => {
    it("should always include structure guidelines", () => {
      const result = buildAIVoiceProfile({});

      expect(result).toContain("EMAIL STRUCTURE");
      expect(result).toContain("brief greeting");
      expect(result).toContain("context alignment");
      expect(result).toContain("bullet points");
      expect(result).toContain("clear CTA");
    });
  });

  describe("Combined Scenarios", () => {
    it("should handle friendly tone + light intensity + early stage lead", () => {
      const result = buildAIVoiceProfile({
        tonePreset: "friendly",
        followUpIntensity: "light",
        lead: {
          stage: "new",
          score: 25,
          urgencyLevel: "low",
        },
      });

      expect(result).toContain("friendly");
      expect(result).toContain("soft language");
      expect(result).toContain("early-stage lead");
      expect(result).toContain("softer CTA");
    });

    it("should handle direct tone + strong intensity + advanced stage lead", () => {
      const result = buildAIVoiceProfile({
        tonePreset: "direct",
        followUpIntensity: "strong",
        lead: {
          stage: "ready_to_close",
          score: 95,
          urgencyLevel: "high",
        },
      });

      expect(result).toContain("direct and concise");
      expect(result).toContain("firmer language");
      expect(result).toContain("advanced stage");
      expect(result).toContain("sharp, sales-ready CTA");
      expect(result).toContain("High urgency detected");
    });

    it("should handle professional tone + normal intensity + qualified lead with business context", () => {
      const businessContext = {
        profile: {
          business_name: "Test Corp",
          description: "Test description",
        },
        services: [],
        pricingTiers: [],
        hours: [],
        faqs: [],
      };

      const result = buildAIVoiceProfile({
        tonePreset: "professional",
        followUpIntensity: "normal",
        lead: {
          stage: "qualified",
          score: 70,
          urgencyLevel: "medium",
        },
        businessContext,
      });

      expect(result).toContain("professional");
      expect(result).toContain("balanced approach");
      expect(result).toContain("qualified");
      expect(result).toContain("BUSINESS INFORMATION");
      expect(result).toContain("Moderate urgency");
    });
  });
});


