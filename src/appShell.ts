import type { AppPhase, AuthSession, PhaseDefinition } from './types'

export const phaseOrder: AppPhase[] = ['setup', 'ready', 'playing', 'frozen', 'session-ended']

export const phaseDefinitions: Record<AppPhase, PhaseDefinition> = {
  setup: {
    id: 'setup',
    label: 'Setup',
    heading: 'Prepare host session',
    summary:
      'Authenticate the Spotify host, confirm session continuity, and leave playback/device setup to the next delivery slice.',
    accent: 'var(--phase-setup)',
    nextActionLabel: 'Mark setup complete',
  },
  ready: {
    id: 'ready',
    label: 'Ready',
    heading: 'Session ready for playback setup',
    summary:
      'The host session is authenticated and restorable. Playback device readiness, playlist preparation, and host controls attach here next.',
    accent: 'var(--phase-ready)',
    nextActionLabel: 'Start round',
  },
  playing: {
    id: 'playing',
    label: 'Playing',
    heading: 'Music is playing',
    summary:
      'This remains a placeholder state until the playback-device and playlist slices connect live Spotify playback to the gameplay shell.',
    accent: 'var(--phase-playing)',
    nextActionLabel: 'Trigger freeze',
  },
  frozen: {
    id: 'frozen',
    label: 'Freeze',
    heading: 'Freeze moment',
    summary:
      'The app shell still distinguishes the stop moment so later playback and visualisation work can plug into a clear state boundary.',
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

export function deriveAppPhaseFromSession(session: AuthSession): AppPhase {
  return session.status === 'session-ready' ? 'ready' : 'setup'
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
