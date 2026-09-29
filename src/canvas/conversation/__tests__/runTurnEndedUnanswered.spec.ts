/**
 * ⭐ Served 29 Sep (R3-B's `823bc028`): "Analyse first pass" sent the run, CEE answered with a unit question and no
 * analysis, and the reply sat in the Olumi tab behind the Analysis tab. A run turn that ends unanswered now brings the
 * conversation into view; a landed run or an aborted turn does not.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runTurnEndedUnanswered } from '../runTurnEndedUnanswered'

describe('runTurnEndedUnanswered', () => {
  it('the served case: still preparing, no report, not aborted → reveal', () => {
    expect(runTurnEndedUnanswered({ status: 'preparing' }, false)).toBe(true)
  })
  it('CONTRAST — an answer landed (complete, or a report waiting to settle) → nothing', () => {
    expect(runTurnEndedUnanswered({ status: 'complete', report: {} }, false)).toBe(false)
    expect(runTurnEndedUnanswered({ status: 'preparing', report: {} }, false)).toBe(false)
  })
  it('an aborted turn (a newer run pre-empted it) → nothing', () => {
    expect(runTurnEndedUnanswered({ status: 'preparing' }, true)).toBe(false)
  })
})

describe('the run turn\'s settle reads it BEFORE settling, and reveals on it (source pin on useConversation)', () => {
  const src = readFileSync(join(__dirname, '..', 'useConversation.ts'), 'utf8')
  it('computes the flag before resultsSettle() and reveals Olumi when it is set', () => {
    const at = src.indexOf('const unanswered = runTurnEndedUnanswered(')
    expect(at).toBeGreaterThan(-1)
    const settle = src.indexOf('useCanvasStore.getState().resultsSettle()', at)
    const reveal = src.indexOf('if (unanswered) revealOlumiSurface()', at)
    expect(settle).toBeGreaterThan(at)
    expect(reveal).toBeGreaterThan(settle)
    expect(src.slice(at, reveal)).toContain('controller.signal.aborted')
  })
})
