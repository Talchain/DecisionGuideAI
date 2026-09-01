/**
 * "What we checked" — the trust readout imported from the old Analysis tab.
 *
 * ⭐⭐ WHAT THIS FILE IS ACTUALLY GUARDING, and it is ONE property above all
 * others: THAT "WE LOOKED AND FOUND NOTHING" AND "WE DID NOT LOOK" ARE
 * DIFFERENT STATES ON SCREEN.
 *
 * Collapsing those two is the exact defect the third state exists to prevent,
 * and it is a defect the SOURCE surface partially ships: the old tab renders
 * the same muted glyph for `evidence_none_flagged` and `evidence_not_assessed`,
 * so the distinction survives only in the label text. The mutant pair at the
 * foot of this file pins the discrimination in BOTH directions.
 *
 * ⚠ ASSERTIONS BIND BY IDENTITY (`data-testid` + the check's `id` / `code`),
 * never by "the chip whose text contains 'not assessed'" — three checks can
 * carry that phrase at once, so a text predicate could pass on the wrong
 * object (CLAUDE.md trap 19).
 */

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { ChecksCode, ChecksItem } from '../analysisNewTypes'
import { WhatWeChecked } from '../sections/WhatWeChecked'
import { makeData, makeOption } from './analysisNewFixtures'
import type { DecisionVerdict } from '../../../../lib/decisionVerdict'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

// ── helpers ─────────────────────────────────────────────────────────────────

function vmChecks(data: ResultsSectionDataReturn, isPreRun = false) {
  return buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun,
    isRunning: false,
    isStale: false,
  }).checks
}

/** The code emitted for one check id. Identity lookup, never positional. */
function codeFor(data: ResultsSectionDataReturn, id: ChecksItem['id']): ChecksCode | undefined {
  return vmChecks(data).items.find((i) => i.id === id)?.code
}

function verdict(over: Partial<DecisionVerdict>): DecisionVerdict {
  return {
    leaderId: 'opt_a',
    separation: 'clear',
    hasLeadingOption: true,
    gapPp: 20,
    source: 'producer_near_tie',
    ...over,
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. THE ADAPTER — every reachable code, from the producer's own field values
// ═════════════════════════════════════════════════════════════════════════════

describe('leader check — the denial is licensed by `tied` alone', () => {
  it('hasLeadingOption true → leader_present', () => {
    expect(codeFor(makeData({ recommendation: { verdict: verdict({}) } }), 'leader')).toBe(
      'leader_present',
    )
  })

  it("separation 'tied' → leader_tied (the ONE licensed denial)", () => {
    const data = makeData({
      recommendation: { verdict: verdict({ separation: 'tied', hasLeadingOption: false }) },
    })
    expect(codeFor(data, 'leader')).toBe('leader_tied')
  })

  /**
   * ⭐ `decisionVerdict.ts:166-168` — "`'unknown'` licenses silence, never a
   * denial". An unknown separation must NOT render "No clear leader".
   */
  it("separation 'unknown' → leader_not_assessed, NOT the denial", () => {
    const data = makeData({
      recommendation: { verdict: verdict({ separation: 'unknown', hasLeadingOption: false }) },
    })
    expect(codeFor(data, 'leader')).toBe('leader_not_assessed')
  })

  /**
   * ⭐⭐ THE FALLBACK THE SOURCE HAS AND THIS DOES NOT.
   * `TriageActionCardsBody.tsx:573-575` reads `!!recommendedOption` when the
   * verdict is absent — a UI-derived leader claim, i.e. the "Authority 3" that
   * `decisionVerdict.ts` deleted (ROADMAP 1.223). CEE withholds the CLAIM while
   * the per-option numbers keep riding the wire, so that fallback ticks
   * "Has leading option" on precisely the runs where the product is withholding
   * one. This fixture is that run: a recommended option, no verdict.
   */
  it('no verdict but a recommendedOption present → leader_not_assessed (no re-derived claim)', () => {
    const data = makeData({
      recommendation: {
        verdict: undefined,
        recommendedOption: makeOption({ id: 'opt_a', label: 'Rebuild in-house' }),
      },
    })
    expect(codeFor(data, 'leader')).toBe('leader_not_assessed')
  })
})

describe('robustness check — an explicit allowlist, and the two silences are split', () => {
  it("'robust' → robustness_robust", () => {
    expect(codeFor(makeData({ recommendation: { robustnessVerdict: 'robust' } }), 'robustness')).toBe(
      'robustness_robust',
    )
  })

  it.each(['moderate', 'fragile'] as const)("'%s' → robustness_sensitive", (v) => {
    expect(codeFor(makeData({ recommendation: { robustnessVerdict: v } }), 'robustness')).toBe(
      'robustness_sensitive',
    )
  })

  it("explicit 'not_assessed' → robustness_not_assessed (the producer SAID it did not assess)", () => {
    expect(
      codeFor(makeData({ recommendation: { robustnessVerdict: 'not_assessed' } }), 'robustness'),
    ).toBe('robustness_not_assessed')
  })

  it('field absent → robustness_unknown (an older build said NOTHING — a different statement)', () => {
    expect(codeFor(makeData({ recommendation: { robustnessVerdict: undefined } }), 'robustness')).toBe(
      'robustness_unknown',
    )
  })

  /**
   * ⚠ THE ALLOWLIST, PROVEN RATHER THAN ASSERTED. A `!== 'not_assessed'`
   * implementation would render an unrecognised producer token as
   * "Sensitive to assumptions" — a fabricated finding from a string nobody
   * recognises. The cast is deliberate: this is the shape of a producer that
   * ships a new verdict word before the UI knows it.
   */
  it('an UNRECOGNISED producer token → robustness_unknown, never a fabricated finding', () => {
    const data = makeData({
      recommendation: { robustnessVerdict: 'inconclusive' as unknown as undefined },
    })
    expect(codeFor(data, 'robustness')).toBe('robustness_unknown')
  })
})

describe('evidence check — the empty list is TWO states', () => {
  it('gaps present, all addressed → evidence_all_addressed', () => {
    const data = makeData({
      confidence: {
        evidenceGaps: [{ factorId: 'f1', factorLabel: 'Supplier lead time', confidence: 90 }],
        evidenceGapsAssessed: true,
      } as never,
    })
    expect(codeFor(data, 'evidence')).toBe('evidence_all_addressed')
  })

  it('gaps present, one outstanding → evidence_gaps', () => {
    const data = makeData({
      confidence: {
        evidenceGaps: [
          { factorId: 'f1', factorLabel: 'Supplier lead time', confidence: 90 },
          { factorId: 'f2', factorLabel: 'Churn', confidence: 10 },
        ],
        evidenceGapsAssessed: true,
      } as never,
    })
    expect(codeFor(data, 'evidence')).toBe('evidence_gaps')
  })

  /**
   * ⭐⭐ THE PAIR THIS WHOLE SECTION EXISTS FOR. Identical `evidenceGaps: []`,
   * differing ONLY in `evidenceGapsAssessed` — and they must not be the same
   * state. If these two ever agree, the readout has stopped distinguishing
   * "we looked and found nothing" from "we did not look".
   */
  it('empty list + assessed → evidence_none_flagged (a real, licensed all-clear)', () => {
    const data = makeData({
      confidence: { evidenceGaps: [], evidenceGapsAssessed: true } as never,
    })
    expect(codeFor(data, 'evidence')).toBe('evidence_none_flagged')
  })

  it('empty list + NOT assessed → evidence_not_assessed (an empty list is not an all-clear)', () => {
    const data = makeData({
      confidence: { evidenceGaps: [], evidenceGapsAssessed: false } as never,
    })
    expect(codeFor(data, 'evidence')).toBe('evidence_not_assessed')
  })

  it('the two empty-list states are DIFFERENT codes AND different glyph states', () => {
    const assessed = vmChecks(
      makeData({ confidence: { evidenceGaps: [], evidenceGapsAssessed: true } as never }),
    ).items.find((i) => i.id === 'evidence')!
    const notAssessed = vmChecks(
      makeData({ confidence: { evidenceGaps: [], evidenceGapsAssessed: false } as never }),
    ).items.find((i) => i.id === 'evidence')!

    expect(assessed.code).not.toBe(notAssessed.code)
    expect(assessed.state).toBe('pass')
    expect(notAssessed.state).toBe('not_assessed')
  })

  /**
   * ⚠ THE FIELD FOLLOWS THIS TAB'S OWN SECTION, NOT THE SOURCE'S. The old tab
   * reads `topEvidenceGaps ?? evidenceGaps` because ITS section renders that
   * list; `buildUncertainty` renders `conf.evidenceGaps`. A verbatim copy of
   * the source expression would let the tick and the section beneath it report
   * two different populations — the defect the old tab fixed on its own
   * surface. This fixture puts the two fields in DISAGREEMENT so the choice is
   * observable rather than incidental.
   */
  it('reads the same gap list the Uncertainty section renders, not `topEvidenceGaps`', () => {
    const data = makeData({
      confidence: {
        evidenceGaps: [],
        topEvidenceGaps: [{ factorId: 'f9', factorLabel: 'Decoy', confidence: 10 }],
        evidenceGapsAssessed: false,
      } as never,
    })
    // Reading `topEvidenceGaps` would yield `evidence_gaps` here.
    expect(codeFor(data, 'evidence')).toBe('evidence_not_assessed')
  })
})

/**
 * ⭐⭐ THE CODE→STATE MAP, EXHAUSTIVELY — AND THIS BLOCK EXISTS BECAUSE A
 * MUTANT SURVIVED.
 *
 * The first mutant run flipped `CHECK_STATE.leader_present` from `'pass'` to
 * `'not_assessed'` and ALL 42 TESTS STAYED GREEN. The suite asserted every
 * check's CODE and never its GLYPH STATE, so a run with an entitled leading
 * option would have rendered the muted "not assessed" glyph — the readout
 * saying it had not checked something it had checked — with no red anywhere.
 *
 * ⚠ NOT AN EQUIVALENT MUTANT. It changes what a user sees on the most common
 * healthy run. A survivor is a claim either way and the only settlement is a
 * discriminating fixture (CLAUDE.md trap 13c), so the fixture is here rather
 * than an argument that it did not matter.
 *
 * The map is now pinned for EVERY code, in both directions: a code moved to the
 * wrong state REDs, and so does a state quietly widened to cover more codes.
 */
describe('every code maps to the right glyph state (the survivor that closed this hole)', () => {
  const CASES: ReadonlyArray<readonly [ChecksCode, 'pass' | 'finding' | 'not_assessed', ResultsSectionDataReturn]> = [
    ['leader_present', 'pass', makeData({ recommendation: { verdict: verdict({}) } })],
    [
      'leader_tied',
      'finding',
      makeData({ recommendation: { verdict: verdict({ separation: 'tied', hasLeadingOption: false }) } }),
    ],
    [
      'leader_not_assessed',
      'not_assessed',
      makeData({ recommendation: { verdict: verdict({ separation: 'unknown', hasLeadingOption: false }) } }),
    ],
    ['robustness_robust', 'pass', makeData({ recommendation: { robustnessVerdict: 'robust' } })],
    ['robustness_sensitive', 'finding', makeData({ recommendation: { robustnessVerdict: 'fragile' } })],
    [
      'robustness_not_assessed',
      'not_assessed',
      makeData({ recommendation: { robustnessVerdict: 'not_assessed' } }),
    ],
    ['robustness_unknown', 'not_assessed', makeData({ recommendation: { robustnessVerdict: undefined } })],
    [
      'evidence_all_addressed',
      'pass',
      makeData({
        confidence: {
          evidenceGaps: [{ factorId: 'f1', factorLabel: 'Supplier lead time', confidence: 90 }],
          evidenceGapsAssessed: true,
        } as never,
      }),
    ],
    [
      'evidence_gaps',
      'finding',
      makeData({
        confidence: {
          evidenceGaps: [{ factorId: 'f2', factorLabel: 'Churn', confidence: 10 }],
          evidenceGapsAssessed: true,
        } as never,
      }),
    ],
    [
      'evidence_none_flagged',
      'pass',
      makeData({ confidence: { evidenceGaps: [], evidenceGapsAssessed: true } as never }),
    ],
    [
      'evidence_not_assessed',
      'not_assessed',
      makeData({ confidence: { evidenceGaps: [], evidenceGapsAssessed: false } as never }),
    ],
  ]

  it.each(CASES)('%s → %s', (code, state, data) => {
    const item = vmChecks(data).items.find((i) => i.code === code)
    expect(item, `no check emitted code ${code}`).toBeDefined()
    expect(item!.state).toBe(state)
  })

  /**
   * ⚠ THE FIXTURE TABLE PINS ITS OWN PRECONDITION. If a future change made two
   * of these fixtures produce the SAME code, the rows above would still pass
   * while silently testing one state twice. Every code must appear exactly
   * once, so the table is provably exhaustive over the union rather than
   * exhaustive-looking.
   */
  it('the table covers all 11 codes exactly once', () => {
    const codes = CASES.map(([c]) => c)
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes.length).toBe(11)
  })
})

describe('the section always carries all three checks, and none pre-run', () => {
  it('post-run: exactly the three checks, in the old tab’s order', () => {
    const items = vmChecks(makeData()).items
    expect(items.map((i) => i.id)).toEqual(['leader', 'robustness', 'evidence'])
  })

  /**
   * ⚠ PRE-RUN IS EMPTY, and this is gated harder than the sibling sections
   * rather than more softly: three "not assessed" rows about an analysis that
   * never started read as a run that came back empty.
   */
  it('pre-run: no items at all', () => {
    expect(vmChecks(makeData(), true).items).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. THE COPY DECK — total over the union, and the §7.5 explanation rule
// ═════════════════════════════════════════════════════════════════════════════

describe('the copy deck is total, and explains exactly the states that need it', () => {
  const ALL_CODES: readonly ChecksCode[] = [
    'leader_present',
    'leader_tied',
    'leader_not_assessed',
    'robustness_robust',
    'robustness_sensitive',
    'robustness_not_assessed',
    'robustness_unknown',
    'evidence_all_addressed',
    'evidence_gaps',
    'evidence_none_flagged',
    'evidence_not_assessed',
  ]

  it('every code has a non-empty label', () => {
    for (const code of ALL_CODES) {
      expect(COPY.checks[code]?.label, code).toBeTruthy()
    }
  })

  /**
   * ⭐ THE §7.5 RULE, PINNED IN BOTH DIRECTIONS. The consolidation map's
   * critique of the old readout is "no action, no explanation — what does a
   * user do with 'Evidence not assessed'?". The answer is a visible sentence on
   * exactly the unassessed states — and NOT on the others, because copy
   * identical on every row is furniture rather than information.
   */
  const NEEDS_MEANING: readonly ChecksCode[] = [
    'leader_not_assessed',
    'robustness_not_assessed',
    'robustness_unknown',
    'evidence_not_assessed',
  ]

  it.each(NEEDS_MEANING)('%s carries a visible explanation', (code) => {
    const entry = COPY.checks[code] as { meaning?: string }
    expect(entry.meaning, `${code} must explain itself`).toBeTruthy()
  })

  it.each(ALL_CODES.filter((c) => !NEEDS_MEANING.includes(c)))(
    '%s carries NO explanation (density: a sentence only where one is owed)',
    (code) => {
      expect('meaning' in COPY.checks[code]).toBe(false)
    },
  )

  /**
   * ⭐⭐ THE ONE THING EVERY EXPLANATION MUST DO: block the reading of SILENCE
   * AS REASSURANCE. Each sentence names the absence and denies the comfort.
   */
  it.each(NEEDS_MEANING)('%s does not read as reassurance', (code) => {
    const meaning = (COPY.checks[code] as { meaning: string }).meaning.toLowerCase()
    // It must say what did not happen…
    expect(meaning).toMatch(/\b(no|not|did not)\b/)
    // …and must never offer the comfort the absence cannot support.
    expect(meaning).not.toMatch(/\b(looks (good|solid|fine)|is (stable|robust|fine)|no concerns)\b/)
  })

  /**
   * ⛔ NO ROBUSTNESS REASON IN THIS DECK. The producer's
   * `robustnessVerdictReason` belongs to "At a glance"; repeating it here would
   * put one producer sentence on the surface twice, which is what
   * `firstViewportCensus.spec.tsx` exists to forbid.
   */
  it('the two robustness silences say DIFFERENT things (they are different statements)', () => {
    const a = (COPY.checks.robustness_not_assessed as { meaning: string }).meaning
    const b = (COPY.checks.robustness_unknown as { meaning: string }).meaning
    expect(a).not.toBe(b)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. THE COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

describe('WhatWeChecked renders the readout', () => {
  const TID = 'analysis-new-checks'

  function renderFor(data: ResultsSectionDataReturn) {
    return render(<WhatWeChecked checks={vmChecks(data)} />)
  }

  it('renders the heading and all three chips, bound by check id', () => {
    renderFor(makeData({ recommendation: { verdict: verdict({}), robustnessVerdict: 'robust' } }))
    expect(screen.getByTestId(`${TID}-heading`)).toHaveTextContent('What we checked')
    expect(screen.getByTestId(`${TID}-leader`)).toBeInTheDocument()
    expect(screen.getByTestId(`${TID}-robustness`)).toBeInTheDocument()
    expect(screen.getByTestId(`${TID}-evidence`)).toBeInTheDocument()
  })

  it('renders nothing at all when there are no checks (pre-run)', () => {
    const { container } = render(<WhatWeChecked checks={{ items: [] }} />)
    expect(container).toBeEmptyDOMElement()
  })

  /**
   * ⭐⭐ THE DISCRIMINATION, AT THE DOM. Two runs identical but for
   * `evidenceGapsAssessed`. The chip must differ in BOTH its state attribute
   * and its label — the source surface differs only in the label, and that is
   * the half this import improves.
   */
  it('assessed-and-clean and never-assessed render as DIFFERENT chips', () => {
    const { unmount } = renderFor(
      makeData({ confidence: { evidenceGaps: [], evidenceGapsAssessed: true } as never }),
    )
    const clean = screen.getByTestId(`${TID}-evidence`)
    const cleanState = clean.getAttribute('data-check-state')
    const cleanText = clean.textContent
    unmount()

    renderFor(makeData({ confidence: { evidenceGaps: [], evidenceGapsAssessed: false } as never }))
    const unknown = screen.getByTestId(`${TID}-evidence`)

    expect(cleanState).toBe('pass')
    expect(unknown.getAttribute('data-check-state')).toBe('not_assessed')
    expect(unknown.textContent).not.toBe(cleanText)
  })

  it('an unassessed check renders its explanation as VISIBLE text, not a hover tooltip', () => {
    renderFor(makeData({ confidence: { evidenceGaps: [], evidenceGapsAssessed: false } as never }))
    const meaning = screen.getByTestId(`${TID}-meaning-evidence`)
    expect(meaning).toBeInTheDocument()
    expect(meaning).toHaveTextContent('not an all-clear')
    // ⚠ The old tab put this in a `title` attribute, where a touch user and a
    // scanning reader never meet it. Pinned so a "tidy-up" cannot put it back.
    expect(meaning.getAttribute('title')).toBeNull()
  })

  it('an ASSESSED check renders no explanation line (density)', () => {
    renderFor(
      makeData({
        recommendation: { verdict: verdict({}), robustnessVerdict: 'robust' },
        confidence: { evidenceGaps: [], evidenceGapsAssessed: true } as never,
      }),
    )
    expect(screen.queryByTestId(`${TID}-meaning-leader`)).toBeNull()
    expect(screen.queryByTestId(`${TID}-meaning-robustness`)).toBeNull()
    expect(screen.queryByTestId(`${TID}-meaning-evidence`)).toBeNull()
    expect(screen.queryByTestId(`${TID}-meanings`)).toBeNull()
  })

  /**
   * ⚠ AN UNKNOWN IS NOT A FAILURE. The glyph colour IS the claim for a reader
   * scanning the row, so the danger colour must never appear on a check that
   * simply was not made.
   */
  it('a not-assessed chip never carries the danger styling', () => {
    renderFor(
      makeData({
        recommendation: { verdict: verdict({ separation: 'unknown', hasLeadingOption: false }) },
      }),
    )
    const chip = screen.getByTestId(`${TID}-leader`)
    expect(chip.getAttribute('data-check-state')).toBe('not_assessed')
    expect(chip.querySelector('.text-danger')).toBeNull()
    expect(chip.querySelector('.text-text-light')).not.toBeNull()
  })

  it('a genuine finding DOES carry the danger styling (the contrast control)', () => {
    renderFor(
      makeData({
        recommendation: { verdict: verdict({ separation: 'tied', hasLeadingOption: false }) },
      }),
    )
    const chip = screen.getByTestId(`${TID}-leader`)
    expect(chip.getAttribute('data-check-state')).toBe('finding')
    expect(chip.querySelector('.text-danger')).not.toBeNull()
  })
})
