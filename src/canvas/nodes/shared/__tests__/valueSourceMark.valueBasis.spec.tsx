/**
 * A FIGURE THE MODEL SETS SAYS SO, IN CEE'S WORDS (S3 #3709, 23 Oct). CEE stamps `value_basis` on a figure no person
 * or brief authored: worked out from other figures, fixed by how the model is built, or waiting for the person's
 * answer. The card's source mark, the factor's popover line and the inspector said "Source not recorded" for all three.
 * They now read CEE's words, verbatim, only where no author stamp exists (a person's figure still says it is theirs).
 * Fixtures: CEE's served program reads (S3 smoke-alpha3, the real read route), nodes through the real
 * `mapDraftNodeToCanvas`. Expected words are spelt inline.
 */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { factorValueSourceMark, ValueSourceMark } from '../valueSourceMark'
import { factorValueSourceLabel } from '../../../ui/inspector-v2/inspectorStrings'
import { mapDraftNodeToCanvas } from '../../../utils/applyDraftResult'
import capacity from '../../../runView/__tests__/fixtures/alpha3-capacity-r1-read.json'
import hiring from '../../../runView/__tests__/fixtures/alpha3-hiring-r1-read.json'

vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual('@xyflow/react')), Handle: () => null }))
vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) => selector({
    results: { status: 'idle', report: null }, highlightedNodes: new Set(), dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set() }, goalThreshold: null, goalConstraints: [], edges: [], nodes: [], viewMode: 'expert',
  })),
}))
import { OutcomeNode } from '../../OutcomeNode'

afterEach(cleanup)

type Wire = { id: string }
const dataOf = (read: { graph: { nodes: Wire[] } }, id: string) => mapDraftNodeToCanvas(read.graph.nodes.find(n => n.id === id)).data
const WORKED_OUT = 'Worked out from Additional specialists and Weekly capacity per additional specialist'

describe('the source mark reads CEE’s value_basis', () => {
  it('a worked-out figure: the model mark, with CEE’s words', () => {
    expect(factorValueSourceMark(dataOf(capacity, 'additional_capacity'))).toEqual({ kind: 'basis', label: WORKED_OUT })
  })
  it('a figure fixed by how the model is built: the model mark, with CEE’s words', () => {
    expect(factorValueSourceMark(dataOf(hiring, 'developers_hired'))).toEqual({ kind: 'basis', label: 'Fixed by how the model is built' })
  })
  it('a figure waiting for the person’s answer: the asked mark, with CEE’s words', () => {
    expect(factorValueSourceMark(dataOf(hiring, 'developer_hiring_cost'))).toEqual({ kind: 'asked', label: 'Waiting for your answer' })
  })
  it('the inspector’s source line says the same words', () => {
    expect(factorValueSourceLabel(dataOf(capacity, 'additional_capacity'))).toBe(WORKED_OUT)
    expect(factorValueSourceLabel(dataOf(hiring, 'developer_hiring_cost'))).toBe('Waiting for your answer')
  })

  it('CONTRAST: a brief figure keeps its brief mark', () => {
    expect(factorValueSourceMark(dataOf(capacity, 'existing_capacity'))).toEqual({ kind: 'brief', label: 'From your brief' })
  })
  it('CONTRAST: a person’s own figure outranks the basis (the answered ask is theirs)', () => {
    const data = dataOf(hiring, 'developer_hiring_cost')
    expect(factorValueSourceMark({ ...data, observedState: { value: 40000, raw_value: 40000, unit: '£', source: 'user_override' } })?.kind).toBe('you')
  })
  it('CONTRAST: no value_basis, or one of a kind this UI does not know, stays "Source not recorded"', () => {
    const { value_basis: _dropped, ...without } = dataOf(hiring, 'developers_hired') as Record<string, unknown>
    expect(factorValueSourceMark(without)).toEqual({ kind: 'unknown', label: 'Source not recorded' })
    expect(factorValueSourceMark({ ...without, value_basis: { kind: 'guessed', words: 'Guessed' } })).toEqual({ kind: 'unknown', label: 'Source not recorded' })
  })
})

describe('the marks on screen', () => {
  it('the model mark draws its own glyph and names itself with CEE’s words', () => {
    render(<ValueSourceMark mark={{ kind: 'basis', label: WORKED_OUT }} testId="source" />)
    expect(screen.getByTestId('source')).toHaveAttribute('aria-label', WORKED_OUT)
    expect(screen.getByTestId('source').querySelector('.lucide-calculator')).not.toBeNull()
    expect(screen.getByTestId('source').querySelector('.lucide-help-circle')).toBeNull()
  })
  it('the asked mark draws its own glyph and names itself with CEE’s words', () => {
    render(<ValueSourceMark mark={{ kind: 'asked', label: 'Waiting for your answer' }} testId="source" />)
    expect(screen.getByTestId('source')).toHaveAttribute('aria-label', 'Waiting for your answer')
    expect(screen.getByTestId('source').querySelector('.lucide-hourglass')).not.toBeNull()
  })
  it('the worked-out outcome card: CEE’s words on its source mark, never "Source not recorded"', () => {
    const props: Record<string, unknown> = { id: 'additional_capacity', type: 'outcome', position: { x: 0, y: 0 }, selected: false,
      isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0, data: dataOf(capacity, 'additional_capacity') }
    const { container } = render(<ReactFlowProvider><OutcomeNode {...(props as any)} /></ReactFlowProvider>)
    const mark = screen.getByTestId('outcome-value-source-additional_capacity')
    expect(mark).toHaveAttribute('aria-label', WORKED_OUT)
    expect(mark.querySelector('.lucide-calculator')).not.toBeNull()
    expect(container.textContent).not.toContain('Source not recorded')
  })
})
