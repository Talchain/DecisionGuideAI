/**
 * ROADMAP 2.102 — the post-edit "Re-run" control must DISPATCH A RUN.
 *
 * THE DEFECT THIS PINS (live-confirmed on staging `03e13443`, 2026-07-28).
 * #513 made an inspector value edit a real turn; the inspector then told the
 * user "Re-run to see how this affects the results" — and rendered no control
 * that would do it. `InlineRerunPrompt`'s button sat behind `{onRerun && (…)}`
 * with `onRerun` OPTIONAL, and ALL FOUR render sites (EdgePanel,
 * FactorControllablePanel, FactorObservablePanel, RiskPanel) passed only
 * `visible`. In the live walk the prompt text was present and
 * `button:has-text("Re-run")` counted ZERO. Advice with no affordance.
 *
 * WHAT THIS FILE PINS, and why each assertion is load-bearing:
 *
 *   1. THE CONTROL EXISTS AND DISPATCHES — the assertion that was RED. It
 *      goes through `executeCanonicalRun`, the SAME registry the canvas
 *      shortcut, command palette, Actions menu and Define-success modal use,
 *      which resolves to OutputsDock's `runCanonicalAnalysis` — the identical
 *      pipeline the composer's rerun takes. Asserting the registered runner is
 *      invoked is what proves convergence; a parallel fetch would pass a
 *      "something happened" test and fail this one.
 *   2. NO PROP TO FORGET — rendering the prompt with `visible` ALONE (exactly
 *      what all four panels pass) still yields a live button. This is the
 *      mutation guard on the actual defect: restore the `onRerun &&` wrapper
 *      and this RED-s, because the panels supply no such prop.
 *   3. IT REACHES THE WIRE THROUGH A REAL PANEL — asserted through
 *      `FactorControllablePanel`, not just the leaf. A leaf-only test would
 *      pass while the panel rendered a different component or dropped it.
 *   4. NEGATIVE CONTROL — `visible={false}` renders no button. Without it,
 *      assertion 1 is satisfiable by a control that is ALWAYS present, which
 *      would invite a rerun over an analysis that is already current.
 *   5. IT NEVER SWALLOWS A REFUSAL — a blocked/unavailable outcome is surfaced
 *      as a toast carrying the runner's own reason. A rerun that silently
 *      no-ops is the same class of defect in a new spelling.
 *   6. IT DOES NOT RACE AN IN-FLIGHT TURN — disabled while a run is running.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import type { Node } from '@xyflow/react'

const showToast = vi.fn()

// Trap 12 (the hand-maintained mirror): spread the real module rather than
// hand-listing its exports — a `vi.mock` factory REPLACES the module.
vi.mock('../../../ToastContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useShowToastSafe: () => showToast }
})

// The panel's own emitter is out of scope here (#513 covers it); silence it so
// this file fails only for its own reason.
vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn() }) }
})

import { InlineRerunPrompt } from '../shared/InlineRerunPrompt'
import { FactorControllablePanel } from '../panels/FactorControllablePanel'
import { useCanvasStore } from '../../../store'
import {
  registerCanonicalRunner,
  __resetCanonicalRunnerForTests,
  RUNNER_UNAVAILABLE_MESSAGE,
} from '../../../analysis/canonicalRunRegistry'

const NODE_ID = 'fac_compliance_readiness'
const CAP = 1
const noop = () => {}

function factorNode(): Node {
  return {
    id: NODE_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Compliance Readiness',
      kind: 'factor',
      factor_type: 'lever',
      observedState: { value: 0.3, raw_value: 0.3, cap: CAP },
    },
  } as unknown as Node
}

/**
 * The post-edit state the live walk produced: an analysis exists, CEE's
 * verdict is no longer confirmable ('unknown' after a local edit), and an edit
 * was confirmed in THIS panel. That is exactly `isStaleAfterEdit`.
 */
function seedPostEditState(runStatus: string = 'complete') {
  useCanvasStore.setState(
    {
      nodes: [factorNode()],
      edges: [],
      results: { status: runStatus, report: null },
      analysisFreshness: { freshness: 'stale', computedAt: new Date().toISOString() },
      analysisFreshnessDirty: true,
    } as any,
    false,
  )
}

describe('post-edit inline Re-run dispatches the canonical run (ROADMAP 2.102)', () => {
  beforeEach(() => {
    showToast.mockClear()
    __resetCanonicalRunnerForTests()
    seedPostEditState()
  })
  afterEach(() => {
    cleanup()
    __resetCanonicalRunnerForTests()
  })

  it('renders a live Re-run control given ONLY `visible` — the prop no call site passes', async () => {
    const runner = vi.fn().mockResolvedValue({ status: 'dispatched' })
    registerCanonicalRunner(runner)

    // Exactly what all four inspector panels pass. Before the fix this
    // rendered the advice and no button at all.
    render(<InlineRerunPrompt visible />)

    const btn = screen.getByTestId('inline-rerun')
    expect(btn).toBeInTheDocument()

    fireEvent.click(btn)
    await waitFor(() => expect(runner).toHaveBeenCalledTimes(1))
  })

  it('dispatches through the CANONICAL registry, not a parallel path', async () => {
    const runner = vi.fn().mockResolvedValue({ status: 'dispatched' })
    registerCanonicalRunner(runner)

    render(<InlineRerunPrompt visible />)
    fireEvent.click(screen.getByTestId('inline-rerun'))

    // The registered runner IS OutputsDock's `runCanonicalAnalysis` in the
    // app; being called through it is what proves the inspector rerun and the
    // composer/footer rerun are the same pipeline.
    await waitFor(() => expect(runner).toHaveBeenCalledTimes(1))
    expect(runner.mock.calls[0][0]).toMatchObject({ source: 'inspector-inline-rerun' })
  })

  it('NEGATIVE CONTROL: renders nothing when not stale-after-edit', () => {
    registerCanonicalRunner(vi.fn().mockResolvedValue({ status: 'dispatched' }))
    render(<InlineRerunPrompt visible={false} />)
    expect(screen.queryByTestId('inline-rerun')).not.toBeInTheDocument()
  })

  it('surfaces a BLOCKED refusal instead of silently no-opping', async () => {
    const runner = vi
      .fn()
      .mockResolvedValue({ status: 'blocked', reason: 'Draft or save a model first, then run analysis.' })
    registerCanonicalRunner(runner)

    render(<InlineRerunPrompt visible />)
    fireEvent.click(screen.getByTestId('inline-rerun'))

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('Draft or save a model first, then run analysis.', 'warning'),
    )
  })

  it('surfaces the UNAVAILABLE reason when no run host is mounted', async () => {
    // No runner registered at all — executeCanonicalRun folds this into the
    // outcome union rather than throwing or no-opping.
    render(<InlineRerunPrompt visible />)
    fireEvent.click(screen.getByTestId('inline-rerun'))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith(RUNNER_UNAVAILABLE_MESSAGE, 'warning'))
  })

  it('does not race an in-flight turn: disabled while a run is streaming', () => {
    const runner = vi.fn().mockResolvedValue({ status: 'dispatched' })
    registerCanonicalRunner(runner)
    seedPostEditState('streaming')

    render(<InlineRerunPrompt visible />)
    const btn = screen.getByTestId('inline-rerun')
    expect(btn).toBeDisabled()

    fireEvent.click(btn)
    expect(runner).not.toHaveBeenCalled()
  })

  it('reaches the runner THROUGH a real inspector panel, not just the leaf', async () => {
    const runner = vi.fn().mockResolvedValue({ status: 'dispatched' })
    registerCanonicalRunner(runner)

    render(
      <FactorControllablePanel nodeId={NODE_ID} techMode={false} onClose={noop} onNavigate={noop} />,
    )

    // Commit an edit so the panel's own `lastConfirmed` gate opens — this is
    // the #513 loop, and the prompt only shows after an edit in THIS panel.
    const input = screen.getByPlaceholderText('Enter value') as HTMLInputElement
    fireEvent.change(input, { target: { value: '0.9' } })
    fireEvent.blur(input)

    const btn = await screen.findByTestId('inline-rerun')
    fireEvent.click(btn)
    await waitFor(() => expect(runner).toHaveBeenCalledTimes(1))
  })
})
