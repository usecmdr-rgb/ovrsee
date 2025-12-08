# Email Send UX Analysis - Accept Draft → Send Email Flow

## Current State
- User sees draft preview in sidebar
- "Accept draft" button exists but is non-functional
- Need to implement: Accept → Review → Send flow

---

## Recommended Approach: **Two-Step Modal Flow**

### Option 1: Compose/Send Modal (RECOMMENDED) ⭐

**Flow:**
1. User clicks "Accept draft"
2. Modal opens showing full email composition view
3. User reviews and can make final edits
4. User clicks "Send Email" button
5. Email is sent via Gmail API

**Why This Is Best:**
- ✅ **Full context**: User sees complete email (To, Subject, Body)
- ✅ **Final review**: Can catch mistakes before sending
- ✅ **Last-minute edits**: Can tweak draft if needed
- ✅ **Clear intent**: "Send Email" button makes action obvious
- ✅ **Safety**: Cancel button to abort
- ✅ **Familiar pattern**: Matches Gmail, Outlook, Apple Mail
- ✅ **Professional**: Shows you care about email accuracy

**UI Structure:**
```
┌─────────────────────────────────────────┐
│  Send Email                    [X]      │
├─────────────────────────────────────────┤
│                                         │
│  To: [recipient email]                  │
│  Subject: Re: [original subject]       │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ [Editable draft text area]      │   │
│  │                                 │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Cancel]          [Send Email →]      │
└─────────────────────────────────────────┘
```

**Visual Design:**
- Modal overlay (dark backdrop)
- Centered, max-width ~600px
- Clear "Send Email" button (primary action, emerald/green)
- Cancel button (secondary, outlined)
- Editable textarea for body
- Read-only fields for To/Subject (or editable if needed)

---

### Option 2: Confirmation Dialog (Simpler, Less Control)

**Flow:**
1. User clicks "Accept draft"
2. Confirmation dialog: "Send email to [recipient]?"
3. User clicks "Yes, Send" or "Cancel"
4. Email sent immediately

**Pros:**
- ✅ Faster (one less step)
- ✅ Simpler implementation

**Cons:**
- ❌ No final review of full email
- ❌ Can't make last-minute edits
- ❌ Less professional
- ❌ Higher risk of sending mistakes

**Not Recommended** - Too risky for email sending

---

### Option 3: Inline Expansion (Alternative)

**Flow:**
1. User clicks "Accept draft"
2. Draft preview expands in place to show full email
3. "Send Email" button appears below
4. User reviews and sends

**Pros:**
- ✅ No modal overhead
- ✅ Stays in context

**Cons:**
- ❌ Less prominent (easy to miss)
- ❌ Limited space for full email view
- ❌ Less clear that this will send email

**Not Recommended** - Not clear enough that action sends email

---

## Recommended Implementation Details

### Modal Component Structure

```tsx
<SendEmailModal
  open={showSendModal}
  onClose={() => setShowSendModal(false)}
  email={{
    to: selectedEmail.from_address,
    subject: `Re: ${selectedEmail.subject}`,
    body: getEmailDraft(selectedEmail),
    threadId: selectedEmail.gmail_thread_id
  }}
  onSend={handleSendEmail}
/>
```

### Modal Content Sections

1. **Header**
   - Title: "Send Email" or "Review & Send"
   - Close button (X)
   - Optional: Warning icon or "This will send the email" text

2. **Email Fields**
   - **To:** Read-only (from original email's `from_address`)
   - **Subject:** 
     - Pre-filled with "Re: [original subject]"
     - Editable (user might want to change it)
   - **Body:**
     - Pre-filled with draft text
     - Fully editable textarea
     - Min height: 200px, max height: 400px (scrollable)

3. **Action Buttons**
   - **Cancel** (left): Closes modal, discards
   - **Send Email** (right, primary): 
     - Prominent button (emerald/green)
     - Shows loading state while sending
     - Disabled if body is empty

### Visual Indicators

**Before Send:**
- Clear "Send Email" button label
- Optional: Small text "This will send the email to [recipient]"
- Optional: Warning icon or info badge

**During Send:**
- Button shows spinner + "Sending..."
- Button disabled
- Modal can't be closed (or shows "Sending, please wait...")

**After Send:**
- Success message: "Email sent successfully!"
- Auto-close modal after 1-2 seconds
- Update email status in queue (mark as "sent" or "replied")

### Error Handling

- Show error message in modal if send fails
- Keep modal open so user can retry
- Don't lose draft content on error

---

## Alternative: Enhanced Single-Step with Preview

If you want to avoid a modal, you could:

1. Click "Accept draft" → Button changes to "Send Email"
2. Draft preview expands to show full email
3. Clear warning: "Clicking Send will send this email to [recipient]"
4. "Send Email" button becomes prominent

**But this is less clear and more error-prone** - Modal is safer.

---

## Recommended UX Flow Diagram

```
User clicks "Accept draft"
         ↓
Open Send Email Modal
         ↓
Show: To, Subject, Body (editable)
         ↓
User reviews/edits
         ↓
User clicks "Send Email"
         ↓
Show loading state
         ↓
Call Gmail API to send
         ↓
Success → Close modal, show toast
Error → Show error, keep modal open
```

---

## Implementation Checklist

### Frontend
- [ ] Create `SendEmailModal` component
- [ ] Add state: `showSendModal`, `sendingEmail`
- [ ] Wire "Accept draft" button to open modal
- [ ] Add form fields (To, Subject, Body)
- [ ] Add "Send Email" and "Cancel" buttons
- [ ] Add loading states
- [ ] Add success/error handling
- [ ] Update email queue after send

### Backend
- [ ] Create `/api/sync/email/send` endpoint
- [ ] Use `sendGmailMessage()` from `lib/gmail/client.ts`
- [ ] Format email as RFC 2822
- [ ] Handle thread ID for replies
- [ ] Update email_queue status after send
- [ ] Return success/error response

### Email Formatting
- [ ] Format "To:" header
- [ ] Format "Subject:" with "Re:" prefix if reply
- [ ] Format body as plain text or HTML
- [ ] Include proper email headers

---

## Code Structure Preview

### Modal Component Location
`components/sync/SendEmailModal.tsx`

### API Route Location
`app/api/sync/email/send/route.ts`

### Integration Point
`app/sync/page.tsx` - `handleAcceptDraft()` function

---

## Final Recommendation

**Use Option 1: Compose/Send Modal**

This provides:
- ✅ Best user experience
- ✅ Maximum safety (review before send)
- ✅ Professional appearance
- ✅ Familiar pattern (matches major email clients)
- ✅ Flexibility (can edit before sending)

The modal should clearly show:
1. **What** you're sending (full email)
2. **Who** you're sending to (recipient)
3. **How** to send it (prominent "Send Email" button)
4. **How** to cancel (Cancel button)

This is the industry standard approach used by Gmail, Outlook, Apple Mail, and other professional email clients.


