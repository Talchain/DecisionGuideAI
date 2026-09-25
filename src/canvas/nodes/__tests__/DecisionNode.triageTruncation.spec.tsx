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
 *
 * ⭐ LOCKED CANVAS DESIGN (23 Sep 2026; ED 11:52Z point 1, ED 02:31Z). The
 * triage line is now the Question card's ONE pre-analysis focus signal,
 * `decision-node-top-gap`: its VISIBLE text (the `aria-hidden` span) is the
 * 40-character word-boundary short form this file pins, and its screen-reader
 * copy (`.sr-only`) is the FULL untruncated sentence — ED 02:31Z's full-text
 * recovery for a one-line clamp. So the whole-sentence identity assertions
 * below read the VISIBLE span, and each truncating case also asserts the
 * recovery carries the untruncated label.
 *
 * ⭐⭐ SUPERSEDED FOR THE TRIAGE LINE (Paul, 25 Sep 2026 — the canvas matches
 * the PROTOTYPE). Served, the clamped row read "3 options · A success target on
 * your model can't be…": still cut mid-sentence. The prototype row carries no
 * sentence, so the triage line moved OFF the resting row and renders WHOLE in
 * the popover, with a card-side `.sr-only` copy. `truncateAtWord` had no caller
 * left and was removed. The first block below therefore pins the opposite of
 * what it pinned before: NO truncation, at any length, of any label. The second
 * block (the `labelUtils` twin) is untouched — it pins a different helper.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

/**
 * The top gap bound by IDENTITY where it now lives: the popover's
 * `decision-node-top-gap` (whole), the card-side screen-reader copy, and the
 * resting row, which must not carry it.
 */
const topGap = () => {
  const inPopover = within(screen.getByTestId('decision-node-popover')).getByTestId('decision-node-top-gap')
  const sr = screen.getByTestId('decision-focus-signal-sr')
  const row = screen.getByTestId('decision-node-resting-state')
  return { popover: inPopover.textContent ?? '', sr: sr.textContent ?? '', row: row.textContent ?? '' }
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

describe('DecisionNode triage line — never truncated: off the row, whole in the popover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * THE DISCRIMINATING CASE for the old rule: a second word past the measure.
   * The old clamp showed "Top gap: validate Use a…"; now the whole label shows.
   */
  it('a word past the old measure is kept, not dropped', () => {
    const label = 'Use a supercalifragilisticexpialidociousmetricvalue here'
    expect(label.length).toBeGreaterThan(TRIAGE_MEASURE)

    renderWith(label)

    const { popover, sr, row } = topGap()
    expect(popover).toBe(`Top gap: validate ${label}`)
    expect(sr).toBe(popover)
    expect(row).not.toMatch(/Top gap/)
    expect(screen.queryByText('Top gap: validate Use a\u2026')).toBeNull()
  })

  it('an ordinary long label arrives whole — no cut at the last boundary', () => {
    const label = 'Snowflake-Native Build Capacity In The Data Platform Team'
    expect(label.length).toBeGreaterThan(TRIAGE_MEASURE)

    renderWith(label)

    const { popover, sr, row } = topGap()
    expect(popover).toBe(`Top gap: validate ${label}`)
    expect(popover).not.toContain('\u2026')
    expect(sr).toBe(popover)
    expect(row).not.toMatch(/Top gap/)
  })

  it('a single unbroken token arrives whole', () => {
    const token = 'Snowflakenativebuildcapacityinthedataplatformteamnow'
    expect(token.length).toBeGreaterThan(TRIAGE_MEASURE)
    expect(token).not.toContain(' ')

    renderWith(token)

    const { popover, sr } = topGap()
    expect(popover).toBe(`Top gap: validate ${token}`)
    expect(popover).not.toContain('\u2026')
    expect(sr).toBe(popover)
  })

  /**
   * The control that lets this file PASS as well as fail: a short label is the
   * same sentence it always was.
   */
  it('leaves a label shorter than the measure exactly as it is', () => {
    const label = 'Brand perception'
    expect(label.length).toBeLessThan(TRIAGE_MEASURE)

    renderWith(label)

    const { popover, sr } = topGap()
    expect(popover).toBe('Top gap: validate Brand perception')
    expect(sr).toBe(popover)
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
