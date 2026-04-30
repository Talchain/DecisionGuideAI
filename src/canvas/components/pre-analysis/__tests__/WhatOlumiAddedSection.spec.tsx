/**
 * Tests for WhatOlumiAddedSection.
 *
 * Critical invariants:
 *  - empty/absent wideningLog → renders nothing (no empty container)
 *  - collapsed by default; body only mounts after expand
 *  - provenance pill is derived ONLY from canvas node lookup, never invented
 *  - rows render even when nodeId is unknown (label is authoritative)
 *  - no raw entity IDs (fac_, opt_, dec_, …) appear in rendered text
 *  - the literal nodeId string never leaks into rendered text
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WhatOlumiAddedSection } from '../WhatOlumiAddedSection'
import { useCanvasStore } from '../../../store'

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    draftCoaching: null,
  })
})

describe('WhatOlumiAddedSection', () => {
  it('renders nothing when draftCoaching is null', () => {
    const { container } = render(<WhatOlumiAddedSection />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when wideningLog is empty', () => {
    useCanvasStore.setState({
      draftCoaching: { summary: null, strengthenItems: [], wideningLog: [], biasSignals: [] },
    })
    const { container } = render(<WhatOlumiAddedSection />)
    expect(container.firstChild).toBeNull()
  })

  it('renders count badge matching wideningLog.length', () => {
    useCanvasStore.setState({
      draftCoaching: {
        summary: null,
        strengthenItems: [],
        wideningLog: [
          { nodeId: 'a', label: 'Adoption rate', reason: 'Brief implied audience growth.' },
          { nodeId: 'b', label: 'Switching cost', reason: 'Material to outcome.' },
          { nodeId: 'c', label: 'Regulatory risk', reason: 'Sector context made this load-bearing.' },
        ],
        biasSignals: [],
      },
    })
    render(<WhatOlumiAddedSection />)
    expect(screen.getByTestId('what-olumi-added-count').textContent).toBe('3')
  })

  it('renders one row per entry with label and reason after expanding', () => {
    useCanvasStore.setState({
      draftCoaching: {
        summary: null,
        strengthenItems: [],
        wideningLog: [
          { nodeId: 'a', label: 'Adoption rate', reason: 'Brief implied audience growth.' },
          { nodeId: 'b', label: 'Switching cost', reason: 'Material to outcome.' },
        ],
        biasSignals: [],
      },
    })
    render(<WhatOlumiAddedSection />)
    fireEvent.click(screen.getByTestId('what-olumi-added-toggle'))

    const rows = screen.getAllByTestId('what-olumi-added-row')
    expect(rows).toHaveLength(2)
    expect(screen.getByText('Adoption rate')).toBeInTheDocument()
    expect(screen.getByText('Brief implied audience growth.')).toBeInTheDocument()
    expect(screen.getByText('Switching cost')).toBeInTheDocument()
    expect(screen.getByText('Material to outcome.')).toBeInTheDocument()
  })

  it('renders the row when nodeId is unknown, omits provenance pill, and never leaks the nodeId string', () => {
    const unknownNodeId = 'fac_unknown_xyz'
    useCanvasStore.setState({
      nodes: [],
      draftCoaching: {
        summary: null,
        strengthenItems: [],
        wideningLog: [
          { nodeId: unknownNodeId, label: 'Adoption rate', reason: 'Sector context made this load-bearing.' },
        ],
        biasSignals: [],
      },
    })
    const { container } = render(<WhatOlumiAddedSection />)
    fireEvent.click(screen.getByTestId('what-olumi-added-toggle'))

    expect(screen.getAllByTestId('what-olumi-added-row')).toHaveLength(1)
    expect(screen.getByText('Adoption rate')).toBeInTheDocument()
    expect(screen.queryByText('From brief')).not.toBeInTheDocument()
    expect(screen.queryByText('AI estimate')).not.toBeInTheDocument()
    expect(container.textContent ?? '').not.toContain(unknownNodeId)
    // Also scan outerHTML to catch leakage in any DOM attribute
    // (aria-label, title, data-* etc.), not just visible text.
    const root = container.firstElementChild
    expect(root?.outerHTML ?? '').not.toContain(unknownNodeId)
  })

  it('shows "From brief" pill when matched node has provenance from_brief', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'price', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price', kind: 'factor', provenance: 'from_brief' } },
      ],
      draftCoaching: {
        summary: null,
        strengthenItems: [],
        wideningLog: [{ nodeId: 'price', label: 'Price sensitivity', reason: 'Drives downstream demand.' }],
        biasSignals: [],
      },
    })
    render(<WhatOlumiAddedSection />)
    fireEvent.click(screen.getByTestId('what-olumi-added-toggle'))
    expect(screen.getByText('From brief')).toBeInTheDocument()
  })

  it('shows "AI estimate" pill when matched node has provenance ai_inferred', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'price', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price', kind: 'factor', provenance: 'ai_inferred' } },
      ],
      draftCoaching: {
        summary: null,
        strengthenItems: [],
        wideningLog: [{ nodeId: 'price', label: 'Price sensitivity', reason: 'Drives downstream demand.' }],
        biasSignals: [],
      },
    })
    render(<WhatOlumiAddedSection />)
    fireEvent.click(screen.getByTestId('what-olumi-added-toggle'))
    expect(screen.getByText('AI estimate')).toBeInTheDocument()
  })

  it('does NOT show a pill when matched node has provenance user_set (no invented provenance)', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'price', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price', kind: 'factor', provenance: 'user_set' } },
      ],
      draftCoaching: {
        summary: null,
        strengthenItems: [],
        wideningLog: [{ nodeId: 'price', label: 'Price sensitivity', reason: 'Drives downstream demand.' }],
        biasSignals: [],
      },
    })
    render(<WhatOlumiAddedSection />)
    fireEvent.click(screen.getByTestId('what-olumi-added-toggle'))
    expect(screen.queryByText('From brief')).not.toBeInTheDocument()
    expect(screen.queryByText('AI estimate')).not.toBeInTheDocument()
  })

  it('is collapsed by default — body is not mounted until toggle is clicked', () => {
    useCanvasStore.setState({
      draftCoaching: {
        summary: null,
        strengthenItems: [],
        wideningLog: [{ nodeId: 'a', label: 'Adoption rate', reason: 'Brief implied audience growth.' }],
        biasSignals: [],
      },
    })
    render(<WhatOlumiAddedSection />)
    expect(screen.queryByTestId('what-olumi-added-body')).not.toBeInTheDocument()
    expect(screen.queryByText('Adoption rate')).not.toBeInTheDocument()
    expect(screen.getByTestId('what-olumi-added-toggle')).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(screen.getByTestId('what-olumi-added-toggle'))
    expect(screen.getByTestId('what-olumi-added-body')).toBeInTheDocument()
    expect(screen.getByText('Adoption rate')).toBeInTheDocument()
    expect(screen.getByTestId('what-olumi-added-toggle')).toHaveAttribute('aria-expanded', 'true')
  })

  it('does NOT render raw entity IDs', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'fac_price', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price', kind: 'factor', provenance: 'from_brief' } },
      ],
      draftCoaching: {
        summary: null,
        strengthenItems: [],
        wideningLog: [{ nodeId: 'fac_price', label: 'Price sensitivity', reason: 'Drives downstream demand.' }],
        biasSignals: [],
      },
    })
    const { container } = render(<WhatOlumiAddedSection />)
    fireEvent.click(screen.getByTestId('what-olumi-added-toggle'))

    const text = container.textContent ?? ''
    expect(text).not.toContain('fac_')
    expect(text).not.toContain('opt_')
    expect(text).not.toContain('out_')
    expect(text).not.toContain('risk_')
    expect(text).not.toContain('goal_')
    expect(text).not.toContain('con_')
  })
})
