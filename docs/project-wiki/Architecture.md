> _posted by **Spec**_

# Architecture

## Architectural Intent

Keep the MVP architecture lean: a browser-first application with as little backend surface area as possible, while still handling Spotify auth and playback constraints safely.

## Proposed High-level Shape

### Frontend
A TypeScript web app responsible for:

- Spotify login handoff UX
- playlist selection UX
- facilitator controls
- gameplay state machine
- visualisation rendering
- synchronising playback position with visual effects

### Backend / Server Support
A minimal backend may be required for:

- Spotify OAuth token exchange/refresh if not handled fully by a frontend-safe pattern
- secure handling of client secrets
- optional caching/proxying of selected Spotify metadata or audio-analysis responses

### External Dependency
- Spotify Web API
- Spotify Web Playback SDK

## Logical Modules

### 1. Auth Module
Handles login, token lifecycle, session recovery, and Premium/playback eligibility messaging.

### 2. Spotify Playback Module
Owns player initialisation, device readiness, current track state, pause/play/seek commands, and error handling.

### 3. Playlist & Session Module
Loads playlist options, resolves track lists, and prepares session state for rounds.

### 4. Gameplay Engine
Implements the Musical Statues state machine and facilitator actions.

### 5. Analysis Pipeline
Fetches track audio features / audio analysis, normalises usable data, and exposes time-aligned signals for the visualisation engine.

### 6. Visualisation Engine
Turns playback and analysis signals into rendered effects using Canvas/WebGL.

## Suggested Data Flow

1. User authenticates with Spotify.
2. App loads playlists and selected track metadata.
3. Playback module creates/attaches to a Spotify web player device.
4. Analysis pipeline prefetches audio features and audio analysis for queued tracks where possible.
5. Gameplay engine starts a round and commands playback.
6. Playback time updates feed the visualisation engine.
7. Segment/section/beat data modulates visual parameters.
8. Stop event transitions gameplay and visual state together.

## Suggested Technical Baseline

- **Language:** TypeScript
- **Frontend framework:** React + Vite (preferred for lightweight MVP) or Next.js if server routes are needed early
- **State management:** local app state plus a predictable reducer/state-machine approach
- **Gameplay state modelling:** state machine library optional but recommended if complexity grows
- **Rendering:** Canvas 2D for MVP simplicity, with an upgrade path to WebGL for richer effects
- **Testing:** unit tests for state logic, integration tests for UI flows, contract tests around Spotify wrappers

## Why This Shape

- keeps product logic close to the UI where interaction happens
- isolates Spotify-specific complexity behind adapters
- makes visualisation work independently testable from the rest of the app
- allows graceful degradation when some Spotify analysis data is unavailable

## Constraints

- Spotify playback in browser is Premium-gated.
- Browser autoplay restrictions may require explicit user interaction before playback starts.
- Spotify API rate limits and latency mean the app should avoid repeated per-frame API calls.
- Audio analysis should be prefetched and cached locally in memory for active tracks.

## Risks

- Web Playback SDK readiness can be brittle across browsers/devices.
- Token expiry during an active session may interrupt play.
- Segment-level analysis may not align perfectly with real-time playback timing, requiring smoothing/tolerance.
- Overly ambitious visuals could outpace MVP performance budgets.

## Quality Expectations

- clear separation between gameplay logic and Spotify integration
- deterministic state transitions for rounds
- fallback visuals when analysis is missing
- tests around auth edge cases, device readiness, and stop/start round flow