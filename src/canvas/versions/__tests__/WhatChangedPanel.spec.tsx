/**
 * What Changed panel — mounted behaviour pinned.
 *
 * ⚠ SCOPE, stated precisely (CLAUDE.md trap #16): jsdom proves PRESENCE and
 * text, never visibility or layout. These tests assert that the panel mounts,
 * that a save round-trips, and that the rendered lines derive from the diff.
 * They are NOT evidence that the panel is visible on a real deployed canvas —
 * that needs a browser witness.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import { WhatChangedPanel } from '../WhatChangedPanel'
import { useCanvasStore } from '../../store'
import type { EdgeData } from '../../domain/edges'

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}))

function rfNode(id: string, label: string, data: Record<string, unknown> = {}): Node {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { label, ...data } } as Node
}

function setGraph(nodes: Node[], edges: Edge<EdgeData>[] = []): void {
  useCanvasStore.setState({ nodes, edges, currentScenarioId: 'local-checkpoint-test' } as never)
}

function saveVersionNamed(name: string): void {
  fireEvent.change(screen.getByLabelText('Checkpoint name'), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: /save checkpoint/i }))
}

beforeEach(() => {
  localStorage.clear()
  setGraph([])
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('WhatChangedPanel', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<WhatChangedPanel isOpen={false} onClose={() => {}} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('mounts when open', () => {
    render(<WhatChangedPanel isOpen onClose={() => {}} />)

    expect(screen.getByTestId('what-changed-panel')).toBeInTheDocument()
  })

  it('invites a first save when no versions exist', () => {
    render(<WhatChangedPanel isOpen onClose={() => {}} />)

    expect(screen.getByText(/no device checkpoints yet/i)).toBeInTheDocument()
  })

  it('states the local-only storage limitation on screen', () => {
    render(<WhatChangedPanel isOpen onClose={() => {}} />)

    expect(screen.getByText(/stored in this browser only/i)).toBeInTheDocument()
    expect(screen.getByText(/not authoritative shared history/i)).toBeInTheDocument()
  })

  it('saves a named version from the current canvas', () => {
    setGraph([rfNode('n1', 'Price')])
    render(<WhatChangedPanel isOpen onClose={() => {}} />)

    saveVersionNamed('Baseline')

    expect(screen.getByText('Baseline')).toBeInTheDocument()
  })

  it('asks for a second version before it will compare', () => {
    setGraph([rfNode('n1', 'Price')])
    render(<WhatChangedPanel isOpen onClose={() => {}} />)

    saveVersionNamed('Baseline')

    expect(screen.getByText(/save a second to compare them/i)).toBeInTheDocument()
  })

  it('renders the changed field between two saved versions', () => {
    setGraph([rfNode('n1', 'Price', { observedState: { value: 0.5 } })])
    render(<WhatChangedPanel isOpen onClose={() => {}} />)
    saveVersionNamed('Baseline')

    setGraph([rfNode('n1', 'Price', { observedState: { value: 0.8 } })])
    saveVersionNamed('After review')

    const list = screen.getByTestId('what-changed-list')
    expect(within(list).getByText('Factor "Price" value 0.5 → 0.8')).toBeInTheDocument()
  })

  it('reports an added node in plain language', () => {
    setGraph([rfNode('n1', 'Price')])
    render(<WhatChangedPanel isOpen onClose={() => {}} />)
    saveVersionNamed('Baseline')

    setGraph([rfNode('n1', 'Price'), rfNode('n2', 'Volume')])
    saveVersionNamed('With volume')

    const list = screen.getByTestId('what-changed-list')
    expect(within(list).getByText('Factor "Volume" added')).toBeInTheDocument()
  })

  it('says so plainly when two versions are identical', () => {
    setGraph([rfNode('n1', 'Price')])
    render(<WhatChangedPanel isOpen onClose={() => {}} />)
    saveVersionNamed('One')
    saveVersionNamed('Two')

    expect(screen.getByText(/no differences between these two checkpoints/i)).toBeInTheDocument()
    expect(screen.queryByTestId('what-changed-list')).not.toBeInTheDocument()
  })

  it('deletes a version on request', () => {
    setGraph([rfNode('n1', 'Price')])
    render(<WhatChangedPanel isOpen onClose={() => {}} />)
    saveVersionNamed('Disposable')

    fireEvent.click(screen.getByRole('button', { name: 'Delete checkpoint Disposable' }))

    expect(screen.queryByText('Disposable')).not.toBeInTheDocument()
    expect(screen.getByText(/no device checkpoints yet/i)).toBeInTheDocument()
  })

  it('surfaces a real save failure instead of pretending it worked', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const error = new Error('quota')
      error.name = 'QuotaExceededError'
      throw error
    })
    setGraph([rfNode('n1', 'Price')])
    render(<WhatChangedPanel isOpen onClose={() => {}} />)

    saveVersionNamed('Doomed')

    expect(screen.getByRole('alert')).toHaveTextContent(/too large to save/i)
    expect(screen.queryByText('Doomed')).not.toBeInTheDocument()
  })

  it('calls onClose from the panel close control', () => {
    const onClose = vi.fn()
    render(<WhatChangedPanel isOpen onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: /close panel/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders no summary or judgement copy anywhere', () => {
    setGraph([rfNode('n1', 'Price', { observedState: { value: 0.5 } })])
    render(<WhatChangedPanel isOpen onClose={() => {}} />)
    saveVersionNamed('Baseline')
    setGraph([rfNode('n1', 'Price', { observedState: { value: 0.8 } })])
    saveVersionNamed('After')

    const text = screen.getByTestId('what-changed-panel').textContent?.toLowerCase() ?? ''
    for (const forbidden of ['significant', 'major change', 'improved', 'weakened', 'stronger model']) {
      expect(text).not.toContain(forbidden)
    }
  })
})
