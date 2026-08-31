import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Page } from '@playwright/test'
import { assertBuild, currentIdentity, identityInput } from '../../e2e/helpers/identity-input'

const uiSha = '1111111111111111111111111111111111111111'
const ceeSha = '2222222222222222222222222222222222222222'
const environment = {
  RUN_IDENTITY_ACCEPTANCE: '1',
  IDENTITY_UI_URL: 'https://identity-ui.example.test',
  IDENTITY_EXPECTED_UI_COMMIT: uiSha,
  IDENTITY_EXPECTED_CEE_COMMIT: ceeSha,
  IDENTITY_SUPABASE_URL: 'https://identity-db.example.test',
  IDENTITY_SUPABASE_ANON_KEY: 'sb_publishable_offline_fixture',
  IDENTITY_A_EMAIL: 'owner-a@example.test',
  IDENTITY_A_PASSWORD: 'offline-fixture-a',
  IDENTITY_B_EMAIL: 'owner-b@example.test',
  IDENTITY_B_PASSWORD: 'offline-fixture-b',
}
const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
const jwt = (role: string) => `e30.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.offline`
const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
const setOptionalEnv = (key: string, value: string | undefined) => {
  if (value === undefined) delete process.env[key]
  else vi.stubEnv(key, value)
}

beforeEach(() => {
  Object.entries(environment).forEach(([key, value]) => vi.stubEnv(key, value))
  vi.stubEnv('DEBUG', '')
  vi.stubEnv('PWDEBUG', '')
  // No test can accidentally reach a live endpoint, including a refusal arm.
  fetchMock.mockReset().mockRejectedValue(new Error('Unexpected offline fetch'))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('identity acceptance input fails closed', () => {
  it.each([undefined, '', '0', 'true'])('requires explicit opt-in, not %s', value => {
    setOptionalEnv('RUN_IDENTITY_ACCEPTANCE', value)
    expect(() => identityInput()).toThrow('LIVE_RUN_NOT_ACKNOWLEDGED')
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('accepts explicit opt-in with distinct controlled accounts', () => {
    expect(identityInput()).toMatchObject({ a: { email: environment.IDENTITY_A_EMAIL }, b: { email: environment.IDENTITY_B_EMAIL } })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it.each(['sb_publishable_offline_fixture', jwt('anon')])('accepts a public key', key => {
    vi.stubEnv('IDENTITY_SUPABASE_ANON_KEY', key)
    expect(() => identityInput()).not.toThrow()
  })
  it.each(['sb_secret_offline_fixture', jwt('service_role')])('refuses a privileged key', key => {
    vi.stubEnv('IDENTITY_SUPABASE_ANON_KEY', key)
    expect(() => identityInput()).toThrow(/PUBLIC.*KEY_REQUIRED/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it.each(['owner-a@example.test', 'OWNER-A@EXAMPLE.TEST'])('refuses duplicate accounts: %s', email => {
    vi.stubEnv('IDENTITY_B_EMAIL', email)
    expect(() => identityInput()).toThrow('DISTINCT_ACCOUNTS_REQUIRED')
  })
  it.each(['IDENTITY_EXPECTED_UI_COMMIT', 'IDENTITY_EXPECTED_CEE_COMMIT'])('requires a full SHA for %s', key => {
    for (const value of [undefined, '', '1234567', 'g'.repeat(40)]) {
      setOptionalEnv(key, value)
      expect(() => identityInput()).toThrow()
    }
    vi.stubEnv(key, key.includes('_UI_') ? uiSha : ceeSha)
    expect(() => identityInput()).not.toThrow()
  })
})

describe('served identities must match independently', () => {
  function serve(uiCommit: string, ceeCommit: string, service = 'assistants') {
    fetchMock.mockImplementation(async url => {
      if (url === `${environment.IDENTITY_UI_URL}/version.json`) return response({ commit: uiCommit })
      if (url === `${environment.IDENTITY_UI_URL}/bff/cee/health`) return response({ service, commit: ceeCommit })
      throw new Error('Unexpected offline URL')
    })
  }
  it('accepts the pinned UI and a seven-character CEE prefix', async () => {
    serve(uiSha, ceeSha.slice(0, 7))
    await expect(assertBuild(identityInput())).resolves.toEqual({
      ui_commit: uiSha, cee_reported_commit: ceeSha.slice(0, 7), cee_expected_commit: ceeSha,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('refuses a wrong UI while CEE matches', async () => {
    serve('3'.repeat(40), ceeSha)
    await expect(assertBuild(identityInput())).rejects.toThrow('SERVED_BUILD_MISMATCH_OR_UNREADABLE')
  })
  it('refuses a wrong CEE while UI matches', async () => {
    serve(uiSha, '4'.repeat(40))
    await expect(assertBuild(identityInput())).rejects.toThrow('SERVED_CEE_BUILD_MISMATCH_OR_UNREADABLE')
  })
  it('refuses a matching CEE prefix shorter than seven characters', async () => {
    serve(uiSha, ceeSha.slice(0, 6))
    await expect(assertBuild(identityInput())).rejects.toThrow('SERVED_CEE_BUILD_MISMATCH_OR_UNREADABLE')
  })
  it('refuses the wrong health service even when both commits match', async () => {
    serve(uiSha, ceeSha, 'different-service')
    await expect(assertBuild(identityInput())).rejects.toThrow('SERVED_CEE_BUILD_MISMATCH_OR_UNREADABLE')
  })
})

describe('adopted session belongs to the expected account', () => {
  const page = { evaluate: vi.fn().mockResolvedValue('offline-access-token') } as unknown as Page
  it.each([['owner-a@example.test', true], ['owner-b@example.test', false]])('checks server email %s', async (email, permitted) => {
    vi.mocked(page.evaluate).mockResolvedValue('offline-access-token')
    fetchMock.mockResolvedValue(response({ id: 'verified-user', email }))
    const result = currentIdentity(page, identityInput(), environment.IDENTITY_A_EMAIL)
    if (permitted) await expect(result).resolves.toEqual({ id: 'verified-user', token: 'offline-access-token' })
    else await expect(result).rejects.toThrow('SERVER_IDENTITY_DOES_NOT_MATCH_LOGIN')
    expect(fetchMock).toHaveBeenCalledWith(`${environment.IDENTITY_SUPABASE_URL}/auth/v1/user`, expect.objectContaining({
      headers: { apikey: environment.IDENTITY_SUPABASE_ANON_KEY, Authorization: 'Bearer offline-access-token' },
    }))
  })
})
