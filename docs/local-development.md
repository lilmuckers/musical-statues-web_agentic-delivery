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

## Current auth + playback baseline

This repo now also includes a baseline Spotify audio-analysis ingestion/mapping layer for visualisation work:

- same-origin audio-analysis retrieval via backend session credentials
- cached per-track analysis fetch outside the render path
- mapped visual cues for tempo, loudness, key, segment timing, and timbre-derived energy variation
- robust fallback envelopes when Spotify audio analysis is unavailable or partial


This slice implements:

- Spotify Authorization Code + PKCE sign-in
- backend code exchange and refresh handling
- encrypted HttpOnly cookie session storage
- same-origin session restoration on reload via `/api/auth/session`
- same-origin playback token retrieval via `/api/auth/playback-token`
- Spotify Web Playback SDK loading in the browser
- browser playback-device creation with a host-visible readiness panel
- explicit autoplay / user-gesture guidance through an in-app unlock step
- in-app retry for recoverable device setup failures without forcing a full page reload
- clear unsupported/degraded browser messaging when the SDK cannot be used safely

Rich analysis-driven visual behaviour can now build on the stable mapping layer, but detailed effect design/tuning still lands in follow-on slices.

## Playback readiness notes

- browser playback requires a Spotify Premium host account
- use a supported desktop browser with audio enabled
- Spotify Web Playback SDK requires a secure context (`https://` or localhost)
- after the browser device is created, the host may still need to complete the explicit unlock action once to satisfy browser autoplay rules

## Quality gates

```bash
npm run lint
npm run test
npm run build
```

These commands match the baseline GitHub Actions checks for this repository.
