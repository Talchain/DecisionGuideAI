/**
 * S4 lane esc3 (19 Nov, URL 3): the one Escape rule, and the Record form's reach. Escape closes the TOP-most open layer once; the Record form folds and keeps its draft
 * (as its X does); opening the form scrolls it into view.
 */
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../../../client'
import { resetDrafts } from '../../../../olumiCore/team/drafts'
import { resetWrites } from '../../../../olumiCore/team/writes'
import { CommitForm } from '../CommitForm'
import { useEscapeLayer } from '../../edit/escapeLayers'
import { LaneEditingLayer } from '../../edit/LaneEditingLayer'
import { useLaneInspector } from '../../edit/inspectorStore'
import { CommitFormSlot } from '../CommitForm'
import { ToastProvider } from '../../../../canvas/ToastContext'
import { useCanvasStore } from '../../../../canvas/store'
import { install, uninstall } from '../../edit/__tests__/harness'

const fx: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5/effects.view3.json'), 'utf8'))
const limits = { question: 300, aim: 300, option: 120, options: 5, link_words: 200, links: 5 }
const view = (): View => ({ ...fx, gated: false, you_id: '1', collab: { ...fx.collab, frame_words: { limits } } } as View)
afterEach(() => { cleanup(); resetDrafts(); resetWrites() })

/** A menu that opens when pressed and registers as a layer while open: stands for the model menu, More options and the Summary page. */
function Menu({ name }: { name: string }): JSX.Element {
  const [open, setOpen] = useState(false)
  useEscapeLayer(open, () => setOpen(false))
  return <div><button type="button" data-testid={`${name}-open`} onClick={() => setOpen(true)}>{name}</button>{open ? <div role="menu" data-testid={`${name}-menu`} /> : null}</div>
}
const esc = (to: Element = document.body) => fireEvent.keyDown(to, { key: 'Escape' })

describe('esc3 task 1: Record what you will do', () => {
  it('Escape folds the open form on the FIRST press and KEEPS the draft, as its X does; the folded line says "Draft kept"; CONTRAST: Discard is the only thing that empties it', () => {
    render(<CommitForm sid="s_esc1" view={view()} onWrote={async () => true} />)
    fireEvent.click(screen.getByTestId('commit-form-open'))
    const box = screen.getByLabelText('What will you do?') as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'Ask the two mechanics about hours' } })
    esc(box) // from inside the text field: the layer closes, the words are not discarded
    expect(screen.getByTestId('commit-form').getAttribute('data-open')).toBe('false')
    expect(screen.getByTestId('commit-form-draft-kept').textContent).toBe('· Draft kept')
    fireEvent.click(screen.getByTestId('commit-form-open'))
    expect((screen.getByLabelText('What will you do?') as HTMLTextAreaElement).value).toBe('Ask the two mechanics about hours')
  })
  it('opening the form (its own button, or from outside) scrolls that form into view, just far enough; folded, nothing scrolls', () => {
    const scrolled: Array<[Element, unknown]> = [], was = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (this: Element, o?: boolean | ScrollIntoViewOptions) { scrolled.push([this, o]) }
    try {
      render(<div data-testid="view-chat-scroll"><CommitForm sid="s_esc1b" view={view()} onWrote={async () => true} /></div>)
      expect(scrolled, 'CONTRAST: folded, nothing scrolls').toHaveLength(0)
      fireEvent.click(screen.getByTestId('commit-form-open'))
      expect(scrolled).toEqual([[screen.getByTestId('commit-form'), { block: 'nearest' }]])
    } finally { Element.prototype.scrollIntoView = was }
  })
})

describe('esc3 task 2: one Escape closes one layer', () => {
  it('two layers open: the first press closes the newest only, the second the one beneath; a third does nothing (never two layers, never two presses)', () => {
    render(<><Menu name="model" /><Menu name="more" /></>)
    fireEvent.click(screen.getByTestId('model-open'))
    fireEvent.click(screen.getByTestId('more-open'))
    esc()
    expect([screen.queryByTestId('model-menu') !== null, screen.queryByTestId('more-menu') !== null]).toEqual([true, false])
    esc()
    expect([screen.queryByTestId('model-menu') !== null, screen.queryByTestId('more-menu') !== null]).toEqual([false, false])
    esc()
    expect(screen.queryByRole('menu')).toBeNull()
  })
  it('a layer closes on the first press even with the Record form open beneath it, and the form (opened first) keeps its draft until its own press', () => {
    render(<><CommitForm sid="s_esc2" view={view()} onWrote={async () => true} /><Menu name="more" /></>)
    fireEvent.click(screen.getByTestId('commit-form-open'))
    fireEvent.change(screen.getByLabelText('What will you do?'), { target: { value: 'Keep this' } })
    fireEvent.click(screen.getByTestId('more-open'))
    esc(screen.getByLabelText('What will you do?'))
    expect([screen.queryByTestId('more-menu') !== null, screen.getByTestId('commit-form').getAttribute('data-open')]).toEqual([false, 'true'])
    esc()
    expect([screen.getByTestId('commit-form').getAttribute('data-open'), screen.getByTestId('commit-form-draft-kept').textContent]).toEqual(['false', '· Draft kept'])
  })
  it('the press is taken: a layer that closed does not let the same key reach a listener beneath it', () => {
    let beneath = 0
    const count = () => { beneath += 1 }
    window.addEventListener('keydown', count)
    try {
      render(<Menu name="model" />)
      fireEvent.click(screen.getByTestId('model-open'))
      act(() => { esc() })
      expect(screen.queryByTestId('model-menu')).toBeNull()
      expect(beneath, 'the bubbling listeners never saw it').toBe(0)
      esc() // nothing open: the key goes on its way
      expect(beneath).toBe(1)
    } finally { window.removeEventListener('keydown', count) }
  })
})

describe('esc3 task 2 and 3: the canvas\'s surface and the Record form share one order', () => {
  const OPT = 'single_country_test'
  beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '1'); install() })
  afterEach(() => { uninstall(); vi.unstubAllEnvs(); useLaneInspector.setState({ current: null, peek: null }); useCanvasStore.getState().clearSelection() })
  it('a Record form with a draft is open, then a card is pressed: the first Escape closes the details box AND clears the selection (the form, older, stays with its draft); the second folds the form and keeps the draft', async () => {
    render(<ToastProvider><LaneEditingLayer /><CommitFormSlot /></ToastProvider>)
    fireEvent.click(await screen.findByTestId('commit-form-open'))
    fireEvent.change(screen.getByLabelText('What will you do?'), { target: { value: 'Open one market first' } })
    act(() => { useCanvasStore.setState({ selection: { nodeIds: new Set([OPT]), edgeIds: new Set<string>(), anchorPosition: null } }); useLaneInspector.getState().open({ kind: 'card', id: OPT }) })
    await screen.findByTestId('lane-inspector')
    esc()
    expect([screen.queryByTestId('lane-inspector') === null, useCanvasStore.getState().selection.nodeIds.size, screen.getByTestId('commit-form').getAttribute('data-open')]).toEqual([true, 0, 'true'])
    esc()
    expect([screen.getByTestId('commit-form').getAttribute('data-open'), screen.getByTestId('commit-form-draft-kept').textContent]).toEqual(['false', '· Draft kept'])
  })
  it('CONTRAST: the details box opened FIRST and the form after it: the form closes first, then the box', async () => {
    useLaneInspector.getState().open({ kind: 'card', id: OPT })
    render(<ToastProvider><LaneEditingLayer /><CommitFormSlot /></ToastProvider>)
    await screen.findByTestId('lane-inspector')
    fireEvent.click(await screen.findByTestId('commit-form-open'))
    esc()
    expect([screen.getByTestId('commit-form').getAttribute('data-open'), screen.queryByTestId('lane-inspector') !== null]).toEqual(['false', true])
    esc()
    expect(screen.queryByTestId('lane-inspector')).toBeNull()
  })
})
