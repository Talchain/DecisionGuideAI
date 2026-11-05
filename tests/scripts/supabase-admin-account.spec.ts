// tests/scripts/supabase-admin-account.spec.ts
// =============================================================================
// Controls for scripts/lib/supabase-admin-account.mjs, and the binding that the
// PR4 witness uses it instead of open sign-up.
// =============================================================================
//
// Open self-sign-up is being closed on the SHARED Supabase project (ACCOUNTS
// phase 2, 30 Sep 2026). Accounts are now created with the admin API and signed
// in with the password grant. Stubs only: no network. The key and token values
// below are built at runtime and are not credential-shaped.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createConfirmedUserAndSignIn,
  SERVICE_ROLE_KEY_ENV,
} from '../../scripts/lib/supabase-admin-account.mjs'

const SERVICE = ['svc', 'stub', 'value', 'not', 'a', 'key'].join('-')
const PUBLIC = ['pub', 'stub', 'value'].join('-')
const CREATED_ID = 'created-user-uuid-stub'
const TOKEN = ['tok', 'stub'].join('-')

interface Call {
  url: string
  headers: Record<string, string>
  payload: Record<string, unknown> | null
}

const isSignup = (url: string): boolean => /\/auth\/v1\/signup(\?|$)/.test(url)

function makeFetch(opts: { createStatus?: number; signInUserId?: string } = {}) {
  const { createStatus = 200, signInUserId = CREATED_ID } = opts
  const calls: Call[] = []
  const reply = (status: number, body: unknown) =>
    ({ status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(body) }) as unknown as Response
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const headers = (init?.headers ?? {}) as Record<string, string>
    const payload = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null
    calls.push({ url, headers, payload })
    if (url.endsWith('/auth/v1/admin/users')) {
      return createStatus === 200
        ? reply(200, { id: CREATED_ID, email: payload?.email })
        : reply(createStatus, { code: createStatus, msg: 'refused' })
    }
    if (url.endsWith('/auth/v1/token?grant_type=password')) {
      return reply(200, { access_token: TOKEN, token_type: 'bearer', refresh_token: 'r', user: { id: signInUserId } })
    }
    if (isSignup(url)) return reply(200, { access_token: TOKEN, user: { id: CREATED_ID } })
    return reply(404, { msg: 'unexpected url' })
  }) as typeof fetch
  return { calls, impl }
}

const base = {
  supabaseUrl: 'https://stub-project.example.test',
  publicKey: PUBLIC,
  email: 'olumi-witness+spec@example.test',
  password: 'Pw-stub-0123456789-Aa1!',
}

describe('createConfirmedUserAndSignIn', () => {
  it('POSITIVE CONTROL: the no-signup predicate can see a signup url', () => {
    expect(isSignup('https://x.example.test/auth/v1/signup')).toBe(true)
  })

  it('creates with the admin API, then signs in with the PUBLIC key, and never calls sign-up', async () => {
    const f = makeFetch()
    const r = await createConfirmedUserAndSignIn({ ...base, serviceRoleKey: SERVICE, fetchImpl: f.impl })

    expect(f.calls.map(c => c.url)).toEqual([
      'https://stub-project.example.test/auth/v1/admin/users',
      'https://stub-project.example.test/auth/v1/token?grant_type=password',
    ])
    expect(f.calls.some(c => isSignup(c.url))).toBe(false)

    const [create, signIn] = f.calls
    expect(create.headers.apikey).toBe(SERVICE)
    expect(create.headers.Authorization).toBe(`Bearer ${SERVICE}`)
    expect(create.payload).toEqual({ email: base.email, password: base.password, email_confirm: true })

    expect(signIn.headers.apikey).toBe(PUBLIC)
    expect(signIn.headers).not.toHaveProperty('Authorization')
    expect(JSON.stringify(signIn.headers)).not.toContain(SERVICE)
    expect(signIn.payload).toEqual({ email: base.email, password: base.password })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.userId).toBe(CREATED_ID)
    expect(r.accessToken).toBe(TOKEN)
    expect((r.session.user as { id: string }).id).toBe(CREATED_ID)
    expect(JSON.stringify(r)).not.toContain(SERVICE)
  })

  it('tolerates a /rest/v1 base (the shape the bundle crawl returns)', async () => {
    const f = makeFetch()
    await createConfirmedUserAndSignIn({
      ...base,
      supabaseUrl: 'https://stub-project.example.test/rest/v1/',
      serviceRoleKey: SERVICE,
      fetchImpl: f.impl,
    })
    expect(f.calls[0]?.url).toBe('https://stub-project.example.test/auth/v1/admin/users')
  })

  it('with no service-role key: refuses before ANY call and names the variable (never falls back to sign-up)', async () => {
    for (const missing of [undefined, null, '']) {
      const f = makeFetch()
      const r = await createConfirmedUserAndSignIn({ ...base, serviceRoleKey: missing, fetchImpl: f.impl })
      expect(f.calls).toHaveLength(0)
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.step).toBe('config')
      expect(r.reason).toContain(SERVICE_ROLE_KEY_ENV)
    }
  })

  it('an admin refusal stops the run: no sign-in, no sign-up, status carried, key absent', async () => {
    const f = makeFetch({ createStatus: 422 })
    const r = await createConfirmedUserAndSignIn({ ...base, serviceRoleKey: SERVICE, fetchImpl: f.impl })
    expect(f.calls).toHaveLength(1)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.step).toBe('admin-create')
    expect(r.http).toBe(422)
    expect(r.reason).not.toContain(SERVICE)
    expect(r.reason).not.toContain(base.password)
  })

  it('refuses a session for a user OTHER than the one created (identity-bound)', async () => {
    const f = makeFetch({ signInUserId: 'someone-else-uuid-stub' })
    const r = await createConfirmedUserAndSignIn({ ...base, serviceRoleKey: SERVICE, fetchImpl: f.impl })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.step).toBe('identity')
  })
})

describe('the PR4 witness mints its owner through the helper, not open sign-up', () => {
  const src = readFileSync(
    path.resolve(__dirname, '../../scripts/witness/pr4-two-person-collab-witness.mjs'),
    'utf8',
  )

  it('POSITIVE CONTROL: the same text predicate sees a signup call in a synthetic source', () => {
    expect('fetch(`${supabaseUrl}/auth/v1/signup`, {'.includes('/auth/v1/signup')).toBe(true)
  })

  it('has no open sign-up call', () => {
    expect(src.includes('/auth/v1/signup')).toBe(false)
  })

  it('imports and calls createConfirmedUserAndSignIn with the service key from the environment', () => {
    expect(src).toContain("from '../lib/supabase-admin-account.mjs'")
    expect(src).toMatch(/await createConfirmedUserAndSignIn\(\{[\s\S]*serviceRoleKey: process\.env\[SERVICE_ROLE_KEY_ENV\]/)
  })
})
