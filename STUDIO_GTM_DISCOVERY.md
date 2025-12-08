# Studio GTM Discovery

## Current Studio Routes

### Pages
- `/studio` - Root route (redirects to `/studio/overview` or `/studio/onboarding`)
- `/studio/overview` - Overview dashboard (`app/studio/overview/page.tsx`)
- `/studio/calendar` - Calendar view (`app/studio/calendar/page.tsx`)
- `/studio/reports` - Weekly reports (`app/studio/reports/page.tsx`)
- `/studio/experiments` - A/B testing (`app/studio/experiments/page.tsx`)
- `/studio/campaigns` - Campaign management (`app/studio/campaigns/page.tsx`)
- `/studio/competitors` - Competitor tracking (`app/studio/competitors/page.tsx`)
- `/studio/settings` - Brand profile settings (`app/studio/settings/page.tsx`)
- `/studio/onboarding` - Onboarding checklist (`app/studio/onboarding/page.tsx`)
- `/studio/chat` - Studio Agent chat (`app/studio/chat/page.tsx`)

## Current Copy & Labels

### Overview Page (`app/studio/overview/page.tsx`)
- Title: "Studio Overview" (line 57)
- No explicit subtitle/description
- Quick action buttons:
  - "Generate Weekly Plan"
  - "Ask Studio" (routes to `/studio/chat`)
- Sections:
  - "This Week's Schedule"
  - "Key Metrics"
  - "Latest Report"
  - "Top Hashtags"
  - "Recent Experiments"

### Calendar Page (`app/studio/calendar/page.tsx`)
- No explicit page title visible in initial lines
- Button: "Generate Weekly Plan"
- Repurpose button on post hover

### Reports Page (`app/studio/reports/page.tsx`)
- Title: "Weekly Reports" (likely)
- Button: "Generate Report"
- Empty state: Not visible in first 80 lines

### Experiments Page (`app/studio/experiments/page.tsx`)
- Title: "Experiments" (likely)
- Empty state: Not visible in first 80 lines

### Settings/Brand Profile (`app/studio/settings/page.tsx`)
- Title: "Brand Profile" (likely)
- Form fields for brand description, target audience, voice/tone, brand attributes

### Studio Agent (`components/studio/StudioIntelligence.tsx`)
- Header: "Studio Intelligence" (line 72)
- Subheader: "Studio insights" (line 70)
- Placeholder: "Ask about your analytics, content ideas, or how to improve your next posts..." (line 82)
- No description of capabilities
- No suggestion prompts

### Chat Page (`app/studio/chat/page.tsx`)
- Title: "Ask Studio Agent" (likely)
- Description: Not visible in file

### Onboarding Page (`app/studio/onboarding/page.tsx`)
- Title: "Welcome to Studio" (line 30)
- Subtitle: "Let's get you set up in 4 simple steps" (line 33)
- Steps:
  1. "Connect Social Accounts"
  2. "Fill Brand Profile"
  3. "Generate First Weekly Plan"
  4. "Review Overview & Calendar"

## Navigation/Sidebar

- Check `components/app/AppSidebar.tsx` for Studio nav item label
- Likely just "Studio" or "Content Studio"

## Empty States

Current empty states need review:
- Calendar: Unknown
- Reports: Unknown
- Experiments: Unknown
- Campaigns: Unknown
- Competitors: Unknown

## CTAs & Buttons

- "Generate Weekly Plan" - appears in Overview and Calendar
- "Ask Studio" - routes to chat
- "Repurpose" - on calendar post hover
- "Generate Report" - in Reports page
- "Create Experiment" - likely in Experiments page
- "Add Competitor" - likely in Competitors page
- "Create Campaign" - likely in Campaigns page

## Notes

- Studio Agent is referred to as "Studio Intelligence" in the component
- No consistent description of what Studio does
- No guidance on Studio Agent capabilities
- Empty states likely need improvement
- Copy is functional but not aspirational or explanatory

