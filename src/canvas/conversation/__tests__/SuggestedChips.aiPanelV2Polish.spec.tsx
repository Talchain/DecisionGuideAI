/**
 * aiPanelV2 UX polish — Run analysis chip suppression/relabel.
 *
 * Product rule (only when aiPanelV2 is ON):
 *   - no analysis exists       → keep chip as-is ("Run analysis")
 *   - current analysis exists  → SUPPRESS chip entirely
 *                                (Analysis/readiness panel owns rerun)
 *   - stale analysis exists    → RELABEL to "Rerun"
 *
 * Decision keys off `results.status === 'complete'` + `isStale` from the
 * stale guard. This is the loosened path — the old `analysisState ===
 * 'current'` predicate raced on staging when the hash compare lagged.
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

/** Drive useStaleGuard's three return shapes via the canvas store. */
function setAnalysisState(state: 'none' | 'current' | 'stale') {
  if (state === 'none') {
    useCanvasStore.setState({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      results: { status: 'idle' } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      _internal: { graphHash: undefined } as any,
    })
    return
  }
  useCanvasStore.setState({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results: { status: 'complete', graphHash: 'abc123' } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _internal: { graphHash: state === 'current' ? 'abc123' : 'xyz999' } as any,
  })
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

  // Reviewer amendment: regression should pin the exact product-rule
  // matrix, regardless of internal predicate names.
  it('product rule: none → keep, current → suppress, stale → Rerun', () => {
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

    // stale
    setAnalysisState('stale')
    render(
      <SuggestedChips chips={[fixture()]} onChipClick={vi.fn().mockResolvedValue(undefined)} />,
    )
    expect(screen.getByTestId('suggested-chip-matrix')).toHaveTextContent(/^\s*Rerun\s*$/i)
  })
})

describe('SuggestedChips — FF-off legacy parity (no polish)', () => {
  beforeEach(() => {
    try { localStorage.removeItem('feature.aiPanelV2') } catch {}
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
