/**
 * NodeChip intent contract (A1 meta-decision diagnosis, 2026-07-20).
 *
 * Node chips are product-authored prompts. Before this contract they were
 * sent as anonymous text via `_sendMessage` — CEE's heuristics re-inferred
 * their intent from the words, which is how the product's own "Run the
 * analysis now" chip got folded into a clarify round as a brief "answer"
 * instead of running the analysis.
 *
 * Pinned here, through the REAL production seams (NodeChip → guidance
 * bridge → buildChipMeta → buildV5Payload):
 *  - a chip with a bound action ships `chip.action_type` + its chip_id and
 *    promotes the wire source to `chip_click` (CEE's deterministic branch);
 *  - a coaching chip with a deliberate null still ships its chip_id
 *    (explicit product identity) with NO action_type key;
 *  - hosts that registered only the legacy `_sendMessage` bridge still get
 *    the message (no dead clicks).
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import type { ReactElement } from 'react'
import { render, fireEvent, cleanup } from '@testing-library/react'

import { NodeChip } from '../NodeChip'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { buildChipMeta } from '../../../conversation/chipMeta'
import { buildV5Payload } from '../../../../v5/buildPayload'

type DispatchOpts = {
  action_type?: string
  parameters?: Record<string, unknown>
  label: string
  message: string
  hidden?: boolean
  source: string
}

let unregister: (() => void) | null = null

function registerBridge(withDispatch: boolean) {
  const sendMessage = vi.fn()
  const dispatchAction = vi.fn()
  unregister = useGuidanceStore
    .getState()
    .registerConversationCallbacks(
      sendMessage,
      vi.fn(),
      undefined,
      undefined,
      undefined,
      withDispatch ? dispatchAction : undefined,
    )
  return { sendMessage, dispatchAction }
}

afterEach(() => {
  unregister?.()
  unregister = null
  cleanup()
})

function clickChip(ui: ReactElement, label: string) {
  const { getByRole } = render(ui)
  fireEvent.click(getByRole('button', { name: label }))
}

/** Feed the captured dispatch opts through the real wire modules. */
function buildWire(opts: DispatchOpts) {
  const chipMeta = buildChipMeta({
    action_type: opts.action_type,
    parameters: opts.parameters,
  })
  const built = buildV5Payload({
    turnId: '00000000-0000-4000-8000-000000000011',
    scenarioId: '00000000-0000-4000-8000-000000000012',
    stage: 'frame',
    turnClass: 'frame',
    mode: 'user',
    message: opts.message,
    source: 'chip',
    chipMeta,
  })
  if (!built.ok) throw new Error('payload build failed: ' + JSON.stringify(built))
  return built.payload as {
    source: string
    message: string
    chip?: { action_type?: string; parameters?: Record<string, unknown> }
  }
}

describe('NodeChip — bound action ships explicit intent to the wire', () => {
  it('run_analysis chip dispatches action_type + chip_id and builds a chip_click payload', () => {
    const { dispatchAction, sendMessage } = registerBridge(true)
    clickChip(
      <NodeChip
        chipId="decision_run_analysis"
        actionType="run_analysis"
        label="Run analysis"
        message="Run the analysis now"
      />,
      'Run analysis',
    )

    expect(sendMessage).not.toHaveBeenCalled()
    expect(dispatchAction).toHaveBeenCalledTimes(1)
    const opts = dispatchAction.mock.calls[0][0] as DispatchOpts
    expect(opts.action_type).toBe('run_analysis')
    expect(opts.parameters).toEqual({ chip_id: 'decision_run_analysis' })
    expect(opts.message).toBe('Run the analysis now')
    expect(opts.source).toBe('chip')

    const payload = buildWire(opts)
    // Bound action promotes the source to CEE's deterministic chip branch.
    expect(payload.source).toBe('chip_click')
    expect(payload.chip?.action_type).toBe('run_analysis')
    expect(payload.chip?.parameters).toEqual({ chip_id: 'decision_run_analysis' })
    expect(payload.message).toBe('Run the analysis now')
  })
})

describe('NodeChip — coaching chip (deliberate null) still ships its identity', () => {
  it('null actionType dispatches chip_id only and never fabricates an action_type', () => {
    const { dispatchAction } = registerBridge(true)
    clickChip(
      <NodeChip
        chipId="risk_add_mitigation"
        actionType={null}
        label="Add mitigation"
        message="Suggest a mitigation strategy for this risk"
      />,
      'Add mitigation',
    )

    expect(dispatchAction).toHaveBeenCalledTimes(1)
    const opts = dispatchAction.mock.calls[0][0] as DispatchOpts
    // A null decision must not leak as a key CEE could misread.
    expect('action_type' in opts).toBe(false)
    expect(opts.parameters).toEqual({ chip_id: 'risk_add_mitigation' })

    const payload = buildWire(opts)
    expect(payload.source).toBe('chip')
    expect(payload.chip).toBeDefined()
    expect(payload.chip && 'action_type' in payload.chip).toBe(false)
    expect(payload.chip?.parameters).toEqual({ chip_id: 'risk_add_mitigation' })
  })
})

describe('NodeChip — legacy bridge fallback', () => {
  it('falls back to _sendMessage when no dispatcher is registered (no dead clicks)', () => {
    const { sendMessage } = registerBridge(false)
    clickChip(
      <NodeChip
        chipId="risk_what_reduces"
        actionType={null}
        label="What reduces this?"
        message="What factors or actions could reduce this risk?"
      />,
      'What reduces this?',
    )
    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage).toHaveBeenCalledWith('What factors or actions could reduce this risk?')
  })
})
