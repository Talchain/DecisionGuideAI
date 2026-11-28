/** V12 details panel: core's own words for the item, only the edits core takes (each through the one form and its route), no "Take out of comparison" (no core route). */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ToastProvider } from '../../../../canvas/ToastContext'
import { LaneEditingLayer } from '../LaneEditingLayer'
import { useLaneInspector } from '../inspectorStore'
import { viewLinkEdgeIds } from '../../links/ids'
import { useViewStore } from '../../../store'
import { SID, approved, install, uninstall, type Stub } from './harness'

let stub: Stub
// Surfaces step 5: the lane's panel (a figure, a risk's size and a link's strength are changed in its Value row); the older look's panel keeps its buttons (oneFigureEditor.spec.tsx S5-C2).
beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '1'); stub = install() })
afterEach(() => { cleanup(); uninstall(); vi.unstubAllEnvs(); useLaneInspector.setState({ current: null, peek: null }) })
// The layer draws the details panel and the one small form its buttons open (in the panel's place: one thing open at a time).
const mount = () => render(<ToastProvider><LaneEditingLayer /></ToastProvider>)

describe('details panel', () => {
  // Surfaces step 5: the risk's and the link's size is changed in the panel's Value row (the one place), not by a button that opens the small form.
  it('a risk card: core\'s figure words, its Value row posts /size, no second Set button, and nothing offers to take it out of comparison', async () => {
    useLaneInspector.getState().open({ kind: 'card', id: 'slow_ramp' })
    mount()
    expect(screen.getByTestId('lane-inspector-title')).toHaveTextContent('Slow ramp')
    expect(screen.getByTestId('lane-inspector-figure')).toHaveTextContent('no size yet')
    expect(screen.queryByText(/take out of comparison/i)).toBeNull()
    expect(screen.queryByTestId('lane-inspector-size'), 'the Value row is the one place').toBeNull()
    fireEvent.change(screen.getByTestId('inspector-figure-chance'), { target: { value: '20%' } })
    fireEvent.click(screen.getByTestId('inspector-figure-set'))
    await waitFor(() => expect(stub.posts()).toHaveLength(1))
    expect(stub.posts()[0]!.path).toBe(`/api/scenarios/${SID}/size`)
    expect(stub.posts()[0]!.body).toMatchObject({ record: 'slow_ramp', chance: '20%' })
  })
  it('a link: its strength is edited through /size and its removal is core\'s remove', () => {
    const links = approved().model!.links
    useLaneInspector.getState().open({ kind: 'link', id: viewLinkEdgeIds(links)[links.findIndex((l) => l.size?.edit != null)]! })
    mount()
    expect(screen.getByTestId('lane-inspector-strength')).toHaveTextContent('no strength yet')
    expect(screen.getByTestId('inspector-figure-typed'), 'the strength is changed in the Value row').toBeInTheDocument()
    expect(screen.queryByTestId('lane-inspector-size')).toBeNull()
    expect(screen.getByTestId('lane-inspector-remove-link')).toBeInTheDocument()
  })
  it('while Olumi\'s change is held the Value row cannot save, says why in core\'s words, and nothing is sent', () => {
    useViewStore.setState({ view: { ...approved(), model: { ...approved().model!, edit_base: null } } as never })
    useLaneInspector.getState().open({ kind: 'card', id: 'slow_ramp' })
    mount()
    fireEvent.change(screen.getByTestId('inspector-figure-chance'), { target: { value: '20%' } })
    expect(screen.getByTestId('inspector-figure-set')).toBeDisabled()
    expect(screen.getByTestId('inspector-figure-held')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('inspector-figure-set'))
    expect(screen.queryByTestId('lane-edit-form')).toBeNull()
    expect(stub.posts()).toHaveLength(0)
  })
  // C6 (20 Nov): the provenance sentence is said once. A figure Olumi estimated on a card that is not Olumi's: core's `olumi.title` is the Value row's source.
  describe('C6 core\'s provenance sentence prints once', () => {
    const SAID = 'Olumi estimated this from the two sources you gave'
    const withCard = (over: Record<string, unknown>) => {
      const v = approved(), m = v.model!
      const q = { ...m.cards.find((c) => c.family === 'quantity')!, id: 'est', heading: 'Estimate', olumi: { glyph: 'O', title: SAID }, author: { by: 'person', text: 'Yours', title: 'Yours' },
        figure: { text: '5,000', title: 'A figure', edit: null }, ...over }
      useViewStore.setState({ view: { ...v, model: { ...m, cards: [...m.cards, q] } } as never })
    }
    const times = (el: Element, w: string): number => el.textContent!.split(w).length - 1
    it('pinned: the sentence is in the fold, not also beside the value; where the card\'s detail holds it, the detail is its one place', () => {
      withCard({ detail: 'A card with its own account.' })
      useLaneInspector.getState().open({ kind: 'card', id: 'est' })
      mount()
      const box = screen.getByTestId('lane-inspector')
      expect(screen.queryByTestId('lane-inspector-value-source'), 'not beside the value').toBeNull()
      expect([times(box, SAID), screen.getByTestId('lane-inspector-source').textContent]).toEqual([1, SAID])
      cleanup(); useLaneInspector.setState({ current: null })
      withCard({ detail: `${SAID}. More.`, figure: { text: '5,000', title: 'A figure', edit: null } })
      useLaneInspector.getState().open({ kind: 'card', id: 'est' })
      mount()
      expect([times(screen.getByTestId('lane-inspector'), SAID), screen.queryByTestId('lane-inspector-source')], 'the detail says it; no second line').toEqual([1, null])
    })
    it('pinned: the figure\'s own sentence is not printed again when the detail already holds it', () => {
      withCard({ detail: 'It is A figure, as given.' })
      useLaneInspector.getState().open({ kind: 'card', id: 'est' })
      mount()
      expect(screen.queryByTestId('lane-inspector-figure-said'), 'the detail holds it').toBeNull()
      cleanup(); useLaneInspector.setState({ current: null })
      withCard({ detail: 'Something else.' })
      useLaneInspector.getState().open({ kind: 'card', id: 'est' })
      mount()
      expect(screen.getByTestId('lane-inspector-figure-said'), 'CONTRAST: a sentence the detail does not hold is drawn').toHaveTextContent('A figure')
    })
    it('the preview has no fold, so it keeps the source beside the value', () => {
      withCard({})
      useLaneInspector.setState({ current: null, peek: { kind: 'card', id: 'est' } })
      mount()
      expect(screen.getByTestId('lane-peek')).toBeInTheDocument()
      expect(screen.getByTestId('lane-inspector-value-source')).toHaveTextContent(SAID)
    })
  })
  describe('a card with a held proposal', () => {
    const changeTitle = 'An invented change\nvalue 10 → 12'
    const withCard = (change?: { glyph: string; title: string; kind: 'added' | 'changed' } | null) => {
      const v = approved(), m = v.model!
      const q = {
        ...m.cards.find((c) => c.family === 'quantity')!,
        id: 'pending_est',
        heading: 'Pending estimate',
        figure: { text: '£12,000/year', title: 'An invented figure', edit: null },
        change,
      }
      if (change === undefined) Reflect.deleteProperty(q, 'change')
      useViewStore.setState({ view: { ...v, model: { ...m, cards: [...m.cards, q] } } as never })
    }

    it('shows the change glyph and both title lines in the pinned box and preview', () => {
      withCard({ glyph: '↻', title: changeTitle, kind: 'changed' })
      useLaneInspector.getState().open({ kind: 'card', id: 'pending_est' })
      mount()
      const pinnedChange = screen.getByTestId('lane-inspector-change')
      expect(pinnedChange, 'the pinned box identifies a changed card').toHaveAttribute('data-change-kind', 'changed')
      expect(pinnedChange.textContent, 'the pinned box shows the glyph and preserves both title lines').toBe(`↻ ${changeTitle}`)

      cleanup()
      useLaneInspector.setState({ current: null, peek: { kind: 'card', id: 'pending_est' } })
      mount()
      const previewChange = screen.getByTestId('lane-inspector-change')
      expect(screen.getByTestId('lane-peek'), 'the change appears inside the card preview').toContainElement(previewChange)
      expect(previewChange, 'the preview identifies a changed card').toHaveAttribute('data-change-kind', 'changed')
      expect(previewChange.textContent, 'the preview shows the glyph and preserves both title lines').toBe(`↻ ${changeTitle}`)
    })

    it('shows the addition glyph and title for an added card', () => {
      withCard({ glyph: '+', title: 'An invented addition', kind: 'added' })
      useLaneInspector.getState().open({ kind: 'card', id: 'pending_est' })
      mount()
      const change = screen.getByTestId('lane-inspector-change')
      expect(change, 'the box identifies an added card').toHaveAttribute('data-change-kind', 'added')
      expect(change.textContent, 'the box shows the addition glyph and its title').toBe('+ An invented addition')
    })

    it('keeps the figure visible when the change is null', () => {
      withCard(null)
      useLaneInspector.getState().open({ kind: 'card', id: 'pending_est' })
      mount()
      expect(screen.queryByTestId('lane-inspector-change'), 'a null change produces no change line').toBeNull()
      expect(screen.getByTestId('lane-inspector-figure'), 'the figure remains visible').toHaveTextContent('£12,000/year')
    })

    it('keeps the title and figure visible when the change key is absent', () => {
      withCard()
      useLaneInspector.getState().open({ kind: 'card', id: 'pending_est' })
      mount()
      expect(screen.queryByTestId('lane-inspector-change'), 'an absent change key produces no change line').toBeNull()
      expect(screen.getByTestId('lane-inspector-title'), 'the older card still shows its title').toHaveTextContent('Pending estimate')
      expect(screen.getByTestId('lane-inspector-figure'), 'the older card still shows its figure').toHaveTextContent('£12,000/year')
    })
  })
  it('closes when the item is no longer in the model', async () => {
    useLaneInspector.getState().open({ kind: 'card', id: 'gone' })
    mount()
    await waitFor(() => expect(screen.queryByTestId('lane-inspector')).toBeNull())
  })
})
