import { useEffect, useMemo, useState } from 'react'
import { fetchSession, getDefaultSession, signOut, startLogin } from './auth'
import { getNextPhase, getPreviousPhase, phaseDefinitions, phaseOrder } from './appShell'
import type { AppPhase, AuthSession, HostAuthState } from './types'

const readinessChecks = [
  'Spotify host session established',
  'Browser playback device prepared (placeholder for issue #4)',
  'Playlist selected and validated (placeholder for later slice)',
]

const futureSlices = [
  'Playback device readiness and browser constraints',
  'Playlist/session preparation',
  'Gameplay state machine and round controls',
  'Reactive visualisation and freeze transition',
]

const authStateCopy: Record<HostAuthState, { title: string; body: string }> = {
  'signed-out': {
    title: 'Signed out',
    body: 'Start Spotify sign-in to establish the host session. Client secrets and refresh handling stay on the backend session surface.',
  },
  'auth-in-progress': {
    title: 'Auth in progress',
    body: 'Spotify sign-in is being completed. The app will restore your host session once the backend exchange succeeds.',
  },
  'session-ready': {
    title: 'Session ready',
    body: 'The host session is active and ready for playback-device setup in the next delivery slice.',
  },
  'not-premium': {
    title: 'Playback ineligible',
    body: 'This Spotify account is authenticated but not eligible for browser playback. Premium is required for the MVP playback path.',
  },
  'session-expired': {
    title: 'Session expired / refresh failed',
    body: 'The backend could not restore or refresh the Spotify session. Sign in again to continue.',
  },
}

function getAuthErrorMessage(authError: string | null): string | null {
  if (!authError) {
    return null
  }

  if (authError === 'state_mismatch') {
    return 'Spotify sign-in could not be completed safely because the auth state check failed. Please try again.'
  }

  if (authError === 'access_denied') {
    return 'Spotify sign-in was cancelled or permissions were denied before the host session could be established.'
  }

  return `Spotify sign-in failed: ${authError.replace(/_/g, ' ')}.`
}

function clearAuthErrorQueryParam() {
  const url = new URL(window.location.href)

  if (!url.searchParams.has('authError')) {
    return
  }

  url.searchParams.delete('authError')
  window.history.replaceState({}, document.title, url.toString())
}

function getAuthStatusTone(status: HostAuthState): 'neutral' | 'good' | 'warning' {
  switch (status) {
    case 'session-ready':
      return 'good'
    case 'not-premium':
    case 'session-expired':
      return 'warning'
    default:
      return 'neutral'
  }
}

export function App() {
  const [phase, setPhase] = useState<AppPhase>('setup')
  const [session, setSession] = useState<AuthSession>(() => getDefaultSession())
  const [loadingSession, setLoadingSession] = useState(true)
  const [busyAction, setBusyAction] = useState<'sign-in' | 'sign-out' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const definition = phaseDefinitions[phase]
  const nextPhase = useMemo(() => getNextPhase(phase), [phase])
  const previousPhase = useMemo(() => getPreviousPhase(phase), [phase])
  const authCopy = authStateCopy[session.status]

  useEffect(() => {
    const controller = new AbortController()
    const authError = new URLSearchParams(window.location.search).get('authError')
    const authErrorMessage = getAuthErrorMessage(authError)

    async function restoreSession() {
      try {
        const restored = await fetchSession(controller.signal)

        if (authErrorMessage) {
          setSession({
            ...getDefaultSession(),
            status: 'session-expired',
            canResume: true,
            failureReason: authErrorMessage,
          })
          setPhase('setup')
          clearAuthErrorQueryParam()
          return
        }

        setSession(restored)
        setPhase(restored.status === 'session-ready' ? 'ready' : 'setup')
      } catch (error) {
        const message = authErrorMessage ?? (error instanceof Error ? error.message : 'Unable to restore Spotify session.')
        setSession({
          ...getDefaultSession(),
          status: 'session-expired',
          canResume: true,
          failureReason: message,
        })
        clearAuthErrorQueryParam()
      } finally {
        setLoadingSession(false)
      }
    }

    void restoreSession()

    return () => controller.abort()
  }, [])

  async function handleSignIn() {
    setActionError(null)
    setBusyAction('sign-in')
    setSession((current) => ({ ...current, status: 'auth-in-progress', failureReason: null }))

    try {
      await startLogin()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start Spotify sign-in.'
      setSession((current) => ({ ...current, status: 'signed-out', failureReason: message }))
      setActionError(message)
      setBusyAction(null)
    }
  }

  async function handleSignOut() {
    setActionError(null)
    setBusyAction('sign-out')

    try {
      const signedOut = await signOut()
      setSession(signedOut)
      setPhase('setup')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign out of the Spotify session.'
      setActionError(message)
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <p className="eyebrow">Musical Statues Web</p>
        <h1>Host control baseline</h1>
        <p className="lede">
          Spotify auth/session lifecycle is now wired into the facilitator shell, with playback device
          orchestration intentionally deferred to issue #4.
        </p>

        <div className="panel">
          <h2>Host auth state</h2>
          {loadingSession ? (
            <p>Restoring host session…</p>
          ) : (
            <>
              <p className={`status-chip status-chip--${getAuthStatusTone(session.status)}`}>{authCopy.title}</p>
              <p>{authCopy.body}</p>
              {session.profile ? (
                <dl className="profile-list">
                  <div>
                    <dt>Host</dt>
                    <dd>{session.profile.displayName}</dd>
                  </div>
                  <div>
                    <dt>Spotify plan</dt>
                    <dd>{session.profile.product}</dd>
                  </div>
                  {session.expiresAt ? (
                    <div>
                      <dt>Session expiry</dt>
                      <dd>{new Date(session.expiresAt).toLocaleString()}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
              {session.failureReason ? <p className="error-copy">{session.failureReason}</p> : null}
              {actionError ? <p className="error-copy">{actionError}</p> : null}
              <div className="stacked-actions">
                <button
                  type="button"
                  className="primary"
                  onClick={() => void handleSignIn()}
                  disabled={busyAction !== null || session.status === 'auth-in-progress'}
                >
                  {busyAction === 'sign-in' || session.status === 'auth-in-progress' ? 'Connecting to Spotify…' : 'Sign in with Spotify'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  disabled={!session.isAuthenticated || busyAction !== null}
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>

        <div className="panel">
          <h2>Round phases</h2>
          <ol className="phase-list">
            {phaseOrder.map((phaseId) => {
              const item = phaseDefinitions[phaseId]
              const isActive = phaseId === phase

              return (
                <li key={phaseId} className={isActive ? 'is-active' : undefined}>
                  <button type="button" onClick={() => setPhase(phaseId)}>
                    <span>{item.label}</span>
                    <small>{item.heading}</small>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>

        <div className="panel">
          <h2>Readiness scaffold</h2>
          <ul>
            {readinessChecks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="stage" style={{ '--phase-accent': definition.accent } as React.CSSProperties}>
        <section className="hero-card" aria-labelledby="phase-heading">
          <p className="status-pill">Current phase: {definition.label}</p>
          <h2 id="phase-heading">{definition.heading}</h2>
          <p>{definition.summary}</p>

          <div className="hero-card__actions">
            <button type="button" onClick={() => previousPhase && setPhase(previousPhase)} disabled={!previousPhase}>
              Previous state
            </button>
            <button type="button" className="primary" onClick={() => nextPhase && setPhase(nextPhase)} disabled={!nextPhase}>
              {definition.nextActionLabel ?? 'Session complete'}
            </button>
          </div>
        </section>

        <section className="panel panel--grid" aria-label="Delivery baseline details">
          <article>
            <h3>What exists now</h3>
            <p>
              The shell now restores same-origin host session state on reload, surfaces Premium/auth expiry conditions,
              and keeps sign-out scoped to backend-session invalidation plus local UI reset.
            </p>
          </article>
          <article>
            <h3>Out of scope in this slice</h3>
            <ul>
              <li>Playback device orchestration beyond auth-continuity placeholders</li>
              <li>Playlist browsing/selection workflows</li>
              <li>Gameplay controls beyond the existing scaffold</li>
            </ul>
          </article>
          <article>
            <h3>Next integration slices</h3>
            <ul>
              {futureSlices.map((slice) => (
                <li key={slice}>{slice}</li>
              ))}
            </ul>
          </article>
        </section>
      </main>
    </div>
  )
}
