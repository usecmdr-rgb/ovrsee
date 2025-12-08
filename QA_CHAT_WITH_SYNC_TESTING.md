# Chat with Sync - QA Testing Checklist

## Test Scenarios

### Scenario 1: New Inbound Lead (Pricing + Demo Request)

**Email Context:**
- New lead asking for pricing and demo
- Lead stage: "new"
- Lead score: 45-60 (warm)

**Test Questions:**
1. ✅ **"Summarize this in 2 sentences."**
   - Expected: `type: "answer"`
   - Should reference the customer's request for pricing/demo
   - Should be concise (2 sentences)

2. ✅ **"Is this a hot lead?"**
   - Expected: `type: "answer"`
   - Should reference lead score and stage
   - Should provide assessment based on context

3. ✅ **"How should I respond if I don't want to discount yet?"**
   - Expected: `type: "answer"`
   - Should provide strategic advice
   - Should reference business pricing from context
   - Should NOT suggest discounts unless explicitly in business info

4. ✅ **"Rewrite the draft to sound more friendly and suggest 2 time slots."**
   - Expected: `type: "draft_update"`
   - Should make tone friendlier (if tone preset allows)
   - Should add 2 time slots from available slots
   - Should explain what changed in the message

---

### Scenario 2: Existing Client Upset / Complaint

**Email Context:**
- Existing client with complaint
- Lead stage: "warm" or "negotiating"
- Lead score: 70+

**Test Questions:**
1. ✅ **"What's their main concern?"**
   - Expected: `type: "answer"`
   - Should reference the last customer message
   - Should identify the core issue

2. ✅ **"How would you respond to de-escalate but still hold boundaries?"**
   - Expected: `type: "answer"`
   - Should provide strategic advice
   - Should balance empathy with firmness
   - Should reference business policies if available

3. ✅ **"Rewrite my draft but keep it firm and professional."**
   - Expected: `type: "draft_update"`
   - Should maintain professional tone
   - Should keep firm boundaries
   - Should explain changes made

---

### Scenario 3: Warm Lead Gone Quiet

**Email Context:**
- Warm lead, no activity for 7+ days
- Lead stage: "warm" or "qualified"
- Lead score: 60-75

**Test Questions:**
1. ✅ **"What's the best follow-up angle here?"**
   - Expected: `type: "answer"`
   - Should reference lead stage and score
   - Should suggest appropriate follow-up strategy
   - Should consider last activity date

2. ✅ **"Make my draft more direct and add a strong CTA for a call."**
   - Expected: `type: "draft_update"`
   - Should make tone more direct
   - Should add clear call-to-action
   - Should explain changes

---

### Scenario 4: Scheduling / Time-Based Email

**Email Context:**
- Customer asking for meeting time
- Business hours configured
- Calendar availability set

**Test Questions:**
1. ✅ **"Suggest 3 time slots that work based on my availability and business hours."**
   - Expected: `type: "answer"` or `type: "draft_update"` (if draft exists)
   - Should fetch available time slots via `getAvailableTimeSlots()`
   - Should only suggest times within business hours
   - Should respect calendar conflicts
   - Should format times clearly with timezone

**Verification:**
- ✅ Time slots match business hours configuration
- ✅ Time slots don't conflict with existing appointments
- ✅ Times are formatted correctly (date, time, timezone)

---

## General Quality Checks

### Tone Matching
- ✅ Chat responses match user's tone preset (friendly/professional/direct/custom)
- ✅ Draft updates use the same tone profile
- ✅ Tone is consistent across conversation

### Factual Accuracy
- ✅ No hallucinated prices, dates, or services
- ✅ Only uses information from provided context
- ✅ Business info (pricing, services) is accurate
- ✅ Dates/times are realistic and match availability

### Response Quality
- ✅ Explanations are specific ("I shortened the intro, made it friendlier, and added two time slots")
- ✅ Context is referenced explicitly ("In the last message, the customer asked about...")
- ✅ Lead information is used appropriately ("This lead is in stage 'warm' with a score of 72/100")
- ✅ Suggestions are actionable and relevant

### Error Handling
- ✅ Vague requests trigger clarification with 2-3 options
- ✅ Missing context is handled gracefully
- ✅ Errors are caught and reported clearly

---

## Implementation Status

### ✅ Completed Features
- Context gathering (thread, lead, business, appointments, tasks)
- Tone matching for chat and drafts
- Agent awareness (references context explicitly)
- Draft editing with explanations
- Clarification handling
- Time slot fetching for scheduling requests
- Business hours awareness

### ⚠️ Areas to Monitor
- Time slot accuracy (verify against actual calendar)
- Tone consistency across long conversations
- Price/service accuracy (ensure no hallucination)
- Scheduling logic (business hours + calendar conflicts)

---

## Testing Commands

To test each scenario, use the Chat with Sync interface and ask the questions listed above. Verify:

1. Response type is correct (`answer`, `draft_update`, or `clarification`)
2. Content is accurate and context-aware
3. Tone matches user preferences
4. Explanations are clear and specific
5. No fabricated information

