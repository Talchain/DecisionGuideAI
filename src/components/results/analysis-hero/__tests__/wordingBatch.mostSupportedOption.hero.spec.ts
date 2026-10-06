/**
 * ⭐ CUT 6 — the hero's run-share captions (WORDING BATCH; Science d5 #87 6007954023 + 6007969474). A share of runs is
 * never a chance (CLAUDE.md, 6 Oct). Split from `components/results/__tests__/wordingBatch.mostSupportedOption.spec.tsx`
 * because only the analysis hero's own tests may import it (`inertness.spec.ts`).
 */
import { describe, it, expect } from 'vitest'

import { HERO_COPY } from '../heroCopy'

const CONTEST = /\b(lead|leads|leading|led|leader|ahead|winner|wins?|best|beats?|overtake)\b/i

describe('hero evidence: a run share is a share of runs, never a chance (Science d5)', () => {
  it('flip-risk caption, permitted and target-only withheld — exact', () => {
    expect(HERO_COPY.evidence.flipRisksNote(false)).toBe(
      'Share of runs in which varying a relationship within its plausible range changes the most-supported option, in this model.')
    expect(HERO_COPY.evidence.flipRisksNote(true)).toBe(
      'Share of runs in which varying a relationship within its plausible range changes how the options compare, in this model.')
  })

  it('attribution-suppressed note — exact opening, rest unchanged', () => {
    expect(HERO_COPY.evidence.attributionSuppressed.startsWith(
      "How much each factor moves the share of runs supporting each option wasn't produced for this run — ")).toBe(true)
    expect(HERO_COPY.evidence.attributionSuppressed.endsWith('The ranking above is unaffected.')).toBe(true)
  })

  it('SCAN: none of the three says "chance" or names a contest', () => {
    for (const line of [
      HERO_COPY.evidence.flipRisksNote(false),
      HERO_COPY.evidence.flipRisksNote(true),
      HERO_COPY.evidence.attributionSuppressed,
    ]) {
      expect(line, line).not.toMatch(/\bchance\b/i)
      expect(line, line).not.toMatch(CONTEST)
    }
  })

  it('POSITIVE CONTROL: the captions served before are caught', () => {
    expect('Chance the leading option changes when a relationship is varied within its plausible range.').toMatch(/\bchance\b/i)
    expect('Chance the comparison between options changes when a relationship is varied within its plausible range.').toMatch(/\bchance\b/i)
    expect("How much each factor moves an option's chance of coming out ahead wasn't produced for").toMatch(/\bchance\b/i)
  })
})

