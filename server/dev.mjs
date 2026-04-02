import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleAuthRequest } from './authServer.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env')

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)

  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) {
      continue
    }

    const separator = line.indexOf('=')
    if (separator === -1) {
      continue
    }

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

const port = Number(process.env.AUTH_SERVER_PORT ?? 8787)

const server = http.createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', process.env.APP_ORIGIN ?? 'http://127.0.0.1:5173')
  response.setHeader('Access-Control-Allow-Credentials', 'true')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')

  if (request.method === 'OPTIONS') {
    response.statusCode = 204
    response.end()
    return
  }

  const handled = await handleAuthRequest(request, response)

  if (!handled) {
    response.statusCode = 404
    response.end('Not found')
  }
})

server.listen(port, () => {
  console.log(`Spotify auth server listening on http://127.0.0.1:${port}`)
})
