import type { AuthSession } from './types'

const defaultSession: AuthSession = {
  status: 'signed-out',
  isAuthenticated: false,
  profile: null,
  scopes: [],
  expiresAt: null,
  canResume: false,
  failureReason: null,
}

interface StartLoginResponse {
  authorizeUrl: string
}

export async function fetchSession(signal?: AbortSignal): Promise<AuthSession> {
  const response = await fetch('/api/auth/session', {
    credentials: 'include',
    signal,
  })

  if (!response.ok) {
    throw new Error('Unable to restore the Spotify session.')
  }

  return (await response.json()) as AuthSession
}

export async function startLogin(): Promise<void> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Unable to start Spotify sign-in.')
  }

  const body = (await response.json()) as StartLoginResponse
  window.location.assign(body.authorizeUrl)
}

export async function signOut(): Promise<AuthSession> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Unable to sign out of the Spotify session.')
  }

  return (await response.json()) as AuthSession
}

export function getDefaultSession(): AuthSession {
  return defaultSession
}
