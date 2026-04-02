import { createInitialGameplayState, getGameplayActionAvailability, reduceGameplayState } from './gameplay'
import type { PlaylistPreparation } from './types'

const preparedPlaylist: PlaylistPreparation = {
  selectedPlaylistId: 'playlist-1',
  selectedPlaylistName: 'Party Starters',
  totalTracks: 2,
  playableTracks: [
    { id: 'track-1', name: 'Freeze Dance', artistNames: ['The Movers'], durationMs: 180000, albumName: 'Party', isPlayable: true, reason: null },
    { id: 'track-2', name: 'Statues Theme', artistNames: ['The Movers'], durationMs: 175000, albumName: 'Party', isPlayable: true, reason: null },
  ],
  skippedTracks: [],
}

describe('gameplay state machine', () => {
  it('starts a round deterministically from idle with a prepared playlist', () => {
    const result = reduceGameplayState(createInitialGameplayState(), 'start-round', preparedPlaylist)

    expect(result.accepted).toBe(true)
    expect(result.nextState.status).toBe('round-playing')
    expect(result.nextState.roundNumber).toBe(1)
    expect(result.nextState.activeTrackName).toBe('Freeze Dance')
  })

  it('rejects start-round when there is no prepared playlist', () => {
    const result = reduceGameplayState(createInitialGameplayState(), 'start-round', null)

    expect(result.accepted).toBe(false)
    expect(result.nextState.status).toBe('idle')
    expect(result.reason).toMatch(/prepared playlist/i)
  })

  it('supports stop, reset, and next round sequencing deterministically', () => {
    const started = reduceGameplayState(createInitialGameplayState(), 'start-round', preparedPlaylist)
    const stopped = reduceGameplayState(started.nextState, 'stop-round', preparedPlaylist)
    const reset = reduceGameplayState(stopped.nextState, 'reset-round', preparedPlaylist)
    const nextRound = reduceGameplayState(reset.nextState, 'start-round', preparedPlaylist)

    expect(stopped.nextState.status).toBe('round-stopped')
    expect(reset.nextState.status).toBe('idle')
    expect(nextRound.nextState.status).toBe('round-playing')
    expect(nextRound.nextState.roundNumber).toBe(2)
    expect(nextRound.nextState.activeTrackName).toBe('Statues Theme')
  })

  it('locks reset/start controls after end-session until a new shell session is prepared externally', () => {
    const started = reduceGameplayState(createInitialGameplayState(), 'start-round', preparedPlaylist)
    const ended = reduceGameplayState(started.nextState, 'end-session', preparedPlaylist)
    const retryStart = reduceGameplayState(ended.nextState, 'start-round', preparedPlaylist)
    const availability = getGameplayActionAvailability(ended.nextState, preparedPlaylist)

    expect(ended.nextState.status).toBe('session-ended')
    expect(retryStart.accepted).toBe(false)
    expect(availability.canStartRound).toBe(false)
    expect(availability.canEndSession).toBe(false)
  })
})
