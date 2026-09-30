/**
 * PTL #77 5908320681 item 7 (DL routing 5908352174 → Canvas): user-facing copy never says "withheld" or uses gate words.
 * It says what is missing and how to supply it (where the UI has a writer for it). Scans the words of EVERY humanised
 * code, not a hand-picked list, plus the two other UI-owned sites the sweep changed.
 */
import { describe, it, expect } from 'vitest'
import { humaniseCritique, humanisedCodes } from '../humaniseCritique'
import type { UncertaintyItem } from '../../types'

const GATE_WORDS = /\bwithh[oe]ld(?:ing)?\b|\bleader[_ ]claim\b|\bnot admitted\b|\bgated\b/i

describe('plain-language withholding — no "withheld" in the UI’s own words', () => {
  it('POSITIVE CONTROL: the matcher catches the served sentence this sweep replaced; the scan sees every template', () => {
    expect(GATE_WORDS.test("so its check was withheld rather than guessed")).toBe(true)
    expect(humanisedCodes().length).toBeGreaterThan(40)
    expect(humanisedCodes()).toContain('CONSTRAINT_NOT_CONVERTIBLE')
  })

  it('RED: no humanised code’s title, description or suggestion says "withheld" or a gate word', () => {
    const offenders = humanisedCodes().flatMap((code) => {
      const h = humaniseCritique({ code, message: 'raw producer prose', label: 'Monthly churn' } as unknown as UncertaintyItem)
      return [h.title, h.description, h.suggestion].filter((t): t is string => typeof t === 'string' && GATE_WORDS.test(t)).map((t) => `${code}: ${t}`)
    })
    expect(offenders).toEqual([])
  })

  it('the limit and goal checks say what is missing and the next step', () => {
    const limit = humaniseCritique({ code: 'CONSTRAINT_NOT_CONVERTIBLE', message: 'x' } as unknown as UncertaintyItem)
    expect(limit.title).toMatch(/current level, then run the analysis again/)
    const frame = humaniseCritique({ code: 'CONSTRAINT_FRAME_UNSPECIFIED', message: 'x' } as unknown as UncertaintyItem)
    expect(frame.title).toMatch(/Restate it as a level or a change, then run the analysis again/)
  })
})
