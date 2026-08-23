/**
 * B3 authority regression: the two former "rehomed local commits" are facts
 * the server never accepted. They now render as information, not controls.
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
}

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => cleanup())

describe('local-only Model mutations are withheld', () => {
  it('does not mount factor-confirmation actions', () => {
    renderPanel()
    expect(screen.queryByTestId(`model-row-v2-${FACTOR_ID}-confirm-as-is`)).not.toBeInTheDocument()
    expect(screen.queryByTestId('model-tab-v2-chip-confirm-estimates')).not.toBeInTheDocument()
  })

  it('renders an option intervention as static information, not an editor', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(`model-row-v2-${OPTION_ID}`))
    const value = screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}-value`)
    expect(value.tagName).toBe('SPAN')
    fireEvent.click(value)
    expect(
      screen.queryByTestId(`model-detail-v2-intervention-${FACTOR_ID}-input`),
    ).not.toBeInTheDocument()
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
