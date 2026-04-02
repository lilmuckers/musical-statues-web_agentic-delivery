# Local development

## Prerequisites

- Node.js 22
- npm 10+
- a Spotify app configured in the Spotify developer dashboard

## Install

```bash
npm install
```

## Auth/session environment setup

Copy `.env.example` to `.env` (or export the variables in your shell) and set:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI`
- `APP_ORIGIN`
- `AUTH_SERVER_PORT`
- `SESSION_SECRET`

### Local redirect URI

For local development, configure this redirect URI in the Spotify developer dashboard:

```text
http://127.0.0.1:8787/api/auth/callback
```

The frontend app origin should remain:

```text
http://127.0.0.1:5173
```

## Run the app locally

Start the minimal auth/session backend in one terminal:

```bash
npm run dev:auth
```

Then start the Vite frontend in another terminal:

```bash
npm run dev
```

Vite will print the local development URL, typically `http://localhost:5173` or `http://127.0.0.1:5173`.

## Current auth/session baseline

This slice implements:

- Spotify Authorization Code + PKCE sign-in
- backend code exchange and refresh handling
- encrypted HttpOnly cookie session storage
- same-origin session restoration on reload via `/api/auth/session`
- explicit host-visible auth/session states for signed out, auth in progress, session ready, not Premium, and session expired / refresh failed
- sign-out that clears the backend session and resets the local host state

Playback-device readiness, autoplay/browser constraints, and playlist preparation remain intentionally out of scope for this issue and land in follow-on slices.

## Quality gates

```bash
npm run lint
npm run test
npm run build
```

These commands match the baseline GitHub Actions checks for this repository.
