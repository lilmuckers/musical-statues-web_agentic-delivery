import crypto from 'node:crypto'
import { URL } from 'node:url'

const sessionCookieName = 'musical_statues_host_session'
const stateCookieName = 'musical_statues_oauth_state'
const pkceCookieName = 'musical_statues_pkce_verifier'

const spotifyScopes = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
]

function getRequiredEnv(name) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function getSessionSecret() {
  return getRequiredEnv('SESSION_SECRET')
}

function getSpotifyRedirectUri() {
  return process.env.SPOTIFY_REDIRECT_URI ?? 'http://127.0.0.1:8787/api/auth/callback'
}

function getAppOrigin() {
  return process.env.APP_ORIGIN ?? 'http://127.0.0.1:5173'
}

function toBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromBase64Url(value) {
  const normalised = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalised.length % 4 === 0 ? '' : '='.repeat(4 - (normalised.length % 4))

  return Buffer.from(`${normalised}${padding}`, 'base64')
}

function signValue(payload) {
  const secret = getSessionSecret()
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

function verifySignedValue(value) {
  if (!value) {
    return null
  }

  const lastSeparator = value.lastIndexOf('.')
  if (lastSeparator === -1) {
    return null
  }

  const payload = value.slice(0, lastSeparator)
  const signature = value.slice(lastSeparator + 1)
  const expectedSignature = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url')

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null
  }

  return payload
}

function encryptJson(value) {
  const iv = crypto.randomBytes(12)
  const key = crypto.createHash('sha256').update(getSessionSecret()).digest()
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${toBase64Url(iv)}.${toBase64Url(ciphertext)}.${toBase64Url(tag)}`
}

function decryptJson(value) {
  if (!value) {
    return null
  }

  const [ivPart, ciphertextPart, tagPart] = value.split('.')
  if (!ivPart || !ciphertextPart || !tagPart) {
    return null
  }

  const key = crypto.createHash('sha256').update(getSessionSecret()).digest()
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, fromBase64Url(ivPart))
  decipher.setAuthTag(fromBase64Url(tagPart))

  try {
    const plaintext = Buffer.concat([
      decipher.update(fromBase64Url(ciphertextPart)),
      decipher.final(),
    ]).toString('utf8')

    return JSON.parse(plaintext)
  } catch {
    return null
  }
}

function parseCookies(request) {
  const cookieHeader = request.headers.cookie
  if (!cookieHeader) {
    return {}
  }

  return Object.fromEntries(
    cookieHeader.split(';').map((part) => {
      const separator = part.indexOf('=')
      const key = part.slice(0, separator).trim()
      const value = part.slice(separator + 1).trim()
      return [key, decodeURIComponent(value)]
    }),
  )
}

function setCookie(response, name, value, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  const maxAge = typeof maxAgeSeconds === 'number' ? `; Max-Age=${maxAgeSeconds}` : ''
  const cookie = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${maxAge}${secure}`
  const existing = response.getHeader('Set-Cookie')

  if (!existing) {
    response.setHeader('Set-Cookie', [cookie])
    return
  }

  response.setHeader('Set-Cookie', [...existing, cookie])
}

function clearCookie(response, name) {
  setCookie(response, name, '', 0)
}

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

function sendText(response, statusCode, body) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'text/plain; charset=utf-8')
  response.end(body)
}

function getSessionFromRequest(request) {
  const cookies = parseCookies(request)
  const encryptedSession = cookies[sessionCookieName]
  const session = decryptJson(encryptedSession)

  if (!session) {
    return null
  }

  return session
}

function normaliseSession(session) {
  if (!session) {
    return {
      status: 'signed-out',
      isAuthenticated: false,
      profile: null,
      scopes: [],
      expiresAt: null,
      canResume: false,
      failureReason: null,
    }
  }

  const isPremium = (session.profile?.product ?? '').toLowerCase() === 'premium'
  const expired = Date.now() >= session.expiresAt

  if (expired) {
    return {
      status: 'session-expired',
      isAuthenticated: false,
      profile: session.profile ?? null,
      scopes: session.scope?.split(' ') ?? [],
      expiresAt: new Date(session.expiresAt).toISOString(),
      canResume: true,
      failureReason: 'The stored Spotify session expired and could not be refreshed.',
    }
  }

  return {
    status: isPremium ? 'session-ready' : 'not-premium',
    isAuthenticated: true,
    profile: session.profile ?? null,
    scopes: session.scope?.split(' ') ?? [],
    expiresAt: new Date(session.expiresAt).toISOString(),
    canResume: true,
    failureReason: isPremium ? null : 'Spotify Premium is required for browser playback in the MVP flow.',
  }
}

async function readJsonBody(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }

  if (chunks.length === 0) {
    return null
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function createPkceVerifier() {
  return crypto.randomBytes(64).toString('base64url')
}

function createPkceChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

async function exchangeCodeForToken(code, verifier) {
  const clientId = getRequiredEnv('SPOTIFY_CLIENT_ID')
  const clientSecret = getRequiredEnv('SPOTIFY_CLIENT_SECRET')
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getSpotifyRedirectUri(),
      client_id: clientId,
      code_verifier: verifier,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Spotify code exchange failed: ${text}`)
  }

  return response.json()
}

async function refreshAccessToken(refreshToken) {
  const clientId = getRequiredEnv('SPOTIFY_CLIENT_ID')
  const clientSecret = getRequiredEnv('SPOTIFY_CLIENT_SECRET')
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Spotify refresh failed: ${text}`)
  }

  return response.json()
}

async function fetchSpotifyProfile(accessToken) {
  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Unable to load Spotify profile: ${text}`)
  }

  const profile = await response.json()

  return {
    displayName: profile.display_name ?? profile.id ?? 'Spotify host',
    email: profile.email ?? null,
    product: profile.product ?? 'unknown',
  }
}

async function maybeRefreshSession(request, response) {
  const session = getSessionFromRequest(request)
  if (!session) {
    return null
  }

  const needsRefresh = Date.now() >= session.expiresAt - 60_000
  if (!needsRefresh) {
    return session
  }

  try {
    const refreshed = await refreshAccessToken(session.refreshToken)
    const updatedSession = {
      ...session,
      accessToken: refreshed.access_token,
      expiresAt: Date.now() + refreshed.expires_in * 1000,
      refreshToken: refreshed.refresh_token ?? session.refreshToken,
      scope: refreshed.scope ?? session.scope,
    }

    setCookie(response, sessionCookieName, encryptJson(updatedSession), 60 * 60 * 24 * 7)
    return updatedSession
  } catch {
    clearCookie(response, sessionCookieName)
    return {
      ...session,
      expiresAt: Date.now() - 1,
    }
  }
}

export async function handleAuthRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`)

  try {
    if (request.method === 'GET' && url.pathname === '/api/auth/session') {
      const session = await maybeRefreshSession(request, response)
      sendJson(response, 200, normaliseSession(session))
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      const verifier = createPkceVerifier()
      const state = crypto.randomBytes(24).toString('base64url')
      const challenge = createPkceChallenge(verifier)
      const authorizeUrl = new URL('https://accounts.spotify.com/authorize')

      authorizeUrl.searchParams.set('client_id', getRequiredEnv('SPOTIFY_CLIENT_ID'))
      authorizeUrl.searchParams.set('response_type', 'code')
      authorizeUrl.searchParams.set('redirect_uri', getSpotifyRedirectUri())
      authorizeUrl.searchParams.set('code_challenge_method', 'S256')
      authorizeUrl.searchParams.set('code_challenge', challenge)
      authorizeUrl.searchParams.set('scope', spotifyScopes.join(' '))
      authorizeUrl.searchParams.set('state', signValue(state))
      authorizeUrl.searchParams.set('show_dialog', 'false')

      setCookie(response, stateCookieName, signValue(state), 600)
      setCookie(response, pkceCookieName, signValue(verifier), 600)
      sendJson(response, 200, { authorizeUrl: authorizeUrl.toString() })
      return true
    }

    if (request.method === 'GET' && url.pathname === '/api/auth/callback') {
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const error = url.searchParams.get('error')
      const cookies = parseCookies(request)
      const storedState = verifySignedValue(cookies[stateCookieName])
      const returnedState = verifySignedValue(state)
      const verifier = verifySignedValue(cookies[pkceCookieName])

      clearCookie(response, stateCookieName)
      clearCookie(response, pkceCookieName)

      if (error) {
        response.statusCode = 302
        response.setHeader('Location', `${getAppOrigin()}?authError=${encodeURIComponent(error)}`)
        response.end()
        return true
      }

      if (!code || !storedState || !returnedState || storedState !== returnedState || !verifier) {
        response.statusCode = 302
        response.setHeader('Location', `${getAppOrigin()}?authError=state_mismatch`)
        response.end()
        return true
      }

      const token = await exchangeCodeForToken(code, verifier)
      const profile = await fetchSpotifyProfile(token.access_token)
      const session = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        scope: token.scope,
        expiresAt: Date.now() + token.expires_in * 1000,
        profile,
      }

      setCookie(response, sessionCookieName, encryptJson(session), 60 * 60 * 24 * 7)
      response.statusCode = 302
      response.setHeader('Location', `${getAppOrigin()}?auth=success`)
      response.end()
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      await readJsonBody(request)
      clearCookie(response, sessionCookieName)
      sendJson(response, 200, normaliseSession(null))
      return true
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected auth server error'
    sendText(response, 500, message)
    return true
  }

  return false
}
