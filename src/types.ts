export type AppPhase = 'setup' | 'ready' | 'playing' | 'frozen' | 'session-ended'

export interface PhaseDefinition {
  id: AppPhase
  label: string
  heading: string
  summary: string
  accent: string
  nextActionLabel: string | null
}

export type HostAuthState =
  | 'signed-out'
  | 'auth-in-progress'
  | 'session-ready'
  | 'not-premium'
  | 'session-expired'

export interface HostProfile {
  displayName: string
  product: string
  email?: string
}

export interface AuthSession {
  status: HostAuthState
  isAuthenticated: boolean
  profile: HostProfile | null
  scopes: string[]
  expiresAt: string | null
  canResume: boolean
  failureReason: string | null
}

export type PlaybackReadinessState =
  | 'idle'
  | 'sdk-loading'
  | 'sdk-ready'
  | 'device-connecting'
  | 'device-ready'
  | 'user-action-required'
  | 'unsupported-browser'
  | 'device-error'

export interface PlaybackReadiness {
  state: PlaybackReadinessState
  deviceName: string | null
  deviceId: string | null
  message: string
  needsUserAction: boolean
  isRecoverable: boolean
  sdkLoaded: boolean
}

export interface PlaylistSummary {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  ownerName: string
  trackCount: number
  isCollaborative: boolean
  isPublic: boolean | null
}

export interface SessionTrack {
  id: string
  name: string
  artistNames: string[]
  durationMs: number
  albumName: string
  isPlayable: boolean
  reason: string | null
}

export interface PlaylistPreparation {
  selectedPlaylistId: string | null
  selectedPlaylistName: string | null
  playableTracks: SessionTrack[]
  skippedTracks: SessionTrack[]
  totalTracks: number
}

export type GameplayStatus = 'idle' | 'starting-round' | 'round-playing' | 'round-stopped' | 'session-ended'

export type GameplayAction = 'start-round' | 'stop-round' | 'reset-round' | 'end-session'

export interface GameplayState {
  status: GameplayStatus
  roundNumber: number
  activeTrackName: string | null
  message: string
}

export interface GameplayTransitionResult {
  nextState: GameplayState
  accepted: boolean
  reason: string
}
