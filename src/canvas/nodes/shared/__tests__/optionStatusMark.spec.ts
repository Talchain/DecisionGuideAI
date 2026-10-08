/**
 * The option card shows AT MOST ONE status mark (DL 8 Oct, workstream D):
 * withheld > stale (last-run > no-new-comparison) > not analysed > provisional,
 * and the winner's tooltip names every demoted mark.
 */
import { describe, expect, it } from 'vitest'
import { cardMark } from '../cardMarks'
import {
  OPTION_STATUS_ALSO_PREFIX,
  OPTION_STATUS_MARK_PRIORITY,
  pickOptionStatusMark,
  type OptionStatusMarkCandidate,
  type OptionStatusMarkId,
} from '../optionStatusMark'

const cand = (id: OptionStatusMarkId, description?: string): OptionStatusMarkCandidate => ({ id, testId: `t-${id}`, description })

describe('pickOptionStatusMark', () => {
  it('nothing active → no mark', () => {
    expect(pickOptionStatusMark([])).toBeNull()
    expect(pickOptionStatusMark([false, null])).toBeNull()
  })

  it('a single mark is unchanged: same id, same test id, same description, nothing demoted', () => {
    for (const id of OPTION_STATUS_MARK_PRIORITY) {
      expect(pickOptionStatusMark([cand(id, 'own words')])).toEqual({ id, testId: `t-${id}`, description: 'own words', demoted: [] })
      expect(pickOptionStatusMark([cand(id)])).toEqual({ id, testId: `t-${id}`, description: undefined, demoted: [] })
    }
  })

  // Every pair, in BOTH input orders: the higher-priority mark wins and the other is named in the tooltip.
  const pairs: [OptionStatusMarkId, OptionStatusMarkId][] = []
  OPTION_STATUS_MARK_PRIORITY.forEach((hi, i) => OPTION_STATUS_MARK_PRIORITY.slice(i + 1).forEach(lo => pairs.push([hi, lo])))
  it.each(pairs)('%s beats %s', (hi, lo) => {
    for (const input of [[cand(hi), cand(lo)], [cand(lo), cand(hi)]]) {
      const picked = pickOptionStatusMark(input)
      expect(picked?.id).toBe(hi)
      expect(picked?.testId).toBe(`t-${hi}`)
      expect(picked?.demoted).toEqual([lo])
      expect(picked?.description).toBe(`${OPTION_STATUS_ALSO_PREFIX} ${cardMark(lo).words}`)
    }
  })

  it('the DL order: withheld > stale > not analysed', () => {
    expect(OPTION_STATUS_MARK_PRIORITY.indexOf('share-withheld')).toBeLessThan(OPTION_STATUS_MARK_PRIORITY.indexOf('last-run'))
    expect(OPTION_STATUS_MARK_PRIORITY.indexOf('no-new-comparison')).toBeLessThan(OPTION_STATUS_MARK_PRIORITY.indexOf('not-analysed'))
    expect(OPTION_STATUS_MARK_PRIORITY.indexOf('not-analysed')).toBeLessThan(OPTION_STATUS_MARK_PRIORITY.indexOf('provisional'))
  })

  it('the tooltip keeps the winner\'s own reason first, then lists every demoted mark in priority order', () => {
    const picked = pickOptionStatusMark([cand('provisional'), cand('not-analysed'), cand('share-withheld', 'Olumi withheld the shares'), cand('no-new-comparison')])
    expect(picked?.id).toBe('share-withheld')
    expect(picked?.demoted).toEqual(['no-new-comparison', 'not-analysed', 'provisional'])
    expect(picked?.description).toBe(
      `Olumi withheld the shares · ${OPTION_STATUS_ALSO_PREFIX} ${cardMark('no-new-comparison').words} · ${cardMark('not-analysed').words} · ${cardMark('provisional').words}`,
    )
  })

  it('the same mark offered twice (two stale paths) is shown once and not listed as demoted', () => {
    const picked = pickOptionStatusMark([{ id: 'last-run', testId: 'a' }, { id: 'last-run', testId: 'b' }])
    expect(picked).toEqual({ id: 'last-run', testId: 'a', description: undefined, demoted: [] })
  })
})
