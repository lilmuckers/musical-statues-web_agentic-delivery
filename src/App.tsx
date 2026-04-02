import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchPlaybackAccessToken, fetchSession, getDefaultSession, signOut, startLogin } from './auth'
import { deriveAppPhaseFromSession, getNextPhase, getPreviousPhase, phaseDefinitions, phaseOrder } from './appShell'
import { getDefaultPlaybackReadiness, initialisePlaybackDevice, loadSpotifySdk, unlockPlaybackDevice, type PlaybackController } from './playback'
import type { AppPhase, AuthSession, HostAuthState, PlaybackReadiness } from './types'

const futureSlices = [
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
    body: 'The host session is active. The browser playback device can now be prepared in-app without reworking auth/session architecture.',
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

function getPlaybackStatusTone(state: PlaybackReadiness['state']): 'neutral' | 'good' | 'warning' {
  switch (state) {
    case 'device-ready':
      return 'good'
    case 'unsupported-browser':
    case 'device-error':
      return 'warning'
    default:
      return 'neutral'
  }
}

function getReadinessChecks(session: AuthSession, playback: PlaybackReadiness): string[] {
  return [
    `Spotify host session: ${session.status === 'session-ready' ? 'ready' : authStateCopy[session.status].title.toLowerCase()}`,
    `Browser playback device: ${playback.message}`,
    'Playlist selected and validated (placeholder for later slice)',
  ]
}

export function App() {
  const [phase, setPhase] = useState<AppPhase>('setup')
  const [session, setSession] = useState<AuthSession>(() => getDefaultSession())
  const [playback, setPlayback] = useState<PlaybackReadiness>(() => getDefaultPlaybackReadiness())
  const [loadingSession, setLoadingSession] = useState(true)
  const [busyAction, setBusyAction] = useState<'sign-in' | 'sign-out' | 'prepare-device' | 'unlock-device' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const controllerRef = useRef<PlaybackController | null>(null)

  const definition = phaseDefinitions[phase]
  const nextPhase = useMemo(() => getNextPhase(phase), [phase])
  const previousPhase = useMemo(() => getPreviousPhase(phase), [phase])
  const authCopy = authStateCopy[session.status]
  const readinessChecks = useMemo(() => getReadinessChecks(session, playback), [playback, session])

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
          setPlayback(getDefaultPlaybackReadiness())
          setPhase('setup')
          clearAuthErrorQueryParam()
          return
        }

        setSession(restored)
        setPhase(deriveAppPhaseFromSession(restored))
      } catch (error) {
        const message = authErrorMessage ?? (error instanceof Error ? error.message : 'Unable to restore Spotify session.')
        setSession({
          ...getDefaultSession(),
          status: 'session-expired',
          canResume: true,
          failureReason: message,
        })
        setPlayback(getDefaultPlaybackReadiness())
        clearAuthErrorQueryParam()
      } finally {
        setLoadingSession(false)
      }
    }

    void restoreSession()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (session.status !== 'session-ready') {
      controllerRef.current?.disconnect()
      controllerRef.current = null
      setPlayback(getDefaultPlaybackReadiness())
      setPhase('setup')
      return
    }

    if (playback.state === 'device-ready') {
      setPhase('ready')
    } else {
      setPhase('setup')
    }
  }, [playback.state, session.status])

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
      controllerRef.current?.disconnect()
      controllerRef.current = null
      const signedOut = await signOut()
      setSession(signedOut)
      setPlayback(getDefaultPlaybackReadiness())
      setPhase('setup')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign out of the Spotify session.'
      setActionError(message)
    } finally {
      setBusyAction(null)
    }
  }

  async function handlePrepareDevice() {
    setActionError(null)
    setBusyAction('prepare-device')
    controllerRef.current?.disconnect()
    controllerRef.current = null

    try {
      setPlayback({
        state: 'sdk-loading',
        deviceName: null,
        deviceId: null,
        message: 'Loading the Spotify Web Playback SDK…',
        needsUserAction: false,
        isRecoverable: false,
        sdkLoaded: false,
      })

      await loadSpotifySdk()

      setPlayback({
        state: 'sdk-ready',
        deviceName: 'Musical Statues Web Player',
        deviceId: null,
        message: 'Spotify SDK loaded. Creating the browser playback device…',
        needsUserAction: false,
        isRecoverable: false,
        sdkLoaded: true,
      })

      const accessToken = await fetchPlaybackAccessToken()
      const controller = await initialisePlaybackDevice(accessToken, setPlayback)
      controllerRef.current = controller
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to prepare the Spotify browser playback device.'
      const isUnsupported = message.includes('browser') || message.includes('secure context') || message.includes('media capabilities')

      setPlayback({
        state: isUnsupported ? 'unsupported-browser' : 'device-error',
        deviceName: 'Musical Statues Web Player',
        deviceId: null,
        message,
        needsUserAction: false,
        isRecoverable: !isUnsupported,
        sdkLoaded: false,
      })
      setActionError(message)
    } finally {
      setBusyAction(null)
    }
  }

  async function handleUnlockPlayback() {
    setActionError(null)
    setBusyAction('unlock-device')

    try {
      const readiness = await unlockPlaybackDevice(controllerRef.current)
      setPlayback((current) => ({
        ...readiness,
        deviceId: current.deviceId,
        deviceName: current.deviceName ?? readiness.deviceName,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to complete the browser audio unlock step.'
      setPlayback((current) => ({
        ...current,
        state: 'device-error',
        message,
        needsUserAction: false,
        isRecoverable: true,
      }))
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
          Spotify auth/session lifecycle and browser playback-device readiness are now wired into the facilitator shell,
          with playlist preparation and gameplay controls still deferred to later slices.
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
          <h2>Playback device readiness</h2>
          <p className={`status-chip status-chip--${getPlaybackStatusTone(playback.state)}`}>{playback.state.replace(/-/g, ' ')}</p>
          <p>{playback.message}</p>
          {playback.deviceName ? (
            <dl className="profile-list">
              <div>
                <dt>Device label</dt>
                <dd>{playback.deviceName}</dd>
              </div>
              {playback.deviceId ? (
                <div>
                  <dt>Spotify device id</dt>
                  <dd>{playback.deviceId}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          <div className="stacked-actions">
            <button
              type="button"
              className="primary"
              onClick={() => void handlePrepareDevice()}
              disabled={session.status !== 'session-ready' || busyAction !== null}
            >
              {busyAction === 'prepare-device' ? 'Preparing device…' : playback.isRecoverable ? 'Retry device setup' : 'Prepare browser playback'}
            </button>
            <button
              type="button"
              onClick={() => void handleUnlockPlayback()}
              disabled={playback.state !== 'user-action-required' || busyAction !== null}
            >
              {busyAction === 'unlock-device' ? 'Unlocking audio…' : 'Unlock browser audio'}
            </button>
          </div>
          <ul>
            <li>Use a supported desktop browser with audio enabled.</li>
            <li>Spotify browser playback requires a Premium host account.</li>
            <li>The unlock action is the host-visible step for autoplay/user-gesture requirements.</li>
            <li>If setup fails, retry in-app rather than reloading the page.</li>
          </ul>
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
              The shell restores same-origin host session state, loads the Spotify Web Playback SDK, creates a browser device,
              and keeps autoplay/user-gesture guidance visible as an explicit in-app step.
            </p>
          </article>
          <article>
            <h3>Recovery posture</h3>
            <p>
              Device-init failures and unsupported browser conditions are surfaced in-app, and recoverable failures can be retried without forcing a full page reload.
            </p>
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
