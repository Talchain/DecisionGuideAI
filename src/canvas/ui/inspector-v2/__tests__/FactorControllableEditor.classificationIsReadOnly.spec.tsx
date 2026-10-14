/**
 * The Category and Factor type of a controllable factor are SHOWN, never edited, in the Inspector.
 *
 * The selects changed the canvas and never the model: `setCategory` / `setFactorType` write the local store only,
 * nothing reaches CEE, and a signed-in session saves layout only (`store/scenarios.ts`, thin client). The change sat
 * on the canvas until a reload silently undid it (DL ruling, 8 Oct). The observable and external editors already
 * show Category read-only; this editor now matches them.
 *
 * Contrast row: the rest of the technical editor is untouched (Extraction type is still a select).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { FactorControllableEditor } from '../editors/FactorControllableEditor'
import { useCanvasStore } from '../../../store'
import type { Node } from '@xyflow/react'

function seed(data: Record<string, unknown>) {
  const factor: Node = { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price', ...data } }
  useCanvasStore.setState({ nodes: [factor], edges: [], results: { status: 'idle', report: null } } as any, false)
}

beforeEach(() => {
  cleanup()
})

describe('FactorControllableEditor: classification is read-only', () => {
  it('shows the stored category and factor type as text, with no control that edits either', () => {
    seed({ category: 'external', factor_type: 'cost' })
    render(<FactorControllableEditor nodeId="f1" />)

    expect(screen.queryByLabelText('Category')).toBeNull()
    expect(screen.queryByLabelText('Factor type')).toBeNull()
    expect(screen.getByText('Category').nextElementSibling?.textContent).toBe('External')
    expect(screen.getByText('Factor type').nextElementSibling?.textContent).toBe('Cost')
  })

  it('an unclassified factor shows no category, rather than an assumed "Controllable"', () => {
    seed({})
    render(<FactorControllableEditor nodeId="f1" />)

    expect(screen.queryByText('Category')).toBeNull()
    expect(screen.queryByText('Controllable')).toBeNull()
    expect(screen.queryByText('Factor type')).toBeNull()
  })

  it('contrast: Extraction type is still an editable select', () => {
    seed({ category: 'controllable' })
    render(<FactorControllableEditor nodeId="f1" />)

    expect(screen.getByLabelText('Extraction type').tagName).toBe('SELECT')
  })
})
