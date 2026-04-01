export type AppPhase = 'setup' | 'ready' | 'playing' | 'frozen' | 'session-ended'

export interface PhaseDefinition {
  id: AppPhase
  label: string
  heading: string
  summary: string
  accent: string
  nextActionLabel: string | null
}
