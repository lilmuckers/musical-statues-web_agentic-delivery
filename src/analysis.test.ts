import { clearAnalysisCache, createAnalysisCueSignal } from './analysis'
import type { TrackAnalysisEnvelope } from './analysis'

describe('analysis mapping layer', () => {
  afterEach(() => {
    clearAnalysisCache()
  })

  it('maps current segment progress and normalised cues from analysis envelopes', () => {
    const envelope: TrackAnalysisEnvelope = {
      trackId: 'track-1',
      tempoBpm: 120,
      keyClass: 5,
      loudnessDb: -8,
      durationSeconds: 12,
      source: 'analysis',
      segments: [
        { startSeconds: 0, durationSeconds: 4, loudness: -10, loudnessNormalised: 0.66, timbreVariation: 0.2 },
        { startSeconds: 4, durationSeconds: 4, loudness: -6, loudnessNormalised: 0.8, timbreVariation: 0.7 },
      ],
    }

    const cue = createAnalysisCueSignal(envelope, 5)

    expect(cue.currentSegmentIndex).toBe(1)
    expect(cue.segmentProgress).toBeCloseTo(0.25)
    expect(cue.tempoNormalised).toBeGreaterThan(0)
    expect(cue.energyNormalised).toBeGreaterThan(0.5)
    expect(cue.source).toBe('analysis')
  })

  it('falls back safely when analysis is unavailable', () => {
    const cue = createAnalysisCueSignal(null, 3)

    expect(cue.source).toBe('fallback')
    expect(cue.currentSegment).not.toBeNull()
    expect(cue.tempoBpm).toBeNull()
  })
})
