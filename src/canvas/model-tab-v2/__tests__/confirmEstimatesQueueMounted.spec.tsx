/**
 * B3 authority gate: estimate confirmation is not a GraphV3 transaction.
 * Until it has a receipt-bearing carrier, neither its chip nor queue mounts.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { useCanvasStore } from '../../store'

const UNVERIFIED = 'fac_sales_cycle_length'
const VERIFIED = 'fac_headcount'

function factor(id: string, label: string, source: string): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label,
      kind: 'factor',
      observedState: { value: 0.45, raw_value: 45, cap: 100, source },
    },
  } as unknown as Node
}

function renderPanel() {
  const nodes = [
    factor(UNVERIFIED, 'Sales cycle length', 'cee_inference'),
    factor(VERIFIED, 'Headcount', 'user_confirmed'),
  ]
  useCanvasStore.setState({ nodes, edges: [] } as never, false)
  render(<ModelTabV2Panel nodes={nodes} edges={[]} goalThreshold={null} />)
}

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => cleanup())

describe('local-only estimate confirmation is withheld', () => {
  it('mounts neither the verify chip nor its queue/apply controls', () => {
    renderPanel()
    expect(screen.queryByTestId('model-tab-v2-chip-confirm-estimates')).not.toBeInTheDocument()
    expect(screen.queryByTestId('repair-queue-v2-confirm-estimates')).not.toBeInTheDocument()
    expect(screen.queryByTestId(`model-row-v2-${UNVERIFIED}-confirm-as-is`)).not.toBeInTheDocument()
  })

  it('keeps the entity visible and the canonical factor-value route available', () => {
    renderPanel()
    expect(screen.getByTestId(`model-row-v2-${UNVERIFIED}`)).toBeInTheDocument()
    expect(screen.getByTestId(`model-row-v2-${UNVERIFIED}-value`)).toBeEnabled()
  })
})
