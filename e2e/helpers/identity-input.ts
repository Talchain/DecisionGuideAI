import { createHash } from 'node:crypto'
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export function check(ok: unknown, code: string): asserts ok {
  if (!ok) throw new Error(`IDENTITY:${code}`)
}

export function identityInput() {
  check(process.env.RUN_IDENTITY_ACCEPTANCE === '1', 'LIVE_RUN_NOT_ACKNOWLEDGED')
  check(!process.env.DEBUG && !process.env.PWDEBUG, 'DEBUG_OUTPUT_MUST_BE_OFF')
  const required = (name: string) => {
    const value = process.env[name]
    check(typeof value === 'string' && value.trim().length > 0, `MISSING_${name}`)
    return value
  }
  const origin = (name: string) => {
    const value = required(name)
    const url = new URL(value)
    check(url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/', `INVALID_${name}`)
    return url.origin
  }
  const ui = origin('IDENTITY_UI_URL')
  const commit = required('IDENTITY_EXPECTED_UI_COMMIT')
  check(/^[a-f0-9]{40}$/.test(commit), 'EXPECTED_COMMIT_MUST_BE_FULL_SHA')
  const ceeCommit = required('IDENTITY_EXPECTED_CEE_COMMIT')
  check(/^[a-f0-9]{40}$/.test(ceeCommit), 'EXPECTED_CEE_COMMIT_MUST_BE_FULL_SHA')
  const supabase = origin('IDENTITY_SUPABASE_URL')
  const anonKey = required('IDENTITY_SUPABASE_ANON_KEY')
  check(!anonKey.startsWith('sb_secret_'), 'PUBLIC_KEY_REQUIRED')
  if (anonKey.split('.').length === 3) {
    check(JSON.parse(Buffer.from(anonKey.split('.')[1], 'base64url').toString()).role === 'anon', 'PUBLIC_ANON_KEY_REQUIRED')
  } else check(anonKey.startsWith('sb_publishable_'), 'PUBLIC_KEY_REQUIRED')
  const a = { email: required('IDENTITY_A_EMAIL'), password: required('IDENTITY_A_PASSWORD') }
  const b = { email: required('IDENTITY_B_EMAIL'), password: required('IDENTITY_B_PASSWORD') }
  check(a.email.trim().toLowerCase() !== b.email.trim().toLowerCase(), 'DISTINCT_ACCOUNTS_REQUIRED')
  return { ui, commit, ceeCommit, supabase, anonKey, a, b }
}
export type IdentityInput = ReturnType<typeof identityInput>
export type Identity = { id: string; token: string }

// Native fetch avoids Playwright request/response artifacts; callers retain only allowlisted facts.
export async function jsonRequest(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(45_000), cache: 'no-store', redirect: 'error' })
  const body = await response.json().catch(() => null)
  return { status: response.status, body }
}
export async function assertBuild(input: IdentityInput) {
  const { status, body } = await jsonRequest(`${input.ui}/version.json`)
  check(status === 200 && body?.commit === input.commit, 'SERVED_BUILD_MISMATCH_OR_UNREADABLE')
  // The real same-origin proxy, not a caller-supplied unrelated healthy service.
  const cee = await jsonRequest(`${input.ui}/bff/cee/health`)
  const reported = cee.body?.commit
  check(cee.status === 200 && cee.body?.service === 'assistants' &&
    typeof reported === 'string' && /^[a-f0-9]{7,40}$/.test(reported) &&
    input.ceeCommit.startsWith(reported), 'SERVED_CEE_BUILD_MISMATCH_OR_UNREADABLE')
  return { ui_commit: body.commit as string, cee_reported_commit: reported as string,
    cee_expected_commit: input.ceeCommit }
}
export async function currentIdentity(page: Page, input: IdentityInput, expectedEmail?: string): Promise<Identity> {
  const key = `sb-${new URL(input.supabase).hostname.split('.')[0]}-auth-token`
  const token = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null')?.access_token, key)
  check(typeof token === 'string' && token.length > 0, 'SESSION_TOKEN_NOT_ADOPTED')
  const { status, body } = await jsonRequest(`${input.supabase}/auth/v1/user`, {
    headers: { apikey: input.anonKey, Authorization: `Bearer ${token}` },
  })
  check(status === 200 && typeof body?.id === 'string', 'SESSION_NOT_SERVER_VERIFIED')
  if (expectedEmail !== undefined) {
    check(typeof body.email === 'string' && body.email.trim().toLowerCase() === expectedEmail.trim().toLowerCase(),
      'SERVER_IDENTITY_DOES_NOT_MATCH_LOGIN')
  }
  return { id: body.id, token }
}
export async function passwordLogin(page: Page, input: IdentityInput, account: IdentityInput['a']) {
  await page.goto(`${input.ui}/#/login`)
  await page.getByLabel('Email address', { exact: true }).fill(account.email)
  await page.getByTestId('owner-password-input').fill(account.password)
  await page.getByTestId('owner-password-submit').click()
  await expect(page.getByRole('button', { name: /^(Start a new decision|New decision)$/ })).toBeVisible()
  return currentIdentity(page, input, account.email)
}
export async function scenarioRows(input: IdentityInput, identity: Identity, id: string) {
  return jsonRequest(`${input.supabase}/rest/v1/scenarios?id=eq.${encodeURIComponent(id)}&select=id,user_id,graph`, {
    headers: { apikey: input.anonKey, Authorization: `Bearer ${identity.token}` },
  })
}
export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

export async function mountedModel(page: Page) {
  return page.locator('[data-testid^="rf__node-"]').evaluateAll(nodes => nodes.map(node => ({
    id: node.getAttribute('data-testid')!.replace(/^rf__node-/, ''),
    label: node.querySelector('[data-testid="node-title"]')?.textContent?.trim() ?? '',
  })).filter(node => !node.id.startsWith('__')).sort((a, b) => a.id.localeCompare(b.id)))
}
