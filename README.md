# Musical Statues Web

A browser-based Musical Statues game that uses Spotify playback and a reactive visualisation layer.

This repository now contains the **application shell and delivery baseline** for the facilitator-hosted Musical Statues experience. The current implementation establishes the React/Vite app scaffold, the host session shell, baseline test/lint/build tooling, and GitHub Actions validation so later Spotify and gameplay slices can build on a stable foundation.

## Current implementation baseline

The app currently provides:

- a Vite + React + TypeScript application scaffold
- a facilitator-focused host control shell
- placeholder round/session phases for setup, ready, playing, freeze, and session end
- readiness and delivery scaffolding for future Spotify, playback, and visualisation work
- baseline lint, test, and build automation aligned with CI

The current app shell intentionally uses placeholders for Spotify auth, playback, playlist preparation, and the reactive visualisation layer. Those integrations land in later delivery slices, but the frame they plug into already exists.

## Quick start

### Prerequisites

- Node.js 22
- npm 10+

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Vite will print the local development URL, typically `http://localhost:5173`.

### Validate locally

```bash
npm run lint
npm run test
npm run build
```

These commands match the baseline GitHub Actions checks for this repository.

For deeper local setup and workflow detail, see [`docs/local-development.md`](./docs/local-development.md).

## Current product shape

Musical Statues Web is designed for a **single facilitator-hosted session**:

- the host signs in with Spotify
- selects a playlist
- prepares a browser playback device
- starts and stops rounds of music
- uses a shared-screen visual experience to reinforce the game state for players in the room

## MVP boundaries

The MVP aims to deliver:

- a laptop/desktop browser experience for one host
- Spotify authentication for a Premium user
- playlist selection from the host account
- Spotify Web Playback SDK playback in the browser
- clear gameplay/session states for running rounds
- a reactive visualiser driven by playback timing and Spotify analysis data when available
- graceful fallback behaviour when Spotify analysis or playback conditions are limited

The MVP explicitly does **not** aim to deliver:

- player accounts or remote participants
- automatic elimination detection or camera judging
- support for non-Spotify music sources
- tournament management or persistent scoring
- advanced visualiser customisation tooling

## Source of truth

- In-repo summary: [`SPEC.md`](./SPEC.md)
- Detailed product and architecture definition: staged wiki source in [`docs/project-wiki/`](./docs/project-wiki/)
- Local setup and validation flow: [`docs/local-development.md`](./docs/local-development.md)
- Scoped delivery work and acceptance criteria: GitHub issues

## Staged wiki pages

- [`Home`](./docs/project-wiki/Home.md)
- [`Project-Definition`](./docs/project-wiki/Project-Definition.md)
- [`Architecture`](./docs/project-wiki/Architecture.md)
- [`Spotify-Integration`](./docs/project-wiki/Spotify-Integration.md)
- [`Visualisation-and-Gameplay`](./docs/project-wiki/Visualisation-and-Gameplay.md)

## Next delivery slices

The current recommended follow-on slices are:

1. Spotify auth and session lifecycle
2. playback device readiness and browser constraints
3. playlist selection and session preparation
4. gameplay state machine and host controls
5. visualisation baseline and freeze transition
6. Spotify analysis ingestion and mapping layer
7. integrated session validation
