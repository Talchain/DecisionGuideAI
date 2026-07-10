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

beforeEach(() => {
  focusByTargetMock.mockReset()
  useCanvasStore.setState({
    nodes: [
      { id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor X' } } as any,
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n1' } as any],
  })
})

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: [], edges: [] })
})

describe('TargetRefPill (R1/R3 click-to-focus, fail-closed)', () => {
  it('renders a clickable button when the target node exists; click focuses it', () => {
    render(<TargetRefPill id="n1" label="Factor X" kind="factor" className={PILL_CLASSES} />)
    const btn = screen.getByRole('button', { name: /highlight factor x on the canvas/i })
    expect(btn).toHaveTextContent('Factor X')
    btn.click()
    expect(focusByTargetMock).toHaveBeenCalledWith('n1', 'node')
  })

  it.each(['factor', 'goal', 'option', 'risk', 'outcome'] as const)(
    'collapses non-edge kind %s to node focus',
    (kind) => {
      render(<TargetRefPill id="n1" label="Factor X" kind={kind} className={PILL_CLASSES} />)
      screen.getByRole('button').click()
      expect(focusByTargetMock).toHaveBeenCalledWith('n1', 'node')
    },
  )

  it('routes kind "edge" through edge focus when the edge exists', () => {
    render(<TargetRefPill id="e1" label="Influence" kind="edge" className={PILL_CLASSES} />)
    screen.getByRole('button').click()
    expect(focusByTargetMock).toHaveBeenCalledWith('e1', 'edge')
  })

  it('fails closed to an inert span when the target id is not on the canvas', () => {
    render(<TargetRefPill id="ghost" label="Deleted thing" kind="factor" className={PILL_CLASSES} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    // Label copy still renders verbatim, styling classes intact.
    const pill = screen.getByText('Deleted thing')
    expect(pill.tagName).toBe('SPAN')
    expect(pill).toHaveAttribute('data-ref-id', 'ghost')
    expect(pill).toHaveAttribute('data-ref-kind', 'factor')
    expect(focusByTargetMock).not.toHaveBeenCalled()
  })

  it('existence check is kind-scoped: a node id declared as kind "edge" stays inert', () => {
    render(<TargetRefPill id="n1" label="Mislabelled" kind="edge" className={PILL_CLASSES} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Mislabelled').tagName).toBe('SPAN')
  })

  it('re-resolves at render time: the pill goes inert after the target is removed from the store', () => {
    const { rerender } = render(
      <TargetRefPill id="n1" label="Factor X" kind="factor" className={PILL_CLASSES} />,
    )
    expect(screen.getByRole('button')).toBeInTheDocument()
    useCanvasStore.setState({ nodes: [], edges: [] })
    rerender(<TargetRefPill id="n1" label="Factor X" kind="factor" className={PILL_CLASSES} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Factor X').tagName).toBe('SPAN')
  })

  it('preserves data-ref attributes and the verbatim producer kind on the clickable pill', () => {
    render(<TargetRefPill id="n1" label="Factor X" kind="goal" className={PILL_CLASSES} />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('data-ref-id', 'n1')
    expect(btn).toHaveAttribute('data-ref-kind', 'goal')
    expect(btn).toHaveAttribute('type', 'button')
  })

  it('marks the wrapper as a listitem when role="listitem" is passed (refs containers are role="list")', () => {
    render(
      <div role="list">
        <TargetRefPill id="n1" label="Factor X" kind="factor" className={PILL_CLASSES} role="listitem" />
      </div>,
    )
    const item = screen.getByRole('listitem')
    expect(item).toHaveTextContent('Factor X')
    // The clickable control lives inside the listitem, keeping list semantics valid.
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
