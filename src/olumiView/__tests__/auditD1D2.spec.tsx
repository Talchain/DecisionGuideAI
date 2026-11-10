/**
 * Strategy canvas audit, 10 Nov (witness 12 on the served build; the design owner's calls). D1: the lens bar is a canvas control, so it is
 * not drawn while the Strategy Overview stands in place of the canvas (it sat over the overview's title). D2: on a card the figure editor
 * opens out of the card's flow (opening it never re-lays out the board) and its buttons never wrap inside themselves.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useOverview } from '../strategy/overview/useOverview'
import { ViewLensBar } from '../ViewLensBar'
import { FigureEdit } from '../FigureEdit'

const view = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-chain.view3.json'), 'utf8')) as View
const card = view.model!.cards.find((c) => c.figure?.edit)!
afterEach(() => { cleanup(); useOverview.getState().hide(); useViewStore.setState(useViewStore.getInitialState(), true) })

describe('D1: the lens bar and the Strategy Overview', () => {
  it('D1a catch: with the overview open the lens bar is not drawn; closed, it is', () => {
    useViewStore.setState({ view, sid: view.id })
    render(<ViewLensBar nav />)
    expect(screen.getByTestId('lens-bar-team')).toBeInTheDocument()
    act(() => { useOverview.getState().show() })
    expect(screen.queryByTestId('lens-bar-team')).toBeNull()
    act(() => { useOverview.getState().hide() })
    expect(screen.getByTestId('lens-bar-team')).toBeInTheDocument()
  })
})

describe('D2: the figure editor on a card', () => {
  it('D2a catch: on a card the editor is a panel out of the card\'s flow; each of its buttons stays on one line', () => {
    useViewStore.setState({ view, sid: view.id })
    render(<FigureEdit id={card.id} edit={card.figure!.edit!} glyph="✎" words={false} />)
    act(() => { fireEvent.click(screen.getByTestId(`view-figure-edit-${card.id}`)) })
    const form = screen.getByTestId(`view-figure-form-${card.id}`)
    expect(form.className).toMatch(/\babsolute\b/)
    expect(form.className).toMatch(/\btop-full\b/)
    for (const t of [`view-figure-set-${card.id}`, `view-figure-try-${card.id}`]) expect(screen.getByTestId(t).className).toMatch(/whitespace-nowrap/)
    expect(screen.getByTestId(`view-figure-try-${card.id}`).className).not.toMatch(/info/)
  })
  it('D2b must not change: the same editor elsewhere (the dock\'s most-likely line) stays in place', () => {
    useViewStore.setState({ view, sid: view.id })
    render(<FigureEdit id={card.id} edit={card.figure!.edit!} place="likely" glyph="✎" words={false} />)
    act(() => { fireEvent.click(screen.getByTestId(`likely-edit-${card.id}`)) })
    expect(screen.getByTestId(`likely-form-${card.id}`).className).not.toMatch(/\babsolute\b/)
  })
})
