import { render, screen } from '@testing-library/react'
import { VisualisationLayer } from './visualisation'
import type { GameplayState } from './types'

const baseGameplay: GameplayState = {
  status: 'idle',
  roundNumber: 0,
  activeTrackName: null,
  message: 'Prepare playback and a session playlist to unlock the first round.',
}

describe('VisualisationLayer', () => {
  it('renders a clear live-motion state for playing rounds', () => {
    render(
      <VisualisationLayer
        phase="playing"
        gameplay={{
          ...baseGameplay,
          status: 'round-playing',
          roundNumber: 1,
          activeTrackName: 'Freeze Dance',
        }}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Keep moving' })).toBeInTheDocument()
    expect(screen.getByText('Freeze Dance')).toBeInTheDocument()
    expect(screen.queryByText('Freeze!')).not.toBeInTheDocument()
  })

  it('renders an immediate freeze cue for frozen state', () => {
    render(
      <VisualisationLayer
        phase="frozen"
        gameplay={{
          ...baseGameplay,
          status: 'round-stopped',
          roundNumber: 2,
          activeTrackName: 'Statues Theme',
        }}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Freeze!' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('The music has stopped — hold still now.')
  })
})
