import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchPlaybackAccessToken, fetchSession, getDefaultSession, signOut, startLogin } from './auth'
import { getNextPhase, getPreviousPhase, phaseDefinitions, phaseOrder } from './appShell'
import { fetchPlaylists, getPlaylistPreparationSummary, preparePlaylistSession } from './playlist'
import { getDefaultPlaybackReadiness, initialisePlaybackDevice, loadSpotifySdk, unlockPlaybackDevice, type PlaybackController } from './playback'
import type { AppPhase, AuthSession, HostAuthState, PlaybackReadiness, PlaylistPreparation, PlaylistSummary } from './types'

const futureSlices = [
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
    body: 'The host session is active. The browser playback device and playlist session can now be prepared in-app without reworking auth/session architecture.',
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
  if (!authError) return null
  if (authError === 'state_mismatch') return 'Spotify sign-in could not be completed safely because the auth state check failed. Please try again.'
  if (authError === 'access_denied') return 'Spotify sign-in was cancelled or permissions were denied before the host session could be established.'
  return `Spotify sign-in failed: ${authError.replace(/_/g, ' ')}.`
}

function clearAuthErrorQueryParam() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('authError')) return
  url.searchParams.delete('authError')
  window.history.replaceState({}, document.title, url.toString())
}

function getAuthStatusTone(status: HostAuthState): 'neutral' | 'good' | 'warning' {
  switch (status) {
    case 'session-ready': return 'good'
    case 'not-premium':
    case 'session-expired': return 'warning'
    default: return 'neutral'
  }
}

function getPlaybackStatusTone(state: PlaybackReadiness['state']): 'neutral' | 'good' | 'warning' {
  switch (state) {
    case 'device-ready': return 'good'
    case 'unsupported-browser':
    case 'device-error': return 'warning'
    default: return 'neutral'
  }
}

function getSetupReadinessChecks(session: AuthSession, playback: PlaybackReadiness, preparation: PlaylistPreparation | null): string[] {
  return [
    `Spotify host session: ${session.status === 'session-ready' ? 'ready' : authStateCopy[session.status].title.toLowerCase()}`,
    `Browser playback device: ${playback.state === 'device-ready' ? 'ready' : playback.message}`,
    `Playlist session preparation: ${getPlaylistPreparationSummary(preparation)}`,
  ]
}

export function App() {
  const [phase, setPhase] = useState<AppPhase>('setup')
  const [session, setSession] = useState<AuthSession>(() => getDefaultSession())
  const [playback, setPlayback] = useState<PlaybackReadiness>(() => getDefaultPlaybackReadiness())
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([])
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('')
  const [preparation, setPreparation] = useState<PlaylistPreparation | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [loadingPlaylists, setLoadingPlaylists] = useState(false)
  const [busyAction, setBusyAction] = useState<'sign-in' | 'sign-out' | 'prepare-device' | 'unlock-device' | 'prepare-session' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const controllerRef = useRef<PlaybackController | null>(null)

  const definition = phaseDefinitions[phase]
  const nextPhase = useMemo(() => getNextPhase(phase), [phase])
  const previousPhase = useMemo(() => getPreviousPhase(phase), [phase])
  const authCopy = authStateCopy[session.status]
  const setupChecks = useMemo(() => getSetupReadinessChecks(session, playback, preparation), [session, playback, preparation])
  const isReadyForSession = playback.state === 'device-ready' && Boolean(preparation?.playableTracks.length)

  useEffect(() => {
    const controller = new AbortController()
    const authError = new URLSearchParams(window.location.search).get('authError')
    const authErrorMessage = getAuthErrorMessage(authError)

    async function restoreSession() {
      try {
        const restored = await fetchSession(controller.signal)

        if (authErrorMessage) {
          setSession({ ...getDefaultSession(), status: 'session-expired', canResume: true, failureReason: authErrorMessage })
          setPlayback(getDefaultPlaybackReadiness())
          setPhase('setup')
          clearAuthErrorQueryParam()
          return
        }

        setSession(restored)
        setPhase('setup')
      } catch (error) {
        const message = authErrorMessage ?? (error instanceof Error ? error.message : 'Unable to restore Spotify session.')
        setSession({ ...getDefaultSession(), status: 'session-expired', canResume: true, failureReason: message })
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
      setPlaylists([])
      setSelectedPlaylistId('')
      setPreparation(null)
      setPhase('setup')
      return
    }

    if (playlists.length > 0 || loadingPlaylists) {
      return
    }

    async function loadLists() {
      setLoadingPlaylists(true)
      try {
        const items = await fetchPlaylists()
        setPlaylists(items)
        if (!selectedPlaylistId && items[0]) setSelectedPlaylistId(items[0].id)
      } catch (error) {
        setActionError(error instanceof Error ? error.message : 'Unable to load Spotify playlists.')
      } finally {
        setLoadingPlaylists(false)
      }
    }

    void loadLists()
  }, [loadingPlaylists, playlists.length, selectedPlaylistId, session.status])

  useEffect(() => {
    setPhase(isReadyForSession ? 'ready' : 'setup')
  }, [isReadyForSession])

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
      setPlaylists([])
      setSelectedPlaylistId('')
      setPreparation(null)
      setPhase('setup')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to sign out of the Spotify session.')
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
      setPlayback({ state: 'sdk-loading', deviceName: null, deviceId: null, message: 'Loading the Spotify Web Playback SDK…', needsUserAction: false, isRecoverable: false, sdkLoaded: false })
      await loadSpotifySdk()
      setPlayback({ state: 'sdk-ready', deviceName: 'Musical Statues Web Player', deviceId: null, message: 'Spotify SDK loaded. Creating the browser playback device…', needsUserAction: false, isRecoverable: false, sdkLoaded: true })
      const accessToken = await fetchPlaybackAccessToken()
      const controller = await initialisePlaybackDevice(accessToken, setPlayback)
      controllerRef.current = controller
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to prepare the Spotify browser playback device.'
      const isUnsupported = message.includes('browser') || message.includes('secure context') || message.includes('media capabilities')
      setPlayback({ state: isUnsupported ? 'unsupported-browser' : 'device-error', deviceName: 'Musical Statues Web Player', deviceId: null, message, needsUserAction: false, isRecoverable: !isUnsupported, sdkLoaded: false })
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
      setPlayback((current) => ({ ...readiness, deviceId: current.deviceId, deviceName: current.deviceName ?? readiness.deviceName }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to complete the browser audio unlock step.'
      setPlayback((current) => ({ ...current, state: 'device-error', message, needsUserAction: false, isRecoverable: true }))
      setActionError(message)
    } finally {
      setBusyAction(null)
    }
  }

  async function handlePrepareSession() {
    if (!selectedPlaylistId) return
    setActionError(null)
    setBusyAction('prepare-session')
    try {
      const prepared = await preparePlaylistSession(selectedPlaylistId)
      setPreparation(prepared)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to prepare the selected playlist session.')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <p className="eyebrow">Musical Statues Web</p>
        <h1>Host control baseline</h1>
        <p className="lede">Auth, browser playback readiness, and playlist/session preparation are now wired into the facilitator shell; gameplay flow remains deferred to the next slice.</p>

        <div className="panel">
          <h2>Host auth state</h2>
          {loadingSession ? <p>Restoring host session…</p> : <>
            <p className={`status-chip status-chip--${getAuthStatusTone(session.status)}`}>{authCopy.title}</p>
            <p>{authCopy.body}</p>
            {session.profile ? <dl className="profile-list"><div><dt>Host</dt><dd>{session.profile.displayName}</dd></div><div><dt>Spotify plan</dt><dd>{session.profile.product}</dd></div>{session.expiresAt ? <div><dt>Session expiry</dt><dd>{new Date(session.expiresAt).toLocaleString()}</dd></div> : null}</dl> : null}
            {session.failureReason ? <p className="error-copy">{session.failureReason}</p> : null}
            {actionError ? <p className="error-copy">{actionError}</p> : null}
            <div className="stacked-actions">
              <button type="button" className="primary" onClick={() => void handleSignIn()} disabled={busyAction !== null || session.status === 'auth-in-progress'}>{busyAction === 'sign-in' || session.status === 'auth-in-progress' ? 'Connecting to Spotify…' : 'Sign in with Spotify'}</button>
              <button type="button" onClick={() => void handleSignOut()} disabled={!session.isAuthenticated || busyAction !== null}>Sign out</button>
            </div>
          </>}
        </div>

        <div className="panel">
          <h2>Playback device readiness</h2>
          <p className={`status-chip status-chip--${getPlaybackStatusTone(playback.state)}`}>{playback.state.replace(/-/g, ' ')}</p>
          <p>{playback.message}</p>
          <div className="stacked-actions">
            <button type="button" className="primary" onClick={() => void handlePrepareDevice()} disabled={session.status !== 'session-ready' || busyAction !== null}>{busyAction === 'prepare-device' ? 'Preparing device…' : playback.isRecoverable ? 'Retry device setup' : 'Prepare browser playback'}</button>
            <button type="button" onClick={() => void handleUnlockPlayback()} disabled={playback.state !== 'user-action-required' || busyAction !== null}>{busyAction === 'unlock-device' ? 'Unlocking audio…' : 'Unlock browser audio'}</button>
          </div>
        </div>

        <div className="panel">
          <h2>Playlist session preparation</h2>
          {loadingPlaylists ? <p>Loading Spotify playlists…</p> : <>
            <label className="field-label" htmlFor="playlist-select">Playlist</label>
            <select id="playlist-select" value={selectedPlaylistId} onChange={(event) => setSelectedPlaylistId(event.target.value)} disabled={session.status !== 'session-ready' || busyAction !== null || playlists.length === 0}>
              <option value="">Select a playlist…</option>
              {playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name} ({playlist.trackCount} tracks)</option>)}
            </select>
            <div className="stacked-actions">
              <button type="button" className="primary" onClick={() => void handlePrepareSession()} disabled={!selectedPlaylistId || playback.state !== 'device-ready' || busyAction !== null}>{busyAction === 'prepare-session' ? 'Preparing playlist…' : 'Prepare session playlist'}</button>
            </div>
            <p>{getPlaylistPreparationSummary(preparation)}</p>
            {preparation ? <>
              <p><strong>{preparation.selectedPlaylistName}</strong>: {preparation.playableTracks.length} playable / {preparation.totalTracks} total.</p>
              {preparation.skippedTracks.length > 0 ? <ul>{preparation.skippedTracks.slice(0, 5).map((track) => <li key={track.id}>{track.name} — {track.reason}</li>)}</ul> : <p>No unusable tracks were flagged in the current playlist slice.</p>}
            </> : null}
          </>}
        </div>

        <div className="panel">
          <h2>Round phases</h2>
          <ol className="phase-list">{phaseOrder.map((phaseId) => { const item = phaseDefinitions[phaseId]; const isActive = phaseId === phase; return <li key={phaseId} className={isActive ? 'is-active' : undefined}><button type="button" onClick={() => setPhase(phaseId)}><span>{item.label}</span><small>{item.heading}</small></button></li> })}</ol>
        </div>

        <div className="panel">
          <h2>Readiness scaffold</h2>
          <ul>{setupChecks.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </aside>

      <main className="stage" style={{ '--phase-accent': definition.accent } as React.CSSProperties}>
        <section className="hero-card" aria-labelledby="phase-heading">
          <p className="status-pill">Current phase: {definition.label}</p>
          <h2 id="phase-heading">{definition.heading}</h2>
          <p>{definition.summary}</p>
          <div className="hero-card__actions">
            <button type="button" onClick={() => previousPhase && setPhase(previousPhase)} disabled={!previousPhase}>Previous state</button>
            <button type="button" className="primary" onClick={() => nextPhase && setPhase(nextPhase)} disabled={!nextPhase || (phase === 'setup' && !isReadyForSession)}>{definition.nextActionLabel ?? 'Session complete'}</button>
          </div>
        </section>

        <section className="panel panel--grid" aria-label="Delivery baseline details">
          <article><h3>What exists now</h3><p>The shell restores host session state, prepares the browser playback device, fetches Spotify playlists, and resolves a session-ready playable track list while visibly flagging skipped tracks.</p></article>
          <article><h3>Ready gating</h3><p>The app only enters Ready once both browser playback readiness and playlist/session preparation preconditions are satisfied.</p></article>
          <article><h3>Next integration slices</h3><ul>{futureSlices.map((slice) => <li key={slice}>{slice}</li>)}</ul></article>
        </section>
      </main>
    </div>
  )
}
