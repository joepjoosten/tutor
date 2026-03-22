# Tutor App

Tutor is a Next.js study app that turns homework images into flashcards. It now uses:

- Convex for database, file storage, and backend functions
- Convex-managed Better Auth for auth
- Per-user encrypted OpenRouter API keys for AI generation
- Vercel-native deployment with Convex deployment during build

## Local development

1. Install dependencies:

```bash
npm install
```

2. Start Convex locally:

```bash
npm run dev:backend
```

This creates `.env.local` with local Convex URLs the first time it runs.

3. Copy the env template and fill in the auth/app secrets you need:

```bash
cp .env.example .env.local
```

Required for normal auth flows:

- `SITE_URL`
- `BETTER_AUTH_SECRET`
- `AI_KEY_ENCRYPTION_SECRET`

For local development, the app falls back to local-only secrets if those values
are still left as the `.env.example` placeholders. Production still requires
real secrets.

Required for Google auth:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- set `NEXT_PUBLIC_DISABLE_GOOGLE_AUTH=false`

Because the auth provider is registered from the Convex backend, Google secrets
must also be set on the Convex deployment that serves auth routes:

```bash
npx convex env set GOOGLE_CLIENT_ID your_google_client_id
npx convex env set GOOGLE_CLIENT_SECRET your_google_client_secret
```

4. Start the Next.js app:

```bash
npm run dev
```

## User-owned AI keys

Users bring their own OpenRouter key in the Settings page. The key is:

- stored per authenticated user
- encrypted before it is written to Convex
- only decrypted inside the flashcard generation action

## Deployment

This repo is set up for Vercel-native deploys.

- Production branch: `main`
- Vercel build command: `npx convex deploy && npm run build`
- `vercel.json` already includes that build command
- GitHub Actions is used for CI checks only, not deploys
- `CONVEX_DEPLOY_KEY` should be scoped to the Vercel Production environment only unless you intentionally set up Convex preview deployments

### Required Vercel environment variables

- `CONVEX_DEPLOY_KEY`
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_SITE_URL`
- `SITE_URL`
- `BETTER_AUTH_SECRET`
- `AI_KEY_ENCRYPTION_SECRET`
- `NEXT_PUBLIC_DISABLE_GOOGLE_AUTH`

Production-only if using Google in the UI:

- set `NEXT_PUBLIC_DISABLE_GOOGLE_AUTH=false`

Production Convex deployment variables if using Google auth:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Set those on the production Convex deployment, for example:

```bash
npx convex env set --prod GOOGLE_CLIENT_ID your_google_client_id
npx convex env set --prod GOOGLE_CLIENT_SECRET your_google_client_secret
```

Optional if you later add email reset / verification emails:

- `RESEND_API_KEY`
- `AUTH_FROM_EMAIL`

## CI

`.github/workflows/ci.yml` runs:

- `npm ci`
- `npm run lint`
- `npm run build`

on pull requests and non-`main` pushes.
