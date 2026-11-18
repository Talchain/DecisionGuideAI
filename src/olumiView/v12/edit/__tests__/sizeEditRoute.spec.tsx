/** The size-edit bug, at its source: a risk's chance/size edit (core's `route: 'size'`) goes to `/size`, never `/edit`; a plain figure edit still goes to `/edit`. */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ToastProvider } from '../../../../canvas/ToastContext'
import { FigureEdit } from '../../../FigureEdit'
import { LaneEditingLayer } from '../LaneEditingLayer'
import { useViewStore } from '../../../store'
import { RISK_EDIT, SID, install, uninstall, type Stub } from './harness'

let stub: Stub
beforeEach(() => { stub = install() })
afterEach(() => { cleanup(); uninstall() })
// The size form is drawn by the lane's one editing layer, as on the real canvas.
const mount = (edit: Parameters<typeof FigureEdit>[0]['edit']) => render(<ToastProvider><FigureEdit id="slow_ramp" edit={edit} glyph words={false} label="Change figure" /><LaneEditingLayer /></ToastProvider>)

describe('FigureEdit with core\'s size edit', () => {
  it('a risk\'s chance posts to /size with {record, chance}, never to /edit', async () => {
    mount(RISK_EDIT)
    fireEvent.click(screen.getByTestId('lane-size-edit'))
    fireEvent.change(screen.getByTestId('lane-edit-chance'), { target: { value: '20%' } })
    fireEvent.click(screen.getByTestId('lane-edit-go'))
    await waitFor(() => expect(stub.posts()).toHaveLength(1))
    expect(stub.posts()[0]!.path).toBe(`/api/scenarios/${SID}/size`)
    expect(stub.posts()[0]!.body).toMatchObject({ record: 'slow_ramp', chance: '20%' })
    expect(stub.posts().some((p) => p.path.endsWith('/edit'))).toBe(false)
  })
  it('a plain figure edit keeps the figure editor and posts to /edit', async () => {
    mount({ prompt: 'Your figure?', ask: 'A number.' })
    fireEvent.click(screen.getByTestId('view-figure-edit-slow_ramp'))
    fireEvent.change(screen.getByTestId('view-figure-typed-slow_ramp'), { target: { value: '12' } })
    fireEvent.click(screen.getByTestId('view-figure-set-slow_ramp'))
    await waitFor(() => expect(stub.posts()).toHaveLength(1))
    expect(stub.posts()[0]!.path).toBe(`/api/scenarios/${SID}/edit`)
  })
  it('while Olumi\'s change is held the size button is disabled and sends nothing', () => {
    mount(RISK_EDIT)
    act(() => { useViewStore.setState({ view: { ...useViewStore.getState().view!, model: { ...useViewStore.getState().view!.model!, edit_base: null } } as never }) })
    expect(screen.getByTestId('lane-size-edit')).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(screen.getByTestId('lane-size-edit'))
    expect(screen.queryByTestId('lane-edit-form')).toBeNull()
  })
})
