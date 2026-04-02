import type { PlaylistPreparation } from './types'

export interface AnalysisSegmentSignal {
  startSeconds: number
  durationSeconds: number
  loudness: number
  loudnessNormalised: number
  timbreVariation: number
}

export interface AnalysisCueSignal {
  tempoBpm: number | null
  tempoNormalised: number
  loudnessNormalised: number
  keyClass: number | null
  energyNormalised: number
  currentSegmentIndex: number
  segmentProgress: number
  currentSegment: AnalysisSegmentSignal | null
  source: 'analysis' | 'fallback'
}

export interface TrackAnalysisEnvelope {
  trackId: string
  tempoBpm: number | null
  keyClass: number | null
  loudnessDb: number | null
  durationSeconds: number
  segments: AnalysisSegmentSignal[]
  source: 'analysis' | 'fallback'
}

interface SpotifyAudioAnalysisTrack {
  tempo?: number
  key?: number
  loudness?: number
  duration?: number
}

interface SpotifyAudioAnalysisSegment {
  start: number
  duration: number
  loudness_max?: number
  timbre?: number[]
}

interface SpotifyAudioAnalysisResponse {
  track?: SpotifyAudioAnalysisTrack
  segments?: SpotifyAudioAnalysisSegment[]
}

const analysisCache = new Map<string, Promise<TrackAnalysisEnvelope>>()

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normaliseTempo(tempo: number | null): number {
  if (!tempo) return 0.35
  return clamp((tempo - 60) / 120, 0, 1)
}

function normaliseLoudness(loudness: number | null): number {
  if (loudness === null || Number.isNaN(loudness)) return 0.4
  return clamp((loudness + 30) / 30, 0, 1)
}

function getTimbreVariation(timbre: number[] | undefined): number {
  if (!timbre || timbre.length === 0) return 0.25

  const mean = timbre.reduce((sum, value) => sum + value, 0) / timbre.length
  const variance = timbre.reduce((sum, value) => sum + (value - mean) ** 2, 0) / timbre.length

  return clamp(Math.sqrt(variance) / 90, 0, 1)
}

function createFallbackEnvelope(trackId: string, durationSeconds = 180): TrackAnalysisEnvelope {
  const segmentDuration = 4
  const segmentCount = Math.max(1, Math.round(durationSeconds / segmentDuration))
  const segments = Array.from({ length: segmentCount }).map((_, index) => ({
    startSeconds: index * segmentDuration,
    durationSeconds: segmentDuration,
    loudness: -12,
    loudnessNormalised: normaliseLoudness(-12),
    timbreVariation: 0.3 + (index % 3) * 0.08,
  }))

  return {
    trackId,
    tempoBpm: null,
    keyClass: null,
    loudnessDb: -12,
    durationSeconds,
    segments,
    source: 'fallback',
  }
}

function mapAnalysisEnvelope(trackId: string, analysis: SpotifyAudioAnalysisResponse | null, fallbackDurationSeconds = 180): TrackAnalysisEnvelope {
  const track = analysis?.track
  const segments = analysis?.segments

  if (!track || !segments || segments.length === 0) {
    return createFallbackEnvelope(trackId, fallbackDurationSeconds)
  }

  const loudnessDb = track.loudness ?? null

  return {
    trackId,
    tempoBpm: track.tempo ?? null,
    keyClass: typeof track.key === 'number' ? track.key : null,
    loudnessDb,
    durationSeconds: track.duration ?? fallbackDurationSeconds,
    source: 'analysis',
    segments: segments.map((segment) => ({
      startSeconds: segment.start,
      durationSeconds: segment.duration,
      loudness: segment.loudness_max ?? loudnessDb ?? -12,
      loudnessNormalised: normaliseLoudness(segment.loudness_max ?? loudnessDb ?? -12),
      timbreVariation: getTimbreVariation(segment.timbre),
    })),
  }
}

export async function fetchTrackAnalysis(trackId: string, durationMs?: number): Promise<TrackAnalysisEnvelope> {
  if (!analysisCache.has(trackId)) {
    analysisCache.set(trackId, (async () => {
      try {
        const response = await fetch(`/api/spotify/audio-analysis/${trackId}`, {
          credentials: 'include',
        })

        if (!response.ok) {
          return createFallbackEnvelope(trackId, (durationMs ?? 180000) / 1000)
        }

        const body = (await response.json()) as SpotifyAudioAnalysisResponse
        return mapAnalysisEnvelope(trackId, body, (durationMs ?? 180000) / 1000)
      } catch {
        return createFallbackEnvelope(trackId, (durationMs ?? 180000) / 1000)
      }
    })())
  }

  return analysisCache.get(trackId) as Promise<TrackAnalysisEnvelope>
}

export async function prefetchSessionTrackAnalysis(preparation: PlaylistPreparation | null): Promise<void> {
  if (!preparation) return

  await Promise.all(
    preparation.playableTracks.map((track) => fetchTrackAnalysis(track.id, track.durationMs)),
  )
}

export function createAnalysisCueSignal(envelope: TrackAnalysisEnvelope | null, elapsedSeconds: number): AnalysisCueSignal {
  if (!envelope || envelope.segments.length === 0) {
    const fallback = createFallbackEnvelope('fallback-track')
    return createAnalysisCueSignal(fallback, elapsedSeconds)
  }

  const safeElapsed = Math.max(0, elapsedSeconds)
  const totalDuration = envelope.durationSeconds || 1
  const wrappedElapsed = safeElapsed % totalDuration
  const segmentIndex = envelope.segments.findIndex((segment) => wrappedElapsed >= segment.startSeconds && wrappedElapsed < segment.startSeconds + segment.durationSeconds)
  const currentSegmentIndex = segmentIndex === -1 ? envelope.segments.length - 1 : segmentIndex
  const currentSegment = envelope.segments[currentSegmentIndex]
  const segmentProgress = currentSegment.durationSeconds > 0
    ? clamp((wrappedElapsed - currentSegment.startSeconds) / currentSegment.durationSeconds, 0, 1)
    : 0

  return {
    tempoBpm: envelope.tempoBpm,
    tempoNormalised: normaliseTempo(envelope.tempoBpm),
    loudnessNormalised: currentSegment?.loudnessNormalised ?? normaliseLoudness(envelope.loudnessDb),
    keyClass: envelope.keyClass,
    energyNormalised: clamp(((currentSegment?.timbreVariation ?? 0.3) + (currentSegment?.loudnessNormalised ?? 0.4)) / 2, 0, 1),
    currentSegmentIndex,
    segmentProgress,
    currentSegment,
    source: envelope.source,
  }
}

export function clearAnalysisCache() {
  analysisCache.clear()
}
