/**
 * A value the user typed must stop calling itself Olumi's estimate.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT — measured on deployed `fd992149`, and it reached EVERY editable factor
 * ─────────────────────────────────────────────────────────────────────────────
 * CEE writes `extractionType: 'inferred'` beside `source: 'cee_inference'`
 * (`observedStateHelpers.ts:186-187`). `FactorNode.tsx:199` reads THAT field —
 * not `source` — to decide whether to print the `est.` marker:
 *
 *     const isInferred = observedState?.extractionType === 'inferred'
 *
 * `setObservedValue` replaced the value, the raw value and both `display_value`s
 * and spread `...existing` over everything else — so the stale `'inferred'`
 * marker survived a user's edit indefinitely. The person typed a number and the
 * card went on labelling it an Olumi estimate.
 *
 * Live census on a starter board: **5 of 5 valued factors carry
 * `extractionType: 'inferred'`**, contrast control — the same 5 carry `source`.
 * So this was not an edge case; it was every factor anyone could edit.
 *
 * ⚠ TWO READERS OF ONE QUESTION (CLAUDE.md trap 21). `classifyValueProvenance`
 * answers "who put this number here?" from `source`; the `est.` marker answers
 * it from `extractionType`. Both are legitimate fields, but a writer that
 * updates one and not the other leaves the card and the pill disagreeing about
 * the same value. This fixes the WRITER, deliberately, rather than teaching the
 * marker to read `source` — re-pointing the reader would make the marker and
 * `EstimateMarker`'s two other call sites answer different questions.
 *
 * ⚠ CLEARED, NOT RE-AUTHORED. `extractionType` is the server's to write, the
 * same ruling `display_value` is already under in that setter. Writing
 * `'explicit'` here would be the client asserting an extraction it never
 * performed.
 *
 * ⚠ AND NOT RECEIPT-GATED — 2.304 is untouched. Withdrawing a statement that is
 * now FALSE is a different act from asserting a new one, and a server refusal
 * restores it anyway: `revertOptimisticFactorEdit` puts back the whole captured
 * `observedState`, including the absence of keys that were absent.
 *
 * ⚠ WHAT THIS FILE DOES AND DOES NOT PROVE. It hand-builds the post-edit shape,
 * so it is GREEN AT BOTH HEADS by construction: it pins that the MARKER FOLLOWS
 * THE FIELD, which is worth pinning and is not evidence of the fix. The
 * assertion that REDs at pristine — that `setObservedValue` actually produces
 * that shape — lives in
 * `ui/inspector-v2/__tests__/setObservedValue.withdrawsTheExtractionMarker.spec.tsx`,
 * because this file mocks the store at module scope and a mocked store cannot
 * exercise the real setter. Neither half is sufficient alone.
 *
 * CLAIM SCOPE (trap 3): jsdom text assertions prove PRESENCE and ABSENCE of text
 * in the DOM, never layout or visibility.
 */

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

// The `est.` marker renders only when `isInferred && !isDetailed`, and
// `isDetailed = viewMode === 'expert'` — so the STANDARD view is the one the
// founder looks at and the only one where this defect is visible.
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) =>
    selector({
      hoveredOptionId: null, nodes: [], edges: [], ceeAnalysisReady: null,
      results: { status: 'idle', report: null }, highlightedNodes: new Set(),
      dimmedNodeIds: new Set(), goalThreshold: null, goalConstraints: [],
      viewMode: 'standard',
    })
  ),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="factor-node-popover">{children}</div>
  ),
}))

// Spread the real flags module: `FactorNode` now reads the composed analysis
// verdict (`useModelChangedSinceRun`), whose source classifier calls a flag
// this factory never listed. A `vi.mock` factory REPLACES the module, so an
// unlisted flag is `undefined` and throws at render (CLAUDE.md trap 12).
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))

const baseProps = {
  id: 'factor-1', type: 'factor', position: { x: 0, y: 0 }, selected: false,
  isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
  dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true,
}

const renderFactor = (observedState: Record<string, unknown>) =>
  render(
    <ReactFlowProvider>
      <FactorNode
        {...baseProps}
        data={{ label: 'Engineering Capacity', kind: 'factor', observedState }}
      />
    </ReactFlowProvider>,
  )

const marker = (c: HTMLElement) => c.querySelector('[data-testid="estimate-marker"]')

/** The live shape: CEE's own estimate, exactly as the deployed board carries it. */
const CEE_ESTIMATE = {
  value: 0.62,
  raw_value: 0.62,
  source: 'cee_inference',
  extractionType: 'inferred',
}

describe('a value the user typed is not labelled an Olumi estimate', () => {
  it('CONTROL — an untouched CEE estimate DOES carry the est. marker', () => {
    // Without this the test below could pass on a card that never renders the
    // marker at all, for any reason (trap 13: an absence assertion needs a
    // demonstrated presence).
    // ⚠ With a UNIT: a unitless 0–1 Olumi estimate is now omitted from the card
    // altogether (contract v3.1 #20, `readoutIsBareModelScale`), so the control
    // carries a real unit to keep its value line — and its marker — on the card.
    const { container } = renderFactor({ ...CEE_ESTIMATE, raw_value: 62, unit: 'engineers' })
    expect(marker(container)).toBeTruthy()
    expect(marker(container)!.textContent).toBe('est.')
  })

  it('⭐ the marker is GONE once the value has been edited through the sanctioned setter', () => {
    // What `setObservedValue` now produces: the spread of the pre-edit state
    // with the value replaced, `display_value` cleared, and the stale
    // extraction marker withdrawn.
    const afterEdit = { ...CEE_ESTIMATE, value: 0.8, raw_value: 0.8, extractionType: undefined }
    const { container } = renderFactor(afterEdit)
    // RED before the fix: the spread preserved `extractionType: 'inferred'`,
    // so the card still printed `est.` over the user's own number.
    expect(marker(container)).toBeNull()
  })

  it('and the NUMBER still renders — withdrawing the claim must not withhold the value', () => {
    const afterEdit = { ...CEE_ESTIMATE, value: 0.8, raw_value: 0.8, extractionType: undefined }
    const { container } = renderFactor(afterEdit)
    // `FactorNode.tsx:926` gates the value and the marker on ONE outer
    // condition, so dropping the marker by emptying the face would satisfy the
    // test above for entirely the wrong reason.
    expect((container.textContent ?? '')).toContain('0.8')
  })
})
