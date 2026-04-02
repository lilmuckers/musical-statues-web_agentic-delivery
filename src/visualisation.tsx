import type { AppPhase, GameplayState } from './types'

interface VisualisationLayerProps {
  phase: AppPhase
  gameplay: GameplayState
}

const phaseCopy: Record<AppPhase, { heading: string; subheading: string }> = {
  setup: {
    heading: 'Prepare the room',
    subheading: 'Sign in, ready the browser player, and prepare a playlist before the visual layer goes live.',
  },
  ready: {
    heading: 'Ready for the next round',
    subheading: 'The stage is armed. Start the round when the room is settled.',
  },
  playing: {
    heading: 'Keep moving',
    subheading: 'The visual layer is in motion while the round is live.',
  },
  frozen: {
    heading: 'Freeze!',
    subheading: 'The stop cue lands immediately and the room should lock still.',
  },
  'session-ended': {
    heading: 'Session complete',
    subheading: 'The round flow is over. Reset externally when you are ready to run again.',
  },
}

function getOrbCount(phase: AppPhase): number {
  switch (phase) {
    case 'playing':
      return 9
    case 'frozen':
      return 5
    case 'ready':
      return 6
    case 'session-ended':
      return 4
    default:
      return 3
  }
}

export function VisualisationLayer({ phase, gameplay }: VisualisationLayerProps) {
  const copy = phaseCopy[phase]
  const orbCount = getOrbCount(phase)

  return (
    <section className={`visualisation visualisation--${phase}`} aria-label="Visualisation layer">
      <div className="visualisation__backdrop" />
      <div className="visualisation__grid" />
      <div className="visualisation__orbs" aria-hidden="true">
        {Array.from({ length: orbCount }).map((_, index) => (
          <span
            key={`${phase}-${index}`}
            className="visualisation__orb"
            style={{
              '--orb-index': index,
              '--orb-size': `${140 + (index % 3) * 48}px`,
              '--orb-left': `${8 + (index * 11) % 82}%`,
              '--orb-top': `${12 + (index * 9) % 74}%`,
              '--orb-delay': `${index * 220}ms`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="visualisation__content">
        <p className="visualisation__eyebrow">Musical Statues</p>
        <h2>{copy.heading}</h2>
        <p>{copy.subheading}</p>
        <dl className="visualisation__stats">
          <div>
            <dt>Phase</dt>
            <dd>{phase.replace(/-/g, ' ')}</dd>
          </div>
          <div>
            <dt>Round</dt>
            <dd>{gameplay.roundNumber || 'Stand by'}</dd>
          </div>
          <div>
            <dt>Track</dt>
            <dd>{gameplay.activeTrackName ?? 'Awaiting cue'}</dd>
          </div>
        </dl>
      </div>

      {phase === 'frozen' ? (
        <div className="visualisation__freeze-banner" role="status" aria-live="assertive">
          <strong>Freeze!</strong>
          <span>The music has stopped — hold still now.</span>
        </div>
      ) : null}
    </section>
  )
}
