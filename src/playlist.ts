import type { PlaylistPreparation, PlaylistSummary } from './types'

interface PlaylistListResponse {
  items: PlaylistSummary[]
}

type PlaylistPreparationResponse = PlaylistPreparation

export async function fetchPlaylists(): Promise<PlaylistSummary[]> {
  const response = await fetch('/api/spotify/playlists', {
    credentials: 'include',
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Unable to load Spotify playlists.')
  }

  const body = (await response.json()) as PlaylistListResponse
  return body.items
}

export async function preparePlaylistSession(playlistId: string): Promise<PlaylistPreparation> {
  const response = await fetch(`/api/spotify/playlists/${playlistId}/prepare`, {
    credentials: 'include',
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Unable to prepare the selected playlist for a session.')
  }

  return (await response.json()) as PlaylistPreparationResponse
}

export function getPlaylistPreparationSummary(preparation: PlaylistPreparation | null): string {
  if (!preparation) {
    return 'No playlist prepared yet.'
  }

  return `${preparation.playableTracks.length} playable tracks ready, ${preparation.skippedTracks.length} skipped.`
}
