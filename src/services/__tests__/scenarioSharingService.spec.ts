/**
 * ACCOUNTS "Invite a colleague" — the sharing RPC client. Binds the exact RPC
 * names + argument keys of the DRAFT contract (owner 522325, #85 5947474393) and
 * the SM-code → outcome map. The server is the authority; this never throws.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }))

import {
  getScenarioAccess,
  listScenarioMembers,
  listSharedScenarios,
  normaliseEmail,
  shareScenario,
  unshareScenario,
} from '../scenarioSharingService'

const SID = '3b241101-e2bb-4255-8caf-4136c566a962'

beforeEach(() => rpc.mockReset())

describe('shareScenario', () => {
  it('sends share_scenario with the scenario id and the LOWER-CASED, trimmed email', async () => {
    rpc.mockResolvedValue({ data: { shared: true }, error: null })
    await expect(shareScenario(SID, '  Ana.Lee@Example.COM ')).resolves.toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith('share_scenario', { p_scenario_id: SID, p_email: 'ana.lee@example.com' })
  })

  it.each([
    ['SM403', 'not_owner'],
    ['SM400', 'bad_email'],
    ['SM429', 'member_cap'],
    ['PGRST301', 'unavailable'],
  ])('error %s → %s', async (code, failure) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: 'x' } })
    await expect(shareScenario(SID, 'a@b.co')).resolves.toEqual({ ok: false, failure })
  })

  it('a malformed email is refused BEFORE any call', async () => {
    await expect(shareScenario(SID, 'not-an-email')).resolves.toEqual({ ok: false, failure: 'bad_email' })
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('unshareScenario / members / shared list', () => {
  it('unshare_scenario reports revoked exactly as the server says', async () => {
    rpc.mockResolvedValue({ data: { revoked: true }, error: null })
    await expect(unshareScenario(SID, 'A@B.co')).resolves.toEqual({ ok: true, revoked: true })
    expect(rpc).toHaveBeenCalledWith('unshare_scenario', { p_scenario_id: SID, p_email: 'a@b.co' })
    rpc.mockResolvedValue({ data: { revoked: false }, error: null })
    await expect(unshareScenario(SID, 'a@b.co')).resolves.toEqual({ ok: true, revoked: false })
  })

  it('list_scenario_members maps rows and drops malformed ones', async () => {
    rpc.mockResolvedValue({ data: [{ email: 'a@b.co', created_at: '2026-10-02T07:00:00Z' }, { nope: 1 }], error: null })
    await expect(listScenarioMembers(SID)).resolves.toEqual({ ok: true, members: [{ email: 'a@b.co', createdAt: '2026-10-02T07:00:00Z' }] })
    expect(rpc).toHaveBeenCalledWith('list_scenario_members', { p_scenario_id: SID })
  })

  it('list_shared_scenarios maps rows; a blank title reads "Untitled decision"', async () => {
    rpc.mockResolvedValue({
      data: [{ scenario_id: SID, title: ' ', updated_at: 'u', shared_at: 's', owner_name: 'Paul' }],
      error: null,
    })
    await expect(listSharedScenarios()).resolves.toEqual({
      ok: true,
      items: [{ scenarioId: SID, title: 'Untitled decision', updatedAt: 'u', sharedAt: 's', ownerName: 'Paul' }],
    })
    expect(rpc).toHaveBeenCalledWith('list_shared_scenarios', {})
  })
})

describe('getScenarioAccess — fail closed', () => {
  it.each([
    ['owner', 'owner'],
    ['viewer', 'viewer'],
    ['none', 'none'],
    ['admin', 'none'],
    [null, 'none'],
  ])('server %s → %s', async (data, expected) => {
    rpc.mockResolvedValue({ data, error: null })
    await expect(getScenarioAccess(SID)).resolves.toBe(expected)
    expect(rpc).toHaveBeenCalledWith('scenario_access', { p_scenario_id: SID })
  })

  it('a failed call is NONE — never an owner on a guess', async () => {
    rpc.mockResolvedValue({ data: 'owner', error: { code: 'PGRST301' } })
    await expect(getScenarioAccess(SID)).resolves.toBe('none')
  })
})

describe('normaliseEmail', () => {
  it('trims and lower-cases', () => {
    expect(normaliseEmail('  X@Y.Z ')).toBe('x@y.z')
  })
})
