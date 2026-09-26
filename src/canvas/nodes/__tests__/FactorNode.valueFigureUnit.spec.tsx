/**
 * GAP 14 (value half) — contract §02 on the resting factor card:
 *
 *   .node .own-value strong{font-weight:610}
 *   .node .own-value span{font-size:11px;color:var(--muted)}
 *
 * The figure is a `<strong>` at weight 610; its unit word is a SEPARATE
 * smaller (11px value-scale token), muted, regular-weight span. The figure stays
 * at the 14px value token by the Canvas lead's standing ruling (DS 14px minimum
 * over the contract's 13px).
 *
 * ⭐ BOUND BY IDENTITY: the figure and unit are found by their own test ids ON
 * THIS NODE (`factor-value-figure-{id}` / `factor-value-unit-{id}`), inside the
 * exact affordance that renders them (the inline editor's button for a
 * controllable factor, the read-only span for an observable one), and the host's
 * visible text is asserted to equal `factorDisplayText` byte for byte.
 *
 * CONTRASTS that must stay unchanged: a producer `display_value` renders as one
 * string with no figure markup; #1977's settlement words never become bold; the
 * weight never moves onto the shared `typography.nodeValue`.
 *
 * CLAIM SCOPE: jsdom — DOM structure and class tokens, not rendered pixels.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { typography } from '../../../styles/typography'
import { factorDisplayText } from '../../../utils/formatFactorDisplayValue'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) =>
    selector({
      hoveredOptionId: null, nodes: [], edges: [], ceeAnalysisReady: null,
      results: { status: 'idle', report: null }, highlightedNodes: new Set(),
      dimmedNodeIds: new Set(), goalThreshold: null, goalConstraints: [],
      viewMode: 'standard',
    })
  ),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))

vi.mock('../../hooks/useModelEditAuthority', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useModelEditAuthority')>()
  return {
    ...actual,
    // Dispatched and never settled: the card must say "Saving…".
    useModelEditAuthority: () => new Proxy({}, {
      get: (_t, key) => key === 'proposeFactorValue' ? () => 'dispatched' : () => undefined,
    }),
  }
})

const ID = 'fac_customers'
const baseProps = {
  id: ID, type: 'factor', position: { x: 0, y: 0 }, selected: false,
  isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
  dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true,
}

const renderFactor = (data: Record<string, unknown>) =>
  render(
    <ReactFlowProvider>
      <FactorNode {...baseProps} data={data} />
    </ReactFlowProvider>,
  )

const tokens = (el: Element) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))
const byId = (c: HTMLElement, id: string) => c.querySelector<HTMLElement>(`[data-testid="${id}"]`)

const CUSTOMERS = {
  label: 'Customers', kind: 'factor', category: 'controllable',
  observedState: { value: 0.6, raw_value: 1200, cap: 2000, unit: 'customers', source: 'user_override' },
}

beforeEach(() => { cleanup() })

describe('contract §02: the resting value is a figure, and its unit is a separate quieter span', () => {
  it('⭐ editable (controllable) card: <strong> figure at 610, unit in its own 11px muted regular span, text byte-identical', () => {
    const { container } = renderFactor(CUSTOMERS)
    const button = byId(container, `node-value-editor-${ID}`)
    expect(button, 'precondition: a controllable factor rests in the inline editor').not.toBeNull()
    const figure = byId(container, `factor-value-figure-${ID}`)
    const unit = byId(container, `factor-value-unit-${ID}`)
    expect(figure, 'the figure is its own element').not.toBeNull()
    expect(unit, 'the unit is its own element').not.toBeNull()
    expect(button!.contains(figure!) && button!.contains(unit!), 'both live in the editor\'s resting readout').toBe(true)

    expect(figure!.tagName).toBe('STRONG')
    expect(figure!.textContent).toBe('1,200')
    expect(tokens(figure!).has('font-[610]')).toBe(true)

    expect(unit!.tagName).toBe('SPAN')
    expect(unit!.textContent).toBe('customers')
    const u = tokens(unit!)
    for (const t of typography.edgeLabel.split(/\s+/)) expect(u.has(t), `unit wears the 11px canvas token (${t})`).toBe(true)
    expect(u.has('font-normal'), 'unit is regular weight, not the row\'s 500').toBe(true)
    expect(u.has('text-text-light'), 'unit is the muted ink').toBe(true)
    expect(unit!.closest('strong'), 'the unit is not inside the figure').toBeNull()

    // Visible text is exactly what every other surface reads.
    expect(button!.textContent).toBe('1,200 customers')
    expect(button!.textContent).toBe(factorDisplayText(CUSTOMERS))
  })

  it('⭐ read-only (observable) card: the same split in the plain span', () => {
    const data = { ...CUSTOMERS, category: 'observable' }
    const { container } = renderFactor(data)
    expect(byId(container, `node-value-editor-${ID}`), 'precondition: an observable factor is read-only').toBeNull()
    const row = byId(container, 'factor-recorded-value')!
    const figure = byId(container, `factor-value-figure-${ID}`)
    const unit = byId(container, `factor-value-unit-${ID}`)
    expect(figure?.tagName).toBe('STRONG')
    expect(tokens(figure!).has('font-[610]')).toBe(true)
    expect(unit?.textContent).toBe('customers')
    expect(row.contains(figure!) && row.contains(unit!)).toBe(true)
    // The host span reads the full value with its unit.
    expect(figure!.parentElement!.textContent).toBe('1,200 customers')
    expect(figure!.parentElement!.textContent).toBe(factorDisplayText(data))
  })

  it('a currency value is ONE figure: "£49" in the <strong>, no unit span', () => {
    const data = { ...CUSTOMERS, label: 'Monthly price', observedState: { value: 0.245, raw_value: 49, cap: 200, unit: '£' } }
    const { container } = renderFactor(data)
    const figure = byId(container, `factor-value-figure-${ID}`)
    expect(figure?.tagName).toBe('STRONG')
    expect(figure!.textContent).toBe('£49')
    expect(byId(container, `factor-value-unit-${ID}`)).toBeNull()
    expect(byId(container, `node-value-editor-${ID}`)!.textContent).toBe('£49')
  })

  it('⛔ CONTRAST: a producer display_value renders as ONE unchanged string — no figure/unit split; ONE whole <strong> (v3.1 #35)', () => {
    const data = {
      label: 'Demand', kind: 'factor', category: 'controllable',
      display_value: '1,200 enterprise customers',
      observedState: { value: 0.5 },
    }
    const { container } = renderFactor(data)
    const button = byId(container, `node-value-editor-${ID}`)
    expect(button, 'precondition: the editor renders the producer string').not.toBeNull()
    expect(byId(container, `factor-value-figure-${ID}`)).toBeNull()
    expect(byId(container, `factor-value-unit-${ID}`)).toBeNull()
    // Contract v3.1 #35: EVERY value carries the `.own-value strong` weight
    // (610) — the producer's string too — but as ONE element holding the
    // unchanged string, never split into a figure and a unit.
    const strongs = button!.querySelectorAll('strong')
    expect(strongs).toHaveLength(1)
    expect(strongs[0].getAttribute('data-testid')).toBe(`factor-value-whole-${ID}`)
    expect(strongs[0].textContent).toBe('1,200 enterprise customers')
    expect(button!.textContent).toBe('1,200 enterprise customers')
  })

  it('⛔ CONTRAST: the weight is on the figure only — never on the shared value token or the row', () => {
    const { container } = renderFactor(CUSTOMERS)
    expect(typography.nodeValue).not.toMatch(/610/)
    expect(typography.nodeValue).toContain('font-medium')
    const row = byId(container, 'factor-recorded-value')!
    expect(tokens(row).has('font-[610]')).toBe(false)
    expect(tokens(byId(container, `node-value-editor-${ID}`)!).has('font-[610]')).toBe(false)
  })

  it('⛔ CONTRAST: #1977\'s settlement word ("Saving…") does not become bold', () => {
    const { container } = renderFactor(CUSTOMERS)
    fireEvent.click(byId(container, `node-value-editor-${ID}`)!)
    const input = byId(container, `node-value-editor-${ID}-input`) as HTMLInputElement
    fireEvent.change(input, { target: { value: '1500' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    const word = byId(container, `node-value-editor-${ID}-settlement`)
    expect(word?.textContent).toBe('Saving…')
    expect(tokens(word!).has('font-[610]')).toBe(false)
    expect(word!.querySelector('strong')).toBeNull()
    expect(word!.closest('strong')).toBeNull()
    // …while the figure beside it keeps its weight.
    expect(tokens(byId(container, `factor-value-figure-${ID}`)!).has('font-[610]')).toBe(true)
  })

  it('the editor\'s accessible name is unchanged, and the figure/unit are not hidden from assistive tech', () => {
    const { container } = renderFactor(CUSTOMERS)
    const button = byId(container, `node-value-editor-${ID}`)!
    expect(button.getAttribute('aria-label')).toBe('Value for Customers — click to edit')
    expect(button.getAttribute('title')).toBe('Click to edit')
    for (const id of [`factor-value-figure-${ID}`, `factor-value-unit-${ID}`]) {
      expect(byId(container, id)!.closest('[aria-hidden="true"]'), id).toBeNull()
    }
  })
})
