/**
 * The restored run's identity comes from the saved fact, or it does not come.
 *
 * Every fixture below is the shape measured on staging: a `v5_handler_facts`
 * row whose payload is `{ fact_type: 'run_analysis', result: { computed_at, … } }`.
 */
import { describe, expect, it } from 'vitest'
import { resolveRunIdentityFromFacts, stampedRunIdentity } from '../resolveRunIdentityFromFacts'

const AT = '2026-09-18T12:58:15.960Z'
const fact = (id: string, computed_at: string | null, factType = 'run_analysis') => ({
  id,
  payload: { fact_type: factType, result: computed_at === null ? {} : { computed_at } },
})

describe('resolveRunIdentityFromFacts', () => {
  it('⭐ returns the durable id of the fact recorded at that instant', () => {
    expect(
      resolveRunIdentityFromFacts([fact('other', '2026-09-18T11:00:00.000Z'), fact('f_real', AT)], AT),
    ).toBe('f_real')
  })

  it('⭐ DISCRIMINATES: a different instant is not this run', () => {
    // Without this the resolver could return the first row it sees and the
    // arm above would still pass — stamping a neighbouring run's identity,
    // which is worse than the placeholder it replaces.
    expect(resolveRunIdentityFromFacts([fact('f_other', '2026-09-18T11:00:00.000Z')], AT)).toBeNull()
  })

  it('joins across encodings of the same instant', () => {
    expect(resolveRunIdentityFromFacts([fact('f_real', '2026-09-18T13:58:15.960+01:00')], AT)).toBe(
      'f_real',
    )
  })

  it('⛔ DECLINES on ambiguity rather than guessing', () => {
    expect(resolveRunIdentityFromFacts([fact('a', AT), fact('b', AT)], AT)).toBeNull()
  })

  it('ignores rows that are not run_analysis facts', () => {
    expect(resolveRunIdentityFromFacts([fact('f_wrong', AT, 'draft_graph')], AT)).toBeNull()
  })

  it('returns null when the restored result has no computedAt to join on', () => {
    expect(resolveRunIdentityFromFacts([fact('f_real', AT)], null)).toBeNull()
    expect(resolveRunIdentityFromFacts([fact('f_real', AT)], undefined)).toBeNull()
    expect(resolveRunIdentityFromFacts([fact('f_real', AT)], 'not-a-date')).toBeNull()
  })

  it('survives malformed rows without throwing', () => {
    const rows = [
      { id: '', payload: { fact_type: 'run_analysis', result: { computed_at: AT } } },
      { id: 'f_null', payload: null },
      { id: 'f_str', payload: 'nonsense' },
      { id: 'f_noresult', payload: { fact_type: 'run_analysis' } },
      fact('f_real', AT),
    ]
    expect(resolveRunIdentityFromFacts(rows, AT)).toBe('f_real')
  })

  it('returns null on an empty set — a guest reads nothing (RLS) and must not be guessed for', () => {
    expect(resolveRunIdentityFromFacts([], AT)).toBeNull()
  })
})

describe('stampedRunIdentity', () => {
  const isPlaceholder = (id: string | undefined) =>
    typeof id === 'string' && id.startsWith('restored:')

  it('⭐ replaces the placeholder with the durable id', () => {
    expect(stampedRunIdentity('restored:v5:1b52', 'f_real', isPlaceholder)).toBe('f_real')
  })

  it('⛔ NEVER overwrites a real id — the twin that stops this losing the truth', () => {
    expect(stampedRunIdentity('run_real', 'f_other', isPlaceholder)).toBe('run_real')
  })

  it('changes nothing when the facts resolved nothing', () => {
    expect(stampedRunIdentity('restored:v5:1b52', null, isPlaceholder)).toBe('restored:v5:1b52')
    expect(stampedRunIdentity(undefined, null, isPlaceholder)).toBeUndefined()
  })

  it('fills an absent id, which is the state a fresh V5 run leaves behind', () => {
    expect(stampedRunIdentity(undefined, 'f_real', isPlaceholder)).toBe('f_real')
  })
})
