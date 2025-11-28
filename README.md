# OVRSEE

AI agents for modern business. Delegate calls, inbox, content, and insights to OVRSEE. Four focused AI agents handle communications, media polish, and reporting so you can stay on high-value work.

## Agents

- **OVRSEE Aloha**: Voice and call assistant. Answers calls, books appointments, and keeps calendars tidy.
- **OVRSEE Sync**: Email and calendar agent. Drafts replies, prioritizes inboxes, and syncs schedules.
- **OVRSEE Studio**: Media and branding agent. Edits images and videos, and provides social media performance insights.
- **OVRSEE Insight**: Business intelligence agent. Rolls up every signal into clean, actionable insight.

## Tech Stack

- **Framework**: Next.js 14.1.0
- **React**: 18.2.0
- **TypeScript**: 5.0.4
- **Database**: Supabase
- **AI**: OpenAI API
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- OpenAI API key
- Google Cloud Console credentials (for Gmail/Calendar OAuth)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/usecmdr-rgb/ovrsee-site.git
cd ovrsee-site
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your credentials:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REDIRECT_URI`
- `NEXT_PUBLIC_APP_URL`

4. Run database migrations:
```bash
# Apply Supabase migrations
# See supabase/migrations/ for migration files
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3001`

## Project Structure

```
├── app/                 # Next.js app directory
│   ├── api/            # API routes
│   ├── aloha/          # Aloha agent pages
│   ├── sync/           # Sync agent pages
│   ├── studio/         # Studio agent pages
│   └── insight/        # Insight agent pages
├── components/         # React components
├── lib/                # Utility libraries
├── hooks/              # Custom React hooks
├── context/            # React context providers
├── types/              # TypeScript type definitions
└── supabase/           # Database migrations
```

## Available Scripts

- `npm run dev` - Start development server on port 3001
- `npm run dev:3000` - Start development server on port 3000
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Environment Variables

See `.env.local.example` for all required environment variables.

## Contributing

1. Create a feature branch
2. Make your changes
3. Commit and push to your branch
4. Open a pull request

## License

Private - All rights reserved

## About OVRSEE

OVRSEE is an AI-powered platform that helps small and medium businesses delegate routine operations to specialized AI agents. Our four agents—Aloha, Sync, Studio, and Insight—handle communications, media enhancement, and business intelligence so you can focus on high-value work.

