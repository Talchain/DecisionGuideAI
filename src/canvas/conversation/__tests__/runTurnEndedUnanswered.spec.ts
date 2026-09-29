/**
 * ⭐ Served 29 Sep (R3-B's `823bc028`): "Analyse first pass" sent the run, CEE answered with a unit question and no
 * analysis, and the reply sat in the Olumi tab behind the Analysis tab. A run turn that ends with no new report brings
 * the dock's Olumi tab to the front; a landed run or an aborted turn does not.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('../../../flags', async (orig) => ({ ...(await orig<object>()), isAiPanelV2Enabled: () => true }))
const revealOlumiSurface = vi.fn(() => true)
vi.mock('../revealOlumi', () => ({ revealOlumiSurface: () => revealOlumiSurface() }))

import { runTurnEndedUnanswered, revealRunReply } from '../runTurnEndedUnanswered'
import { useUIStore } from '../../../stores/uiStore'

const PRIOR = { id: 'prior-report' }

describe('runTurnEndedUnanswered', () => {
  it('the served case: no report before, none after, not aborted → unanswered', () => {
    expect(runTurnEndedUnanswered(null, null, false)).toBe(true)
  })
  it('an older report still on screen and no new one → unanswered', () => {
    expect(runTurnEndedUnanswered(PRIOR, PRIOR, false)).toBe(true)
  })
  it('CONTRAST — a report landed (a new object replaced the old one, or appeared) → answered', () => {
    expect(runTurnEndedUnanswered(null, { id: 'new' }, false)).toBe(false)
    expect(runTurnEndedUnanswered(PRIOR, { id: 'new' }, false)).toBe(false)
  })
  it('an aborted turn (a newer run pre-empted it) → nothing', () => {
    expect(runTurnEndedUnanswered(null, null, true)).toBe(false)
  })
})

describe('revealRunReply fronts the dock\'s Olumi tab — never only a floating focus', () => {
  beforeEach(() => revealOlumiSurface.mockClear())
  it('force-activates the Olumi output tab (the served failure: the Analysis tab stayed in front)', () => {
    const spy = vi.spyOn(useUIStore.getState(), 'forceActivateOutputTab')
    revealRunReply()
    expect(spy).toHaveBeenCalledWith('olumi')
    expect(revealOlumiSurface).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('the run turn\'s settle reads it BEFORE settling, and reveals on it (source pin on useConversation)', () => {
  const src = readFileSync(join(__dirname, '..', 'useConversation.ts'), 'utf8')
  it('records the report at dispatch, compares it at the end, then reveals the reply', () => {
    expect(src).toMatch(/const runReportAtDispatch = isRunAnalysisTurn \? useCanvasStore\.getState\(\)\.results\.report : undefined/)
    const at = src.indexOf('const unanswered = runTurnEndedUnanswered(runReportAtDispatch,')
    expect(at).toBeGreaterThan(-1)
    const settle = src.indexOf('useCanvasStore.getState().resultsSettle()', at)
    const reveal = src.indexOf('if (unanswered) revealRunReply()', at)
    expect(settle).toBeGreaterThan(at)
    expect(reveal).toBeGreaterThan(settle)
    expect(src.slice(at, reveal)).toContain('controller.signal.aborted')
  })
})
