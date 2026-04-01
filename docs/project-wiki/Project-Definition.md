> _posted by **Spec**_

# Project Definition

## Product Intent

Build a browser-based Musical Statues experience where a facilitator uses Spotify playback and a reactive visual layer to run engaging stop/start dance rounds for a group of players in the same physical space.

## Primary User

- **Facilitator / host**: the person running the game from a browser on a laptop or desktop, connected to speakers and optionally a TV/projector.

## Secondary Users

- **Players**: children or adults participating in the room.
- **Spectators**: optional observers watching the shared visualisation.

## Problem Being Solved

Traditional Musical Statues is simple to run but manually awkward: the host must manage music, timing, and engagement. This product turns that into a polished browser experience with playlist selection, clear round controls, and lively visual feedback synced to the music.

## MVP Scope

The MVP should include:

- Spotify authentication for the host
- playlist browsing/selection from Spotify
- browser playback via Spotify Web Playback SDK
- clear game states: setup, ready, playing, paused/stopped, round result, next round, session end
- controls for start / stop / next round / new playlist
- animated visualisation that reacts to current playback position plus track- and segment-level audio-analysis data where available
- graceful fallback when analysis data is missing or delayed

## Explicit Non-goals

The MVP does **not** need to include:

- online multiplayer or remote participants
- individual player accounts
- referee AI / automated player elimination detection
- support for Apple Music, YouTube, or local files
- complex tournament brackets or persistent scoring history
- user-generated visualisation editor

## Core User Flow

1. Host opens the app.
2. Host signs in with Spotify.
3. Host selects a playlist.
4. App validates playback readiness and prepares the selected track queue.
5. Host starts a game session.
6. Music plays while visualisation reacts in real time.
7. Host or game logic stops music unpredictably.
8. Players freeze; facilitator decides outcome offline/in-person.
9. Host advances to next round and resumes playback.
10. Session ends when the host chooses or playlist/game flow completes.

## Gameplay State Model

### Setup
- user not yet authenticated or playlist not selected

### Ready
- authenticated, playback device ready, playlist selected, round prepared

### Playing
- track playing, visualisation active, stop event can occur manually or by configured game logic

### Stopped / Freeze Check
- playback paused/stopped, visualisation transitions to freeze-state effect, facilitator judges players

### Round Resolution
- facilitator acknowledges round completion and prepares the next start

### Session Complete
- host exits or ends the session

## MVP Success Criteria

A host should be able to run a full short session from one browser without needing external tools beyond Spotify.

## Assumptions

- Host has a Spotify Premium account.
- The game is primarily single-screen and co-located.
- Facilitator judgment, not computer vision, determines who moved after the music stopped.

## Open Questions

- Should MVP support only manual stop, or also optional auto-stop after a random interval?
- Should the session always continue through playlist order, or support random track selection?
- How much pre-round configuration is needed before the game becomes slower than the real-world activity it supports?

## Recommended Follow-on Issues

1. App bootstrap and deployment baseline
2. Spotify auth + playback device readiness
3. Playlist selection and queue/session setup
4. Gameplay state machine and facilitator controls
5. Visualisation engine baseline with fallback mode
6. Audio-analysis mapping and effect orchestration
7. End-to-end integration test harness for auth/playback/game loop boundaries