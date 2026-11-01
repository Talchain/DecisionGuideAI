import { describe, it, expect } from 'vitest'
import { derivedUuidOfSid, sidOfUuid, uuidOfSid, aliasesOfHeader, aliasHeader, propIdOf, turnIdOf, runIdOf, rev16, rev64, parseCookies } from '../../../scripts/olumi-core/lib/ids.mjs'
import { isCeeAddressableScenarioId } from '../../canvas/hydrate/bootGraphRead'
import { isUnversionedSaveReceipt } from '../../v5/saveReceipts'

describe('ids: derived, never remembered', () => {
  it('a core scenario id has a reversible UUID form that DGAI\'s own UUID gate accepts', () => {
    const uuid = derivedUuidOfSid('s_437f3c107bdd')
    expect(uuid).toBe('00000000-0000-4000-8000-437f3c107bdd')
    expect(isCeeAddressableScenarioId(uuid)).toBe(true)
    expect(sidOfUuid(uuid)).toBe('s_437f3c107bdd')
  })
  it('a UUID DGAI minted first is paired by the page, and the pairing wins both ways', () => {
    const minted = '11111111-2222-4333-8444-555555555555'
    const aliases = aliasesOfHeader(aliasHeader([minted, 's_437f3c107bdd']))
    expect(aliases).toEqual([[minted, 's_437f3c107bdd']])
    expect(sidOfUuid(minted, aliases)).toBe('s_437f3c107bdd')
    expect(uuidOfSid('s_437f3c107bdd', aliases)).toBe(minted)
    expect(uuidOfSid('s_437f3c107bdd', [])).toBe('00000000-0000-4000-8000-437f3c107bdd')
    expect(sidOfUuid(minted, [])).toBeNull()
  })
  it('the pairing header names a UUID and a core scenario id, and anything else names nothing', () => {
    for (const bad of [undefined, '', 'nonsense', '11111111-2222-4333-8444-555555555555=../x', '11111111-2222-4333-8444-555555555555=s_zz', 'x=s_1', '11111111-2222-4333-8444-555555555555=s_1;extra']) expect(aliasesOfHeader(bad), String(bad)).toEqual([])
  })
  it('a held card, a turn and a Run are stable for what they name and differ for what else they could name', () => {
    expect(propIdOf('s_a', 7)).toMatch(/^prop_[0-9a-f]{32}$/)
    expect(propIdOf('s_a', 7)).toBe(propIdOf('s_a', 7))
    expect(propIdOf('s_a', 7)).not.toBe(propIdOf('s_a', 8))
    expect(propIdOf('s_a', 7)).not.toBe(propIdOf('s_b', 7))
    expect(isCeeAddressableScenarioId(turnIdOf('s_a', 3))).toBe(true)
    expect(runIdOf({ n: 2, id: 9 })).toMatch(/^mp_run_2_[0-9a-f]{12}$/)
  })
  it('the saved identity DGAI reads is 16 and 64 hex and moves with the version and the held change', () => {
    const v = { id: 's_a', version: { id: 1 }, pending: null }
    expect(rev16(v)).toMatch(/^[0-9a-f]{16}$/)
    expect(rev64(v)).toMatch(/^[0-9a-f]{64}$/)
    expect(rev16({ ...v, version: { id: 2 } })).not.toBe(rev16(v))
    expect(rev16({ ...v, pending: { id: 5 } })).not.toBe(rev16(v))
    expect(isUnversionedSaveReceipt({ kind: 'unversioned', scenario_revision: rev64(v), run_id: runIdOf({ n: 1, id: 1 }), source_turn_id: 't', authorised_by: 'person' })).toBe(true)
  })
  it('reads cookies without trusting them', () => {
    expect(parseCookies('olumi=abc; olumi_sc=zzz; other=%E0%A4%A')).toMatchObject({ olumi: 'abc', olumi_sc: 'zzz' })
  })
})
