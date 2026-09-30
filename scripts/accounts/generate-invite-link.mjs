#!/usr/bin/env node
// scripts/accounts/generate-invite-link.mjs
// =============================================================================
// OPERATOR TOOL: mint ONE invite link for ONE tester (design A1, no SMTP).
// =============================================================================
//
// Sign-up is invite-only. The operator (the DL or Paul) runs this locally for
// each tester and emails the printed link from their own mailbox. The link opens
// the /accept-invite page (src/components/auth/AcceptInvitePage.tsx), which
// verifies the token and asks the tester to choose a password.
//
// USAGE
//   OLUMI_INVITE_ENV_FILE=/absolute/path/to/.env.staging.local \
//     node scripts/accounts/generate-invite-link.mjs --email tester@company.com | pbcopy
//
//   --email <address>   required; the tester's address
//   --type invite       (default) a new account; Supabase creates it as "invited"
//   --type recovery     an EXISTING account: re-issue a link that sets a new password
//   --origin <url>      default https://staging--olumi.netlify.app
//   --key-var <NAME>    the env-file variable holding the service-role key
//                       (default SUPABASE_SERVICE_ROLE_KEY)
//   --dry-run           check the inputs and the env file; call NOTHING; print a
//                       placeholder URL. Creates no user.
//
// WHAT IT CALLS: supabase-js `auth.admin.generateLink({ type, email,
// options: { redirectTo } })` with the service-role key. It sends no email. For
// type=invite it creates the user if the address is new; that is the invite.
//
// SECRETS DISCIPLINE
//   * The service-role key is read from the env FILE named by
//     OLUMI_INVITE_ENV_FILE, never from argv (argv lands in shell history) and
//     never from the ambient environment.
//   * stdout carries ONLY the accept-invite URL: one line, nothing else. Pipe it
//     to `pbcopy` so it never sits in terminal scrollback. The URL is a single-use
//     credential until the tester opens it; send it to that tester only.
//   * stderr carries diagnostics with no key, no token and no link. Error text
//     from Supabase is scrubbed of the key, of JWT-shaped strings and of long hex
//     before it is printed.
//
// EXIT CODES: 0 link printed (or dry run passed) · 1 Supabase refused ·
//             2 usage or configuration error (nothing was called).

import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const ENV_FILE_VAR = 'OLUMI_INVITE_ENV_FILE'
export const DEFAULT_KEY_VAR = 'SUPABASE_SERVICE_ROLE_KEY'
export const DEFAULT_ORIGIN = 'https://staging--olumi.netlify.app'
/** Must equal ACCEPT_INVITE_PATH in src/components/auth/AcceptInvitePage.tsx (a spec binds them). */
export const ACCEPT_INVITE_PATH = '/accept-invite'
export const LINK_TYPES = /** @type {const} */ (['invite', 'recovery'])
export const DRY_RUN_TOKEN = 'DRY-RUN-NO-TOKEN'

class UsageError extends Error {}

/** Parse argv (without node and the script path). Throws UsageError. */
export function parseArgs(argv) {
  const out = { email: null, type: 'invite', origin: DEFAULT_ORIGIN, keyVar: DEFAULT_KEY_VAR, dryRun: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    const next = () => {
      const v = argv[i + 1]
      if (v === undefined || v.startsWith('--')) throw new UsageError(`${a} needs a value`)
      i += 1
      return v
    }
    if (a === '--email') out.email = next().trim().toLowerCase()
    else if (a === '--type') out.type = next()
    else if (a === '--origin') out.origin = next()
    else if (a === '--key-var') out.keyVar = next()
    else if (a === '--dry-run') out.dryRun = true
    else throw new UsageError(`unknown argument ${JSON.stringify(a)}`)
  }
  if (!out.email) throw new UsageError('--email <address> is required')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) throw new UsageError('--email is not an email address')
  if (!LINK_TYPES.includes(out.type)) throw new UsageError(`--type must be one of ${LINK_TYPES.join(' | ')}`)
  if (!/^[A-Z_][A-Z0-9_]*$/.test(out.keyVar)) throw new UsageError('--key-var must be an environment-variable NAME')
  let origin
  try {
    origin = new URL(out.origin)
  } catch {
    throw new UsageError('--origin is not a URL')
  }
  const local = origin.hostname === 'localhost' || origin.hostname === '127.0.0.1'
  if (origin.protocol !== 'https:' && !(local && origin.protocol === 'http:')) {
    throw new UsageError('--origin must be https (http is allowed for localhost only)')
  }
  if ((origin.pathname !== '/' && origin.pathname !== '') || origin.search || origin.hash) {
    throw new UsageError('--origin must be a bare origin, e.g. https://staging--olumi.netlify.app')
  }
  out.origin = origin.origin
  return out
}

/** Minimal dotenv reader: KEY=VALUE, optional `export `, quotes, `#` comments. Values are never printed. */
export function parseEnvFile(text) {
  const vars = {}
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"') && v.length >= 2) || (v.startsWith("'") && v.endsWith("'") && v.length >= 2)) {
      v = v.slice(1, -1)
    } else {
      v = v.replace(/\s+#.*$/, '').trim()
    }
    vars[m[1]] = v
  }
  return vars
}

/** A class name for a key, never the key. */
export function keyClass(key) {
  if (!key) return 'missing'
  if (key.startsWith('sb_secret_')) return 'sb_secret'
  if (key.startsWith('sb_publishable_')) return 'sb_publishable'
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) return 'jwt'
  return 'unrecognised'
}

/** The URL the tester opens. HashRouter: the route and its query live after `#`. */
export function buildAcceptInviteUrl(origin, tokenHash, type) {
  const q = new URLSearchParams({ token_hash: tokenHash, type })
  return `${origin}/#${ACCEPT_INVITE_PATH}?${q.toString()}`
}

/** Scrub anything credential-shaped from a message before it reaches stderr. */
export function scrub(message, key) {
  let s = String(message ?? '')
  if (key) s = s.split(key).join('[key]')
  return s
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[jwt]')
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, '[key]')
    .replace(/\b[0-9a-f]{32,}\b/gi, '[hex]')
    .replace(/(token(?:_hash)?=)[^&\s]+/gi, '$1[redacted]')
}

/** Load config from the env file named by OLUMI_INVITE_ENV_FILE. Throws UsageError. */
export function loadConfig(env, keyVar, readFile = p => readFileSync(p, 'utf8'), stat = statSync) {
  const file = env[ENV_FILE_VAR]
  if (!file) throw new UsageError(`${ENV_FILE_VAR} is not set: point it at the LOCAL env file that holds the service-role key`)
  if (!path.isAbsolute(file)) throw new UsageError(`${ENV_FILE_VAR} must be an absolute path`)
  let isFile = false
  try {
    isFile = stat(file).isFile()
  } catch {
    isFile = false
  }
  if (!isFile) throw new UsageError(`${ENV_FILE_VAR} does not name a readable file`)
  const vars = parseEnvFile(readFile(file))
  const supabaseUrl = vars.SUPABASE_URL
  const key = vars[keyVar]
  if (!supabaseUrl) throw new UsageError('the env file has no SUPABASE_URL')
  let host
  try {
    host = new URL(supabaseUrl)
  } catch {
    throw new UsageError('SUPABASE_URL in the env file is not a URL')
  }
  if (host.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(host.hostname)) {
    throw new UsageError('SUPABASE_URL in the env file is not an https://<ref>.supabase.co URL')
  }
  const cls = keyClass(key)
  if (cls === 'missing') throw new UsageError(`the env file has no ${keyVar}`)
  if (cls === 'sb_publishable') throw new UsageError(`${keyVar} is a PUBLISHABLE key; generateLink needs the service-role (secret) key`)
  return { supabaseUrl: host.origin, projectRef: host.hostname.split('.')[0], key, keyClass: cls }
}

async function defaultLoadSupabase() {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient
}

/**
 * Run the tool. Returns the exit code. `io` is injectable for the spec.
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} env
 * @param {{ stdout?: (s: string) => void, stderr?: (s: string) => void,
 *           loadSupabase?: () => Promise<Function>, readFile?: (p: string) => string,
 *           stat?: (p: string) => { isFile(): boolean } }} [io]
 */
export async function main(argv, env, io = {}) {
  const stdout = io.stdout ?? (s => process.stdout.write(s))
  const stderr = io.stderr ?? (s => process.stderr.write(s))
  const loadSupabase = io.loadSupabase ?? defaultLoadSupabase

  let args
  let cfg
  try {
    args = parseArgs(argv)
    cfg = loadConfig(env, args.keyVar, io.readFile, io.stat)
  } catch (err) {
    if (err instanceof UsageError) {
      stderr(`generate-invite-link: ${err.message}\n`)
      stderr('usage: OLUMI_INVITE_ENV_FILE=/abs/path/.env node scripts/accounts/generate-invite-link.mjs --email <addr> [--type invite|recovery] [--origin <url>] [--key-var NAME] [--dry-run]\n')
      return 2
    }
    throw err
  }

  const redirectTo = `${args.origin}/#${ACCEPT_INVITE_PATH}`
  const domain = args.email.slice(args.email.lastIndexOf('@'))

  if (args.dryRun) {
    stderr(
      `DRY RUN: nothing was called and no user was created.\n` +
        `  would call auth.admin.generateLink({ type: '${args.type}', email: <…${domain}>, options: { redirectTo: '${redirectTo}' } })\n` +
        `  project ${cfg.projectRef} · key ${args.keyVar} present (class ${cfg.keyClass}, value not printed)\n` +
        `  the line on stdout is a PLACEHOLDER showing the link's shape; it carries no token.\n`,
    )
    stdout(`${buildAcceptInviteUrl(args.origin, DRY_RUN_TOKEN, args.type)}\n`)
    return 0
  }

  let createClient
  try {
    createClient = await loadSupabase()
  } catch (err) {
    stderr(`generate-invite-link: could not load @supabase/supabase-js (${scrub(err?.message, cfg.key)}); run \`pnpm install\` first\n`)
    return 2
  }
  const admin = createClient(cfg.supabaseUrl, cfg.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  let data
  let error
  try {
    ;({ data, error } = await admin.auth.admin.generateLink({ type: args.type, email: args.email, options: { redirectTo } }))
  } catch (err) {
    stderr(`generate-invite-link: the call failed before Supabase answered (${scrub(err?.message, cfg.key)})\n`)
    return 1
  }
  if (error) {
    const status = typeof error.status === 'number' ? error.status : 'no status'
    stderr(`generate-invite-link: Supabase refused (${status}): ${scrub(error.message, cfg.key)}\n`)
    if (args.type === 'invite' && status === 422) {
      stderr('  If this address already has an account, re-run with --type recovery to issue a set-password link.\n')
    }
    return 1
  }
  const tokenHash = data?.properties?.hashed_token
  if (typeof tokenHash !== 'string' || tokenHash.length === 0) {
    stderr('generate-invite-link: Supabase answered without a hashed_token; no link was built\n')
    return 1
  }
  stderr(`generated a ${args.type} link for <…${domain}> (user ${data?.user?.id ?? 'unknown'}). The link is single-use: send it to this tester only.\n`)
  stdout(`${buildAcceptInviteUrl(args.origin, tokenHash, args.type)}\n`)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2), process.env).then(
    code => process.exit(code),
    err => {
      process.stderr.write(`generate-invite-link: unexpected failure (${err?.name ?? 'error'})\n`)
      process.exit(1)
    },
  )
}
