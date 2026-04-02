# Local development

## Prerequisites

- Node.js 22
- npm 10+

## Install

```bash
npm install
```

## Run the app shell locally

```bash
npm run dev
```

Vite will print the local development URL, typically `http://localhost:5173`.

## Quality gates

```bash
npm run lint
npm run test
npm run build
```

These commands match the baseline GitHub Actions checks for this repository.

## Current baseline scope

The current app shell intentionally includes placeholder facilitator states for:

- setup
- ready
- playing
- freeze
- session end

Spotify auth, playback control, and the reactive visualisation engine will plug into this shell in later issue slices.
