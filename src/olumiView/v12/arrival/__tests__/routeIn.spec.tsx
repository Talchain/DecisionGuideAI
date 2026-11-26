import { act, cleanup, render, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from '../../../../canvas/store'
import type { View } from '../../../client'
import studioView from '../../../fixtures/cardface/studio.view3.json'
import bakeryView from '../../../golden/bakery.view.json'
import { useViewStore } from '../../../store'
import { routeInOf, useRouteIn } from '../routeIn'

const studio = studioView as unknown as View
const bakery = bakeryView as unknown as View
const drafting = (view: View): View => ({
  ...view, version: null, proposal: null, model: null,
  draft: { ...view.draft!, status: 'drafting', stage: 'building', words: 'Building the model' },
})

describe('routeInOf', () => {
  it('takes the first figure from the first find-out entry', () => {
    const model = bakery.model!
    const [figure, second] = model.run!.find_out![0]!.figures
    const waits = studio.model!.run!.waits_on!
    const waits_on = { ...waits, items: [{ ...waits.items[0]!, id: second!.id }] }
    const next = { ...bakery, model: { ...model, run: { ...model.run!, waits_on } } }
    expect(routeInOf(drafting(bakery), next)).toBe(figure!.id)
  })

  it('takes the first waits-on item in Studio when it names a card', () => {
    expect(routeInOf(drafting(studio), studio)).toBe('member_mood')
  })

  it('skips link ids and falls back from a non-card first figure without reading later figures', () => {
    const model = studio.model!, run = model.run!, waits = run.waits_on!
    const [card, link] = waits.items
    expect(link!.id).toBe('evening_mood')
    const aim = bakery.model!.run!.find_out![0]!
    const first = aim.figures[0]!
    const next = {
      ...studio,
      model: {
        ...model,
        run: {
          ...run,
          waits_on: { ...waits, items: [link!, card!] },
          find_out: [{ ...aim, figures: [{ ...first, id: link!.id }, { ...first, id: model.cards[0]!.id }] }],
        },
      },
    }
    expect(routeInOf(drafting(studio), next)).toBe('member_mood')
  })

  it('gives no target without a resolvable id, on refresh, or across scenarios', () => {
    const model = studio.model!
    const noRun = { ...studio, model: { ...model, run: null } }
    expect(routeInOf(drafting(studio), noRun)).toBeNull()
    expect(routeInOf(drafting(studio), { ...studio, model: { ...model, cards: [] } })).toBeNull()
    expect(routeInOf(studio, studio)).toBeNull()
    expect(routeInOf(null, studio)).toBeNull()
    expect(routeInOf(drafting(bakery), studio)).toBeNull()
  })
})

function mount(id: string, first: View = drafting(studio)) {
  const focus = vi.fn<[id: string, canFocus: () => boolean, selectOnly: boolean], void>()
  const moves = { current: 0 }
  const view = { ...first, id }
  useViewStore.setState({ view, at: null })
  const hook = renderHook(({ view }) => useRouteIn(view, moves, focus), { initialProps: { view } })
  const show = (next: View) => {
    const view = { ...next, id }
    useViewStore.setState({ view })
    hook.rerender({ view })
  }
  return { ...hook, show, focus, moves }
}

afterEach(() => {
  cleanup()
  useViewStore.setState({ view: null })
  useCanvasStore.getState().clearSelection()
})

describe('useRouteIn', () => {
  it('focuses once per scenario across polls and canvas remounts', () => {
    const first = mount('s_route_once')
    first.show(studio)
    first.show(studio)
    expect(first.focus).toHaveBeenCalledOnce()
    expect(first.focus).toHaveBeenCalledWith('member_mood', expect.any(Function), true)  // ring only: a board fitted whole is never re-centred
    first.unmount()

    const again = mount('s_route_once')
    again.show(studio)
    expect(again.focus).not.toHaveBeenCalled()
    again.unmount()

    const other = mount('s_route_other')
    other.show(studio)
    expect(other.focus).toHaveBeenCalledOnce()
  })

  it('does nothing on an ordinary refresh or after selecting, moving a card, or moving the camera', () => {
    const refresh = mount('s_route_refresh', studio)
    expect(refresh.focus).not.toHaveBeenCalled()
    refresh.unmount()

    const selected = mount('s_route_selection')
    act(() => {
      useCanvasStore.getState().selectNodeWithoutHistory('kept-idea')
      useCanvasStore.getState().clearSelection()
    })
    selected.show(studio)
    expect(selected.focus).not.toHaveBeenCalled()
    selected.unmount()

    const card = mount('s_route_card_move')
    card.result.current()
    card.show(studio)
    expect(card.focus).not.toHaveBeenCalled()
    card.unmount()

    const camera = mount('s_route_camera_move')
    camera.moves.current += 1
    camera.show(studio)
    expect(camera.focus).not.toHaveBeenCalled()
  })

  it('rings the card even while the composer has focus: ringing takes no keyboard focus, and the person has just sent their brief from there', () => {
    const { getByRole } = render(<div data-testid="view-composer"><textarea /></div>)
    getByRole('textbox').focus()
    const typed = mount('s_route_composer')
    typed.show(studio)
    expect(typed.focus).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(getByRole('textbox'))
  })

  it('still arrives when a View between the draft and the model says only that the draft is done', () => {
    const late = mount('s_route_done_first')
    late.show({ ...studio, model: null, draft: { ...drafting(studio).draft!, status: 'done' } } as View)
    expect(late.focus).not.toHaveBeenCalled()
    late.show(studio)
    expect(late.focus).toHaveBeenCalledOnce()
  })

  it('stops while the card is being laid out if the person acts first', () => {
    const laying = mount('s_route_laying')
    laying.show(studio)
    const canFocus = laying.focus.mock.calls[0]![1]
    expect(canFocus()).toBe(true)
    laying.moves.current += 1
    expect(canFocus()).toBe(false)
  })
})
