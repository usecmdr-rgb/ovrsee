# OVRSEE Mobile

Production-quality mobile app (iOS + Android) for the OVRSEE brand.

## Overview

OVRSEE Mobile is a React Native application built with Expo, providing a comprehensive interface for managing multiple AI agents: Sync, Aloha, Studio, and Insights.

## Features

- **Bottom Tab Navigation** with 5 tabs: Sync → Aloha → Summary → Studio → Insights
- **Dark Mode First** design with OVRSEE branding
- **Global Header** with logo, profile, and settings on all screens
- **Complete Agent Screens**: Sync (email/calendar), Aloha (voicemail/calls), Studio (creative), Insights (business intelligence)
- **Summary Screen** (center tab) with complete overview
- **Profile & Settings** screens
- **Complete API Layer** ready for backend integration
- **TypeScript** for type safety
- **Mock Data** for demonstration

## Tech Stack

- Expo ~51.0.0
- React Native 0.74.0
- React Navigation (Bottom Tabs + Stack)
- TypeScript
- React Native SVG

## Project Structure

```
ovrsee-mobile/
├── src/
│   ├── api/              # API layer (HTTP client, agents, user, summary, OpenAI)
│   ├── components/       # Reusable components (Logo, Header, Card, etc.)
│   ├── data/             # Mock data
│   ├── navigation/       # Navigation setup (BottomTabs, AppNavigator)
│   ├── screens/          # All app screens
│   ├── theme/            # Theme system (colors, typography)
│   └── types/            # TypeScript types
├── App.tsx               # Main entry point
├── package.json
└── app.json              # Expo configuration
```

## Agent Order

The app strictly follows the required agent order everywhere:
1. **Sync** - Email & Calendar agent
2. **Aloha** - Voice & Call Assistant
3. **Studio** - Media & Branding
4. **Insights** - Business Intelligence

This order is enforced in:
- Navigation tabs
- Summary cards
- Internal linking
- Screen ordering
- All components referencing agents

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on iOS:
```bash
npm run ios
```

4. Run on Android:
```bash
npm run android
```

## API Configuration

The app includes a complete API layer ready for backend integration. Update the base URL in `src/api/http.ts`:

```typescript
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://api.ovrsee.com";
```

Set the environment variable or update the default URL.

## Branding

- **Primary Color**: #0F172A (Dark background)
- **Accent Color**: #4F46E5 (Blue iris)
- **Agent Colors**:
  - Sync: #0EA5E9 (Sky blue)
  - Aloha: #F97316 (Orange)
  - Studio: #8B5CF6 (Violet)
  - Insights: #10B981 (Emerald)

## Development

The app uses mock data by default. To connect to a real backend:

1. Update API endpoints in `src/api/`
2. Replace mock data imports with actual API calls
3. Add authentication tokens to HTTP client

## License

Private - OVRSEE


