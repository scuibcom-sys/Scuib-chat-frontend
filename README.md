<<<<<<< HEAD
# Scuib Chat Frontend

Scuib Chat is a Next.js 16 frontend for a community platform focused on tech cliques, onboarding, profile setup, chat, and community administration.

## Overview

This app includes:

- Public landing and pre-login onboarding screens
- Email signup, sign-in, email verification, and password reset flows
- Authenticated onboarding and profile completion flow
- Dashboard experience for groups, messaging, and members
- Community administration screens
- Zustand-based persisted client state for auth and onboarding data

## Tech Stack

- Next.js 16.2.3 with the App Router
- React 19.2.4
- TypeScript 5
- Tailwind CSS 4
- Zustand 5 for client state
- Motion and Lucide for animation and icons

## Requirements

- Node.js 20.9 or newer
- npm 10 or newer recommended

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create a `.env.local` file in the project root and add the variables from the Environment Variables section below.

3. Start the development server:

```bash
npm run dev
```

4. Open the app in your browser:

```text
http://localhost:3000
```

## Environment Variables

The project reads the following client-safe environment variables:

```bash
NEXT_PUBLIC_API_BASE_URL=https://scuib-chat-rrx6.onrender.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Variable Reference

- `NEXT_PUBLIC_API_BASE_URL`
  Base URL for the backend API. If omitted, the app falls back to `https://scuib-chat-rrx6.onrender.com`.
- `NEXT_PUBLIC_APP_URL`
  Public URL of the frontend. Used for metadata, canonical URLs, and callback/base URL helpers.

## Available Scripts

```bash
npm run dev
```

Runs the local development server.

```bash
npm run build
```

Builds the production bundle.

```bash
npm run start
```

Starts the production server after a successful build.

```bash
npm run lint
```

Runs ESLint for the codebase.

## Project Structure

```text
app/                 Next.js routes, layouts, route handlers, and pages
components/          Feature UI for auth, onboarding, dashboard, profile, and community
hooks/               Reusable client hooks
public/              Static assets and illustrations
store/               Zustand persisted stores
types/               Shared TypeScript types
utils/               API clients, helpers, icons, and domain utilities
```

## Main Routes

- `/`
  Public landing page for logged-out users. Authenticated users are redirected straight to the dashboard.
- `/signin`
  Email/password sign-in screen.
- `/signup`
  Account creation screen.
- `/forgot-password`
  Password reset request form.
- `/reset-password`
  Password reset completion screen.
- `/verify-email`
  Email verification flow.
- `/verify-email-sent`
  Post-signup verification notice.
- `/onboarding`
  Authenticated onboarding flow for incomplete profiles.
- `/dashboard`
  Main workspace.
- `/dashboard/community`
  Community administration screen.
- `/setup-profile`
  Profile editing/setup screen.
- `/profile`
  Placeholder profile page while the final profile section is being completed.

## State Management

The app uses persisted Zustand stores:

- `store/authStore.ts`
  Handles user identity, tokens, auth status, session refresh, and logout.
- `store/onboardingStore.ts`
  Handles the public onboarding flow and selected cliques.
- `store/profileSetupStore.ts`
  Handles authenticated profile onboarding progress and completion markers per user.

## API Integration

Most backend communication is centralized in:

- `utils/scuibApi.ts`
  Auth, profile, groups, and shared API helpers
- `utils/scuibMessagingApi.ts`
  Messaging and chat-related API helpers
- `utils/scuibAdminApi.ts`
  Admin/community management helpers

The frontend expects token-based authentication and includes refresh-token handling in the auth store and API helper layer.

## Authentication and Welcome Flow

Current behavior:

- First-time visitors see the public landing and onboarding experience.
- Returning logged-out users are redirected to `/signin`.
- Logged-out users can return to `/` and will see the welcome landing page again.
- Users with an active authenticated session are redirected straight to `/dashboard`.

## Styling Notes

- Global styles live in `app/globals.css`.
- The app uses Tailwind CSS 4.
- Google font setup is configured in `app/layout.tsx`.

## Deployment Notes

Before deploying:

1. Set `NEXT_PUBLIC_API_BASE_URL` to the production backend.
2. Set `NEXT_PUBLIC_APP_URL` to the deployed frontend origin.
3. Run `npm run build` to verify the project compiles cleanly.
4. Serve with `npm run start` or deploy to a Next.js-compatible hosting platform.

## Troubleshooting

- If auth redirects behave unexpectedly, clear local storage for persisted Zustand stores and sign in again.
- If API requests fail locally, confirm `NEXT_PUBLIC_API_BASE_URL` points to a reachable backend.
- If metadata or callback URLs are wrong, verify `NEXT_PUBLIC_APP_URL`.
- If the app builds but runtime behavior is stale, remove `.next/` and rebuild.

## Notes for Contributors

- This project is on Next.js 16, so check the bundled framework docs in `node_modules/next/dist/docs/` before making framework-level changes.
- Prefer `rg` for codebase searches and keep client-side auth and onboarding logic consistent with the Zustand stores.
- Avoid introducing route behavior that shows onboarding or welcome screens on passive session restoration unless that behavior is intentional.
=======
# Scuib-chat-frontend
World first status platform. Let the world feel you daily
>>>>>>> c5d388ed7a0ad9de5772428552c834edfd0afd8e
