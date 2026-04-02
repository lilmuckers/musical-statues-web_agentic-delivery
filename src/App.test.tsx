import { render, screen, waitFor } from '@testing-library/react'
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

vi.mock('./playback', () => ({
  getDefaultPlaybackReadiness: vi.fn(() => ({
    state: 'idle',
    deviceName: null,
    deviceId: null,
    message: 'Sign in with an eligible Spotify Premium account to prepare the browser playback device.',
    needsUserAction: false,
    isRecoverable: false,
    sdkLoaded: false,
  })),
  loadSpotifySdk: vi.fn(),
  initialisePlaybackDevice: vi.fn(),
  unlockPlaybackDevice: vi.fn(),
}))

const authModule = await import('./auth')
const playbackModule = await import('./playback')

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState({}, '', '/')
})

describe('App playback readiness slice', () => {
  it('restores a ready Spotify host session and surfaces the host profile', async () => {
    vi.mocked(authModule.fetchSession).mockResolvedValue({
      status: 'session-ready',
      isAuthenticated: true,
      profile: {
        displayName: 'Patrick',
        product: 'premium',
      },
      scopes: ['streaming'],
      expiresAt: '2026-04-02T11:00:00.000Z',
      canResume: true,
      failureReason: null,
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Session ready')).toBeInTheDocument()
    })

    expect(screen.getByText('Patrick')).toBeInTheDocument()
    expect(screen.getByText('premium')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prepare browser playback' })).toBeEnabled()
  })

  it('surfaces callback auth failure query params as a host-visible error state', async () => {
    window.history.replaceState({}, '', '/?authError=state_mismatch')
    vi.mocked(authModule.fetchSession).mockResolvedValue({
      status: 'signed-out',
      isAuthenticated: false,
      profile: null,
      scopes: [],
      expiresAt: null,
      canResume: false,
      failureReason: null,
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Session expired / refresh failed')).toBeInTheDocument()
    })

    expect(
      screen.getByText('Spotify sign-in could not be completed safely because the auth state check failed. Please try again.'),
    ).toBeInTheDocument()
    expect(window.location.search).toBe('')
  })

  it('prepares the browser playback device and prompts for browser audio unlock', async () => {
    const user = userEvent.setup()
    const disconnect = vi.fn()
    const activateElement = vi.fn().mockResolvedValue(undefined)

    vi.mocked(authModule.fetchSession).mockResolvedValue({
      status: 'session-ready',
      isAuthenticated: true,
      profile: {
        displayName: 'Patrick',
        product: 'premium',
      },
      scopes: ['streaming'],
      expiresAt: '2026-04-02T11:00:00.000Z',
      canResume: true,
      failureReason: null,
    })
    vi.mocked(authModule.fetchPlaybackAccessToken).mockResolvedValue('playback-token')
    vi.mocked(playbackModule.loadSpotifySdk).mockResolvedValue()
    vi.mocked(playbackModule.initialisePlaybackDevice).mockImplementation(async (_token, onStateChange) => {
      onStateChange({
        state: 'user-action-required',
        deviceName: 'Musical Statues Web Player',
        deviceId: 'device-123',
        message: 'Browser playback device created. Use the unlock action once to satisfy browser audio/autoplay requirements.',
        needsUserAction: true,
        isRecoverable: true,
        sdkLoaded: true,
      })
      return { disconnect, activateElement }
    })
    vi.mocked(playbackModule.unlockPlaybackDevice).mockResolvedValue({
      state: 'device-ready',
      deviceName: 'Musical Statues Web Player',
      deviceId: null,
      message: 'Audio unlock completed. The browser playback device is ready for the next integration slice.',
      needsUserAction: false,
      isRecoverable: true,
      sdkLoaded: true,
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Prepare browser playback' })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: 'Prepare browser playback' }))

    await waitFor(() => {
      expect(screen.getByText('user action required')).toBeInTheDocument()
    })
    expect(screen.getByText('Playback device readiness')).toBeInTheDocument()
    expect(screen.getAllByText(/Browser playback device created/)).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Unlock browser audio' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Unlock browser audio' }))

    await waitFor(() => {
      expect(screen.getByText('device ready')).toBeInTheDocument()
    })
    expect(screen.getAllByText(/Audio unlock completed/)).toHaveLength(2)
    expect(screen.getByText('Current phase: Ready')).toBeInTheDocument()
  })

  it('surfaces recoverable device-init failure and allows retry in-app', async () => {
    const user = userEvent.setup()

    vi.mocked(authModule.fetchSession).mockResolvedValue({
      status: 'session-ready',
      isAuthenticated: true,
      profile: {
        displayName: 'Patrick',
        product: 'premium',
      },
      scopes: ['streaming'],
      expiresAt: '2026-04-02T11:00:00.000Z',
      canResume: true,
      failureReason: null,
    })
    vi.mocked(playbackModule.loadSpotifySdk).mockResolvedValue()
    vi.mocked(authModule.fetchPlaybackAccessToken).mockRejectedValueOnce(new Error('Spotify host session is not available for playback device setup.'))
    vi.mocked(authModule.fetchPlaybackAccessToken).mockResolvedValueOnce('playback-token')
    vi.mocked(playbackModule.initialisePlaybackDevice).mockImplementation(async (_token, onStateChange) => {
      onStateChange({
        state: 'user-action-required',
        deviceName: 'Musical Statues Web Player',
        deviceId: 'device-123',
        message: 'Browser playback device created. Use the unlock action once to satisfy browser audio/autoplay requirements.',
        needsUserAction: true,
        isRecoverable: true,
        sdkLoaded: true,
      })
      return { disconnect: vi.fn(), activateElement: vi.fn().mockResolvedValue(undefined) }
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Prepare browser playback' })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: 'Prepare browser playback' }))

    await waitFor(() => {
      expect(screen.getByText('device error')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Retry device setup' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Retry device setup' }))

    await waitFor(() => {
      expect(screen.getByText('user action required')).toBeInTheDocument()
    })
  })
})
