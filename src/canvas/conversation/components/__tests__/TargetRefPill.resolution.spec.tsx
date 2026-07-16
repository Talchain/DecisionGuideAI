/**
 * F4 (16-Jul feedback item 2): the inert-pill remainder.
 *
 * PR #256 shipped click-to-focus for target_refs pills, resolving by exact
 * canvas id only. The ratified string-target rule (exact id, else UNIQUE
 * exact trimmed case-sensitive label, else inert fail-closed) was applied to
 * the R3 proposal badges but never to the contract ref pills themselves, and
 * #256's own report filed "edge-kind refs inert in practice (canvas edge ids
 * never match producer ids)" as an unshipped follow-up.
 *
 * This spec pins the ratified resolution inside TargetRefPill:
 *   - non-edge kinds: exact node id, else UNIQUE exact trimmed
 *     case-sensitive node-label match, else inert.
 *   - edge kind: exact canvas edge id, else UNIQUE producer edge id stashed
 *     on edge.data (edge_id / plot_edge_id / plot_id, the focusModelTarget
 *     and idMapping conventions), else inert. Edge labels are derived
 *     weight/belief text, not identity, so labels never resolve edges.
 *
 * Resolution is render-time (store subscription), matching the reviewed R3
 * rationale: labels drift while blocks sit on screen, and a pill must never
 * point at a guess. Ambiguity always fails closed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'

const { focusByTargetMock } = vi.hoisted(() => ({ focusByTargetMock: vi.fn() }))
vi.mock('../../../utils/focusHelpers', () => ({
  focusByTarget: focusByTargetMock,
}))

import { TargetRefPill } from '../TargetRefPill'
import { useCanvasStore } from '../../../store'

const PILL_CLASSES =
  'inline-flex items-center rounded-full px-2.5 py-0.5 bg-transparent border border-panel-border text-text-body'

function node(id: string, label: string) {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { label } } as any
}

beforeEach(() => {
  focusByTargetMock.mockReset()
  useCanvasStore.setState({ nodes: [], edges: [] })
})

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: [], edges: [] })
})

describe('TargetRefPill node-label resolution (ratified rule leg 2)', () => {
  it('positive control: an exact-id ref is clickable and focuses that id', () => {
    useCanvasStore.setState({ nodes: [node('n1', 'Conversion Rate')], edges: [] })
    render(
      <TargetRefPill id="n1" label="Conversion Rate" kind="factor" className={PILL_CLASSES} />,
    )
    screen.getByRole('button').click()
    expect(focusByTargetMock).toHaveBeenCalledWith('n1', 'node')
  })

  it('resolves an unknown id via a UNIQUE exact label match and focuses the RESOLVED canvas id', () => {
    useCanvasStore.setState({
      nodes: [node('n1', 'Conversion Rate'), node('n2', 'Churn')],
      edges: [],
    })
    render(
      <TargetRefPill
        id="fac_conversion_rate"
        label="Conversion Rate"
        kind="factor"
        className={PILL_CLASSES}
      />,
    )
    const btn = screen.getByRole('button', { name: /highlight conversion rate on the canvas/i })
    // Producer identity is preserved for diagnostics; the resolved canvas id
    // is exposed alongside it.
    expect(btn).toHaveAttribute('data-ref-id', 'fac_conversion_rate')
    expect(btn).toHaveAttribute('data-resolved-id', 'n1')
    btn.click()
    expect(focusByTargetMock).toHaveBeenCalledWith('n1', 'node')
  })

  it('label matching is trimmed on both sides', () => {
    useCanvasStore.setState({ nodes: [node('n1', '  Conversion Rate ')], edges: [] })
    render(
      <TargetRefPill
        id="fac_conversion_rate"
        label="Conversion Rate  "
        kind="factor"
        className={PILL_CLASSES}
      />,
    )
    screen.getByRole('button').click()
    expect(focusByTargetMock).toHaveBeenCalledWith('n1', 'node')
  })

  it('an AMBIGUOUS label (two nodes share it) stays inert, fail-closed', () => {
    useCanvasStore.setState({
      nodes: [node('n1', 'Conversion Rate'), node('n2', 'Conversion Rate')],
      edges: [],
    })
    render(
      <TargetRefPill
        id="fac_conversion_rate"
        label="Conversion Rate"
        kind="factor"
        className={PILL_CLASSES}
      />,
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Conversion Rate').tagName).toBe('SPAN')
    expect(focusByTargetMock).not.toHaveBeenCalled()
  })

  it('label matching is case-sensitive: a case-differing label stays inert', () => {
    useCanvasStore.setState({ nodes: [node('n1', 'conversion rate')], edges: [] })
    render(
      <TargetRefPill
        id="fac_conversion_rate"
        label="Conversion Rate"
        kind="factor"
        className={PILL_CLASSES}
      />,
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Conversion Rate').tagName).toBe('SPAN')
  })

  it('an unknown id with no label match stays inert', () => {
    useCanvasStore.setState({ nodes: [node('n1', 'Churn')], edges: [] })
    render(
      <TargetRefPill id="ghost" label="Deleted thing" kind="factor" className={PILL_CLASSES} />,
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Deleted thing').tagName).toBe('SPAN')
  })

  it('re-resolves at render time: a label-resolved pill goes inert after the node is renamed', () => {
    useCanvasStore.setState({ nodes: [node('n1', 'Conversion Rate')], edges: [] })
    const { rerender } = render(
      <TargetRefPill
        id="fac_conversion_rate"
        label="Conversion Rate"
        kind="factor"
        className={PILL_CLASSES}
      />,
    )
    expect(screen.getByRole('button')).toBeInTheDocument()
    useCanvasStore.setState({ nodes: [node('n1', 'Renamed Factor')], edges: [] })
    rerender(
      <TargetRefPill
        id="fac_conversion_rate"
        label="Conversion Rate"
        kind="factor"
        className={PILL_CLASSES}
      />,
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Conversion Rate').tagName).toBe('SPAN')
  })
})

describe('TargetRefPill edge producer-id resolution (the #256 filed follow-up)', () => {
  it('positive control: an exact canvas edge id is clickable', () => {
    useCanvasStore.setState({
      nodes: [],
      edges: [{ id: 'e1', source: 'a', target: 'b' } as any],
    })
    render(<TargetRefPill id="e1" label="Influence" kind="edge" className={PILL_CLASSES} />)
    screen.getByRole('button').click()
    expect(focusByTargetMock).toHaveBeenCalledWith('e1', 'edge')
  })

  it.each(['edge_id', 'plot_edge_id', 'plot_id'] as const)(
    'resolves a producer edge id stashed on edge.data.%s to the canvas edge id',
    (dataKey) => {
      useCanvasStore.setState({
        nodes: [],
        edges: [
          { id: 'e-0', source: 'a', target: 'b', data: { [dataKey]: 'price::demand::0' } } as any,
        ],
      })
      render(
        <TargetRefPill
          id="price::demand::0"
          label="Price to Demand"
          kind="edge"
          className={PILL_CLASSES}
        />,
      )
      const btn = screen.getByRole('button')
      expect(btn).toHaveAttribute('data-ref-id', 'price::demand::0')
      expect(btn).toHaveAttribute('data-resolved-id', 'e-0')
      btn.click()
      expect(focusByTargetMock).toHaveBeenCalledWith('e-0', 'edge')
    },
  )

  it('an AMBIGUOUS producer edge id (two edges claim it) stays inert, fail-closed', () => {
    useCanvasStore.setState({
      nodes: [],
      edges: [
        { id: 'e-0', source: 'a', target: 'b', data: { edge_id: 'dup' } } as any,
        { id: 'e-1', source: 'b', target: 'c', data: { edge_id: 'dup' } } as any,
      ],
    })
    render(<TargetRefPill id="dup" label="Duplicated" kind="edge" className={PILL_CLASSES} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Duplicated').tagName).toBe('SPAN')
    expect(focusByTargetMock).not.toHaveBeenCalled()
  })

  it('edge refs never resolve by label (derived weight text is not identity)', () => {
    useCanvasStore.setState({
      nodes: [node('n1', 'Influence')],
      edges: [{ id: 'e1', source: 'a', target: 'b', label: 'Influence' } as any],
    })
    render(<TargetRefPill id="ghost" label="Influence" kind="edge" className={PILL_CLASSES} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Influence').tagName).toBe('SPAN')
  })

  it('kind scoping still holds: a node-kind ref never resolves against edges', () => {
    useCanvasStore.setState({
      nodes: [],
      edges: [{ id: 'shared', source: 'a', target: 'b' } as any],
    })
    render(<TargetRefPill id="shared" label="Mislabelled" kind="factor" className={PILL_CLASSES} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Mislabelled').tagName).toBe('SPAN')
  })
})
