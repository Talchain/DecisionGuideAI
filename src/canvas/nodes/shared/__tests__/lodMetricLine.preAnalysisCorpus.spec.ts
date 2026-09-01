/**
 * THE FOUNDER'S DEFECT, WRITTEN DOWN: zoom out to see the whole model and the
 * cards go blank.
 *
 * ⭐ THE MEASUREMENT THIS PINS, taken in a real browser as a guest on deployed
 * `f3b1ca87` (1 Sep 2026), on the "Headcount Allocation Decision" saved example
 * with NO analysis run:
 *
 *     zoom 0.60  →  16 cards,  0 blank bodies
 *     zoom 0.49  →  16 cards, **14 blank bodies**
 *     zoom 0.30  →  16 cards, **14 blank bodies**
 *
 * Two fixes had already shipped for this complaint. Both were correct and both
 * missed, for one reason: every rule in `resolveLodMetricLine` except a
 * factor's stated value asked for an ANALYSIS-DERIVED metric, and `goal` and
 * `decision` asked for nothing at all. **Zooming out to grasp a whole model is
 * something people do BEFORE they analyse**, so the feature was weakest exactly
 * where the gesture is most used.
 *
 * ⚠ WHY THIS CORPUS AND NOT A HANDWRITTEN ONE. A fixture the author writes
 * encodes the author's model of the producer rather than the producer
 * (CLAUDE.md trap 16). This suite therefore drives **the shipped starter
 * payload through the real draft adapter** — `applyDraftResult`, the same
 * function `applyStarter` calls — and asserts over whatever nodes come out.
 * The corpus is the product's own content; it is the exact model measured in
 * the browser above; and it grows or changes only when the product does.
 *
 * ⚠ AND THE LIMIT, STATED RATHER THAN IMPLIED (trap 20). **This suite cannot
 * see the defect the founder reported.** jsdom cannot prove visibility (trap 3)
 * and this is not even a render test — it pins the RULE: that every card in a
 * real pre-analysis model resolves a line to show. Whether that line reaches a
 * pixel at 0.30 zoom is settled only by the browser ladder, and the browser is
 * where the acceptance was taken.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import headcountStarter from '../../../starters/data/headcount-allocation.draft.json'
import { applyDraftResult } from '../../../utils/applyDraftResult'
import { useCanvasStore } from '../../../store'
import { resolveLodMetricLine } from '../lodMetricLine'
import { resolveLodMetricFacts } from '../lodMetricFacts'
import type { NodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'

/**
 * A pre-analysis model's display metadata: nothing has been computed.
 *
 * ⚠ THIS IS AN ASSERTED PRECONDITION, NOT AN ASSUMPTION. It is what makes the
 * suite a test OF the pre-analysis state rather than a test that happens to
 * pass — and it matches the browser reading, where no factor card showed an
 * influence row and no option card showed a win share.
 */
const PRE_ANALYSIS_METADATA = {
  sensitivityRank: null,
  influence: null,
  influenceProvenance: null,
  confidence: null,
  achievementProbability: null,
  achievementProbabilityIsModelledBasis: null,
  achievementProbabilityBasis: null,
  jointGoalProbability: null,
  stabilityPercentage: null,
  winRate: null,
  predictedOutcome: null,
  valueOfInformation: null,
  voiRank: null,
  isResultsMode: false,
} as unknown as NodeDisplayMetadata

interface Card {
  id: string
  type: string
  label: string
  line: string | null
}

let cards: Card[] = []

beforeAll(() => {
  const applied = applyDraftResult(headcountStarter as never, { skipAutosave: true })
  expect(applied.nodeCount).toBeGreaterThan(0)

  const { nodes, ceeAnalysisReady } = useCanvasStore.getState()

  cards = nodes.map((n) => {
    const data = n.data as Record<string, unknown> | undefined
    const nodeType = (n.type ?? (data?.type as string) ?? '') as string
    const facts = resolveLodMetricFacts({
      nodeType,
      nodeId: n.id,
      data,
      ceeOptions: ceeAnalysisReady?.options,
    })
    return {
      id: n.id,
      type: nodeType,
      label: String(data?.label ?? ''),
      line: resolveLodMetricLine({
        nodeType,
        data,
        label: String(data?.label ?? ''),
        displayMetadata: PRE_ANALYSIS_METADATA,
        facts,
      }),
    }
  })
})

describe('the corpus is the model that was measured', () => {
  it('collects the shipped Headcount starter — 16 cards, the count driven in the browser', () => {
    expect(cards).toHaveLength(16)
  })

  it('covers every card type the defect touched', () => {
    const byType = cards.reduce<Record<string, number>>((a, c) => {
      a[c.type] = (a[c.type] ?? 0) + 1
      return a
    }, {})
    // Bound by IDENTITY, not by "at least one of each": if the starter's shape
    // changes, this REDs and the measurement above has to be retaken rather
    // than silently inherited.
    expect(byType).toEqual({ decision: 1, factor: 5, goal: 1, option: 4, outcome: 2, risk: 3 })
  })
})

/**
 * ⚠⚠ THE SCOPE OF THIS ACCEPTANCE NARROWED ON 1 SEP 2026, AND SAYING SO
 * PRECISELY IS THE POINT (CLAUDE.md trap 20 — a capture proves what it was
 * pointed at).
 *
 * It used to assert that all 16 cards resolve a line HERE. That claim is no
 * longer true OF THIS MODULE and it would be dishonest to keep: risk, outcome,
 * goal and decision now declare their lines through `BaseNode`'s `lodMetric`
 * prop (#1074, #1085), which this function never sees. Asserting 16 would mean
 * re-adding four arms the mount can never reach purely to keep a number green.
 *
 * ⛔ SO THE CLAIM IS SPLIT, NOT WEAKENED:
 *   · here — every FACTOR and OPTION card in the real starter resolves a line
 *     (the two types this module owns end-to-end, and 9 of the 16 cards);
 *   · `lodMetric.riskOutcome.spec.tsx` and `lodMetric.decisionGoal.spec.tsx` —
 *     the other four types, pinned where they actually render;
 *   · the whole-model claim ("no blank cards at 0.30 zoom") is the BROWSER
 *     ladder's, and always was. jsdom cannot prove visibility (trap 3).
 */
const OWNED_HERE = ['factor', 'option']

describe('THE ACCEPTANCE: no factor or option card is left with nothing to say', () => {
  it('every factor and option card in the real starter resolves a reduced line', () => {
    const mine = cards.filter((c) => OWNED_HERE.includes(c.type))
    // ⛔ POSITIVE CONTROL FIRST (trap 13). An "none are silent" assertion over
    // an EMPTY list passes while proving nothing — and this list is built by a
    // filter over a store the draft adapter populated, so it can legitimately
    // come back empty if anything upstream changes.
    expect(mine).toHaveLength(9)
    const silent = mine.filter((c) => c.line === null)
    expect(silent.map((c) => `${c.type}:${c.label}`)).toEqual([])
  })

  it('names what each card says, so a change to any line is a decision and not a drift', () => {
    const spoken = Object.fromEntries(cards.map((c) => [c.label, c.line]))
    // ⭐ THE FACTOR CARDS THE FOUNDER NAMED, each now saying the number its own
    // card was already showing one zoom step up.
    expect(spoken['Engineering Attrition Rate']).toBe('Range: 0.3 to 0.9')
    expect(spoken['Market Demand for Product']).toBe('Range: 0.3 to 0.8')
    expect(spoken['Current Sales Quota Attainment']).toBe('Range: 0.25 to 0.75')
  })

  it('⛔ AND THE FOUR OWNER-DECLARED TYPES RESOLVE TO NOTHING HERE — the split is real in the real model, not only in fixtures', () => {
    // This is the corpus form of the ownership map. If an arm for one of these
    // types is ever re-added to `lodMetricLine.ts`, this REDs — which is the
    // only thing that can notice a deletion coming back, since a dark arm's own
    // unit test would pass perfectly.
    const ownedElsewhere = cards.filter((c) => !OWNED_HERE.includes(c.type))
    expect(ownedElsewhere).toHaveLength(7)
    expect(ownedElsewhere.filter((c) => c.line !== null).map((c) => `${c.type}:${c.label} → ${c.line}`)).toEqual([])
  })

  it('states a QUANTITY on every line — a bare number beside a goal reads as a computed contribution (UI-SEM-089)', () => {
    // ⚠ THE FIRST VERSION OF THIS TEST ASSERTED THE WRONG PROPERTY — it banned
    // a leading digit, which flagged "Changes 2 factors". That is a labelled
    // quantity and is exactly what the rule ASKS for. The rule is that no line
    // may be a BARE figure, so the property is that every line carries a word.
    const naked = cards.filter((c) => c.line !== null && !/[A-Za-z]{2,}/.test(c.line))
    expect(naked.map((c) => `${c.label} → ${c.line}`)).toEqual([])
  })

  it('stays SHORT — the line renders at a capped counter-scale and must not need truncating', () => {
    // The reduced line sits in a card whose text measure is ~220px at the
    // capped scale. This bounds the CORPUS, not the format: it REDs if a
    // future line is composed from something unbounded, e.g. a factor name.
    const tooLong = cards.filter((c) => (c.line?.length ?? 0) > 24)
    expect(tooLong.map((c) => `${c.label} → ${c.line} (${c.line?.length})`)).toEqual([])
  })
})

describe('CONTRAST CONTROL — the lines are the cards’ own data, not a default string', () => {
  it('the three range-bearing factors state THREE DIFFERENT ranges', () => {
    const ranges = cards.filter((c) => c.line?.startsWith('Range:')).map((c) => c.line)
    // A blind resolver returning one constant would satisfy "no card is
    // silent" perfectly. Distinct values are what prove it is reading data.
    expect(new Set(ranges).size).toBe(ranges.length)
    expect(ranges.length).toBeGreaterThanOrEqual(3)
  })

  it('CONTRAST CONTROL — the option lines differ from the factor lines, so one default is not answering for both', () => {
    // A resolver that had collapsed to a single constant would satisfy "no card
    // is silent" perfectly. Two distinct shapes of answer, from two distinct
    // arms, is what shows it is reading each card's own data.
    const optionLines = cards.filter((c) => c.type === 'option').map((c) => c.line)
    const factorLines = cards.filter((c) => c.type === 'factor').map((c) => c.line)
    expect(optionLines.every((l) => l !== null)).toBe(true)
    expect(optionLines.some((l) => !factorLines.includes(l))).toBe(true)
  })
})
