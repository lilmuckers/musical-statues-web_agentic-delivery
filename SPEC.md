# SPEC.md

## Project

**Musical Statues Web** is a browser-based game experience that combines Spotify playback, playlist-driven music selection, and a reactive visualisation inspired by classic Windows Media Player effects.

## Purpose

Provide a shared-screen Musical Statues experience where a facilitator can run rounds from a browser while players react to music start/stop events and an animated visual layer that responds to track structure and audio features.

## Scope Status

This file is the in-repository entrypoint only. The authoritative project definition lives in the GitHub wiki.

## Authoritative Wiki Pages

- `Home`
- `Project-Definition`
- `Architecture`
- `Spotify-Integration`
- `Visualisation-and-Gameplay`

## MVP Summary

The first delivery phase should support:

- Spotify authentication for a host user
- playlist selection
- browser playback control
- Musical Statues round-state flow
- reactive visualisation driven by playback timing plus Spotify audio-analysis metadata

## Explicit Non-goals for MVP

- multiplayer personal-device controls
- spectator chat or accounts for multiple players
- support for non-Spotify music providers
- advanced scoring / tournament management
- fully custom visualiser authoring tools

## Key Assumptions

- Spotify Premium is required for in-browser playback via Spotify’s Web Playback SDK.
- The host running the game controls the Spotify session and shares the screen/audio with players.
- Audio-analysis data may need caching or prefetching because it is not guaranteed to be low-latency enough if fetched only at play time.
- Visual reactions should be musically convincing rather than scientifically exact; graceful fallback behaviour is required when some analysis data is unavailable.

## Next Step

Use the wiki pages to split implementation into discrete GitHub issues for app bootstrap, auth/playback integration, gameplay state management, and visualisation rendering.
