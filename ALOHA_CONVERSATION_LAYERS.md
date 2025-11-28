# Aloha Conversation Layers System

## Overview

Aloha now includes three new layers that work together to create more natural, consistent, and context-aware conversations:

1. **Conversation State Machine** - Tracks where Aloha is in the call
2. **Tone Preset System** - Shapes HOW Aloha speaks
3. **Personality Micro-Rules** - Ensures consistent, human-like behavior

These layers are integrated on top of existing Aloha features (campaigns, scenario detection, barge-in, etc.) without breaking any existing functionality.

## Architecture

### Layer 1: Conversation State Machine

**File:** `lib/aloha/state-machine.ts`

**Purpose:** Tracks call state and manages transitions to ensure Aloha always knows where it is in the conversation.

**States:**
- `INIT` - Call initializing
- `GREETING` - Delivering greeting
- `IDENTIFICATION` - Confirming caller identity
- `PURPOSE_DELIVERY` - Explaining why calling (outbound)
- `INTERACTION` - Main conversation flow
- `TASK_HANDLING` - Handling specific tasks (scheduling, etc.)
- `CLARIFICATION` - Asking for clarification
- `EMOTIONAL_SUPPORT` - Providing emotional support
- `ESCALATION_OR_CALLBACK` - Arranging human follow-up
- `CLOSING` - Closing the call
- `TERMINATED` - Call ended

**Context Tracking:**
- Current state and state history
- Last user utterance and detected intent
- Caller emotional state (angry, confused, busy, upset)
- Call progress (purpose delivered, clarification attempts, etc.)
- Campaign context (for outbound calls)

**Key Features:**
- Automatic state transitions based on intent and context
- Validates transitions to prevent invalid state changes
- Provides state-specific guidance for response generation
- Tracks call progress to avoid repeating greetings/purpose

**Usage:**
```typescript
import { AlohaStateMachine, detectIntent } from "@/lib/aloha/state-machine";

const stateMachine = new AlohaStateMachine({
  userId: "user-123",
  callType: "outbound",
  campaignPurpose: "feedback_satisfaction",
});

// Detect intent from user utterance
const intent = detectIntent("I'd like to reschedule my appointment");

// Update state machine
stateMachine.updateFromInteraction("I'd like to reschedule", intent, {
  isBusy: false,
  sttConfidence: 0.9,
});

// Get current state
const state = stateMachine.getState(); // "TASK_HANDLING"

// Get state guidance
const guidance = stateMachine.getStateGuidance();
```

### Layer 2: Tone Preset System

**File:** `lib/aloha/tone-presets.ts`

**Purpose:** Modifies HOW Aloha speaks (style, not content) to match different conversational contexts.

**Tone Presets:**
- **friendly** - Warm, approachable, conversational
- **professional** - Formal, polished, business-appropriate
- **empathetic** - Gentle, understanding, supportive
- **energetic** - Upbeat, enthusiastic, positive

**Each Preset Includes:**
- `speakingRate` - slow | medium | fast
- `pitch` - low | normal | high
- `allowDisfluencies` - Whether to use filler words
- `disfluencyFrequency` - How often to use fillers
- `fillerWords` - List of filler words to use
- `confirmPhrases` - Confirmation phrases
- `softeners` - Softening phrases
- `preferShortSentences` - Whether to prefer shorter sentences
- `maxSentenceLength` - Maximum sentence length
- `useContractions` - Whether to use contractions

**Usage:**
```typescript
import { getTonePreset, applyTonePreset } from "@/lib/aloha/tone-presets";

// Get tone preset
const preset = getTonePreset("empathetic");

// Apply tone to response
const baseResponse = "I understand your concern. Let me help you with that.";
const toneEnhanced = applyTonePreset(baseResponse, preset, {
  isClarification: false,
  isClosing: false,
});

// Result: "I'm really sorry you're dealing with this. I understand your concern. Let me help you with that."
```

**TTS Integration:**
```typescript
import { getTTSSettingsFromPreset } from "@/lib/aloha/tone-presets";

const ttsSettings = getTTSSettingsFromPreset(preset);
// Returns: { rate: 0.85, pitch: -2 } for empathetic preset
// Use these settings with your TTS provider
```

### Layer 3: Personality Micro-Rules

**File:** `lib/aloha/personality-rules.ts`

**Purpose:** Always-on behavioral rules that ensure Aloha remains consistent, calm, and human-like.

**Rules:**
1. **Always calm and polite** - Removes aggressive language, ensures neutral/kind tone
2. **Honest about limitations** - Ensures Aloha acknowledges when it doesn't know something
3. **Short over long** - Compresses overly long responses
4. **One step at a time** - Avoids asking multiple complex questions
5. **Periodic purpose reminder** - Reminds caller of purpose in longer calls
6. **Never pretend to be human** - Ensures AI identity is clear if challenged
7. **Respect caller boundaries** - Handles exit requests and human follow-up requests
8. **Clean closing** - Ensures proper sign-off in CLOSING state

**Usage:**
```typescript
import { applyPersonalityRules } from "@/lib/aloha/personality-rules";

const personalityContext = {
  state: "INTERACTION",
  tonePreset: getTonePreset("friendly"),
  callContext: stateMachine.getContext(),
  isFirstResponse: false,
  isClosing: false,
  isClarification: false,
  callerName: "John",
  businessName: "Acme Corp",
};

const finalResponse = applyPersonalityRules(toneEnhanced, personalityContext);
```

## Integration

### Enhanced Call Handler

**File:** `lib/aloha/enhanced-call-handler.ts`

The enhanced call handler integrates all three layers:

```typescript
import { EnhancedAlohaCallHandler } from "@/lib/aloha/enhanced-call-handler";

// Initialize handler
const handler = new EnhancedAlohaCallHandler({
  userId: "user-123",
  callId: "call-456",
  callType: "outbound",
  campaignId: "campaign-789",
  campaignPurpose: "feedback_satisfaction",
  tonePreset: "empathetic", // Optional, defaults to "friendly"
});

await handler.initialize();

// Process call turn
const result = await handler.processCallTurn(
  {
    sttText: "I'm really frustrated with the service",
    sttConfidence: 0.9,
    audioQuality: 0.8,
  },
  async (text, context) => {
    // Your LLM generator function
    return await generateLLMResponse(text, context);
  }
);

// Result includes:
// - response: Final processed response
// - state: Current call state
// - shouldExit: Whether to end call
// - shouldStopTTS: Whether to stop TTS (barge-in)
// - ttsSettings: Rate and pitch for TTS
// - context: Full call context
```

### Integration with Existing Features

#### 1. Campaign Scripts

The state machine works with campaign scripts:
- `PURPOSE_DELIVERY` state uses campaign purpose
- Campaign tone can override default tone preset
- Extra instructions are respected in all states

#### 2. Scenario Detection

Scenario detection integrates seamlessly:
- Audio issues trigger `CLARIFICATION` state
- Emotional scenarios trigger `EMOTIONAL_SUPPORT` state
- Emergency scenarios trigger immediate `CLOSING`
- Opt-out requests trigger `CLOSING` with proper handling

#### 3. Barge-in Interruption

State machine tracks interruptions:
- Interruptions detected via intent detection
- `shouldStopTTS` flag indicates when to stop TTS
- State machine continues tracking even during interruptions

#### 4. Knowledge Gap Logging

Personality rules ensure knowledge gaps are handled:
- Rule 2 (Honest about limitations) ensures gaps are acknowledged
- Follow-up is always offered
- Knowledge gaps are logged appropriately

#### 5. Time Windows

State machine respects time windows:
- Outside-hours calls can be detected and handled
- Callback offers are made appropriately
- State transitions account for business hours

## State Transition Flow

### Typical Outbound Call Flow:

```
INIT → GREETING → IDENTIFICATION → PURPOSE_DELIVERY → INTERACTION
                                                           ↓
                                    ┌──────────────────────┼──────────────────────┐
                                    ↓                      ↓                      ↓
                            TASK_HANDLING        CLARIFICATION      EMOTIONAL_SUPPORT
                                    ↓                      ↓                      ↓
                                    └──────────────────────┼──────────────────────┘
                                                           ↓
                                              ESCALATION_OR_CALLBACK
                                                           ↓
                                                      CLOSING
                                                           ↓
                                                    TERMINATED
```

### Typical Inbound Call Flow:

```
INIT → GREETING → IDENTIFICATION → INTERACTION
                                         ↓
                          ┌──────────────┼──────────────┐
                          ↓              ↓              ↓
                    TASK_HANDLING  CLARIFICATION  EMOTIONAL_SUPPORT
                          ↓              ↓              ↓
                          └──────────────┼──────────────┘
                                         ↓
                              ESCALATION_OR_CALLBACK
                                         ↓
                                    CLOSING
                                         ↓
                                  TERMINATED
```

## Response Processing Pipeline

Every response goes through this pipeline:

1. **Intent Detection** - Detect intent from user utterance
2. **Scenario Detection** - Detect audio/emotional/business scenarios
3. **State Update** - Update state machine based on intent and scenario
4. **LLM Generation** - Generate base response with state guidance
5. **Tone Application** - Apply tone preset (fillers, softeners, confirmations)
6. **Personality Rules** - Apply personality micro-rules
7. **TTS Generation** - Generate audio with tone-based settings

## Configuration

### Setting Tone Preset

Tone preset can be set:
1. Per campaign (in campaign settings)
2. Per Aloha profile (user preference)
3. Per call (via handler options)
4. Default: "friendly"

### State Machine Customization

State transitions can be customized by:
- Modifying `autoTransition()` logic
- Adding custom state validation
- Extending context tracking

### Personality Rules Customization

Personality rules can be adjusted by:
- Modifying rule functions in `personality-rules.ts`
- Adding new rules
- Adjusting rule priorities

## Examples

### Example 1: Friendly Tone with Emotional Support

```typescript
// User: "I'm really upset about this!"
// State: INTERACTION → EMOTIONAL_SUPPORT
// Tone: empathetic
// Intent: complaint

// Base LLM response: "I understand your concern. Let me help you."
// After tone: "I'm really sorry you're dealing with this. I understand your concern. Let me help you."
// After personality: "I'm really sorry you're dealing with this. I understand your concern. Let me help you. I'm here to help."
```

### Example 2: Professional Tone with Task Handling

```typescript
// User: "I need to reschedule my appointment"
// State: INTERACTION → TASK_HANDLING
// Tone: professional
// Intent: reschedule

// Base LLM response: "I can help you reschedule. What time works for you?"
// After tone: "I understand. I can help you reschedule. What time works for you?"
// After personality: "I understand. I can help you reschedule. What time works for you?"
```

### Example 3: Energetic Tone with Purpose Delivery

```typescript
// User: "Hello?"
// State: PURPOSE_DELIVERY
// Tone: energetic
// Intent: small_talk

// Base LLM response: "Hi! I'm calling to get your feedback on our service."
// After tone: "Hi! Awesome, I'm calling to get your feedback on our service. Sounds great?"
// After personality: "Hi! I'm calling to get your feedback on our service."
```

## Testing

To test the conversation layers:

1. **State Machine**: Test state transitions with different intents
2. **Tone Presets**: Test each tone preset with sample responses
3. **Personality Rules**: Test rules with various response types
4. **Integration**: Test full pipeline with real call scenarios

## Future Enhancements

Potential improvements:
1. **Machine learning** for intent detection
2. **Adaptive tone** based on caller behavior
3. **Custom state transitions** per campaign
4. **Voice emotion detection** for better emotional support
5. **Multi-language support** for tone presets








