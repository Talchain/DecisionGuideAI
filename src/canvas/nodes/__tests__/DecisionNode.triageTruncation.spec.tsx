/**
 * The "Top gap:" triage line's truncation rule — pinned, because this PR
 * CHANGED it and nothing could see the change in either direction.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `truncateAtWord` (`DecisionNode.tsx`) was rewritten in this PR so it never
 * cuts inside a word. Its ONLY callers in this PR are the triage line's
 * `Top gap: estimate …` and `Top gap: validate …` template literals (measure
 * 40) — a user-visible sentence that pre-dates the rewrite and had no test
 * that could see it move. (Cited by the strings they build, not by line
 * number: an earlier draft gave `:274`/`:313`, which this PR's own docblock
 * then pushed to `:304`/`:343`.) The two specs that already touch
 * this line (`DecisionNode.restingState.spec.tsx`, `.triageProvenance.spec.tsx`)
 * both use "Brand perception", 16 characters, which never reaches the measure.
 * So the behaviour moved under a green suite. Measured on the real change:
 *
 *   input   "Use a supercalifragilisticexpialidociousmetricvalue here"
 *   OLD(40) "Use a supercalifragilisticexpialidocious…"   ← cut MID-WORD
 *   NEW(40) "Use a…"                                      ← cut at the word
 *
 * The new rule is the better rule. It is also a material shortening of a live
 * sentence, and an undisclosed, unpinned user-visible change is the finding —
 * not the change.
 *
 * CLAIM TYPE: rendered TEXT, exact string. Not visibility, not layout
 * (platform trap 3 — jsdom does no layout, so nothing here is evidence about
 * pixels or about whether the line overflows its card).
 *
 * BINDING BY IDENTITY, NOT BY PREDICATE (trap 19). Every assertion names the
 * WHOLE triage sentence, so it cannot be satisfied by some other node's copy
 * that happens to contain the same fragment. Proven with a discriminating
 * mutant pair: reverting the truncator's rule REDs these tests; renaming an
 * unrelated factor leaves them GREEN.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode } from '../DecisionNode'
import { compactFactorLabel } from '../../utils/labelUtils'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  edges: [],
  nodes: [],
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  viewMode: 'expert',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="decision-node-popover">{children}</div>
  ),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  id: 'decision-1',
  type: 'decision',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  data: { label: 'Should we hire?', type: 'decision' },
}

/** The measure the two triage call sites pass. Not a magic number here. */
const TRIAGE_MEASURE = 40

/**
 * A graph that reaches triage rule 2 and prints "Top gap: validate <label>".
 *
 * ⚠ THE PRECONDITION IS PINNED IN-TEST, not assumed (trap 13b): every case
 * asserts its own label is LONGER than the measure before asserting what the
 * line says, so a test can never pass because the fixture quietly stopped
 * reaching the truncator. `otherLabel` exists only so the mutant pair has an
 * unrelated string to move.
 */
function graph(inferredLabel: string, otherLabel = 'Headcount') {
  const strength = { weightSource: 'cee' as const }
  return makeStoreState({
    nodes: [
      {
        id: 'fac-inferred',
        type: 'factor',
        data: {
          type: 'factor',
          label: inferredLabel,
          observedState: { value: 5, extractionType: 'inferred' },
        },
      },
      {
        id: 'fac-known',
        type: 'factor',
        data: {
          type: 'factor',
          label: otherLabel,
          observedState: { value: 12, extractionType: 'stated' },
        },
      },
      { id: 'out-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
      { id: 'out-2', type: 'outcome', data: { type: 'outcome', label: 'Margin' } },
      { id: 'opt-1', type: 'option', data: { type: 'option' } },
      { id: 'opt-2', type: 'option', data: { type: 'option' } },
      { id: 'opt-3', type: 'option', data: { type: 'option' } },
    ],
    edges: [
      { id: 'e1', source: 'fac-inferred', target: 'out-1', data: { weight: 0.3, direction: 'positive', ...strength } },
      { id: 'e2', source: 'fac-inferred', target: 'out-2', data: { weight: 0.3, direction: 'positive', ...strength } },
      { id: 'e3', source: 'fac-known', target: 'out-1', data: { weight: 0.3, direction: 'positive', ...strength } },
      { id: 'e4', source: 'decision-1', target: 'opt-1' },
      { id: 'e5', source: 'decision-1', target: 'opt-2' },
      { id: 'e6', source: 'decision-1', target: 'opt-3' },
    ],
    goalThreshold: { value: 100, direction: 'above' },
  })
}

const renderWith = (inferredLabel: string, otherLabel?: string) => {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector(graph(inferredLabel, otherLabel) as never),
  )
  return render(
    <ReactFlowProvider>
      <DecisionNode {...(baseProps as unknown as React.ComponentProps<typeof DecisionNode>)} />
    </ReactFlowProvider>,
  )
}

describe('DecisionNode triage line — truncation never cuts inside a word', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * THE DISCRIMINATING CASE. The second word runs past the measure, so the old
   * 0.6-heuristic rule kept a mid-word fragment of it and the new rule drops it
   * whole. Both halves are asserted: the sentence the user now sees, and the
   * absence of the fragment they used to see.
   */
  it('drops a word that runs past the measure rather than cutting it open', () => {
    const label = 'Use a supercalifragilisticexpialidociousmetricvalue here'
    expect(label.length).toBeGreaterThan(TRIAGE_MEASURE)

    renderWith(label)

    expect(screen.getByText('Top gap: validate Use a…')).toBeTruthy()
    // The mid-word fragment the OLD rule shipped. Asserted absent by its own
    // text, so this REDs if the old behaviour ever returns.
    expect(screen.queryByText(/supercalifragilisticexpialidocious…/)).toBeNull()
    expect(screen.queryByText(/supercalifragilisticexpialidocious[^m]/)).toBeNull()
  })

  /**
   * The ordinary long label — several words, a boundary at or before the
   * measure. The cut lands on that boundary, and the word after it is gone
   * entirely rather than clipped.
   */
  it('cuts at the last word boundary at or before the measure', () => {
    const label = 'Snowflake-Native Build Capacity In The Data Platform Team'
    expect(label.length).toBeGreaterThan(TRIAGE_MEASURE)

    renderWith(label)

    expect(screen.getByText('Top gap: validate Snowflake-Native Build Capacity In The…')).toBeTruthy()
    expect(screen.queryByText(/In The Dat/)).toBeNull()
  })

  /**
   * ⚠ THE DELIBERATE OVERRUN, AND IT IS THE ONE WITH A CONSEQUENCE. A single
   * unbroken token has no boundary to cut at, so the rule returns it WHOLE and
   * the string exceeds the measure. The triage line has NO clamp and NO
   * `break-words`, so this is the case where the new rule prints a LONGER line
   * than the old one did, with nothing in this file bounding it.
   *
   * ⚠ THE SIZE OF THAT TRADE IS NOT STATED IN PROSE HERE, BECAUSE AN EARLIER
   * DRAFT STATED IT WRONG: it said "60 characters here against the old rule's
   * 41", and 60 matches NEITHER frame — the label is 52 and the whole line 70.
   * It is now DERIVED IN-TEST below, in both frames, against the pre-PR rule
   * reproduced verbatim from `5b764fa6`. A number a test derives cannot drift;
   * a number a comment asserts already has. Clamping this line is rowed in the
   * PR body rather than silently absorbed.
   */
  it('returns a single unbroken token whole, exceeding the measure by design', () => {
    const token = 'Snowflakenativebuildcapacityinthedataplatformteamnow'
    expect(token.length).toBeGreaterThan(TRIAGE_MEASURE)
    expect(token).not.toContain(' ')

    renderWith(token)

    expect(screen.getByText(`Top gap: validate ${token}`)).toBeTruthy()
    // No ellipsis anywhere on this line: nothing was cut, so nothing may claim
    // to have been.
    expect(screen.queryByText(/Top gap: validate .*…/)).toBeNull()

    // ---- THE TRADE, MEASURED FROM THIS FIXTURE ----------------------------
    // `OLD_RULE` is the pre-PR `DecisionNode` helper reproduced verbatim from
    // `5b764fa6` (0.6 heuristic, single-character ellipsis) so the comparison
    // is against what actually shipped, not a remembered version of it. It is
    // deliberately a local copy: importing it is impossible (the helper is
    // private and this PR replaced it), and pinning the old OUTPUT is the only
    // way the size of the regression can be stated without drifting.
    const OLD_RULE = (text: string, maxLength: number): string => {
      if (text.length <= maxLength) return text
      const truncated = text.substring(0, maxLength)
      const lastSpace = truncated.lastIndexOf(' ')
      return (lastSpace > maxLength * 0.6 ? truncated.substring(0, lastSpace) : truncated).trimEnd() + '\u2026'
    }
    const PREFIX = 'Top gap: validate '
    const oldLabel = OLD_RULE(token, TRIAGE_MEASURE)

    // Label frame: whole token vs the old cap of measure + one ellipsis char.
    expect(token.length).toBe(52)
    expect(oldLabel.length).toBe(41)
    // Whole-line frame — what the user actually reads on the card.
    expect((PREFIX + token).length).toBe(70)
    expect((PREFIX + oldLabel).length).toBe(59)
    // The precondition that makes the two frames a COMPARISON and not two
    // unrelated numbers: the old rule really did cut this token, mid-word.
    expect(oldLabel).not.toBe(token)
    expect(token.startsWith(oldLabel.slice(0, -1))).toBe(true)
  })

  /**
   * The control that lets this file PASS as well as fail: a label under the
   * measure is returned untouched, with no ellipsis invented.
   */
  it('leaves a label shorter than the measure exactly as it is', () => {
    const label = 'Brand perception'
    expect(label.length).toBeLessThan(TRIAGE_MEASURE)

    renderWith(label)

    expect(screen.getByText('Top gap: validate Brand perception')).toBeTruthy()
  })
})

/**
 * ⭐ THE SAME-BEHAVIOUR TWIN THAT NO GREP FOR `truncateAtWord` CAN FIND.
 *
 * `canvas/utils/labelUtils.ts:123 truncateLabelAtWord` carries the rule this
 * PR replaces in `DecisionNode`, under a DIFFERENT NAME. Its source differs
 * from the merge-base `DecisionNode` helper only in that name and in how the
 * ellipsis is SPELLED: `'\u2026'` in the node file, the literal character in
 * `labelUtils`. They are the same character, so a reviewer reading either file
 * alone sees nothing.
 *
 * ⚠ THIS IS AN ASSERTION AND NOT A SENTENCE ON PURPOSE. The prose version of
 * this fact has been written wrong twice in this PR's own history, both times
 * as a repo-wide COUNT that no grep can measure. A count cannot be pinned; a
 * behavioural relationship between two named objects can, and this REDs the
 * day either side moves.
 *
 * It is reached through the exported `compactFactorLabel`, on its FALLBACK
 * path only — a lookup-table hit returns its replacement verbatim and never
 * reaches the truncator, so every fixture below pins that precondition rather
 * than assuming it.
 *
 * SCOPE, stated precisely: this asserts a relationship between
 * `compactFactorLabel`'s fallback path and `OLD_RULE`. It says NOTHING about
 * how many other truncation helpers exist, and it is not evidence about any
 * object it does not name.
 */
describe('the differently-named twin still carries the pre-PR rule', () => {
  /** The pre-PR `DecisionNode` helper, reproduced verbatim from `5b764fa6`. */
  const OLD_RULE = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text
    const truncated = text.substring(0, maxLength)
    const lastSpace = truncated.lastIndexOf(' ')
    return (lastSpace > maxLength * 0.6 ? truncated.substring(0, lastSpace) : truncated).trimEnd() + '…'
  }

  /** The rule this PR ships in `DecisionNode`, reproduced for the contrast. */
  const NEW_RULE = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text
    const lastSpace = text.lastIndexOf(' ', maxLength)
    if (lastSpace > 0) return text.substring(0, lastSpace).trimEnd() + '…'
    const firstSpace = text.indexOf(' ')
    if (firstSpace === -1) return text
    return text.substring(0, firstSpace).trimEnd() + '…'
  }

  const MEASURE = 20

  /**
   * Chosen so the two rules DISAGREE on every one of them — otherwise the
   * agreement asserted below would be satisfied by a twin carrying either
   * rule, and the test would discriminate nothing. That precondition is
   * asserted, not assumed.
   */
  const FALLBACK_LABELS = [
    'Snowflakenativebuildcapacity here',
    'Use a supercalifragilisticexpialidocious metric',
    'Averyveryverylongsingletokenindeedhere',
  ]

  it('every fixture reaches the truncator, and the two rules genuinely disagree on it', () => {
    expect(FALLBACK_LABELS.length).toBe(3)
    for (const label of FALLBACK_LABELS) {
      // Precondition 1: long enough to truncate at all.
      expect(label.length).toBeGreaterThan(MEASURE)
      // Precondition 2: the lookup table did NOT short-circuit it. A lookup hit
      // returns a canonical replacement verbatim; the fallback path returns a
      // PREFIX of the label plus an ellipsis. Asserting the prefix relation is
      // what proves the truncator ran at all.
      const out = compactFactorLabel(label, MEASURE)
      expect(out.endsWith('…')).toBe(true)
      expect(label.startsWith(out.slice(0, -1))).toBe(true)
      // Precondition 3: THE DISCRIMINATOR. If the two rules agreed here, the
      // assertion in the next test would hold for a twin carrying either one.
      expect(OLD_RULE(label, MEASURE)).not.toBe(NEW_RULE(label, MEASURE))
    }
  })

  it('agrees with the OLD rule and disagrees with the new one — the divergence, pinned', () => {
    for (const label of FALLBACK_LABELS) {
      expect(compactFactorLabel(label, MEASURE)).toBe(OLD_RULE(label, MEASURE))
      expect(compactFactorLabel(label, MEASURE)).not.toBe(NEW_RULE(label, MEASURE))
    }
  })
})
