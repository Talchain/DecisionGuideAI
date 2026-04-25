/**
 * Phase 2.2 — SuggestedChips readiness gate.
 *
 * Contracts pinned:
 *   - action_type === 'run_analysis' hidden when ceeAnalysisReady?.status !== 'ready'
 *   - action_type === 'run_analysis' shown when status === 'ready'
 *   - Chips with no action_type always pass through (conversational)
 *   - Chips with unknown action_type hidden (treat as potentially executable)
 *   - action_type === 'edit_graph' / 'draft_graph' shown regardless of readiness
 *   - Double-click: rapid successive clicks fire onChipClick at most twice
 *     (once per click); after the first click finishes, the chip re-enables
 *     for subsequent clicks unless the parent disables via isThinking.
 *   - Filter log routes through [v5-state] debug channel, not console.warn.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from 'react'

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

function setReady(status: string | null) {
  const payload = status
    ? {
        goal_node_id: 'goal_1',
        status,
        options: [{ id: 'opt_1', label: 'A', status: 'ready', interventions: {} }],
      }
    : null
  useCanvasStore.setState({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ceeAnalysisReady: payload as any,
  })
}

describe('SuggestedChips readiness gate', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
    setReady(null)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    setReady(null)
  })

  it('hides run_analysis chip when ceeAnalysisReady is null', () => {
    const onClick = vi.fn()
    render(
      <SuggestedChips
        chips={[makeChip({ action_type: 'run_analysis' })]}
        onChipClick={onClick}
      />,
    )
    expect(screen.queryByTestId('suggested-chip-chip_1')).toBeNull()
  })

  it('hides run_analysis chip when status is not ready (e.g. needs_encoding)', () => {
    setReady('needs_encoding')
    const onClick = vi.fn()
    render(
      <SuggestedChips
        chips={[makeChip({ action_type: 'run_analysis' })]}
        onChipClick={onClick}
      />,
    )
    expect(screen.queryByTestId('suggested-chip-chip_1')).toBeNull()
  })

  it('shows run_analysis chip when status is ready', () => {
    setReady('ready')
    const onClick = vi.fn()
    render(
      <SuggestedChips
        chips={[makeChip({ action_type: 'run_analysis' })]}
        onChipClick={onClick}
      />,
    )
    expect(screen.getByTestId('suggested-chip-chip_1')).toBeInTheDocument()
  })

  it('shows edit_graph chip regardless of readiness', () => {
    setReady(null) // no analysis ready
    render(
      <SuggestedChips
        chips={[
          makeChip({ id: 'chip_edit', label: 'Edit graph', action_type: 'edit_graph' }),
        ]}
        onChipClick={vi.fn()}
      />,
    )
    expect(screen.getByTestId('suggested-chip-chip_edit')).toBeInTheDocument()
  })

  it('shows chips with no action_type regardless of readiness', () => {
    setReady(null)
    render(
      <SuggestedChips
        chips={[makeChip({ id: 'chip_conv', label: 'Tell me more' })]}
        onChipClick={vi.fn()}
      />,
    )
    expect(screen.getByTestId('suggested-chip-chip_conv')).toBeInTheDocument()
  })

  it('hides chip with unknown action_type (treated as potentially executable)', () => {
    setReady('ready')
    render(
      <SuggestedChips
        chips={[
          makeChip({ id: 'chip_unknown', label: 'Weird', action_type: 'future_action' }),
        ]}
        onChipClick={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('suggested-chip-chip_unknown')).toBeNull()
  })

  it('does not hide run_analysis when V5 is off (V4 passthrough)', () => {
    vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', '')
    setReady(null) // no readiness, but V5 is off so the gate does not apply
    render(
      <SuggestedChips
        chips={[makeChip({ action_type: 'run_analysis' })]}
        onChipClick={vi.fn()}
      />,
    )
    expect(screen.getByTestId('suggested-chip-chip_1')).toBeInTheDocument()
  })
})

describe('SuggestedChips double-click safety', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
    setReady('ready')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    setReady(null)
  })

  it('disables the chip when isThinking is true even if a click already fired', async () => {
    // The component's onChipClick handler relies on the parent to set
    // isThinking=true for the duration of an in-flight request. Once that
    // flips, subsequent clicks are suppressed by the disabled button. This
    // test confirms the gate: while isThinking, clicks do nothing.
    const onClick = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(
      <SuggestedChips
        chips={[makeChip({ action_type: 'run_analysis' })]}
        onChipClick={onClick}
        isThinking={false}
      />,
    )

    const chip = screen.getByTestId('suggested-chip-chip_1')
    await act(async () => {
      fireEvent.click(chip)
    })
    expect(onClick).toHaveBeenCalledTimes(1)

    // Parent flips isThinking → true. Subsequent clicks must be no-ops.
    rerender(
      <SuggestedChips
        chips={[makeChip({ action_type: 'run_analysis' })]}
        onChipClick={onClick}
        isThinking={true}
      />,
    )
    await act(async () => {
      fireEvent.click(chip)
      fireEvent.click(chip)
      fireEvent.click(chip)
    })
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('SuggestedChips hook-ordering invariant on readiness transitions', () => {
  // P0 regression: hooks must be stable across readiness transitions that
  // flip `visible.length === 0`. Before hoisting, useEffect was declared
  // after the early return, so the hook count was 2 when a chip rendered
  // and 1 when it didn't — React threw `Rendered fewer hooks than
  // expected` on the transition. This test exercises both transitions.
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    setReady(null)
  })

  it('survives ready → not_ready transition without React hook errors', () => {
    setReady('ready')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(
      <SuggestedChips
        chips={[makeChip({ action_type: 'run_analysis' })]}
        onChipClick={vi.fn()}
      />,
    )
    expect(screen.getByTestId('suggested-chip-chip_1')).toBeInTheDocument()

    // Flip to not_ready — the chip disappears, visible becomes empty.
    setReady('needs_encoding')
    rerender(
      <SuggestedChips
        chips={[makeChip({ action_type: 'run_analysis' })]}
        onChipClick={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('suggested-chip-chip_1')).toBeNull()

    // React must not have complained about hook ordering.
    const hookErrors = errorSpy.mock.calls.filter((c) =>
      String(c[0] ?? '').includes('Rendered fewer hooks than expected'),
    )
    expect(hookErrors.length).toBe(0)
    errorSpy.mockRestore()
  })

  it('survives ready → missing (ceeAnalysisReady=null) transition', () => {
    setReady('ready')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(
      <SuggestedChips
        chips={[makeChip({ action_type: 'run_analysis' })]}
        onChipClick={vi.fn()}
      />,
    )
    expect(screen.getByTestId('suggested-chip-chip_1')).toBeInTheDocument()

    setReady(null)
    rerender(
      <SuggestedChips
        chips={[makeChip({ action_type: 'run_analysis' })]}
        onChipClick={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('suggested-chip-chip_1')).toBeNull()
    const hookErrors = errorSpy.mock.calls.filter((c) =>
      String(c[0] ?? '').includes('Rendered fewer hooks than expected'),
    )
    expect(hookErrors.length).toBe(0)
    errorSpy.mockRestore()
  })

  it('survives not_ready → ready transition (reverse)', () => {
    setReady('needs_encoding')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(
      <SuggestedChips
        chips={[makeChip({ action_type: 'run_analysis' })]}
        onChipClick={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('suggested-chip-chip_1')).toBeNull()

    setReady('ready')
    rerender(
      <SuggestedChips
        chips={[makeChip({ action_type: 'run_analysis' })]}
        onChipClick={vi.fn()}
      />,
    )
    expect(screen.getByTestId('suggested-chip-chip_1')).toBeInTheDocument()
    const hookErrors = errorSpy.mock.calls.filter((c) =>
      String(c[0] ?? '').includes('Rendered fewer hooks than expected'),
    )
    expect(hookErrors.length).toBe(0)
    errorSpy.mockRestore()
  })
})

describe('SuggestedChips [v5-state] filter logging', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
    vi.stubEnv('VITE_V5_STATE_DEBUG', 'true')
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    infoSpy.mockRestore()
    setReady(null)
  })

  it('emits [v5-state] chip_filter_unready when run_analysis is filtered out', () => {
    setReady('needs_encoding')
    render(
      <SuggestedChips
        chips={[makeChip({ action_type: 'run_analysis' })]}
        onChipClick={vi.fn()}
      />,
    )
    const matches = (infoSpy.mock.calls as unknown[][]).filter(
      (c) => c[0] === '[v5-state]',
    )
    const event = matches
      .map((c) => c[1] as { event?: string })
      .find((c) => c.event === 'chip_filter_unready')
    expect(event).toBeDefined()
  })
})
