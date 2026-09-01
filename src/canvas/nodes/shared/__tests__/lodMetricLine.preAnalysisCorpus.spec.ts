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
import { findGoalNodeId } from '../bridgeStrengthToGoal'
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

  const { nodes, edges, ceeAnalysisReady } = useCanvasStore.getState()
  const goalNodeId = findGoalNodeId(nodes)

  cards = nodes.map((n) => {
    const data = n.data as Record<string, unknown> | undefined
    const nodeType = (n.type ?? (data?.type as string) ?? '') as string
    const facts = resolveLodMetricFacts({
      nodeType,
      nodeId: n.id,
      data,
      goalNodeId,
      edges,
      ceeOptions: ceeAnalysisReady?.options,
      decisionOptionCount:
        nodeType === 'decision'
          ? edges.filter((e) => {
              if (e.source !== n.id) return false
              const t = nodes.find((m) => m.id === e.target)
              return t?.type === 'option' || t?.data?.type === 'option'
            }).length
          : null,
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

describe('THE ACCEPTANCE: no card in a pre-analysis model is left with nothing to say', () => {
  it('every one of the 16 cards resolves a reduced line', () => {
    const silent = cards.filter((c) => c.line === null)
    expect(silent.map((c) => `${c.type}:${c.label}`)).toEqual([])
  })

  it('names what each card says, so a change to any line is a decision and not a drift', () => {
    const spoken = Object.fromEntries(cards.map((c) => [c.label, c.line]))
    // ⭐ THE FIVE CARDS THE FOUNDER NAMED, each now saying the number its own
    // card was already showing one zoom step up.
    expect(spoken['Engineering Attrition Rate']).toBe('Range: 0.3 to 0.9')
    expect(spoken['Market Demand for Product']).toBe('Range: 0.3 to 0.8')
    expect(spoken['Current Sales Quota Attainment']).toBe('Range: 0.25 to 0.75')
    expect(spoken['Achieve ARR Growth by Q3']).toBe('No target set')
    // The outcome reads its strength to the goal — the figure its card renders
    // as "65% strength · est.".
    expect(spoken['New ARR Generated']).toBe('Strength 65% · est.')
  })

  it('states a QUANTITY on every line — a bare number beside a goal reads as a computed contribution (UI-SEM-089)', () => {
    // ⚠ THE FIRST VERSION OF THIS TEST ASSERTED THE WRONG PROPERTY — it banned
    // a leading digit, which flagged "4 options" and "Changes 2 factors". Those
    // are labelled quantities and are exactly what the rule ASKS for. The rule
    // is that no line may be a BARE figure, so the property is that every line
    // carries a word.
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

  it('the three risks state THREE DIFFERENT strengths', () => {
    const strengths = cards.filter((c) => c.type === 'risk').map((c) => c.line)
    expect(strengths.every((s) => s !== null)).toBe(true)
    expect(new Set(strengths).size).toBe(strengths.length)
  })

  it('the decision counts the options that are actually linked to it', () => {
    const decision = cards.find((c) => c.type === 'decision')
    const optionCount = cards.filter((c) => c.type === 'option').length
    expect(decision?.line).toBe(`${optionCount} options`)
  })
})
