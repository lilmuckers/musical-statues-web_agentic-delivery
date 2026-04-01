> _posted by **Spec**_

# Visualisation and Gameplay

## Experience Goal

Blend the simple party-game rules of Musical Statues with a nostalgic, high-energy media-player visual style that makes the room feel more alive while music is playing and unmistakably frozen when the track stops.

## Gameplay Principles

- The game must remain understandable in a noisy room.
- The host must be able to trigger rounds quickly.
- The stop moment should feel crisp and dramatic.
- Visuals should reinforce music energy without obscuring facilitator controls.

## Visual Style Direction

Target a **Windows Media Player–inspired** aesthetic, updated for the browser:

- pulsing colour fields
- waveform / particle / ribbon motion
- radial bursts on energetic moments
- beat-synchronised glow and scale shifts
- sharp freeze-frame visual transition when playback stops

This should be homage rather than pixel-perfect recreation.

## UI Layers

### Control Layer
- playlist selection
- round controls
- playback/session status
- error / readiness messaging

### Visual Layer
- full-screen or dominant-canvas animated scene
- minimal overlay during active play
- stronger control visibility when paused/stopped/setup

## Gameplay-to-Visual State Mapping

### Setup / Ready
- calmer idle animation
- clear prompts and readiness indicators

### Playing
- full reactive motion
- colour and geometry tied to music energy and structure

### Stopped / Freeze Check
- abrupt motion halt or dramatically damped residual effect
- possible glow hold, scanline, or crystallised frame treatment
- strong visual cue that players should freeze

### Round Resolution
- transition animation indicating reset/prepare-next-round

## Audio-analysis Mapping Ideas

The MVP does not need every mapping, but it should establish a coherent first set.

### Tempo / Beat / Bar / Tatum
Use for:

- pulse timing
- camera/canvas scale throbs
- particle emission rhythm
- background oscillation cadence

### Loudness / Segment Loudness Max
Use for:

- brightness intensity
- bloom strength
- particle density / size
- distortion amount during energetic passages

### Key / Mode
Use for:

- colour palette family selection
- mood/theme changes between tracks

### Timbre Vector
Use for:

- choosing texture family or shader preset
- shifting shape complexity or particle behaviour
- differentiating smoother passages from harsher/noisier ones

### Section / Segment Confidence
Use for:

- how aggressively to snap transitions
- whether to smooth or damp a feature change

### Segment Duration / Onset Timing
Use for:

- triggering short-lived accents
- responsive micro-animations within broader section motion

## Recommended MVP Effect Stack

Start with a small layered system:

1. background gradient / colour field
2. beat pulse transform
3. particle emitter with energy modulation
4. event accents on segment/section changes
5. freeze-state transition effect

## Performance Guidance

- Target smooth rendering on common laptop hardware.
- Avoid effect designs that require per-frame network dependency.
- Build deterministic mappings from analysis data to render parameters.
- Prefer stable, legible visuals over maximal complexity.

## Accessibility / Usability Notes

- avoid excessive strobing
- ensure controls remain legible over animation
- provide a reduced-motion mode if feasible
- preserve keyboard/mouse operability for the host

## Recommended Follow-on Build Slices

1. Baseline canvas visualiser with play/pause/freeze states
2. Playback-time synchronisation layer
3. Track analysis ingestion + normalisation
4. Mapping engine from analysis signals to effect params
5. Enhanced effect presets and reduced-motion support