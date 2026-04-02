import type { GameplayAction, GameplayState, GameplayTransitionResult, PlaylistPreparation } from './types'

export function createInitialGameplayState(): GameplayState {
  return {
    status: 'idle',
    roundNumber: 0,
    activeTrackName: null,
    message: 'Prepare playback and a session playlist to unlock the first round.',
  }
}

export function canStartRound(preparation: PlaylistPreparation | null): boolean {
  return Boolean(preparation?.playableTracks.length)
}

export function reduceGameplayState(
  state: GameplayState,
  action: GameplayAction,
  preparation: PlaylistPreparation | null,
): GameplayTransitionResult {
  switch (action) {
    case 'start-round': {
      if (!canStartRound(preparation)) {
        return {
          accepted: false,
          reason: 'A prepared playlist with at least one playable track is required before the round can start.',
          nextState: {
            ...state,
            message: 'Prepare a playable session playlist before starting the round.',
          },
        }
      }

      if (state.status === 'round-playing') {
        return {
          accepted: false,
          reason: 'The round is already playing.',
          nextState: {
            ...state,
            message: 'The current round is already in progress.',
          },
        }
      }

      if (state.status === 'session-ended') {
        return {
          accepted: false,
          reason: 'The session has already ended.',
          nextState: {
            ...state,
            message: 'Reset is not available after the session has been ended.',
          },
        }
      }

      const nextRoundNumber = state.status === 'round-stopped' ? state.roundNumber + 1 : Math.max(1, state.roundNumber + 1)
      const trackIndex = (nextRoundNumber - 1) % (preparation?.playableTracks.length ?? 1)
      const selectedTrack = preparation?.playableTracks[trackIndex] ?? null

      return {
        accepted: true,
        reason: 'Round started successfully.',
        nextState: {
          status: 'round-playing',
          roundNumber: nextRoundNumber,
          activeTrackName: selectedTrack?.name ?? null,
          message: `Round ${nextRoundNumber} is live${selectedTrack ? ` with ${selectedTrack.name}.` : '.'}`,
        },
      }
    }

    case 'stop-round': {
      if (state.status !== 'round-playing') {
        return {
          accepted: false,
          reason: 'Manual stop is only available while a round is playing.',
          nextState: {
            ...state,
            message: 'Start a round before using the manual stop control.',
          },
        }
      }

      return {
        accepted: true,
        reason: 'Round stopped successfully.',
        nextState: {
          ...state,
          status: 'round-stopped',
          message: `Round ${state.roundNumber} stopped. Reset for the next round or end the session.`,
        },
      }
    }

    case 'reset-round': {
      if (state.status !== 'round-stopped') {
        return {
          accepted: false,
          reason: 'Round reset is only available after a round has been stopped.',
          nextState: {
            ...state,
            message: 'Manual stop the current round before resetting for the next round.',
          },
        }
      }

      return {
        accepted: true,
        reason: 'Round reset successfully.',
        nextState: {
          ...state,
          status: 'idle',
          activeTrackName: null,
          message: `Round ${state.roundNumber} complete. Start the next round when ready.`,
        },
      }
    }

    case 'end-session': {
      if (state.status === 'session-ended') {
        return {
          accepted: false,
          reason: 'The session has already been ended.',
          nextState: {
            ...state,
            message: 'The session has already been ended.',
          },
        }
      }

      return {
        accepted: true,
        reason: 'Session ended successfully.',
        nextState: {
          ...state,
          status: 'session-ended',
          activeTrackName: null,
          message: state.roundNumber > 0
            ? `Session ended after round ${state.roundNumber}. Reset/next-round controls are now locked.`
            : 'Session ended before any round started. Reset/next-round controls are now locked.',
        },
      }
    }
  }
}

export function getGameplayActionAvailability(state: GameplayState, preparation: PlaylistPreparation | null) {
  const hasPreparedPlaylist = canStartRound(preparation)

  return {
    canStartRound: hasPreparedPlaylist && state.status !== 'round-playing' && state.status !== 'session-ended',
    canStopRound: state.status === 'round-playing',
    canResetRound: state.status === 'round-stopped',
    canEndSession: state.status !== 'session-ended',
  }
}
