import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

vi.mock('./auth', () => ({
  fetchSession: vi.fn(),
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

const authModule = await import('./auth')

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState({}, '', '/')
})

describe('App shell baseline', () => {
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
    expect(screen.getByText('Current phase: Ready')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Session ready for playback setup' })).toBeInTheDocument()
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
    expect(screen.getByText('Current phase: Setup')).toBeInTheDocument()
  })

  it('starts Spotify sign-in and keeps the UI in an auth-in-progress state until redirect', async () => {
    const user = userEvent.setup()
    vi.mocked(authModule.fetchSession).mockResolvedValue({
      status: 'signed-out',
      isAuthenticated: false,
      profile: null,
      scopes: [],
      expiresAt: null,
      canResume: false,
      failureReason: null,
    })
    vi.mocked(authModule.startLogin).mockResolvedValue()

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign in with Spotify' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Sign in with Spotify' }))

    expect(authModule.startLogin).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Auth in progress')).toBeInTheDocument()
  })

  it('signs out and returns the shell to setup state', async () => {
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
    vi.mocked(authModule.signOut).mockResolvedValue({
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
      expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(screen.getByText('Signed out')).toBeInTheDocument()
    })
    expect(screen.getByText('Current phase: Setup')).toBeInTheDocument()
  })

  it('still allows phase progression through placeholder gameplay states', async () => {
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

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Current phase: Ready')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Start round' }))

    expect(screen.getByText('Current phase: Playing')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trigger freeze' })).toBeInTheDocument()
  })
})
