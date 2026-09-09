/**
 * B3 authority regression: the former "rehomed local commits" are facts the
 * server never accepted, and they render as information rather than controls.
 *
 * ⚠ ONE OF THE TWO HAS SINCE GRADUATED (2026-09-09). The option-effect edit
 * gained a wire carrier, a server writer and a committed receipt, so it mounts a
 * real editor now; factor confirmation still has none and is still withheld. The
 * file keeps both, because the contrast is what makes either meaningful.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'

const sendSystemEvent = vi.fn()
vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent }) }
})
vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { useCanvasStore } from '../../store'
import { openOutlineGroups } from './openOutlineGroups'

const FACTOR_ID = 'fac_monthly_eng_cost'
const DANGLING_FACTOR_ID = 'fac_deleted_last_week'
const OPTION_ID = 'opt_premium'

function allNodes(): Node[] {
  return [
    {
      id: FACTOR_ID,
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Monthly Engineering Cost',
        kind: 'factor',
        category: 'observable',
        observedState: {
          value: 0.5,
          raw_value: 15000,
          cap: 30000,
          unit: '£',
          source: 'cee_inference',
        },
      },
    },
    {
      id: OPTION_ID,
      type: 'option',
      position: { x: 0, y: 0 },
      data: {
        label: 'Premium-first',
        kind: 'option',
        interventions: { [FACTOR_ID]: 0.6, [DANGLING_FACTOR_ID]: 0.9 },
      },
    },
  ] as unknown as Node[]
}

function renderPanel() {
  const nodes = allNodes()
  useCanvasStore.setState({ nodes, edges: [] } as never, false)
  render(<ModelTabV2Panel nodes={nodes} edges={[]} goalThreshold={null} />)
  openOutlineGroups()

}

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => cleanup())

describe('local-only Model mutations are withheld', () => {
  it('does not mount factor-confirmation actions', () => {
    renderPanel()
    expect(screen.queryByTestId(`model-row-v2-${FACTOR_ID}-confirm-as-is`)).not.toBeInTheDocument()
    expect(screen.queryByTestId('model-tab-v2-chip-confirm-estimates')).not.toBeInTheDocument()
  })

  /**
   * ⭐⭐ GRADUATED, AND THE FLIP IS THE WHOLE POINT OF THE ACTIVATION.
   *
   * This asserted the opposite — a SPAN, no editor, nothing sent — and it was
   * right for as long as it was true: an option's effect had no wire carrier, so
   * a control that looked like a shared-model edit would have been a lie.
   *
   * It now has one. `option_intervention_edit` (schemas 0.54.0), CEE's
   * identity-exact writer, and the canonical committed receipt the row settles
   * against. `CANONICAL_EDIT_AUTHORITY` answers exactly one question — "may this
   * control LOOK LIKE a shared-model edit?" — and the answer changed because the
   * evidence changed, not because the question was relaxed.
   *
   * ⚠ ITS THREE NEIGHBOURS ARE UNTOUCHED. Factor confirmation is still withheld,
   * the dangling-id drop still holds, and the factor-value editor is still the
   * positive control. One member graduated; the family did not.
   */
  it('⭐ the option intervention now mounts a REAL editor — it is no longer local-only', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(`model-row-v2-${OPTION_ID}`))
    const value = screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}-value`)
    expect(value.tagName).toBe('BUTTON')
    fireEvent.click(value)
    expect(
      screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}-input`),
    ).toBeInTheDocument()
    // ⚠ AND OPENING AN EDITOR IS NOT AN EDIT. Nothing is sent and nothing is
    // written until the user commits one — the property the old assertion was
    // really protecting, kept rather than dropped with the posture it pinned.
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('drops a dangling intervention before the mounted read-only detail can expose its raw id', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(`model-row-v2-${OPTION_ID}`))

    const detail = screen.getByTestId('model-detail-v2')
    expect(screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}`)).toBeInTheDocument()
    expect(
      screen.queryByTestId(`model-detail-v2-intervention-${DANGLING_FACTOR_ID}`),
    ).not.toBeInTheDocument()
    expect(detail.textContent ?? '').not.toContain(DANGLING_FACTOR_ID)
    expect(
      screen.queryByTestId(`model-detail-v2-intervention-${DANGLING_FACTOR_ID}-input`),
    ).not.toBeInTheDocument()

    const option = useCanvasStore.getState().nodes.find(node => node.id === OPTION_ID)
    const interventions = (option?.data as Record<string, unknown> | undefined)?.interventions as
      | Record<string, unknown>
      | undefined
    expect(interventions?.[DANGLING_FACTOR_ID]).toBe(0.9)
  })

  it('preserves the canonical factor-value editor as the positive control', () => {
    renderPanel()
    const value = screen.getByTestId(`model-row-v2-${FACTOR_ID}-value`)
    expect(value.tagName).toBe('BUTTON')
    expect(value).toBeEnabled()
    fireEvent.click(value)
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}-value-input`)).toBeInTheDocument()
  })
})
