/**
 * ⭐ A YES/NO FACTOR'S VALUE LINE — "AI" stays "AI", and `est.` stays on the
 * value's line (Paul's staging test, 28 Sep 2026, debug export `olumi-debug-64c5eccc`).
 *
 * SERVED (`display_state.rendered_factors`): factor `ai_assistant_use`
 * (`observed_state` unit "binary adoption", value 0, `cee_inference`) displayed
 * "No ai assistant use in place" with `est.` alone on the next line.
 *
 * WHOSE WORDS: the sentence is the UI's, not CEE's — `formatFactorDisplayValue`'s
 * value-only branch builds "No <label> in place" and LOWER-CASED THE WHOLE LABEL,
 * so "AI" became "ai". The export's CEE payload carries no such string. Fixed
 * where it is made: an acronym-like word keeps its capitals.
 *
 * THE MARK: the value row joined value and mark with ONE BREAKABLE space, and
 * the controllable factor's value is its on-graph editor — an atomic button —
 * so a value that filled its line pushed `est.` onto a line of its own. Now the
 * row is `whitespace-nowrap`, so its one joining space is no break
 * opportunity (nor is the edge of the atomic mark — their common ancestor
 * decides), the value re-opens its own spaces (`whitespace-normal`), and the card's
 * editor rests as INLINE text (`NodeValueEditor` `restingFlow="inline"`), not
 * an atomic box. The mark can therefore only wrap WITH the value's last word.
 *
 * PINNED by node id: the exact visible text; a line-break model over the
 * rendered DOM (the runs the row cannot break) whose last run carries the
 * value's last word AND the mark; the editor is still a keyboard-operable
 * button. Both value paths: the served factor is controllable (the editor);
 * the contrast is the same data as an observable factor (plain text).
 *
 * CLAIM SCOPE: jsdom — tokens, text and DOM order, never pixels.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'
import { mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { formatFactorDisplayValue } from '../../../utils/formatFactorDisplayValue'
import served from '../../__fixtures__/realDraft.assistant64c5eccc.json'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, influenceProvenance: null, influenceImportanceBasis: null,
    influenceSetSize: null, influenceRankedCount: null, confidence: null, confidenceIsDefaulted: false,
    confidenceIsProvisional: false, inSensitivityAnalysis: false, achievementProbability: null,
    achievementProbabilityIsModelledBasis: false, stabilityPercentage: null, winRate: null,
    isResultsMode: false, predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div data-testid="factor-node-popover">{children}</div>,
}))

const ID = 'ai_assistant_use'
type CanvasNode = { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }
const SERVED = (served as { nodes: unknown[] }).nodes
  .map(mapDraftNodeToCanvas as (n: unknown) => CanvasNode)
  .find(n => n.id === ID)!

function renderFactor(data: Record<string, unknown>) {
  useCanvasStore.setState({
    nodes: [{ id: ID, type: 'factor', position: { x: 0, y: 0 }, data }],
    edges: [], ceeAnalysisReady: null, viewMode: 'standard', lodRung: 'full', goalConstraints: [],
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false, v5AnalysisFact: null,
    hasCompletedFirstRun: false, results: { status: 'idle', report: null },
  } as never)
  return render(
    <ReactFlowProvider>
      <FactorNode
        id={ID} type="factor" data={data as never} selected={false}
        isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable
      />
    </ReactFlowProvider>,
  )
}

const tokens = (el: Element) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))
const visibleText = (el: Element) => {
  const clone = el.cloneNode(true) as Element
  clone.querySelectorAll('.sr-only').forEach(n => n.remove())
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim()
}
const card = () => {
  const root = screen.getByTestId('node-title').closest('[role="group"]')
  expect(root, 'the card root renders').not.toBeNull()
  return root as HTMLElement
}
const NBSP = '\u00a0'
const ATOMIC_CLASSES = ['inline-flex', 'inline-block', 'flex', 'grid', 'inline-grid']

/**
 * The runs the value row CANNOT break, read off the rendered DOM. A text node
 * breaks at its ordinary spaces only where its white-space allows; U+00A0 never
 * breaks; an ATOMIC inline (a `<button>`, or an inline-flex/-block box) is one
 * unit whose contents never join a neighbour's run, and a break opportunity
 * exists on either side of it whenever the surrounding white-space wraps
 * (Chromium ignores the U+00A0 glue there — the served N5 finding).
 */
function unbreakableRuns(row: HTMLElement, markSlotTestId: string): string[] {
  const runs: string[] = ['']
  const walk = (node: Node, canBreak: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node as Text).data
      if (!canBreak) { runs[runs.length - 1] += text; return }
      text.split(' ').forEach((p, i) => { if (i > 0) runs.push(''); runs[runs.length - 1] += p })
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    if (el.classList.contains('sr-only')) return
    const t = tokens(el)
    const atomic = el.getAttribute('data-testid') === markSlotTestId ||
      el.tagName === 'BUTTON' || ATOMIC_CLASSES.some(c => t.has(c))
    if (atomic) {
      if (canBreak) runs.push('')
      runs[runs.length - 1] += visibleText(el)
      if (canBreak) runs.push('')
      return
    }
    const next = t.has('whitespace-nowrap') ? false : t.has('whitespace-normal') ? true : canBreak
    el.childNodes.forEach(c => walk(c, next))
  }
  const rt = tokens(row)
  walk(row, !rt.has('whitespace-nowrap'))
  return runs.map(r => r.replace(new RegExp(NBSP, 'g'), ' ').replace(/\s+/g, ' ').trim()).filter(Boolean)
}

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: [], edges: [], viewMode: 'standard', lodRung: 'full' } as never)
})

const CASES = [
  { name: 'served (controllable — the on-graph editor holds the value)', data: () => SERVED.data, editor: true },
  { name: 'contrast (observable — the plain value text)', data: () => ({ ...SERVED.data, category: 'observable' }), editor: false },
] as const

describe(`served 64c5eccc — ${ID}: "No AI assistant use in place", est. on the value's line`, () => {
  it('PRECONDITION: the served factor is the binary Olumi estimate at 0', () => {
    expect(SERVED, 'the export carries ai_assistant_use').toBeDefined()
    expect(SERVED.data.label).toBe('AI assistant use')
    expect(SERVED.data.observedState).toMatchObject({ unit: 'binary adoption', value: 0, source: 'cee_inference' })
  })

  it('the UI\'s sentence keeps the label\'s acronym ("AI", never "ai")', () => {
    expect(formatFactorDisplayValue({ label: 'AI assistant use', value: 0, unit: 'binary adoption' })).toBe('No AI assistant use in place')
    // Contrast: an ordinary capitalised word still reads as prose mid-sentence.
    expect(formatFactorDisplayValue({ label: 'Tech lead headcount', value: 0, unit: 'binary adoption' })).toBe('No tech lead headcount in place')
    expect(formatFactorDisplayValue({ label: 'Customer NPS programme', value: 0, unit: 'binary adoption' })).toBe('No customer NPS programme in place')
  })

  for (const c of CASES) {
    it(`${c.name}: the value line reads "No AI assistant use in place est."`, () => {
      renderFactor(c.data())
      const row = within(card()).getByTestId('factor-recorded-value')
      expect(visibleText(row)).toBe('No AI assistant use in place est.')
      expect(Boolean(within(row).queryByTestId(`node-value-editor-${ID}`))).toBe(c.editor)
    })

    it(`${c.name}: est. can only wrap WITH the value's last word — never alone`, () => {
      renderFactor(c.data())
      const row = within(card()).getByTestId('factor-recorded-value')
      const runs = unbreakableRuns(row, `factor-value-mark-slot-${ID}`)
      const last = runs[runs.length - 1]
      expect(last, `runs: ${JSON.stringify(runs)}`).not.toBe('est.')
      expect(last.endsWith('place est.'), `runs: ${JSON.stringify(runs)}`).toBe(true)
      // …and the value itself still wraps inside the card: it is more than one run.
      expect(runs.length, `runs: ${JSON.stringify(runs)}`).toBeGreaterThan(1)
    })
  }

  // GUARD (not a RED row): the inline resting form must stay a real control.
  // A native <button> is activated by the browser (jsdom does not synthesise
  // that), so only a non-native button is driven by key here.
  it.each(['Enter', ' '])('the editor still is one: a focusable button, named, and %j opens the field', (key) => {
    renderFactor(SERVED.data)
    const editor = within(card()).getByTestId(`node-value-editor-${ID}`)
    expect(editor.getAttribute('role') ?? (editor.tagName === 'BUTTON' ? 'button' : null)).toBe('button')
    expect(editor.tabIndex).toBe(0)
    expect(editor.getAttribute('aria-label')).toBe('Value for AI assistant use — click to edit')
    if (editor.tagName === 'BUTTON') fireEvent.click(editor)
    else fireEvent.keyDown(editor, { key })
    expect(within(card()).getByTestId(`node-value-editor-${ID}-input`)).toBeTruthy()
  })
})
