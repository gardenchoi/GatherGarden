# GatherGarden Realtime Setup

The app uses Supabase Realtime Presence and Broadcast. No database tables are required for the MVP.

## Required Environment Variables

Set these in Vercel Project Settings or with the Vercel CLI:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Only use the anon public key in the frontend. Do not use the service role key.

## Local Setup

Copy `.env.example` to `.env.local` and fill in the two values above.

```bash
cp .env.example .env.local
npm run dev
```

## Vercel CLI

```bash
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel deploy --prod
```

Repeat the env add commands for `preview` and `development` if needed.
