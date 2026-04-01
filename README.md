# Musical Statues Web

A browser-based Musical Statues game that uses Spotify playback plus a reactive, Windows Media Player–inspired visualisation layer.

This repository is intentionally starting from a clean slate. The initial project definition lives in the GitHub wiki, with a concise in-repo entrypoint in [`SPEC.md`](./SPEC.md).

## Current Status

This repository currently contains project-definition artefacts only. Implementation work should follow from discrete GitHub issues once the specification is reviewed.

## Planned MVP

- Spotify login for a user with an active Premium account
- Playlist selection from the user’s Spotify account
- Browser-based playback control via the Spotify Web Playback SDK
- Musical Statues gameplay loop with clear rounds/states
- Reactive visualisation responding to playback and Spotify audio-analysis features
- A facilitator / shared-screen friendly play mode

## Repository Source of Truth

- Product/spec summary: [`SPEC.md`](./SPEC.md)
- Detailed project definition and architecture: GitHub wiki
- Scoped build tasks and acceptance criteria: GitHub issues

## Expected Setup Direction

Implementation has not been bootstrapped yet, but the current intended direction is:

- Frontend: web app (likely React + TypeScript + Vite or Next.js)
- Spotify integration: Spotify Web API + Web Playback SDK
- Visualisation: browser rendering stack such as Canvas/WebGL
- Hosting: static frontend plus lightweight backend/API surface only if needed for auth/session support

## Before Building

Read the following first:

1. [`SPEC.md`](./SPEC.md)
2. Wiki: Home / Project Definition / Architecture / Spotify Integration / Visualisation & Gameplay
3. Issue-specific acceptance criteria

## Non-goal of this commit

This repository update does **not** implement the application. It only establishes the durable specification baseline needed for subsequent delivery.
