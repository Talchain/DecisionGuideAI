/** V12 details panel: core's own words for the item, only the edits core takes (each through the one form and its route), no "Take out of comparison" (no core route). */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ToastProvider } from '../../../../canvas/ToastContext'
import { LaneInspector } from '../LaneInspector'
import { useLaneInspector } from '../inspectorStore'
import { edgeIdOf } from '../../../../canvas/contextMenu/laneMenu'
import { useViewStore } from '../../../store'
import { SID, approved, install, uninstall, type Stub } from './harness'

let stub: Stub
beforeEach(() => { stub = install() })
afterEach(() => { cleanup(); uninstall(); useLaneInspector.setState({ target: null }) })
const mount = () => render(<ToastProvider><LaneInspector /></ToastProvider>)

describe('details panel', () => {
  it('a risk card: core\'s figure words, Set chance and size posts /size, and nothing offers to take it out of comparison', async () => {
    useLaneInspector.getState().open({ kind: 'card', id: 'slow_ramp' })
    mount()
    expect(screen.getByTestId('lane-inspector-title')).toHaveTextContent('Slow ramp')
    expect(screen.getByTestId('lane-inspector-figure')).toHaveTextContent('no size yet')
    expect(screen.queryByText(/take out of comparison/i)).toBeNull()
    fireEvent.click(screen.getByTestId('lane-inspector-size'))
    fireEvent.change(screen.getByTestId('lane-edit-chance'), { target: { value: '20%' } })
    fireEvent.click(screen.getByTestId('lane-edit-go'))
    await waitFor(() => expect(stub.posts()).toHaveLength(1))
    expect(stub.posts()[0]!.path).toBe(`/api/scenarios/${SID}/size`)
    expect(stub.posts()[0]!.body).toMatchObject({ record: 'slow_ramp', chance: '20%' })
  })
  it('a link: its strength is edited through /size and its removal is core\'s remove', () => {
    const link = approved().model!.links.find((l) => l.size?.edit != null)!
    useLaneInspector.getState().open({ kind: 'link', id: edgeIdOf(link) })
    mount()
    expect(screen.getByTestId('lane-inspector-strength')).toHaveTextContent('no strength yet')
    expect(screen.getByTestId('lane-inspector-size')).toBeInTheDocument()
    expect(screen.getByTestId('lane-inspector-remove-link')).toBeInTheDocument()
  })
  it('while Olumi\'s change is held the edit buttons are disabled with core\'s reason, and nothing is sent', () => {
    useViewStore.setState({ view: { ...approved(), model: { ...approved().model!, edit_base: null } } as never })
    useLaneInspector.getState().open({ kind: 'card', id: 'slow_ramp' })
    mount()
    const b = screen.getByTestId('lane-inspector-size')
    expect(b).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(b)
    expect(screen.queryByTestId('lane-edit-form')).toBeNull()
    expect(stub.posts()).toHaveLength(0)
  })
  it('closes when the item is no longer in the model', async () => {
    useLaneInspector.getState().open({ kind: 'card', id: 'gone' })
    mount()
    await waitFor(() => expect(screen.queryByTestId('lane-inspector')).toBeNull())
  })
})
