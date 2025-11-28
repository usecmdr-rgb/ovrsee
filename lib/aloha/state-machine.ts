/**
 * Aloha Conversation State Machine
 * 
 * Tracks call state and manages transitions to ensure Aloha always knows
 * where it is in the conversation and what comes next.
 */

export type CallState =
  | "INIT"
  | "GREETING"
  | "IDENTIFICATION"
  | "PURPOSE_DELIVERY"
  | "INTERACTION"
  | "TASK_HANDLING"
  | "CLARIFICATION"
  | "EMOTIONAL_SUPPORT"
  | "ESCALATION_OR_CALLBACK"
  | "CLOSING"
  | "TERMINATED";

export type CallIntent =
  | "question_pricing"
  | "question_service"
  | "question_hours"
  | "question_location"
  | "reschedule"
  | "cancel"
  | "confirm"
  | "unsubscribe"
  | "small_talk"
  | "complaint"
  | "compliment"
  | "emergency"
  | "unclear"
  | "none";

export interface AlohaCallContext {
  // State tracking
  state: CallState;
  previousState: CallState | null;
  stateHistory: CallState[];

  // Caller information
  lastUserUtterance: string;
  lastIntent: CallIntent;
  callerName?: string;
  callerIdentified: boolean;

  // Emotional state
  isCallerAngry: boolean;
  isCallerConfused: boolean;
  isCallerBusy: boolean;
  isCallerUpset: boolean;

  // Call progress
  hasDeliveredPurpose: boolean;
  purposeDeliveredAt?: Date;
  clarificationAttempts: number;
  connectionIssuesCount: number;
  needsHumanFollowup: boolean;
  exitRequested: boolean;

  // Campaign context (for outbound)
  campaignId?: string;
  campaignPurpose?: string;

  // Call metadata
  callId?: string;
  userId: string;
  callType: "inbound" | "outbound";
  startedAt: Date;
  lastStateChangeAt: Date;
}

/**
 * State Machine Manager
 */
export class AlohaStateMachine {
  private context: AlohaCallContext;

  constructor(initialContext: Partial<AlohaCallContext>) {
    this.context = {
      state: "INIT",
      previousState: null,
      stateHistory: ["INIT"],
      lastUserUtterance: "",
      lastIntent: "none",
      callerIdentified: false,
      isCallerAngry: false,
      isCallerConfused: false,
      isCallerBusy: false,
      isCallerUpset: false,
      hasDeliveredPurpose: false,
      clarificationAttempts: 0,
      connectionIssuesCount: 0,
      needsHumanFollowup: false,
      exitRequested: false,
      callType: "inbound",
      userId: initialContext.userId || "",
      startedAt: new Date(),
      lastStateChangeAt: new Date(),
      ...initialContext,
    };
  }

  /**
   * Get current context
   */
  getContext(): AlohaCallContext {
    return { ...this.context };
  }

  /**
   * Transition to a new state
   */
  transitionTo(newState: CallState, reason?: string): void {
    if (this.context.state === newState) {
      return; // Already in this state
    }

    // Validate transition
    if (!this.isValidTransition(this.context.state, newState)) {
      console.warn(
        `Invalid state transition from ${this.context.state} to ${newState}`
      );
      return;
    }

    this.context.previousState = this.context.state;
    this.context.state = newState;
    this.context.stateHistory.push(newState);
    this.context.lastStateChangeAt = new Date();

    if (reason) {
      console.log(
        `[Aloha State] ${this.context.previousState} → ${newState}: ${reason}`
      );
    }
  }

  /**
   * Check if a transition is valid
   */
  private isValidTransition(from: CallState, to: CallState): boolean {
    // Define valid transitions
    const validTransitions: Record<CallState, CallState[]> = {
      INIT: ["GREETING", "TERMINATED"],
      GREETING: ["IDENTIFICATION", "PURPOSE_DELIVERY", "CLOSING", "TERMINATED"],
      IDENTIFICATION: [
        "PURPOSE_DELIVERY",
        "INTERACTION",
        "CLARIFICATION",
        "CLOSING",
        "TERMINATED",
      ],
      PURPOSE_DELIVERY: [
        "INTERACTION",
        "TASK_HANDLING",
        "CLARIFICATION",
        "EMOTIONAL_SUPPORT",
        "CLOSING",
        "TERMINATED",
      ],
      INTERACTION: [
        "TASK_HANDLING",
        "CLARIFICATION",
        "EMOTIONAL_SUPPORT",
        "ESCALATION_OR_CALLBACK",
        "CLOSING",
        "TERMINATED",
      ],
      TASK_HANDLING: [
        "INTERACTION",
        "CLARIFICATION",
        "ESCALATION_OR_CALLBACK",
        "CLOSING",
        "TERMINATED",
      ],
      CLARIFICATION: [
        "INTERACTION",
        "TASK_HANDLING",
        "EMOTIONAL_SUPPORT",
        "CLOSING",
        "TERMINATED",
      ],
      EMOTIONAL_SUPPORT: [
        "INTERACTION",
        "TASK_HANDLING",
        "ESCALATION_OR_CALLBACK",
        "CLOSING",
        "TERMINATED",
      ],
      ESCALATION_OR_CALLBACK: ["CLOSING", "TERMINATED"],
      CLOSING: ["TERMINATED"],
      TERMINATED: [], // Terminal state
    };

    return validTransitions[from]?.includes(to) ?? false;
  }

  /**
   * Update context based on user utterance and detected intent
   */
  updateFromInteraction(
    utterance: string,
    intent: CallIntent,
    metadata?: {
      isAngry?: boolean;
      isConfused?: boolean;
      isBusy?: boolean;
      isUpset?: boolean;
      hasConnectionIssue?: boolean;
      sttConfidence?: number;
    }
  ): void {
    this.context.lastUserUtterance = utterance;
    this.context.lastIntent = intent;

    // Update emotional state
    if (metadata?.isAngry !== undefined) {
      this.context.isCallerAngry = metadata.isAngry;
    }
    if (metadata?.isConfused !== undefined) {
      this.context.isCallerConfused = metadata.isConfused;
    }
    if (metadata?.isBusy !== undefined) {
      this.context.isCallerBusy = metadata.isBusy;
    }
    if (metadata?.isUpset !== undefined) {
      this.context.isCallerUpset = metadata.isUpset;
    }

    // Track connection issues
    if (metadata?.hasConnectionIssue) {
      this.context.connectionIssuesCount++;
    }

    // Auto-transition based on intent and state
    this.autoTransition(intent, metadata);
  }

  /**
   * Auto-transition based on intent and context
   */
  private autoTransition(
    intent: CallIntent,
    metadata?: {
      sttConfidence?: number;
      hasConnectionIssue?: boolean;
    }
  ): void {
    const currentState = this.context.state;

    // Handle exit requests
    if (intent === "unsubscribe" || this.context.exitRequested) {
      if (currentState !== "CLOSING" && currentState !== "TERMINATED") {
        this.transitionTo("CLOSING", "Exit requested");
      }
      return;
    }

    // Handle emergencies
    if (intent === "emergency") {
      this.transitionTo("CLOSING", "Emergency detected - redirecting");
      return;
    }

    // Handle low STT confidence or connection issues
    if (
      (metadata?.sttConfidence !== undefined &&
        metadata.sttConfidence < 0.5) ||
      metadata?.hasConnectionIssue
    ) {
      if (
        currentState !== "CLARIFICATION" &&
        currentState !== "CLOSING" &&
        currentState !== "TERMINATED"
      ) {
        this.context.clarificationAttempts++;
        if (this.context.clarificationAttempts < 3) {
          this.transitionTo("CLARIFICATION", "Low confidence or connection issue");
        } else {
          this.transitionTo("CLOSING", "Too many clarification attempts");
        }
      }
      return;
    }

    // Handle emotional states
    if (
      this.context.isCallerAngry ||
      this.context.isCallerUpset ||
      intent === "complaint"
    ) {
      if (
        currentState !== "EMOTIONAL_SUPPORT" &&
        currentState !== "CLOSING" &&
        currentState !== "TERMINATED"
      ) {
        this.transitionTo("EMOTIONAL_SUPPORT", "Emotional support needed");
      }
      return;
    }

    // Handle task-related intents
    if (
      intent === "reschedule" ||
      intent === "cancel" ||
      intent === "confirm"
    ) {
      if (
        currentState !== "TASK_HANDLING" &&
        currentState !== "CLOSING" &&
        currentState !== "TERMINATED"
      ) {
        this.transitionTo("TASK_HANDLING", `Task intent: ${intent}`);
      }
      return;
    }

    // Handle escalation requests
    if (this.context.needsHumanFollowup) {
      if (
        currentState !== "ESCALATION_OR_CALLBACK" &&
        currentState !== "CLOSING" &&
        currentState !== "TERMINATED"
      ) {
        this.transitionTo("ESCALATION_OR_CALLBACK", "Human follow-up needed");
      }
      return;
    }

    // Default: move to INTERACTION if we're in a state that allows it
    if (
      currentState === "PURPOSE_DELIVERY" ||
      currentState === "IDENTIFICATION"
    ) {
      if (intent !== "unclear" && intent !== "none") {
        this.transitionTo("INTERACTION", "User engaged");
      }
    }
  }

  /**
   * Mark purpose as delivered
   */
  markPurposeDelivered(): void {
    this.context.hasDeliveredPurpose = true;
    this.context.purposeDeliveredAt = new Date();
  }

  /**
   * Mark caller as identified
   */
  markCallerIdentified(name?: string): void {
    this.context.callerIdentified = true;
    if (name) {
      this.context.callerName = name;
    }
  }

  /**
   * Request exit
   */
  requestExit(): void {
    this.context.exitRequested = true;
    if (this.context.state !== "CLOSING" && this.context.state !== "TERMINATED") {
      this.transitionTo("CLOSING", "Exit requested");
    }
  }

  /**
   * Request human follow-up
   */
  requestHumanFollowup(): void {
    this.context.needsHumanFollowup = true;
  }

  /**
   * Reset clarification attempts (after successful clarification)
   */
  resetClarificationAttempts(): void {
    this.context.clarificationAttempts = 0;
  }

  /**
   * Check if we should deliver purpose
   */
  shouldDeliverPurpose(): boolean {
    return (
      !this.context.hasDeliveredPurpose &&
      (this.context.state === "PURPOSE_DELIVERY" ||
        this.context.state === "IDENTIFICATION")
    );
  }

  /**
   * Check if we should identify caller
   */
  shouldIdentifyCaller(): boolean {
    return (
      !this.context.callerIdentified &&
      (this.context.state === "IDENTIFICATION" ||
        this.context.state === "GREETING")
    );
  }

  /**
   * Check if we're in a terminal state
   */
  isTerminal(): boolean {
    return this.context.state === "TERMINATED";
  }

  /**
   * Get state-specific guidance for response generation
   */
  getStateGuidance(): string {
    const state = this.context.state;
    const guidance: Record<CallState, string> = {
      INIT: "Call is initializing. Prepare for greeting.",
      GREETING:
        "Deliver a warm greeting. Introduce yourself and ask if it's a good time.",
      IDENTIFICATION:
        "Confirm caller identity if needed. Be polite and brief.",
      PURPOSE_DELIVERY:
        "Explain why you're calling. Be clear and concise about the purpose.",
      INTERACTION:
        "Engage with the caller's needs. Answer questions, handle requests, or provide information.",
      TASK_HANDLING:
        "Focus on completing the specific task (scheduling, rescheduling, confirming, etc.).",
      CLARIFICATION:
        "Ask for clarification. Be patient and use simple language.",
      EMOTIONAL_SUPPORT:
        "Provide empathetic support. Acknowledge emotions, remain calm, and offer help.",
      ESCALATION_OR_CALLBACK:
        "Arrange for human follow-up. Confirm callback details and set expectations.",
      CLOSING:
        "Close the call politely. Thank the caller and provide a warm sign-off.",
      TERMINATED: "Call has ended. No further action needed.",
    };

    return guidance[state] || "";
  }
}

/**
 * Detect intent from user utterance
 */
export function detectIntent(utterance: string): CallIntent {
  const lower = utterance.toLowerCase();

  // Emergency (highest priority)
  if (
    lower.match(/\b(emergency|911|ambulance|police|fire|help me|urgent)\b/)
  ) {
    return "emergency";
  }

  // Unsubscribe/opt-out
  if (
    lower.match(
      /\b(remove|unsubscribe|don'?t call|stop calling|do not call|opt out|take me off)\b/
    )
  ) {
    return "unsubscribe";
  }

  // Task intents
  if (lower.match(/\b(reschedule|re-schedule|change time|move appointment)\b/)) {
    return "reschedule";
  }
  if (lower.match(/\b(cancel|cancelled|no longer need)\b/)) {
    return "cancel";
  }
  if (lower.match(/\b(confirm|confirmation|yes|sure|okay|ok)\b/)) {
    return "confirm";
  }

  // Question intents
  if (lower.match(/\b(price|pricing|cost|fee|charge|rate|how much)\b/)) {
    return "question_pricing";
  }
  if (lower.match(/\b(service|services|what do you|what can you)\b/)) {
    return "question_service";
  }
  if (lower.match(/\b(hour|hours|open|close|when|time|schedule)\b/)) {
    return "question_hours";
  }
  if (lower.match(/\b(location|where|address|city|state)\b/)) {
    return "question_location";
  }

  // Emotional intents
  if (
    lower.match(
      /\b(angry|mad|furious|terrible|awful|horrible|worst|hate|disgusted|complaint)\b/
    )
  ) {
    return "complaint";
  }
  if (lower.match(/\b(thank|thanks|appreciate|great|good|excellent|love)\b/)) {
    return "compliment";
  }

  // Small talk
  if (
    lower.match(
      /\b(how are you|how's it going|what's up|hello|hi|hey|good morning|good afternoon|good evening)\b/
    )
  ) {
    return "small_talk";
  }

  // Unclear
  if (lower.length < 3 || lower.match(/^(uh|um|hmm|er|ah)$/)) {
    return "unclear";
  }

  return "none";
}










