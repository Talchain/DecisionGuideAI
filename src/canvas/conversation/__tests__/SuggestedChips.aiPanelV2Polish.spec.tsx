/**
 * aiPanelV2 UX polish — Run analysis chip suppression/relabel.
 *
 * Product rule (only when aiPanelV2 is ON):
 *   - no analysis exists                 → keep chip as-is ("Run analysis")
 *   - confirmed-current analysis exists  → SUPPRESS chip entirely
 *                                          (Analysis/readiness panel owns rerun)
 *   - stale / cannot-confirm analysis    → RELABEL to "Rerun"
 *
 * Decision keys off `results.status === 'complete'` + the shared freshness display
 * semantic (`changed` or `cannot_confirm`).
 * This replaces the legacy `isStale` from useStaleGuard, whose production input
 * `_internal.graphHash` is never written — so the rerun affordance never appeared
 * after a graph edit even though the Results surface showed cannot-confirm.
 *
 * Detection covers both V2 chips (`action_type === 'run_analysis'`) and
 * legacy / prompt-style chips matched by the tolerant regex
 * `/^(?:run|rerun)\s+(?:the\s+)?analysis\.?$/i`.
 *
 * When aiPanelV2 is OFF, chips render unchanged (legacy parity).
 * Independent of the V5 readiness gate — this filter runs after the V5
 * filter, on whatever survives.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SuggestedChips } from '../zones/SuggestedChips'
import { useCanvasStore } from '../../store'
import type { ActionChip } from '../types'

function makeChip(overrides: Partial<ActionChip> = {}): ActionChip {
  return {
    id: overrides.id ?? 'chip_1',
    label: 'Run analysis',
    intent: 'primary',
    message: 'Please run the analysis now',
    ...overrides,
  }
}

/**
 * Drive the run-analysis polish input via the CEE freshness verdict + dirty
 * overlay (the production source), NOT the dead useStaleGuard graph-hash path.
 *   none          → no analysis (idle, no verdict)
 *   current       → complete + CEE 'fresh', clean
 *   stale         → complete + CEE 'stale'
 *   cannot-confirm→ complete + CEE 'fresh' downgraded by a local edit (dirty)
 *   cee-unknown   → complete + CEE-sourced unknown (cannot confirm, no edit claim)
 *   no-verdict    → complete but NO freshness verdict at all (legacy / non-CEE run)
 */
function setAnalysisState(state: 'none' | 'current' | 'stale' | 'cannot-confirm' | 'cee-unknown' | 'no-verdict') {
  if (state === 'none') {
    useCanvasStore.setState({
      results: { status: 'idle' } as any,
      analysisFreshness: null,
      analysisFreshnessDirty: false,
    })
    return
  }
  useCanvasStore.setState({
    results: { status: 'complete', graphHash: 'abc123' } as any,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
  })
  if (state === 'no-verdict') {
    // results complete but no analysis_ready freshness ever set → slice stays null.
    return
  }
  if (state === 'stale') {
    useCanvasStore.getState().setAnalysisFreshness({ freshness: 'stale', freshness_reason: 'graph_changed' })
    return
  }
  if (state === 'cee-unknown') {
    useCanvasStore.getState().setAnalysisFreshness({ freshness: 'unknown', freshness_reason: 'no_hash' })
    return
  }
  // current + cannot-confirm both start from a CEE 'fresh' verdict.
  useCanvasStore.getState().setAnalysisFreshness({ freshness: 'fresh', freshness_reason: 'graph_hash_match' })
  if (state === 'cannot-confirm') {
    useCanvasStore.getState().markAnalysisFreshnessDirty()
  }
}

describe('SuggestedChips — aiPanelV2 Run analysis polish', () => {
  beforeEach(() => {
    // Polish filter is FF-gated. makeFlag eagerly snapshots import.meta.env
    // at module load — vi.stubEnv arrives too late. localStorage is the only
    // runtime-mutable override path. Any non-'0'/'false' value enables.
    try { localStorage.setItem('feature.aiPanelV2', 'true') } catch {}
    // V5 off so the upstream readiness gate doesn't pre-filter the
    // run_analysis chip — we're testing the downstream polish step.
    vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', '')
    setAnalysisState('none')
  })
  afterEach(() => {
    try { localStorage.removeItem('feature.aiPanelV2') } catch {}
    vi.unstubAllEnvs()
    setAnalysisState('none')
  })

  it('suppresses the Run analysis chip entirely when current analysis exists', () => {
    setAnalysisState('current')
    render(
      <SuggestedChips
        chips={[makeChip({ action_type: 'run_analysis' })]}
        onChipClick={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    expect(screen.queryByTestId('suggested-chip-chip_1')).toBeNull()
  })

  it('relabels the Run analysis chip to "Rerun" when analysis is stale', () => {
    setAnalysisState('stale')
    render(
      <SuggestedChips
        chips={[makeChip({ id: 'r1', action_type: 'run_analysis', label: 'Run analysis' })]}
        onChipClick={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    const chip = screen.getByTestId('suggested-chip-r1')
    expect(chip).toHaveTextContent(/^\s*Rerun\s*$/i)
    expect(chip).not.toHaveTextContent(/Run analysis/i)
  })

  it('relabels to "Rerun" when a fresh analysis is cannot-confirm after a local edit', () => {
    // The key production regression: before, isStale (dead useStaleGuard) never
    // fired, so a post-edit cannot-confirm state kept the rerun chip suppressed.
    setAnalysisState('cannot-confirm')
    render(
      <SuggestedChips
        chips={[makeChip({ id: 'cc1', action_type: 'run_analysis', label: 'Run analysis' })]}
        onChipClick={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    const chip = screen.getByTestId('suggested-chip-cc1')
    expect(chip).toHaveTextContent(/^\s*Rerun\s*$/i)
    expect(chip).not.toHaveTextContent(/Run analysis/i)
  })

  it('relabels to "Rerun" when CEE reports cannot-confirm freshness', () => {
    setAnalysisState('cee-unknown')
    render(
      <SuggestedChips
        chips={[makeChip({ id: 'cu1', action_type: 'run_analysis', label: 'Run analysis' })]}
        onChipClick={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    const chip = screen.getByTestId('suggested-chip-cu1')
    expect(chip).toHaveTextContent(/^\s*Rerun\s*$/i)
    expect(chip).not.toHaveTextContent(/Run analysis/i)
  })

  it('keeps (does NOT suppress) the run-analysis chip when complete but NO freshness verdict — V5 off, no readiness gate', () => {
    // A completed analysis with no freshness verdict is NOT confirmed-current, so
    // it must NOT be suppressed as if current (mirrors useStageAwarePlaceholder,
    // which treats this state as not-"latest"). It is NOT relabelled to "Rerun"
    // either — that label carries a readiness-gate bypass reserved for a real
    // verdict; with no verdict the chip stays a plain 'keep' that the gate governs.
    // V5 is off in this suite, so no gate applies → the chip renders as-is.
    setAnalysisState('no-verdict')
    render(
      <SuggestedChips
        chips={[makeChip({ id: 'nv1', action_type: 'run_analysis', label: 'Run analysis' })]}
        onChipClick={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    const chip = screen.getByTestId('suggested-chip-nv1')
    expect(chip).toBeInTheDocument() // not suppressed
    expect(chip).toHaveTextContent(/Run analysis/i) // kept, not relabelled to "Rerun"
  })

  it('leaves the Run analysis chip unchanged when no analysis has been run yet', () => {
    setAnalysisState('none')
    render(
      <SuggestedChips
        chips={[makeChip({ id: 'n1', action_type: 'run_analysis', label: 'Run analysis' })]}
        onChipClick={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    const chip = screen.getByTestId('suggested-chip-n1')
    expect(chip).toHaveTextContent(/Run analysis/i)
  })

  it('does NOT touch non-run_analysis chips (current path is run_analysis-specific)', () => {
    setAnalysisState('current')
    render(
      <SuggestedChips
        chips={[
          makeChip({ id: 'x', action_type: undefined, label: 'Explain', message: 'Explain it' }),
        ]}
        onChipClick={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    expect(screen.getByTestId('suggested-chip-x')).toBeInTheDocument()
  })

  // Defensive: legacy/prompt-style chips arrive without action_type. The
  // polish must catch them by canonical label/message too.
  it('suppresses a label-only "Run analysis" chip (no action_type) when current', () => {
    setAnalysisState('current')
    render(
      <SuggestedChips
        chips={[
          makeChip({
            id: 'legacy-1',
            action_type: undefined,
            label: 'Run analysis',
            message: 'Run analysis',
          }),
        ]}
        onChipClick={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    expect(screen.queryByTestId('suggested-chip-legacy-1')).toBeNull()
  })

  it('relabels a label-only "Run analysis" chip to "Rerun" when stale', () => {
    setAnalysisState('stale')
    render(
      <SuggestedChips
        chips={[
          makeChip({
            id: 'legacy-2',
            action_type: undefined,
            label: 'Run analysis',
            message: 'Run analysis',
          }),
        ]}
        onChipClick={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    const chip = screen.getByTestId('suggested-chip-legacy-2')
    expect(chip).toHaveTextContent(/^\s*Rerun\s*$/i)
  })

  it('does NOT false-positive on conversational chips that mention analysis', () => {
    setAnalysisState('current')
    render(
      <SuggestedChips
        chips={[
          makeChip({
            id: 'conv-1',
            action_type: undefined,
            label: 'Explain the analysis',
            message: 'Explain the analysis in plain terms',
          }),
        ]}
        onChipClick={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    expect(screen.getByTestId('suggested-chip-conv-1')).toBeInTheDocument()
  })

  // Pin against the actual CEE fixture shape (tests/fixtures/cee-responses/
  // v5-turn.explain-stale.json) — what live staging emits after analysis.
  it('suppresses the real CEE-fixture-shape chip when current', () => {
    setAnalysisState('current')
    render(
      <SuggestedChips
        chips={[
          makeChip({
            id: 'cee-fixture',
            label: 'Rerun analysis',
            message: 'Rerun the analysis.',
            action_type: 'run_analysis',
          }),
        ]}
        onChipClick={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    expect(screen.queryByTestId('suggested-chip-cee-fixture')).toBeNull()
  })

  it('relabels the real CEE-fixture-shape chip to "Rerun" when stale', () => {
    setAnalysisState('stale')
    render(
      <SuggestedChips
        chips={[
          makeChip({
            id: 'cee-stale',
            label: 'Rerun analysis',
            message: 'Rerun the analysis.',
            action_type: 'run_analysis',
          }),
        ]}
        onChipClick={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    const chip = screen.getByTestId('suggested-chip-cee-stale')
    expect(chip).toHaveTextContent(/^\s*Rerun\s*$/i)
  })

  // Regex fallback — V4-legacy chips drop action_type but carry the
  // canonical copy in the message field.
  it('suppresses a chip with "Run the analysis" message and no action_type when current', () => {
    setAnalysisState('current')
    render(
      <SuggestedChips
        chips={[
          makeChip({
            id: 'msg-only',
            action_type: undefined,
            label: 'Run',
            message: 'Run the analysis',
          }),
        ]}
        onChipClick={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    expect(screen.queryByTestId('suggested-chip-msg-only')).toBeNull()
  })

  it('suppresses a chip with trailing-period "Rerun the analysis." message when current', () => {
    setAnalysisState('current')
    render(
      <SuggestedChips
        chips={[
          makeChip({
            id: 'msg-period',
            action_type: undefined,
            label: 'Rerun',
            message: 'Rerun the analysis.',
          }),
        ]}
        onChipClick={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    expect(screen.queryByTestId('suggested-chip-msg-period')).toBeNull()
  })

  // V5 readiness gate previously filtered run_analysis when status !==
  // 'ready'. Stale/cannot-confirm analysis can map to status !== 'ready', so
  // the chip was dropped upstream and the polish never saw it. The aiPanelV2
  // bypass keeps it alive to be relabelled.
  it('V5-on stale: run_analysis survives readiness gate and is relabelled to "Rerun"', () => {
    // Enable V5 so the readiness filter is active.
    vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
    // Stale analysis: complete + hash mismatch.
    setAnalysisState('stale')
    // ceeAnalysisReady is null / not 'ready' — this is the V5 path that
    // would normally filter out the run_analysis chip BEFORE the polish.
    useCanvasStore.setState({
      ceeAnalysisReady: null as any,
    })
    render(
      <SuggestedChips
        chips={[
          makeChip({
            id: 'v5-stale',
            action_type: 'run_analysis',
            label: 'Rerun analysis',
            message: 'Rerun the analysis.',
          }),
        ]}
        onChipClick={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    const chip = screen.getByTestId('suggested-chip-v5-stale')
    expect(chip).toHaveTextContent(/^\s*Rerun\s*$/i)
  })

  // Mirror: with V5 active AND CURRENT analysis (status=ready), the
  // run_analysis chip survives the V5 gate normally, then the polish
  // suppresses it (current state).
  it('V5-on current: run_analysis is suppressed after passing readiness gate', () => {
    vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
    setAnalysisState('current')
    useCanvasStore.setState({
      ceeAnalysisReady: {
        goal_node_id: 'g',
        status: 'ready',
        options: [{ id: 'o', label: 'A', status: 'ready', interventions: {} }],
      } as any,
    })
    render(
      <SuggestedChips
        chips={[
          makeChip({
            id: 'v5-current',
            action_type: 'run_analysis',
            label: 'Rerun analysis',
            message: 'Rerun the analysis.',
          }),
        ]}
        onChipClick={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    expect(screen.queryByTestId('suggested-chip-v5-current')).toBeNull()
  })

  // Reviewer amendment: regression should pin the exact product-rule
  // matrix, regardless of internal predicate names.
  it('product rule: none → keep, current → suppress, stale/cannot-confirm → Rerun', () => {
    const fixture = () =>
      makeChip({
        id: 'matrix',
        label: 'Rerun analysis',
        message: 'Rerun the analysis.',
        action_type: 'run_analysis',
      })

    // none
    setAnalysisState('none')
    const { unmount: u1 } = render(
      <SuggestedChips chips={[fixture()]} onChipClick={vi.fn().mockResolvedValue(undefined)} />,
    )
    expect(screen.getByTestId('suggested-chip-matrix')).toHaveTextContent(/Rerun analysis/i)
    u1()

    // current
    setAnalysisState('current')
    const { unmount: u2 } = render(
      <SuggestedChips chips={[fixture()]} onChipClick={vi.fn().mockResolvedValue(undefined)} />,
    )
    expect(screen.queryByTestId('suggested-chip-matrix')).toBeNull()
    u2()

    // stale / cannot-confirm
    for (const state of ['stale', 'cannot-confirm', 'cee-unknown'] as const) {
      setAnalysisState(state)
      const { unmount } = render(
        <SuggestedChips chips={[fixture()]} onChipClick={vi.fn().mockResolvedValue(undefined)} />,
      )
      expect(screen.getByTestId('suggested-chip-matrix')).toHaveTextContent(/^\s*Rerun\s*$/i)
      unmount()
    }
  })
})

describe('SuggestedChips — FF-off legacy parity (no polish)', () => {
  beforeEach(() => {
    // Round-12: aiPanelV2 flag now defaults to TRUE, so `removeItem` no
    // longer engages the FF-off path. Explicit "false" override drives
    // the legacy parity branch.
    try { localStorage.setItem('feature.aiPanelV2', 'false') } catch {}
    vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', '')
    setAnalysisState('current')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    setAnalysisState('none')
  })

  it('still renders the Run analysis chip when current analysis exists (FF off — legacy)', () => {
    render(
      <SuggestedChips
        chips={[makeChip({ id: 'l1', action_type: 'run_analysis', label: 'Run analysis' })]}
        onChipClick={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    const chip = screen.getByTestId('suggested-chip-l1')
    expect(chip).toHaveTextContent(/Run analysis/i)
  })
})
