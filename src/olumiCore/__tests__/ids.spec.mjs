import { describe, it, expect } from 'vitest'
import { derivedUuidOfSid, sidOfUuid, uuidOfSid, withAlias, encodeAliases, decodeAliases, propIdOf, turnIdOf, runIdOf, rev16, rev64, parseCookies, MAX_ALIASES } from '../../../scripts/olumi-core/lib/ids.mjs'
import { isCeeAddressableScenarioId } from '../../canvas/hydrate/bootGraphRead'
import { isUnversionedSaveReceipt } from '../../v5/saveReceipts'

describe('ids: derived, never remembered', () => {
  it('a core scenario id has a reversible UUID form that DGAI\'s own UUID gate accepts', () => {
    const uuid = derivedUuidOfSid('s_437f3c107bdd')
    expect(uuid).toBe('00000000-0000-4000-8000-437f3c107bdd')
    expect(isCeeAddressableScenarioId(uuid)).toBe(true)
    expect(sidOfUuid(uuid)).toBe('s_437f3c107bdd')
  })
  it('a UUID DGAI minted first is paired in the browser\'s own alias list, and wins both ways', () => {
    const minted = '11111111-2222-4333-8444-555555555555'
    const aliases = withAlias([], minted, 's_437f3c107bdd')
    expect(sidOfUuid(minted, aliases)).toBe('s_437f3c107bdd')
    expect(uuidOfSid('s_437f3c107bdd', aliases)).toBe(minted)
    expect(uuidOfSid('s_437f3c107bdd', [])).toBe('00000000-0000-4000-8000-437f3c107bdd')
    expect(sidOfUuid(minted, [])).toBeNull()
  })
  it('the alias cookie round-trips, caps its size, and treats anything malformed as empty', () => {
    let a = []
    for (let i = 0; i < MAX_ALIASES + 5; i++) a = withAlias(a, `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, `s_${String(i).padStart(12, '0')}`)
    expect(a).toHaveLength(MAX_ALIASES)
    expect(decodeAliases(encodeAliases(a))).toEqual(a)
    expect(decodeAliases('not base64 json')).toEqual([])
    expect(decodeAliases(encodeAliases([['x', 'y']]))).toEqual([])
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
