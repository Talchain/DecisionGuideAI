/**
 * v10 (#/canvas2): Paul's two 24 Oct rulings, and #/canvas unchanged.
 *
 *   1. Nothing dims. Under v10 a card the Changes view would subdue, or a selection or lens would dim, stays at full
 *      strength. The same store in the current design still dims (the contrast).
 *   2. Blue means Olumi only. The person's primary buttons resolve to ink #262626 (hover #3F3F3E, disabled the 35% look, solid) inside
 *      a v10 subtree; the same markup outside it is untouched, and Olumi's own info elements are not matched.
 */
import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPortal } from 'react-dom'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { MemoryRouter } from 'react-router-dom'
import { DecisionNode } from '../../canvas/nodes/DecisionNode'
import { PresentationProvider } from '../v10'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  edges: [],
  nodes: [],
  results: { status: 'complete', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  ceeAnalysisReady: null,
  lodRung: 'full',
  viewMode: 'expert',
  ...overrides,
})

vi.mock('../../canvas/store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))
vi.mock('../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../flags')>()),
  isGraphLensEnabled: () => true,
}))
vi.mock('../../canvas/hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
    achievementProbability: null, stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))
vi.mock('../../canvas/nodes/shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { useCanvasStore } from '../../canvas/store'

const props = {
  id: 'decision-1', type: 'decision', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
  data: { label: 'Should we hire?', type: 'decision' },
}

const renderCard = (state: Record<string, unknown>, presentation: 'current' | 'v10') => {
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState(state) as never))
  return render(
    <MemoryRouter>
      <PresentationProvider value={presentation}>
        <ReactFlowProvider>
          <DecisionNode {...(props as unknown as React.ComponentProps<typeof DecisionNode>)} />
        </ReactFlowProvider>
      </PresentationProvider>
    </MemoryRouter>,
  )
}
const card = () => screen.getByRole('group', { name: /^Question:/i })
const DIM = /(^|\s)opacity-(20|25|30)(\s|$)/

// The three dims BaseNode can wear, each with the state that drives it.
const DIMS: Array<[string, Record<string, unknown>]> = [
  ['the Changes view subdues a card nothing happened to', {
    analysisHighlight: {
      source: 'run_changes', nodeIds: new Set(['other-node']), edgeIds: new Set(),
      nodeMarks: new Map([['other-node', 'moved']]), edgeMarks: new Map(),
    },
  }],
  ['a selection or focus dims a card (dimmedNodeIds)', { dimmedNodeIds: new Set(['decision-1']) }],
  ['a lens sets a card aside (lens._dimmedNodeIds)', {
    lens: { _dimmedNodeIds: new Set(['decision-1']), _hiddenNodeIds: new Set(), active: 'tradeoffs' },
  }],
]

describe('v10 ruling 1: nothing dims', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(cleanup)

  for (const [name, state] of DIMS) {
    it(`CONTRAST (current design): ${name}, so the card is below full strength`, () => {
      renderCard(state, 'current')
      expect(card().className).toMatch(DIM)
    })
    it(`v10: ${name}, and the card stays at full strength`, () => {
      renderCard(state, 'v10')
      expect(card().className).not.toMatch(DIM)
      expect(card().getAttribute('data-run-change-subdued')).toBeNull()
    })
  }

  it('v10 keeps the emphasis: the card a change landed on still carries its outline and its word', () => {
    renderCard({
      analysisHighlight: {
        source: 'run_changes', nodeIds: new Set(['decision-1']), edgeIds: new Set(),
        nodeMarks: new Map([['decision-1', 'changed']]), edgeMarks: new Map(),
      },
    }, 'v10')
    expect(card().getAttribute('data-run-change')).toBe('changed')
    expect(card().style.outline).toContain('var(--semantic-info)')
    expect(screen.getByTestId('run-change-badge-decision-1')).toBeInTheDocument()
  })
})

// ── CSS: the v10 sheet, applied to real markup in jsdom ──────────────────────────────────────────────────────────
const CSS = readFileSync(resolve(__dirname, '../v10.css'), 'utf8')
const INK = 'rgb(38, 38, 38)'
const INK_HOVER = 'rgb(63, 63, 62)'

describe('v10 ruling 2: blue means Olumi only', () => {
  let sheet: HTMLStyleElement
  beforeEach(() => {
    // The classes a real Tailwind build would emit for the primary recipe, BEFORE the v10 sheet (as in the app).
    sheet = document.createElement('style')
    sheet.textContent = `.bg-primary{background-color:rgb(39,122,157)} .bg-info{background-color:rgb(39,122,157)} ${CSS}`
    document.head.appendChild(sheet)
  })
  afterEach(() => { sheet.remove(); document.body.innerHTML = '' })

  const mount = (inner: string, scope: 'v10' | 'current') => {
    document.body.innerHTML = `<div data-presentation="${scope}">${inner}</div>`
    return document.body.querySelector('button, span') as HTMLElement
  }
  const bg = (el: Element) => getComputedStyle(el).backgroundColor

  const rules = () => Array.from(sheet.sheet!.cssRules).filter((r): r is CSSStyleRule => 'selectorText' in r)
    .filter((r) => r.selectorText.includes('data-presentation'))

  it('the v10 sheet is scoped: every selector starts at [data-presentation="v10"], so #/canvas cannot match', () => {
    const selectors = rules().flatMap((r) => r.selectorText.split(/,\s*(?=\[data-presentation)/))
    expect(selectors.length).toBeGreaterThan(8)
    for (const sel of selectors) expect(sel.trim().startsWith('[data-presentation="v10"]'), sel).toBe(true)
  })

  /** jsdom lets inline style beat !important, so for inline-painted markup assert the rule matches AND is !important. */
  const importantRule = (el: Element, prop: string, value: string) =>
    rules().some((r) => el.matches(r.selectorText) && r.style.getPropertyValue(prop) === value
      && r.style.getPropertyPriority(prop) === 'important')

  it.each([
    ['the Button primary variant', '<button class="bg-primary text-text-on-color">Run analysis</button>'],
    ['a filled-info recipe', '<button class="bg-info-600 text-text-on-color">Save</button>'],
  ])('%s is ink inside a v10 subtree', (_n, html) => {
    expect(bg(mount(html, 'v10'))).toBe(INK)
  })

  it('the composer send button, painted inline with var(--primary), is overridden to ink (and #3F3F3E on hover)', () => {
    const send = mount('<button class="send-btn" style="background: var(--primary, #277A9D)">Send</button>', 'v10')
    expect(importantRule(send, 'background-color', '#262626')).toBe(true)
    const hover = rules().find((r) => r.selectorText.includes('.send-btn:not(:disabled):hover'))
    expect(hover?.style.getPropertyValue('background-color')).toBe('#3F3F3E')
    expect(hover?.style.getPropertyPriority('background-color')).toBe('important')
    const outside = mount('<button class="send-btn" style="background: var(--primary, #277A9D)">Send</button>', 'current')
    expect(importantRule(outside, 'background-color', '#262626')).toBe(false)
  })

  it('the disabled send button is the 35% ink look as one solid colour (nothing faded at rest, 9 Nov audit) with a white arrow', () => {
    const send = mount('<button class="send-btn" disabled><svg></svg></button>', 'v10')
    expect(importantRule(send, 'background-color', '#B3B3B3')).toBe(true)
    expect(getComputedStyle(send).opacity).toBe('1')
    expect(importantRule(send.querySelector('svg')!, 'stroke', '#fff')).toBe(true)
  })

  it('CONTRAST: the same markup outside v10 keeps the primary colour', () => {
    expect(bg(mount('<button class="bg-primary">Run analysis</button>', 'current'))).toBe('rgb(39, 122, 157)')
  })

  it('Olumi stays blue: a bg-info mark that is not a button is not matched', () => {
    expect(bg(mount('<span class="bg-info">mark</span>', 'v10'))).toBe('rgb(39, 122, 157)')
  })

  it('hover is #3F3F3E and disabled is the 35% ink look, solid (opacity 1)', () => {
    expect(CSS).toMatch(/:hover:not\(:disabled\)[\s\S]*?background-color:\s*#3F3F3E/i)
    const el = mount('<button class="bg-primary" disabled>Save</button>', 'v10')
    expect(bg(el)).toBe('rgb(179, 179, 179)')
    expect(getComputedStyle(el).opacity).toBe('1')
    expect(bg(mount('<button class="bg-primary">Save</button>', 'v10'))).toBe(INK) // contrast: enabled stays ink
    expect(INK_HOVER).toBe('rgb(63, 63, 62)')
  })

  it('the dim markers are neutralised in v10 (backstop for anything still carrying one)', () => {
    for (const marker of ['data-run-change-subdued', 'data-selection-dimmed']) {
      const el = mount(`<button ${marker}="true" style="opacity:.3">x</button>`, 'v10')
      expect(importantRule(el, 'opacity', '1'), marker).toBe(true)
      const outside = mount(`<button ${marker}="true" style="opacity:.3">x</button>`, 'current')
      expect(importantRule(outside, 'opacity', '1'), `${marker} outside v10`).toBe(false)
    }
  })
})

describe('v10 scope reaches roots portalled into document.body', () => {
  afterEach(() => { cleanup(); document.body.innerHTML = ''; document.getElementById('v10-sheet')?.remove() })

  const Portalled = () => createPortal(<button className="bg-primary" data-testid="portalled-send">Send</button>, document.body)
  const mountProvider = (value: 'current' | 'v10') =>
    render(<MemoryRouter><PresentationProvider value={value}><Portalled /></PresentationProvider></MemoryRouter>)
  const v10Rules = () => {
    const sheet = document.createElement('style')
    sheet.id = 'v10-sheet'
    sheet.textContent = CSS
    document.head.appendChild(sheet)
    return Array.from(sheet.sheet!.cssRules).filter((r): r is CSSStyleRule => 'selectorText' in r)
  }

  it('a button portalled into document.body under the v10 provider is matched by the v10 primary-button rule', () => {
    mountProvider('v10')
    const send = screen.getByTestId('portalled-send')
    expect(send.closest('[data-presentation="v10"]')).not.toBeNull() // it is outside the wrapper div, so this is <html>
    expect(v10Rules().some((r) => send.matches(r.selectorText) && r.style.getPropertyValue('background-color') === '#262626')).toBe(true)
  })

  it('CONTRAST: the same portalled button under the current design is not matched', () => {
    mountProvider('current')
    const send = screen.getByTestId('portalled-send')
    expect(v10Rules().some((r) => send.matches(r.selectorText))).toBe(false)
  })

  it('the attribute leaves <html> when the provider unmounts, and #/canvas never carries it', () => {
    const { unmount } = mountProvider('v10')
    expect(document.documentElement.dataset.presentation).toBe('v10')
    unmount()
    expect(document.documentElement.dataset.presentation).toBeUndefined()
    const current = mountProvider('current')
    expect(document.documentElement.dataset.presentation).toBeUndefined()
    current.unmount()
  })

  it('the expanded legacy draft button, whose label carries the keyboard hint, gets the disabled ink', () => {
    mountProvider('v10')
    document.body.insertAdjacentHTML('beforeend', '<button disabled aria-label="Generate draft (Enter to send, Shift+Enter for new line)"></button>')
    const el = document.body.querySelector('button[aria-label^="Generate draft"]')!
    expect(v10Rules().some((r) => el.matches(r.selectorText) && /b3b3b3|179, 179, 179/i.test(r.style.getPropertyValue('background-color')) && r.style.getPropertyValue('opacity') === '1')).toBe(true)
  })
})
