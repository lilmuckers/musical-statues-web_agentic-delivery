import { useEffect, useMemo, useState } from 'react'
import { createAnalysisCueSignal, fetchTrackAnalysis } from './analysis'
import type { AppPhase, GameplayState, PlaylistPreparation, VisualCueSignal } from './types'

interface VisualisationLayerProps {
  phase: AppPhase
  gameplay: GameplayState
  preparation: PlaylistPreparation | null
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

function getFallbackCue(): VisualCueSignal {
  return {
    tempoBpm: null,
    tempoNormalised: 0.35,
    loudnessNormalised: 0.4,
    energyNormalised: 0.35,
    keyClass: null,
    currentSegmentIndex: 0,
    segmentProgress: 0,
    source: 'fallback',
  }
}

export function VisualisationLayer({ phase, gameplay, preparation }: VisualisationLayerProps) {
  const copy = phaseCopy[phase]
  const orbCount = getOrbCount(phase)
  const [cueSignal, setCueSignal] = useState<VisualCueSignal>(() => getFallbackCue())

  const activeTrack = useMemo(() => {
    if (!preparation?.playableTracks.length) return null
    if (!gameplay.activeTrackName) return preparation.playableTracks[0]
    return preparation.playableTracks.find((track) => track.name === gameplay.activeTrackName) ?? preparation.playableTracks[0]
  }, [gameplay.activeTrackName, preparation])

  useEffect(() => {
    let cancelled = false

    async function hydrateCue() {
      if (!activeTrack) {
        setCueSignal(getFallbackCue())
        return
      }

      const envelope = await fetchTrackAnalysis(activeTrack.id, activeTrack.durationMs)
      if (cancelled) return
      setCueSignal(createAnalysisCueSignal(envelope, gameplay.roundNumber))
    }

    void hydrateCue()

    return () => {
      cancelled = true
    }
  }, [activeTrack, gameplay.roundNumber])

  return (
    <section
      className={`visualisation visualisation--${phase}`}
      aria-label="Visualisation layer"
      style={{
        '--cue-energy': cueSignal.energyNormalised,
        '--cue-tempo': cueSignal.tempoNormalised,
        '--cue-loudness': cueSignal.loudnessNormalised,
      } as React.CSSProperties}
    >
      <div className="visualisation__backdrop" />
      <div className="visualisation__grid" />
      <div className="visualisation__orbs" aria-hidden="true">
        {Array.from({ length: orbCount }).map((_, index) => (
          <span
            key={`${phase}-${index}`}
            className="visualisation__orb"
            style={{
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
            <dd>{gameplay.activeTrackName ?? activeTrack?.name ?? 'Awaiting cue'}</dd>
          </div>
          <div>
            <dt>Analysis source</dt>
            <dd>{cueSignal.source}</dd>
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
