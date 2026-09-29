/**
 * ⭐ E2 — a link's strength is edited where it is clicked, through the inspector's own band control and writer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { LinkQuickEditor } from '../LinkQuickEditor'
import { useCanvasStore } from '../../store'

const setStrength = vi.fn()
vi.mock('../../ui/inspector-v2/useInspectorMutations', () => ({ useEdgeMutations: () => ({ setStrength }) }))

function seed(data: Record<string, unknown>) {
  useCanvasStore.setState({
    nodes: [{ id: 'price', data: { label: 'Price' } }, { id: 'churn', data: { label: 'Churn' } }],
    edges: [{ id: 'e1', source: 'price', target: 'churn', data }],
  } as never)
}
const mount = () => render(<LinkQuickEditor edgeId="e1" x={100} y={100} onClose={vi.fn()} onMoreDetail={vi.fn()} />)
beforeEach(() => { setStrength.mockReset() })

describe('the link mini-editor', () => {
  it('names the link and sets its strength through setStrength (preserving direction); "Saved" only once the store holds it', () => {
    seed({ weight: 0.2, strength_mean: 0.2, direction: 'positive' })
    let settle: (s: string) => void = () => {}
    setStrength.mockImplementation((_v: number, opts: { onSendSettled: (s: string) => void }) => { settle = opts.onSendSettled; return 'dispatched' })
    mount()
    expect(screen.getByTestId('link-quick-editor').textContent).toContain('Price → Churn')
    const band = screen.getAllByRole('button').find((b) => /strong/i.test(b.textContent ?? ''))!
    fireEvent.click(band)
    expect(setStrength).toHaveBeenCalledTimes(1)
    expect(setStrength.mock.calls[0][1]).toMatchObject({ preserveDirection: true })
    const v = setStrength.mock.calls[0][0] as number
    expect(screen.getByTestId('link-quick-editor-settlement').textContent).toBe('Saving…')
    act(() => { useCanvasStore.setState({ edges: [{ id: 'e1', source: 'price', target: 'churn', data: { weight: Math.abs(v), strength_mean: v, direction: 'positive' } }] } as never); settle('sent') })
    expect(screen.getByTestId('link-quick-editor-saved')).toBeDefined()
  })

  it('a link with no strength on record says so, and offers no band', () => {
    seed({})
    mount()
    expect(screen.getByTestId('link-quick-editor-no-strength')).toBeDefined()
    expect(setStrength).not.toHaveBeenCalled()
  })
})
