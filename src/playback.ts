import type { PlaybackReadiness } from './types'

const sdkScriptId = 'spotify-player-sdk'
const spotifySdkUrl = 'https://sdk.scdn.co/spotify-player.js'
const defaultDeviceName = 'Musical Statues Web Player'

const defaultReadiness: PlaybackReadiness = {
  state: 'idle',
  deviceName: null,
  deviceId: null,
  message: 'Sign in with an eligible Spotify Premium account to prepare the browser playback device.',
  needsUserAction: false,
  isRecoverable: false,
  sdkLoaded: false,
}

export interface PlaybackController {
  disconnect(): void
  activateElement?(): Promise<void>
}

interface SpotifyPlayerInit {
  name: string
  getOAuthToken: (callback: (token: string) => void) => void
  volume?: number
}

interface SpotifyPlayer {
  addListener(event: string, callback: (payload?: unknown) => void): boolean
  connect(): Promise<boolean>
  disconnect(): void
  activateElement?(): Promise<void>
}

interface SpotifyWindow extends Window {
  Spotify?: {
    Player: new (init: SpotifyPlayerInit) => SpotifyPlayer
  }
  onSpotifyWebPlaybackSDKReady?: () => void
}

function getBrowserSupportError(): string | null {
  if (typeof window === 'undefined') {
    return 'Spotify playback device readiness is only available in a browser environment.'
  }

  if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'Spotify Web Playback SDK requires a secure browser context (HTTPS or localhost).'
  }

  if (!('MediaSource' in window)) {
    return 'This browser is missing media capabilities required by the Spotify Web Playback SDK.'
  }

  if (!('AudioContext' in window || 'webkitAudioContext' in window)) {
    return 'This browser cannot unlock audio playback for the Spotify Web Playback SDK.'
  }

  return null
}

function getMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null && 'message' in payload && typeof payload.message === 'string') {
    return payload.message
  }

  return fallback
}

function getDeviceId(payload: unknown): string | null {
  if (typeof payload === 'object' && payload !== null && 'device_id' in payload && typeof payload.device_id === 'string') {
    return payload.device_id
  }

  return null
}

export function getDefaultPlaybackReadiness(): PlaybackReadiness {
  return defaultReadiness
}

export function loadSpotifySdk(): Promise<void> {
  const supportError = getBrowserSupportError()
  if (supportError) {
    return Promise.reject(new Error(supportError))
  }

  const spotifyWindow = window as SpotifyWindow

  if (spotifyWindow.Spotify?.Player) {
    return Promise.resolve()
  }

  const existingScript = document.getElementById(sdkScriptId) as HTMLScriptElement | null

  if (existingScript?.dataset.loaded === 'true') {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const script = existingScript ?? document.createElement('script')

    const cleanupReadyHook = () => {
      if (spotifyWindow.onSpotifyWebPlaybackSDKReady === readyHandler) {
        delete spotifyWindow.onSpotifyWebPlaybackSDKReady
      }
    }

    const readyHandler = () => {
      script.dataset.loaded = 'true'
      cleanupReadyHook()
      resolve()
    }

    spotifyWindow.onSpotifyWebPlaybackSDKReady = readyHandler

    script.id = sdkScriptId
    script.src = spotifySdkUrl
    script.async = true
    script.onload = () => {
      if (spotifyWindow.Spotify?.Player) {
        script.dataset.loaded = 'true'
        cleanupReadyHook()
        resolve()
      }
    }
    script.onerror = () => {
      cleanupReadyHook()
      reject(new Error('Spotify Web Playback SDK could not be loaded in this browser.'))
    }

    if (!existingScript) {
      document.head.appendChild(script)
    }
  })
}

export async function initialisePlaybackDevice(
  accessToken: string,
  onStateChange: (state: PlaybackReadiness) => void,
  deviceName = defaultDeviceName,
): Promise<PlaybackController> {
  const supportError = getBrowserSupportError()
  if (supportError) {
    throw new Error(supportError)
  }

  const spotifyWindow = window as SpotifyWindow
  const SpotifyPlayerConstructor = spotifyWindow.Spotify?.Player

  if (!SpotifyPlayerConstructor) {
    throw new Error('Spotify Web Playback SDK is not available yet.')
  }

  onStateChange({
    state: 'device-connecting',
    deviceName,
    deviceId: null,
    message: 'Creating the browser playback device and waiting for Spotify to report readiness…',
    needsUserAction: false,
    isRecoverable: false,
    sdkLoaded: true,
  })

  const player = new SpotifyPlayerConstructor({
    name: deviceName,
    getOAuthToken: (callback) => callback(accessToken),
    volume: 0.75,
  })

  let resolved = false

  return new Promise<PlaybackController>((resolve, reject) => {
    player.addListener('ready', (payload) => {
      const deviceId = getDeviceId(payload)
      resolved = true
      onStateChange({
        state: 'user-action-required',
        deviceName,
        deviceId,
        message: 'Browser playback device created. Use the unlock action once to satisfy browser audio/autoplay requirements.',
        needsUserAction: true,
        isRecoverable: true,
        sdkLoaded: true,
      })
      resolve({
        disconnect: () => player.disconnect(),
        activateElement: () => player.activateElement?.() ?? Promise.resolve(),
      })
    })

    player.addListener('not_ready', (payload) => {
      onStateChange({
        state: 'device-error',
        deviceName,
        deviceId: getDeviceId(payload),
        message: 'Spotify reported that the browser playback device is not ready. You can retry without reloading the page.',
        needsUserAction: false,
        isRecoverable: true,
        sdkLoaded: true,
      })
    })

    player.addListener('initialization_error', (payload) => {
      if (resolved) {
        return
      }

      reject(new Error(getMessage(payload, 'Spotify player initialisation failed.')))
    })

    player.addListener('authentication_error', (payload) => {
      const message = getMessage(payload, 'Spotify authentication for the browser player failed.')

      if (resolved) {
        onStateChange({
          state: 'device-error',
          deviceName,
          deviceId: null,
          message: `${message} Refresh the host session and retry.`,
          needsUserAction: false,
          isRecoverable: true,
          sdkLoaded: true,
        })
        return
      }

      reject(new Error(message))
    })

    player.addListener('account_error', (payload) => {
      const errorMessage = getMessage(payload, 'This Spotify account is not eligible for Web Playback SDK browser playback.')

      if (resolved) {
        onStateChange({
          state: 'unsupported-browser',
          deviceName,
          deviceId: null,
          message: errorMessage,
          needsUserAction: false,
          isRecoverable: false,
          sdkLoaded: true,
        })
        return
      }

      reject(new Error(errorMessage))
    })

    player.addListener('playback_error', (payload) => {
      onStateChange({
        state: 'device-error',
        deviceName,
        deviceId: null,
        message: getMessage(payload, 'Spotify playback device setup hit an error. Retry in-app after checking browser audio permissions.'),
        needsUserAction: false,
        isRecoverable: true,
        sdkLoaded: true,
      })
    })

    void player.connect().then((connected) => {
      if (resolved) {
        return
      }

      if (!connected) {
        reject(new Error('Spotify browser playback device could not connect.'))
      }
    }).catch((error: unknown) => {
      if (resolved) {
        return
      }

      reject(error instanceof Error ? error : new Error('Spotify browser playback device could not connect.'))
    })
  })
}

export async function unlockPlaybackDevice(controller: PlaybackController | null): Promise<PlaybackReadiness> {
  if (!controller?.activateElement) {
    return {
      state: 'device-ready',
      deviceName: defaultDeviceName,
      deviceId: null,
      message: 'Browser playback device is ready. Playback transfer and playlist preparation can continue in later slices.',
      needsUserAction: false,
      isRecoverable: true,
      sdkLoaded: true,
    }
  }

  await controller.activateElement()

  return {
    state: 'device-ready',
    deviceName: defaultDeviceName,
    deviceId: null,
    message: 'Audio unlock completed. The browser playback device is ready for the next integration slice.',
    needsUserAction: false,
    isRecoverable: true,
    sdkLoaded: true,
  }
}
