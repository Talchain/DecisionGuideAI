/**
 * ⛔ BAN HIT #8 (red team #87 6004182580; DL 0df0e1), composed end to end: the Results goal label feeds the hero's
 * "doesn't hold today's level of ‘…’" sentence. It served ‘the best outcome for no-shows’; it must serve the goal's
 * own label. Lives under analysis-hero/ because only this module (and ResultsBody) may import the hero (inertness).
 */
import { describe, expect, it } from 'vitest'
import { resultsGoalLabel } from '../../utils/resultsGoalLabel'
import { HERO_COPY } from '../heroCopy'

describe('the hero names the goal by its own label', () => {
  it('RED: the dental fixture → "today’s level of ‘no-shows’", never "best"', () => {
    const served = HERO_COPY.lensUnavailable.outcomeNoTodayLevel(resultsGoalLabel(undefined, 'no-shows'), null)
    expect(served).toContain('today\'s level of ‘no-shows’')
    expect(served).not.toMatch(/\bbest\b/i)
    expect(served).not.toContain('the best outcome for')
  })
})
