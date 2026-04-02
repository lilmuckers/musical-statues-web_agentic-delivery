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
