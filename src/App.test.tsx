import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

vi.mock('./auth', () => ({
  fetchSession: vi.fn(),
  fetchPlaybackAccessToken: vi.fn(),
  getDefaultSession: vi.fn(() => ({
    status: 'signed-out',
    isAuthenticated: false,
    profile: null,
    scopes: [],
    expiresAt: null,
    canResume: false,
    failureReason: null,
  })),
  startLogin: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('./playlist', () => ({
  fetchPlaylists: vi.fn(),
  preparePlaylistSession: vi.fn(),
  getPlaylistPreparationSummary: vi.fn((preparation) => preparation ? `${preparation.playableTracks.length} playable tracks ready, ${preparation.skippedTracks.length} skipped.` : 'No playlist prepared yet.'),
}))

vi.mock('./playback', () => ({
  getDefaultPlaybackReadiness: vi.fn(() => ({
    state: 'idle', deviceName: null, deviceId: null, message: 'Sign in with an eligible Spotify Premium account to prepare the browser playback device.', needsUserAction: false, isRecoverable: false, sdkLoaded: false,
  })),
  loadSpotifySdk: vi.fn(),
  initialisePlaybackDevice: vi.fn(),
  unlockPlaybackDevice: vi.fn(),
}))

const authModule = await import('./auth')
const playlistModule = await import('./playlist')
const playbackModule = await import('./playback')

function mockReadyHostShell() {
  vi.mocked(authModule.fetchSession).mockResolvedValue({ status: 'session-ready', isAuthenticated: true, profile: { displayName: 'Patrick', product: 'premium' }, scopes: ['streaming'], expiresAt: '2026-04-02T11:00:00.000Z', canResume: true, failureReason: null })
  vi.mocked(authModule.fetchPlaybackAccessToken).mockResolvedValue('playback-token')
  vi.mocked(playbackModule.loadSpotifySdk).mockResolvedValue()
  vi.mocked(playbackModule.initialisePlaybackDevice).mockImplementation(async (_token, onStateChange) => {
    onStateChange({ state: 'user-action-required', deviceName: 'Musical Statues Web Player', deviceId: 'device-123', message: 'Browser playback device created. Use the unlock action once to satisfy browser audio/autoplay requirements.', needsUserAction: true, isRecoverable: true, sdkLoaded: true })
    return { disconnect: vi.fn(), activateElement: vi.fn().mockResolvedValue(undefined) }
  })
  vi.mocked(playbackModule.unlockPlaybackDevice).mockResolvedValue({ state: 'device-ready', deviceName: 'Musical Statues Web Player', deviceId: null, message: 'Audio unlock completed. The browser playback device is ready for the next integration slice.', needsUserAction: false, isRecoverable: true, sdkLoaded: true })
}

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState({}, '', '/')
  vi.mocked(playlistModule.fetchPlaylists).mockResolvedValue([
    { id: 'playlist-1', name: 'Party Starters', description: null, imageUrl: null, ownerName: 'Patrick', trackCount: 3, isCollaborative: false, isPublic: false },
    { id: 'playlist-2', name: 'Cool Down', description: null, imageUrl: null, ownerName: 'Patrick', trackCount: 2, isCollaborative: false, isPublic: false },
  ])
})

describe('App gameplay control slice', () => {
  it('loads Spotify playlists for a ready authenticated host', async () => {
    vi.mocked(authModule.fetchSession).mockResolvedValue({ status: 'session-ready', isAuthenticated: true, profile: { displayName: 'Patrick', product: 'premium' }, scopes: ['streaming'], expiresAt: '2026-04-02T11:00:00.000Z', canResume: true, failureReason: null })
    render(<App />)
    await waitFor(() => expect(screen.getByText('Party Starters (3 tracks)')).toBeInTheDocument())
  })

  it('gates ready state until playlist preparation and playback readiness are both satisfied', async () => {
    const user = userEvent.setup()
    mockReadyHostShell()
    vi.mocked(playlistModule.preparePlaylistSession).mockResolvedValue({
      selectedPlaylistId: 'playlist-1', selectedPlaylistName: 'Party Starters', totalTracks: 3,
      playableTracks: [{ id: 'track-1', name: 'Freeze Dance', artistNames: ['The Movers'], durationMs: 180000, albumName: 'Party', isPlayable: true, reason: null }],
      skippedTracks: [{ id: 'track-2', name: 'Unavailable Jam', artistNames: ['The Sleepers'], durationMs: 120000, albumName: 'Party', isPlayable: false, reason: 'Track is unavailable or not playable for this session.' }],
    })

    render(<App />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Prepare browser playback' })).toBeEnabled())
    expect(screen.getByText('Current phase: Setup')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Prepare browser playback' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unlock browser audio' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Unlock browser audio' }))
    await user.click(screen.getByRole('button', { name: 'Prepare session playlist' }))

    await waitFor(() => expect(screen.getByText('Current phase: Ready')).toBeInTheDocument())
    expect(screen.getAllByText(/1 playable tracks ready, 1 skipped/)).toHaveLength(2)
    expect(screen.getByText(/Unavailable Jam/)).toBeInTheDocument()
  })

  it('does not expose direct phase-navigation buttons that can bypass the gameplay reducer', async () => {
    render(<App />)

    const roundPhasesPanel = screen.getByText('Round phases').closest('.panel') as HTMLElement

    await waitFor(() => {
      expect(within(roundPhasesPanel).queryAllByRole('button')).toHaveLength(0)
    })
    expect(within(roundPhasesPanel).getByText('Reached only through the Start round gameplay control.')).toBeInTheDocument()
    expect(within(roundPhasesPanel).getByText('Reached only through the Manual stop gameplay control.')).toBeInTheDocument()
    expect(within(roundPhasesPanel).getByText('Reached only through the End session gameplay control.')).toBeInTheDocument()
  })

  it('drives the visual layer distinctly for ready, playing, freeze, and session-end phases', async () => {
    const user = userEvent.setup()
    mockReadyHostShell()
    vi.mocked(playlistModule.preparePlaylistSession).mockResolvedValue({
      selectedPlaylistId: 'playlist-1', selectedPlaylistName: 'Party Starters', totalTracks: 2,
      playableTracks: [
        { id: 'track-1', name: 'Freeze Dance', artistNames: ['The Movers'], durationMs: 180000, albumName: 'Party', isPlayable: true, reason: null },
        { id: 'track-2', name: 'Statues Theme', artistNames: ['The Movers'], durationMs: 175000, albumName: 'Party', isPlayable: true, reason: null },
      ],
      skippedTracks: [],
    })

    render(<App />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Prepare browser playback' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Prepare browser playback' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unlock browser audio' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Unlock browser audio' }))
    await user.click(screen.getByRole('button', { name: 'Prepare session playlist' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ready for the next round' })).toBeInTheDocument())

    const controlsPanel = screen.getByText('Gameplay controls').closest('.panel') as HTMLElement
    await user.click(within(controlsPanel).getByRole('button', { name: 'Start round' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Keep moving' })).toBeInTheDocument())

    await user.click(within(controlsPanel).getByRole('button', { name: 'Manual stop' }))
    await waitFor(() => expect(screen.getAllByText('Freeze!').length).toBeGreaterThan(0))
    expect(screen.getByRole('status')).toHaveTextContent('The music has stopped — hold still now.')

    await user.click(within(controlsPanel).getByRole('button', { name: 'End session' }))
    await waitFor(() => expect(screen.getAllByRole('heading', { name: 'Session complete' }).length).toBeGreaterThan(0))
  })

  it('supports start, manual stop, next-round reset, and end session via deterministic host controls', async () => {
    const user = userEvent.setup()
    mockReadyHostShell()
    vi.mocked(playlistModule.preparePlaylistSession).mockResolvedValue({
      selectedPlaylistId: 'playlist-1', selectedPlaylistName: 'Party Starters', totalTracks: 2,
      playableTracks: [
        { id: 'track-1', name: 'Freeze Dance', artistNames: ['The Movers'], durationMs: 180000, albumName: 'Party', isPlayable: true, reason: null },
        { id: 'track-2', name: 'Statues Theme', artistNames: ['The Movers'], durationMs: 175000, albumName: 'Party', isPlayable: true, reason: null },
      ],
      skippedTracks: [],
    })

    render(<App />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Prepare browser playback' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Prepare browser playback' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unlock browser audio' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Unlock browser audio' }))
    await user.click(screen.getByRole('button', { name: 'Prepare session playlist' }))
    await waitFor(() => expect(screen.getByText('Current phase: Ready')).toBeInTheDocument())

    const controlsPanel = screen.getByText('Gameplay controls').closest('.panel') as HTMLElement

    await user.click(within(controlsPanel).getByRole('button', { name: 'Start round' }))
    await waitFor(() => expect(screen.getByText('Current phase: Playing')).toBeInTheDocument())
    expect(within(controlsPanel).getByText(/Round 1 is live/)).toBeInTheDocument()
    expect(within(controlsPanel).getByText('Freeze Dance')).toBeInTheDocument()

    await user.click(within(controlsPanel).getByRole('button', { name: 'Manual stop' }))
    await waitFor(() => expect(screen.getByText('Current phase: Freeze')).toBeInTheDocument())
    expect(within(controlsPanel).getByText(/Round 1 stopped/)).toBeInTheDocument()

    await user.click(within(controlsPanel).getByRole('button', { name: 'Next round reset' }))
    await waitFor(() => expect(screen.getByText('Current phase: Ready')).toBeInTheDocument())
    expect(within(controlsPanel).getByText(/Round 1 complete/)).toBeInTheDocument()

    await user.click(within(controlsPanel).getByRole('button', { name: 'Start round' }))
    await waitFor(() => expect(within(controlsPanel).getByText(/Round 2 is live/)).toBeInTheDocument())
    expect(within(controlsPanel).getByText('Statues Theme')).toBeInTheDocument()

    await user.click(within(controlsPanel).getByRole('button', { name: 'End session' }))
    await waitFor(() => expect(screen.getByText('Current phase: Session end')).toBeInTheDocument())
    expect(within(controlsPanel).getByText(/Session ended after round 2/)).toBeInTheDocument()
    expect(within(controlsPanel).getByRole('button', { name: 'Start round' })).toBeDisabled()
  })

  it('invalidates stale prepared session state when the selected playlist changes', async () => {
    const user = userEvent.setup()
    mockReadyHostShell()
    vi.mocked(playlistModule.preparePlaylistSession).mockResolvedValue({
      selectedPlaylistId: 'playlist-1', selectedPlaylistName: 'Party Starters', totalTracks: 3,
      playableTracks: [{ id: 'track-1', name: 'Freeze Dance', artistNames: ['The Movers'], durationMs: 180000, albumName: 'Party', isPlayable: true, reason: null }],
      skippedTracks: [],
    })

    render(<App />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Prepare browser playback' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Prepare browser playback' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unlock browser audio' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Unlock browser audio' }))
    await user.click(screen.getByRole('button', { name: 'Prepare session playlist' }))

    await waitFor(() => expect(screen.getByText('Current phase: Ready')).toBeInTheDocument())
    await user.selectOptions(screen.getByLabelText('Playlist'), 'playlist-2')

    await waitFor(() => expect(screen.getByText('Current phase: Setup')).toBeInTheDocument())
    expect(screen.getByText('No playlist prepared yet.')).toBeInTheDocument()
    expect(screen.queryByText(/Party Starters: 1 playable/)).not.toBeInTheDocument()
  })
})
