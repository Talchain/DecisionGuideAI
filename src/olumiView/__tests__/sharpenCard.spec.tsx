/**
 * Sharpen your thinking on the Analysis tab (core view/sharpen.ts, olumi.view/3 `model.sharpen`; the previous PoC's block, Paul's 6 Nov
 * side-by-side): after "Behind this result" and before the notes, the first two of core's prompts shown and the rest behind "+N more",
 * every word core's at its own path, the rationale on the ⓘ hover. Fixture: the bakery View from the wire with core's rows as its pricing
 * golden serves them, plus core's shared-mechanism row so the disclosure has something to hold.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View, ViewModel } from '../client'
import { ViewChances } from '../ViewChances'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'

const base = (JSON.parse(readFileSync(path.resolve('src/olumiView/golden/bakery.view.json'), 'utf8')) as View).model!
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }); useMe.setState({ me: null, status: 'none' }) })
const worth = base.run!.science[0]!
// The R17 goldens carry core's `sharpen`; this fixture is the View of a core before it, so the field is taken off.
const { sharpen: _sharpen, ...baseWithout } = base
const model = { ...baseWithout, run: { ...base.run!, science: [0, 1, 2].map((k) => ({ ...worth, id: `W${k}`, line: `${worth.line} (${k})` })) } } as unknown as ViewModel
const before = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

const SHARPEN = [
  { id: 'shared_mechanism', lead: 'All two options act through exactly the same parts of the model.', emphasis: 'These may be variations on one route rather than genuinely different approaches.', rationale: 'Mechanism diversity: when every option acts on the same immediate parts of the model, they may be settings of one lever rather than alternatives. A route that works through a different mechanism is what widens the comparison.', move: 'widen_options' },
  { id: 'option_breadth', lead: 'You are comparing two options.', emphasis: 'A materially different route widens the comparison.', rationale: 'Option generation: comparing only similar routes narrows what the analysis can see. A structurally different option often reveals a better or lower-regret path.', move: 'widen_options' },
  { id: 'risk_count', lead: 'No risks captured yet.', emphasis: 'A pre-mortem typically surfaces failure modes before they arrive.', rationale: 'Pre-mortem (Klein): imagine the choice failed, then ask what went wrong. It typically surfaces risks that planning misses.', move: 'pre_mortem' },
]

describe('Sharpen your thinking', () => {
  it('after Behind this result and before the notes: the first two of core\'s prompts, the rest behind "+N more", every word core\'s at its path', () => {
    const c = render(<ViewChances model={{ ...model, sharpen: SHARPEN } as ViewModel} />).container
    const behind = c.querySelector('[data-testid="view-run-behind"]')!, card = c.querySelector('[data-testid="view-run-sharpen"]')!, notes = c.querySelector('[data-testid="view-run-notes"]')!
    expect(card).not.toBeNull()
    expect([before(behind, card), before(card, notes)]).toEqual([true, true])
    const more = card.querySelector('details[data-testid="view-run-sharpen-more"]')!
    expect([...card.querySelectorAll('[data-sharpen]')].filter((e) => !more.contains(e)).map((e) => e.getAttribute('data-sharpen'))).toEqual(['shared_mechanism', 'option_breadth'])
    expect([...more.querySelectorAll('[data-sharpen]')].map((e) => e.getAttribute('data-sharpen'))).toEqual(['risk_count'])
    expect(more.querySelector('summary')!.textContent).toBe('+1 more')
    SHARPEN.forEach((r, i) => {
      expect(card.querySelector(`[data-view="sharpen.${i}.lead"]`)!.textContent).toBe(r.lead)
      expect(card.querySelector(`[data-view="sharpen.${i}.emphasis"]`)!.textContent).toBe(r.emphasis)
      const why = card.querySelector(`[data-view-hover="sharpen.${i}.rationale"]`)!
      expect([why.getAttribute('aria-label'), why.getAttribute('title')]).toEqual([r.rationale, r.rationale])
    })
  })
  it('a View without the field (a core before it) draws no card', () => {
    const c = render(<ViewChances model={model} />).container
    expect(c.querySelector('[data-testid="view-run-sharpen"]')).toBeNull()
  })
})
