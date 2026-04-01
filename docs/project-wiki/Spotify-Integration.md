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

The implementation should prefer an OAuth flow that keeps client secrets off the browser. That likely implies a minimal backend or serverless function for code exchange and refresh-token management.

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

Final scopes should be confirmed during implementation, but the MVP likely needs permissions sufficient for:

- reading the user profile
- reading private/public playlists as needed
- controlling playback state
- streaming playback through the web player

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

## Open Technical Questions

- Whether the MVP should support transfer to an existing Spotify device as a fallback when Web Playback SDK fails
- Whether analysis prefetch should include only the current track or the next N tracks
- How session resume should behave if Spotify auth expires during a game