> _posted by **Spec**_

# Spotify Integration

## Goal

Use Spotify as the music source for playlist selection and in-browser playback, while respecting Spotify platform constraints and providing a host-friendly experience.

## Expected Capability Split

### Spotify Web API
Used for:

- authentication/user identity
- playlist discovery
- playlist track retrieval
- track metadata
- audio features / audio analysis lookup

### Spotify Web Playback SDK
Used for:

- creating a browser playback device
- controlling play / pause
- receiving playback state updates

## MVP Assumptions

- Host must have a Spotify Premium account.
- The host logs into Spotify in the app.
- The game uses the host’s Spotify account as the single playback authority.
- Playlist selection is limited to playlists accessible from that host account.

## Authentication Notes

The MVP should use **Spotify Authorization Code with PKCE** plus a **minimal backend/serverless auth surface**.

Project-level auth decision:
- the Spotify client secret must never be shipped to the browser
- refresh capability must not live in browser-accessible storage such as `localStorage`, `sessionStorage`, or normal JS-readable cookies
- the frontend should learn auth/session state from same-origin endpoints, not by owning long-lived Spotify credentials directly

Recommended minimal pattern:
1. frontend starts sign-in
2. Spotify redirects to a backend/serverless callback endpoint
3. backend exchanges the code with Spotify and establishes a secure HttpOnly session
4. frontend loads the current session/user state from the app backend
5. backend refreshes Spotify access as needed for the active session
6. sign-out clears the app session and removes local host state

This is the minimum acceptable backend pattern for issue #3 and should be treated as in-scope for the MVP rather than optional future infrastructure.

## Session Lifecycle Requirements

Issue #3 should establish these host-visible session states:

- signed out
- auth in progress
- signed in but playback eligibility not yet confirmed
- signed in but not Premium / playback-ineligible
- signed in and session-ready for playback setup
- session expired / refresh failed

On browser reload, the app should attempt to restore the host session from the backend/session endpoint rather than forcing a fresh login every time.

Sign-out should:
- clear app-owned local host session state
- invalidate the backend/session
- return the UI to a clean signed-out/setup state

## Playback Readiness Requirements

Before entering `Ready` state, the app should confirm:

- valid Spotify auth session
- playback SDK loaded
- browser playback device created
- device marked ready
- user interaction completed if required by browser autoplay policy

## Failure Modes to Design For

- user is not Premium
- user denies permissions
- playback device fails to initialise
- token expires mid-session
- selected track cannot be played in the current market/account context
- audio analysis unavailable for a track

## Recommended Permissions / Data Needs

Final scopes should be confirmed during implementation, but issue #3 should be designed around permissions sufficient for:

- reading the user profile
- reading private/public playlists as needed
- controlling playback state
- streaming playback through the web player

Builder should keep the initial scope as tight as practical and document the final selected scopes in implementation docs/PR notes.

## Audio Analysis Strategy

For each track likely to be played in the session:

1. fetch track metadata
2. fetch audio features if useful for coarse styling
3. fetch detailed audio analysis for segments/sections/beats/bars/tatums when available
4. cache results locally for the active session
5. expose a normalised timeline API to the visualisation layer

## Timing Considerations

Visuals should not depend on fresh API calls during active rendering. Instead, playback-state time plus prefetched analysis data should drive frame updates.

## Fallback Rules

If analysis data is missing, the app should still function by falling back to:

- transport-level state (playing / paused / stopped)
- track-level metadata
- coarse beat pulse or timer-driven animation
- static theme per track if richer signals are unavailable

## Builder Readiness Constraints for Issue #3

Issue #3 is ready for Builder only with these boundaries:

- implement auth/session lifecycle only; do not fold playback-device orchestration or playlist UX into this issue except for the minimal auth-readiness placeholders needed by the host shell
- use Authorization Code + PKCE with backend/serverless exchange/refresh handling
- do not place the Spotify client secret or long-lived refresh capability in browser-accessible storage
- make session restoration on page reload part of the baseline, not a follow-up nice-to-have
- provide host-visible UI for signed-out, loading, success-ready, not-Premium/ineligible, and session-expired/error states
- document required environment variables, redirect URI expectations, and local dev setup for the auth path
- keep implementation shaped so issue #4 can consume an authenticated session without reworking the auth contract

## Open Technical Questions

- Whether the MVP should support transfer to an existing Spotify device as a fallback when Web Playback SDK fails
- Whether analysis prefetch should include only the current track or the next N tracks
- How session resume should behave if Spotify auth expires during an active game beyond the baseline requirement to surface expiry clearly and return the host to a recoverable state
