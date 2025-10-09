#!/usr/bin/env -S node

// codex生成

/**
 * Generate a Firebase ID token for development.
 *
 * Usage examples:
 *  - npx tsx scripts/gen-idtoken.ts --uid dev-user
 *  - node -r ts-node/register scripts/gen-idtoken.ts --uid dev-user --claims '{"role":"admin"}'
 *
 * Requirements:
 *  - A valid service account JSON (default: ./service-account.json or GOOGLE_APPLICATION_CREDENTIALS)
 *  - NEXT_PUBLIC_FIREBASE_API_KEY in env (or pass via --api-key)
 */

/* eslint-disable no-console */

import dotenv from 'dotenv'

import { createRequire } from 'node:module'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// Defer requiring firebase-admin to avoid type issues if run with plain node
const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require('firebase-admin') as typeof import('firebase-admin')

type Args = {
  uid: string
  claims?: Record<string, unknown>
  apiKey: string
  projectId?: string
  json: boolean
}

// Load environment variables from .env.local (if present) then .env
try {
  const envLocal = path.resolve(process.cwd(), '.env.local')
  if (existsSync(envLocal)) dotenv.config({ path: envLocal, override: true })
  dotenv.config()
} catch {
  // ignore
}

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = { json: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--uid' && argv[i + 1]) {
      out.uid = argv[++i]
    } else if (a === '--claims' && argv[i + 1]) {
      const raw = argv[++i]
      try {
        out.claims = JSON.parse(raw)
      } catch (e) {
        throw new Error(`--claims must be valid JSON: ${e}`)
      }
    } else if (a === '--api-key' && argv[i + 1]) {
      out.apiKey = argv[++i]
    } else if (a === '--project' && argv[i + 1]) {
      out.projectId = argv[++i]
    } else if (a === '--json') {
      out.json = true
    } else if (a === '-h' || a === '--help') {
      printHelp()
      process.exit(0)
    }
  }

  if (!out.uid) out.uid = 'dev-user'
  if (!out.apiKey) out.apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || ''
  if (!out.apiKey) throw new Error('API key missing. Set NEXT_PUBLIC_FIREBASE_API_KEY or pass --api-key')

  return out as Args
}

function printHelp() {
  console.log(`Generate a Firebase ID token for development

Options:
  --uid <uid>           UID to mint token for (default: dev-user)
  --claims <json>       JSON of additional custom claims
  --api-key <key>       Firebase Web API key (defaults to env NEXT_PUBLIC_FIREBASE_API_KEY)
  --project <id>        Firebase project ID override
  --json                Output machine-readable JSON
  -h, --help            Show this help

Examples:
  npx tsx scripts/gen-idtoken.ts --uid dev-user
  node -r ts-node/register scripts/gen-idtoken.ts --uid dev-user --claims '{"role":"admin"}'
`)
}

function resolveServiceAccountPath(): string | undefined {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  const local = path.resolve(process.cwd(), 'service-account.json')
  if (existsSync(local)) return local
  return undefined
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const saPath = resolveServiceAccountPath()
  if (!saPath) {
    throw new Error('Service account not found. Set GOOGLE_APPLICATION_CREDENTIALS or place service-account.json in project root.')
  }

  const sa = JSON.parse(readFileSync(saPath, 'utf8'))

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: args.projectId || sa.project_id || process.env.FIREBASE_PROJECT_ID,
    })
  }

  const auth = admin.auth()
  const customToken = await auth.createCustomToken(args.uid, args.claims as Record<string, unknown> | undefined)

  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(args.apiKey)}`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Failed to exchange custom token: ${resp.status} ${resp.statusText}\n${text}`)
  }

  const data = (await resp.json()) as { idToken: string; refreshToken?: string; expiresIn?: string; localId?: string }

  // Persist token to token.txt at repository root
  try {
    const outPath = path.resolve(process.cwd(), 'token.txt')
    writeFileSync(outPath, `${data.idToken}\n`, 'utf8')
  } catch (e) {
    console.error('[gen-idtoken] Failed to write token.txt:', e)
  }

  if (args.json) {
    console.log(JSON.stringify({
      uid: args.uid,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
      localId: data.localId,
    }, null, 2))
    return
  }

  console.log('UID           :', args.uid)
  console.log('Local ID      :', data.localId || '(n/a)')
  console.log('Expires In    :', data.expiresIn ? `${data.expiresIn}s` : '(server default)')
  console.log('\nID_TOKEN:')
  console.log(data.idToken)
  console.log('\nUse it as:')
  console.log('  Authorization: Bearer <ID_TOKEN>')
}

main().catch((err) => {
  console.error('[gen-idtoken] Error:', err?.message || err)
  process.exit(1)
})
