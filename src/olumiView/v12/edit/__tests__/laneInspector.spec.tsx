/** V12 details panel: core's own words for the item, only the edits core takes (each through the one form and its route), no "Take out of comparison" (no core route). */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ToastProvider } from '../../../../canvas/ToastContext'
import { LaneEditingLayer } from '../LaneEditingLayer'
import { useLaneInspector } from '../inspectorStore'
import { edgeIdOf } from '../../../../canvas/contextMenu/laneMenu'
import { useViewStore } from '../../../store'
import { SID, approved, install, uninstall, type Stub } from './harness'

let stub: Stub
// Surfaces step 5: the lane's panel (a figure, a risk's size and a link's strength are changed in its Value row); the older look's panel keeps its buttons (oneFigureEditor.spec.tsx S5-C2).
beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '1'); stub = install() })
afterEach(() => { cleanup(); uninstall(); vi.unstubAllEnvs(); useLaneInspector.setState({ current: null }) })
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
    const link = approved().model!.links.find((l) => l.size?.edit != null)!
    useLaneInspector.getState().open({ kind: 'link', id: edgeIdOf(link) })
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
  it('closes when the item is no longer in the model', async () => {
    useLaneInspector.getState().open({ kind: 'card', id: 'gone' })
    mount()
    await waitFor(() => expect(screen.queryByTestId('lane-inspector')).toBeNull())
  })
})
