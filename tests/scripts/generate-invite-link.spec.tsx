// tests/scripts/generate-invite-link.spec.tsx
// =============================================================================
// Controls for scripts/accounts/generate-invite-link.mjs (design A1: the
// operator mints one invite link per tester and emails it; no SMTP).
// =============================================================================
//
// What this binds:
//   · the link the script prints is the link the /accept-invite page reads:
//     rendered at that URL, the page calls verifyOtp with EXACTLY the token
//     Supabase returned (identity, not a value predicate);
//   · stdout carries ONLY that URL; the service key never reaches stdout or stderr;
//   · --dry-run calls nothing and creates nothing;
//   · configuration errors call nothing.
// Stubs only: no network, no filesystem. Key values are built at runtime and are
// not credential-shaped.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const verifyOtp = vi.fn()
vi.mock('../../src/lib/supabase', () => ({
  supabase: { auth: { verifyOtp: (...a: unknown[]) => verifyOtp(...a), updateUser: vi.fn() } },
}))

import AcceptInvitePage, { ACCEPT_INVITE_PATH as PAGE_PATH } from '../../src/components/auth/AcceptInvitePage'
import {
  ACCEPT_INVITE_PATH,
  DEFAULT_ORIGIN,
  DRY_RUN_TOKEN,
  ENV_FILE_VAR,
  buildAcceptInviteUrl,
  main,
  parseEnvFile,
  scrub,
} from '../../scripts/accounts/generate-invite-link.mjs'

const KEY = ['sb', 'secret', 'stubvalue0123456789'].join('_')
const PUBLISHABLE = ['sb', 'publishable', 'stubvalue'].join('_')
const HASH = 'a'.repeat(8) + 'hashed-token-stub' + 'b'.repeat(8)
const ENV_PATH = '/abs/stub/.env.staging.local'
const SUPABASE_URL = 'https://stubref.supabase.co'

function envText(key: string | null = KEY, url: string | null = SUPABASE_URL): string {
  return [
    '# a comment',
    url ? `SUPABASE_URL=${url}` : '',
    key ? `export SUPABASE_SERVICE_ROLE_KEY="${key}"` : '',
    'OTHER=1',
  ].join('\n')
}

function harness(opts: { text?: string; generate?: (...a: unknown[]) => unknown } = {}) {
  const out: string[] = []
  const err: string[] = []
  const generateLink = vi.fn(
    opts.generate ??
      (async () => ({ data: { properties: { hashed_token: HASH, action_link: `https://x/verify?token=${HASH}` }, user: { id: 'u-1' } }, error: null })),
  )
  const createClient = vi.fn(() => ({ auth: { admin: { generateLink } } }))
  const loadSupabase = vi.fn(async () => createClient)
  const io = {
    stdout: (s: string) => out.push(s),
    stderr: (s: string) => err.push(s),
    loadSupabase,
    readFile: () => opts.text ?? envText(),
    stat: () => ({ isFile: () => true }),
  }
  return { io, out, err, generateLink, createClient, loadSupabase }
}

const env = { [ENV_FILE_VAR]: ENV_PATH }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the printed link is the link the accept-invite page reads', () => {
  it('uses the SAME path constant as the page', () => {
    expect(ACCEPT_INVITE_PATH).toBe(PAGE_PATH)
  })

  it.each(['invite', 'recovery'] as const)('a %s link, opened on the page, verifies EXACTLY the token Supabase returned', async type => {
    const h = harness()
    const code = await main(['--email', 'tester@company.example', '--type', type], env, h.io)
    expect(code).toBe(0)
    const url = h.out.join('').trim()
    const hashIndex = url.indexOf('#')
    expect(url.slice(0, hashIndex)).toBe(`${DEFAULT_ORIGIN}/`)
    const route = url.slice(hashIndex + 1) // HashRouter: the route lives after '#'

    verifyOtp.mockResolvedValue({ data: { session: null }, error: null })
    render(
      <MemoryRouter initialEntries={[route]}>
        <AcceptInvitePage />
      </MemoryRouter>,
    )
    await waitFor(() => expect(verifyOtp).toHaveBeenCalledTimes(1))
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: HASH, type })
  })
})

describe('main (live path, stubbed Supabase)', () => {
  it('calls generateLink once with the invite type, the email and the accept-invite redirect', async () => {
    const h = harness()
    const code = await main(['--email', ' Tester@Company.Example '], env, h.io)
    expect(code).toBe(0)
    expect(h.createClient).toHaveBeenCalledTimes(1)
    expect(h.createClient).toHaveBeenCalledWith(SUPABASE_URL, KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    expect(h.generateLink).toHaveBeenCalledTimes(1)
    expect(h.generateLink).toHaveBeenCalledWith({
      type: 'invite',
      email: 'tester@company.example',
      options: { redirectTo: `${DEFAULT_ORIGIN}/#${ACCEPT_INVITE_PATH}` },
    })
  })

  it('stdout is ONE line, the URL; stderr carries neither the key, the token nor the link', async () => {
    const h = harness()
    await main(['--email', 'tester@company.example'], env, h.io)
    expect(h.out).toEqual([`${buildAcceptInviteUrl(DEFAULT_ORIGIN, HASH, 'invite')}\n`])
    const errText = h.err.join('')
    expect(errText).not.toContain(KEY)
    expect(errText).not.toContain(HASH)
    expect(errText).not.toContain('accept-invite?')
    expect(errText).not.toContain('tester@')
  })

  it('a Supabase refusal prints nothing on stdout, scrubs the message, and exits 1', async () => {
    const jwtish = ['eyJ' + 'a'.repeat(12), 'b'.repeat(12), 'c'.repeat(12)].join('.')
    const h = harness({
      generate: async () => ({ data: null, error: Object.assign(new Error(`bad key ${KEY} and ${jwtish}`), { status: 422 }) }),
    })
    const code = await main(['--email', 'tester@company.example'], env, h.io)
    expect(code).toBe(1)
    expect(h.out).toEqual([])
    const errText = h.err.join('')
    expect(errText).toContain('422')
    expect(errText).not.toContain(KEY)
    expect(errText).not.toContain(jwtish)
    expect(errText).toMatch(/--type recovery/)
  })

  it('an answer without hashed_token builds no link', async () => {
    const h = harness({ generate: async () => ({ data: { properties: {} }, error: null }) })
    expect(await main(['--email', 'tester@company.example'], env, h.io)).toBe(1)
    expect(h.out).toEqual([])
  })
})

describe('--dry-run', () => {
  it('calls NOTHING, prints only a token-free placeholder, exits 0', async () => {
    const h = harness()
    const code = await main(['--email', 'tester@company.example', '--dry-run'], env, h.io)
    expect(code).toBe(0)
    expect(h.loadSupabase).not.toHaveBeenCalled()
    expect(h.createClient).not.toHaveBeenCalled()
    expect(h.generateLink).not.toHaveBeenCalled()
    expect(h.out).toEqual([`${buildAcceptInviteUrl(DEFAULT_ORIGIN, DRY_RUN_TOKEN, 'invite')}\n`])
    const errText = h.err.join('')
    expect(errText).toMatch(/DRY RUN/)
    expect(errText).not.toContain(KEY)
  })
})

describe('configuration errors call nothing and exit 2', () => {
  const cases: Array<[string, string[], Record<string, string | undefined>, string?]> = [
    ['no env-file variable', ['--email', 'a@b.example'], {}],
    ['a relative env-file path', ['--email', 'a@b.example'], { [ENV_FILE_VAR]: 'relative/.env' }],
    ['no --email', [], env],
    ['a malformed email', ['--email', 'not-an-email'], env],
    ['an unknown type', ['--email', 'a@b.example', '--type', 'signup'], env],
    ['a key on the command line (unknown flag)', ['--email', 'a@b.example', '--key', 'x'], env],
    ['a non-https origin', ['--email', 'a@b.example', '--origin', 'http://evil.example'], env],
    ['an origin with a path', ['--email', 'a@b.example', '--origin', 'https://staging--olumi.netlify.app/x'], env],
    ['no key in the env file', ['--email', 'a@b.example'], env, envText(null)],
    ['a PUBLISHABLE key in the env file', ['--email', 'a@b.example'], env, envText(PUBLISHABLE)],
    ['a non-supabase URL in the env file', ['--email', 'a@b.example'], env, envText(KEY, 'https://example.com')],
  ]
  it.each(cases)('%s', async (_name, argv, e, text) => {
    const h = harness({ text })
    const code = await main(argv, e, h.io)
    expect(code).toBe(2)
    expect(h.loadSupabase).not.toHaveBeenCalled()
    expect(h.out).toEqual([])
    expect(h.err.join('')).not.toContain(KEY)
  })
})

describe('helpers', () => {
  it('parseEnvFile reads export, quotes and trailing comments', () => {
    expect(parseEnvFile('export A="x y"\nB=\'z\'\nC=plain # note\n# D=hidden\nE = spaced')).toEqual({
      A: 'x y',
      B: 'z',
      C: 'plain',
      E: 'spaced',
    })
  })

  it('scrub removes the key, JWT-shaped strings, long hex and token parameters', () => {
    const s = scrub(`k=${KEY} j=eyJaaaaaaaaaa.bbbbbbbbbb.cccccccccc h=${'f'.repeat(40)} u=?token_hash=abc&type=invite`, KEY)
    expect(s).not.toContain(KEY)
    expect(s).toContain('[key]')
    expect(s).toContain('[jwt]')
    expect(s).toContain('[hex]')
    expect(s).toContain('token_hash=[redacted]')
  })
})
