/**
 * ⛔ PR Review CHANGES_REQUIRED 5881464028, blocking 2 — the MOUNTED receipt. `V5GraphPatchBlock` renders the
 * receipt's subject beside its change summary; a producer label with a level baked in ("Cloud cost <= 0.1") beside
 * "no more than 10% above today" stated the limit twice, the first time falsely. Pinned on the rendered block, the
 * surface the chat mounts, for a recognised change frame and an unread one (DL advisory 5881499189).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { V5GraphPatchBlock } from '../V5GraphPatchBlock'
import { useCanvasStore } from '../../../canvas/store'

const NODES = [{ id: 'fac_cost', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Total monthly cloud cost' } }]

const patch = (value_frame: unknown, label = 'Cloud cost <= 0.1') => ({
  type: 'v5_graph_patch',
  status: 'applied',
  operation: 'add_constraint',
  target_id: 'fac_cost',
  before: null,
  after: { label, node_id: 'fac_cost', value: 0.1, operator: '<=', value_frame },
}) as never

afterEach(() => cleanup())

describe('the mounted chat receipt never shows a carried level label beside a change or an unread frame', () => {
  it('RED: change_rel — the node name and the change, no "0.1"', () => {
    useCanvasStore.setState({ nodes: NODES, edges: [] } as never)
    const { container } = render(<V5GraphPatchBlock block={patch('change_rel')} />)
    const text = container.textContent ?? ''
    expect(text).toContain('no more than 10% above today')
    expect(text).toContain('Total monthly cloud cost')
    expect(text).not.toMatch(/0\.1|<=/)
  })

  it('RED: an unread frame — no bound, and no carried level label', () => {
    useCanvasStore.setState({ nodes: NODES, edges: [] } as never)
    const { container } = render(<V5GraphPatchBlock block={patch('bogus')} />)
    expect(container.textContent ?? '').not.toMatch(/0\.1|<=/)
  })

  it('RED (PR Review 5882050813): a recognised change_abs with no sayable sentence — the quote, no stale label, no level', () => {
    useCanvasStore.setState({ nodes: NODES, edges: [] } as never)
    const block = {
      type: 'v5_graph_patch', status: 'applied', operation: 'add_constraint', target_id: 'fac_cost', before: null,
      after: { label: 'Cloud cost <= 0.02', node_id: 'fac_cost', operator: '<=', value: 0.02, unit: 'fraction', value_frame: 'change_abs', source_quote: 'within 2 percentage points of today' },
    } as never
    const { container } = render(<V5GraphPatchBlock block={block} />)
    const text = container.textContent ?? ''
    expect(text).toContain('within 2 percentage points of today')
    expect(text).not.toMatch(/0\.02|at most|<=/)
  })

  it('⛔ CONTRAST: a level limit keeps its carried label', () => {
    useCanvasStore.setState({ nodes: NODES, edges: [] } as never)
    const { container } = render(<V5GraphPatchBlock block={patch('level', 'Cloud cost <= 50000')} />)
    expect(container.textContent ?? '').toContain('Cloud cost <= 50000')
  })
})
