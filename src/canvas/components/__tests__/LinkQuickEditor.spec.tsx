/**
 * ⭐ E2 — a link's strength is edited where it is clicked, through the inspector's own band control and writer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { LinkQuickEditor, LinkQuickEditorHost, openLinkQuickEditForClick, useLinkQuickEditStore } from '../LinkQuickEditor'
import { useCanvasStore } from '../../store'

const setStrength = vi.fn()
const setDirection = vi.fn()
let mutationsFor: string | null = null
vi.mock('../../ui/inspector-v2/useInspectorMutations', () => ({ useEdgeMutations: (id: string) => { mutationsFor = id; return { setStrength, setDirection } } }))

function seed(data: Record<string, unknown>) {
  useCanvasStore.setState({
    nodes: [{ id: 'price', data: { label: 'Price' } }, { id: 'churn', data: { label: 'Churn' } }],
    edges: [{ id: 'e1', source: 'price', target: 'churn', data }],
  } as never)
}
const mount = () => render(<LinkQuickEditor edgeId="e1" x={100} y={100} onClose={vi.fn()} onMoreDetail={vi.fn()} />)
beforeEach(() => { setStrength.mockReset(); setDirection.mockReset() })

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

  it('a STRUCTURAL link (decision → option) offers no strength and no direction — only "More detail"', () => {
    useCanvasStore.setState({
      nodes: [{ id: 'dec', type: 'decision', data: { label: 'Should we grow?' } }, { id: 'opt', type: 'option', data: { label: 'Carry on as now' } }],
      edges: [{ id: 'e1', source: 'dec', target: 'opt', data: { weight: 1, strength_mean: 1, direction: 'positive', weightSource: 'cee' } }],
    } as never)
    mount()
    expect(screen.getByTestId('link-quick-editor-structural')).toBeDefined()
    expect(screen.queryByTestId('link-quick-editor-direction')).toBeNull()
    expect(screen.queryAllByRole('button').map((b) => b.textContent)).toEqual(['More detail'])
    expect(setStrength).not.toHaveBeenCalled()
  })

  it('a link with no strength on record says so, and offers no band', () => {
    seed({})
    mount()
    expect(screen.getByTestId('link-quick-editor-no-strength')).toBeDefined()
    expect(screen.queryByTestId('link-quick-editor-direction')).toBeNull()
    expect(setStrength).not.toHaveBeenCalled()
  })

  it('direction goes through the DIRECTION-ONLY writer, even on a zero strength (−0 never carries the sign) — PR Review 5897803345', () => {
    seed({ weight: 0, weightSource: 'user', direction: 'positive', directionSource: 'user' })
    let settle: (s: string) => void = () => {}
    setDirection.mockImplementation((_d: string, opts: { onSendSettled: (s: string) => void }) => { settle = opts.onSendSettled; return 'dispatched' })
    mount()
    expect(screen.getByTestId('link-quick-editor-direction-positive').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTestId('link-quick-editor-direction-positive'))
    expect(setDirection).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('link-quick-editor-direction-negative'))
    expect(setDirection).toHaveBeenCalledTimes(1)
    expect(setDirection.mock.calls[0][0]).toBe('negative')
    expect(setStrength).not.toHaveBeenCalled()
    // Settled, and the store now holds the stated negative → "Saved" and the pressed button follows the store.
    act(() => { useCanvasStore.setState({ edges: [{ id: 'e1', source: 'price', target: 'churn', data: { weight: 0, weightSource: 'user', direction: 'negative', directionSource: 'user' } }] } as never); settle('sent') })
    expect(screen.getByTestId('link-quick-editor-saved')).toBeDefined()
    expect(screen.getByTestId('link-quick-editor-direction-negative').getAttribute('aria-pressed')).toBe('true')
  })

  it('a sent direction the store does NOT hold afterwards is never "Saved"', () => {
    seed({ weight: 0.3, weightSource: 'user', direction: 'positive', directionSource: 'user' })
    let settle: (s: string) => void = () => {}
    setDirection.mockImplementation((_d: string, opts: { onSendSettled: (s: string) => void }) => { settle = opts.onSendSettled; return 'dispatched' })
    mount()
    fireEvent.click(screen.getByTestId('link-quick-editor-direction-negative'))
    act(() => { settle('sent') }) // the store still says positive
    expect(screen.queryByTestId('link-quick-editor-saved')).toBeNull()
    expect(screen.getByTestId('link-quick-editor-settlement')).toBeDefined()
  })

  it('a DEFAULTED direction nobody stated presses neither button', () => {
    seed({ weight: 0.3, weightSource: 'user', direction: 'positive' })
    mount()
    expect(screen.getByTestId('link-quick-editor-direction-positive').getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('link-quick-editor-direction-negative').getAttribute('aria-pressed')).toBe('false')
  })

  it("the producer's explicit `unknown` presses neither button, and choosing one still states it through setDirection", () => {
    seed({ weight: 0.3, weightSource: 'user', direction: 'positive', effect_direction: 'unknown' })
    setDirection.mockReturnValue('dispatched')
    mount()
    expect(screen.getByTestId('link-quick-editor-direction-positive').getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(screen.getByTestId('link-quick-editor-direction-positive'))
    expect(setDirection).toHaveBeenCalledWith('positive', expect.anything())
  })
})

describe('PR Review 5897003679: it edits the link the pointer meant, never the first selected one', () => {
  function seedTwo() {
    // A (Price → Churn) is still selected from an earlier click; B (Price → MRR) is the link the pointer resolved to.
    useCanvasStore.setState({
      nodes: [{ id: 'price', data: { label: 'Price' } }, { id: 'churn', data: { label: 'Churn' } }, { id: 'mrr', data: { label: 'MRR' } }],
      edges: [
        { id: 'A', source: 'price', target: 'churn', selected: true, data: { weight: 0.2, strength_mean: 0.2 } },
        { id: 'B', source: 'price', target: 'mrr', selected: true, data: { weight: 0.3, strength_mean: 0.3 } },
      ],
    } as never)
    useLinkQuickEditStore.getState().close()
  }

  it('a plain click opens the editor for the resolver\'s link: its label names B and its writer is bound to B', () => {
    seedTwo()
    setStrength.mockImplementation(() => 'dispatched')
    expect(openLinkQuickEditForClick({ clientX: 10, clientY: 10 }, 'B', false)).toBe(true)
    render(<LinkQuickEditorHost onMoreDetail={vi.fn()} />)
    const text = screen.getByTestId('link-quick-editor').textContent ?? ''
    expect(text).toContain('Price → MRR')
    expect(text).not.toContain('Churn')
    expect(mutationsFor).toBe('B')
    fireEvent.click(screen.getAllByRole('button').find((b) => /strong/i.test(b.textContent ?? ''))!)
    expect(setStrength).toHaveBeenCalledTimes(1)
    expect(mutationsFor).toBe('B')
  })

  it('a Meta/Control (multi-selection) click, which may be a toggle-OFF, opens no editor', () => {
    seedTwo()
    expect(openLinkQuickEditForClick({ clientX: 10, clientY: 10 }, 'B', true)).toBe(false)
    render(<LinkQuickEditorHost onMoreDetail={vi.fn()} />)
    expect(screen.queryByTestId('link-quick-editor')).toBeNull()
  })

  it('no resolved link (no pointer click) opens nothing', () => {
    seedTwo()
    expect(openLinkQuickEditForClick(undefined, null, false)).toBe(false)
    expect(useLinkQuickEditStore.getState().open).toBeNull()
  })
})

describe('the canvas click handler feeds the editor the resolver\'s return (source check on ReactFlowGraph.handleEdgeClick)', () => {
  const src = readFileSync(join(__dirname, '..', '..', 'ReactFlowGraph.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1')
  const at = src.indexOf('const handleEdgeClick = useCallback(')
  const body = src.slice(at, src.indexOf('}, [', at))
  it('binds `intendedId = retargetEdgeClick(…)` and passes it to openLinkQuickEditForClick', () => {
    expect(at).toBeGreaterThan(-1)
    expect(body).toMatch(/const\s+intendedId\s*=\s*retargetEdgeClick\(/)
    expect(body).toMatch(/openLinkQuickEditForClick\(\s*event\s*,\s*intendedId\s*,/)
  })
  it('never picks the link by "first selected edge"', () => {
    expect(body).not.toMatch(/\.find\(\s*\(?\s*e\s*\)?\s*=>\s*e\.selected\s*\)/)
  })
  it('PR Review 5897538379: a single click never opens the FULL inspector — a multi-select toggle or an unresolved click opens neither editor', () => {
    expect(body).not.toMatch(/setShowFullInspector\(\s*true\s*\)/)
    expect(body).toMatch(/setShowFullInspector\(\s*false\s*\)/)
  })
  it('CONTRAST — the double-click still opens the full inspector (the "More detail" route stays)', () => {
    const d = src.indexOf('const handleEdgeDoubleClick = useCallback(')
    expect(d).toBeGreaterThan(-1)
    expect(src.slice(d, src.indexOf('}, [', d))).toMatch(/setShowFullInspector\(\s*true\s*\)/)
  })
})
