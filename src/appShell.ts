import type { AppPhase, PhaseDefinition } from './types'

export const phaseOrder: AppPhase[] = ['setup', 'ready', 'playing', 'frozen', 'session-ended']

export const phaseDefinitions: Record<AppPhase, PhaseDefinition> = {
  setup: {
    id: 'setup',
    label: 'Setup',
    heading: 'Prepare host session',
    summary:
      'Confirm Spotify sign-in, choose a playlist, and satisfy browser playback requirements before starting the game.',
    accent: 'var(--phase-setup)',
    nextActionLabel: 'Mark setup complete',
  },
  ready: {
    id: 'ready',
    label: 'Ready',
    heading: 'Ready for the first round',
    summary:
      'The host session is ready. Playback device readiness, playlist preparation, and gameplay controls will attach here next.',
    accent: 'var(--phase-ready)',
    nextActionLabel: 'Start round',
  },
  playing: {
    id: 'playing',
    label: 'Playing',
    heading: 'Music is playing',
    summary:
      'This placeholder state reserves the future live round surface for Spotify playback, host controls, and reactive visualisation.',
    accent: 'var(--phase-playing)',
    nextActionLabel: 'Trigger freeze',
  },
  frozen: {
    id: 'frozen',
    label: 'Freeze',
    heading: 'Freeze moment',
    summary:
      'The app shell already distinguishes the stop moment so the later visual layer and round logic can plug into a clear state boundary.',
    accent: 'var(--phase-frozen)',
    nextActionLabel: 'End session',
  },
  'session-ended': {
    id: 'session-ended',
    label: 'Session end',
    heading: 'Session complete',
    summary:
      'This state anchors the post-game handoff for summary messaging, reset options, and later facilitator workflows.',
    accent: 'var(--phase-ended)',
    nextActionLabel: null,
  },
}

export function getNextPhase(phase: AppPhase): AppPhase | null {
  const currentIndex = phaseOrder.indexOf(phase)
  const nextPhase = phaseOrder[currentIndex + 1]

  return nextPhase ?? null
}

export function getPreviousPhase(phase: AppPhase): AppPhase | null {
  const currentIndex = phaseOrder.indexOf(phase)
  const previousPhase = phaseOrder[currentIndex - 1]

  return previousPhase ?? null
}
