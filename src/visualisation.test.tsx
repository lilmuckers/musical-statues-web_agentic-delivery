import { render, screen, waitFor } from '@testing-library/react'
import { VisualisationLayer } from './visualisation'
import type { GameplayState, PlaylistPreparation } from './types'

vi.mock('./analysis', () => ({
  fetchTrackAnalysis: vi.fn(),
  createAnalysisCueSignal: vi.fn(),
}))

const analysisModule = await import('./analysis')

const baseGameplay: GameplayState = {
  status: 'idle',
  roundNumber: 0,
  activeTrackName: null,
  message: 'Prepare playback and a session playlist to unlock the first round.',
}

const preparation: PlaylistPreparation = {
  selectedPlaylistId: 'playlist-1',
  selectedPlaylistName: 'Party Starters',
  totalTracks: 1,
  playableTracks: [
    { id: 'track-1', name: 'Freeze Dance', artistNames: ['The Movers'], durationMs: 180000, albumName: 'Party', isPlayable: true, reason: null },
  ],
  skippedTracks: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(analysisModule.fetchTrackAnalysis).mockResolvedValue({
    trackId: 'track-1',
    tempoBpm: 120,
    keyClass: 5,
    loudnessDb: -8,
    durationSeconds: 180,
    source: 'analysis',
    segments: [{ startSeconds: 0, durationSeconds: 4, loudness: -8, loudnessNormalised: 0.7, timbreVariation: 0.6 }],
  })
  vi.mocked(analysisModule.createAnalysisCueSignal).mockReturnValue({
    tempoBpm: 120,
    tempoNormalised: 0.5,
    loudnessNormalised: 0.7,
    energyNormalised: 0.65,
    keyClass: 5,
    currentSegmentIndex: 0,
    segmentProgress: 0.2,
    source: 'analysis',
  })
})

describe('VisualisationLayer', () => {
  it('renders a clear live-motion state for playing rounds', async () => {
    render(
      <VisualisationLayer
        phase="playing"
        gameplay={{
          ...baseGameplay,
          status: 'round-playing',
          roundNumber: 1,
          activeTrackName: 'Freeze Dance',
        }}
        preparation={preparation}
      />,
    )

    await waitFor(() => expect(screen.getByText('analysis')).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Keep moving' })).toBeInTheDocument()
    expect(screen.getByText('Freeze Dance')).toBeInTheDocument()
    expect(screen.queryByText('Freeze!')).not.toBeInTheDocument()
  })

  it('renders an immediate freeze cue for frozen state', async () => {
    render(
      <VisualisationLayer
        phase="frozen"
        gameplay={{
          ...baseGameplay,
          status: 'round-stopped',
          roundNumber: 2,
          activeTrackName: 'Freeze Dance',
        }}
        preparation={preparation}
      />,
    )

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Freeze!' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('The music has stopped — hold still now.')
  })
})
