/**
 * UI restore stage 1, rows 3 and 4 (DL ruling 10 Nov): a scenario waiting for its brief opens on the dock's rail with the welcome composer
 * on the canvas. The one rule both read (ViewWelcome.tsx awaitsBriefOf): decided only for the scenario on screen.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { awaitsBriefOf } from '../ViewWelcome'

const held: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'bakery.view.json'), 'utf8'))
const empty = { ...held, version: null, proposal: null } as View

describe('a scenario waiting for its brief', () => {
  it('a new scenario core holds nothing for (not yet named, or named) waits for its brief', () => {
    expect(awaitsBriefOf({ uuid: null, sid: null, view: null }, null)).toBe(true)
    expect(awaitsBriefOf({ uuid: 'u1', sid: null, view: null }, 'u1')).toBe(true)
  })
  it('a scenario core holds with no model and no proposal waits; one with a model does not', () => {
    expect(awaitsBriefOf({ uuid: 'u1', sid: 's_1', view: empty }, 'u1')).toBe(true)
    expect(held.version).not.toBeNull()
    expect(awaitsBriefOf({ uuid: 'u1', sid: 's_1', view: held }, 'u1')).toBe(false)
  })
  it('must not change: nothing is decided while the View held is another scenario\'s, or its own is not read yet', () => {
    expect(awaitsBriefOf({ uuid: 'u0', sid: null, view: null }, 'u1')).toBe(false)
    expect(awaitsBriefOf({ uuid: null, sid: null, view: null }, 'u1')).toBe(false)
    expect(awaitsBriefOf({ uuid: 'u1', sid: 's_1', view: null }, 'u1')).toBe(false)
  })
})

import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
vi.mock('../../lib/supabase', () => ({ supabase: {}, getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../lib/posthog', () => ({ trackEvent: () => undefined }))
import { useViewStore } from '../store'
import { useCanvasStore } from '../../canvas/store'
import { READING_WORDS, ViewWelcome } from '../ViewWelcome'
import { VIEW_QUESTION } from '../canvas'
import { QUESTION } from '../layout'

/** The View's drawing on the canvas, as drawViewCanvas starts it: the question node, by its id and the View's node type. */
const drawQuestion = () => useCanvasStore.setState({ nodes: [{ id: QUESTION, type: VIEW_QUESTION, position: { x: 0, y: 0 }, data: {} }] } as never)

describe('pre-screen row 9: after Send the canvas is never blank with no words', () => {
  const keep = useViewStore.getState().refresh
  afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, refresh: keep } as never); useCanvasStore.setState({ currentScenarioId: null, nodes: [] } as never) })
  const put = (s: object) => { useCanvasStore.setState({ currentScenarioId: 'u1' } as never); useViewStore.setState({ uuid: 'u1', at: null, ...s } as never); render(createElement(ViewWelcome)) }

  it('core holds the scenario and its View is not read yet: one status line, no composer, no retry', () => {
    put({ sid: 's_1', view: null, status: 'loading', error: null })
    expect(screen.getByTestId('view-reading-words')).toHaveTextContent(READING_WORDS)
    expect(screen.queryByTestId('view-reading-again')).toBeNull()
    expect(screen.queryByTestId('view-welcome')).toBeNull()
  })
  it('the read failed with no View: its reason on the canvas, and Try again reads once more', () => {
    let reads = 0
    put({ sid: 's_1', view: null, status: 'error', error: 'core said no', refresh: async () => { reads += 1; return false } })
    expect(screen.getByTestId('view-reading-words')).toHaveTextContent('core said no')
    fireEvent.click(screen.getByTestId('view-reading-again'))
    expect(reads).toBe(1)
  })
  it('contrast: a scenario whose model is read and drawn on the canvas draws neither', () => {
    drawQuestion()
    put({ sid: held.id, view: held, status: 'ready', error: null })
    expect(screen.queryByTestId('view-reading')).toBeNull()
    expect(screen.queryByTestId('view-welcome')).toBeNull()
  })
  it('catch (cold reopen, 14 Nov: the canvas stood empty with no words after the read): the one line stays, the same element, from the read until the model is drawn', () => {
    put({ sid: held.id, view: null, status: 'loading', error: null })
    const line = screen.getByTestId('view-reading-words')
    expect(line).toHaveTextContent(READING_WORDS)
    // The View is read; nothing of it is on the canvas yet (the layout engine loading, the board being laid out): the same line, unmoved.
    act(() => { useViewStore.setState({ view: held, status: 'ready' } as never) })
    expect(screen.getByTestId('view-reading-words')).toBe(line)
    expect(line).toHaveTextContent(READING_WORDS)
    expect(screen.queryByTestId('view-reading-again')).toBeNull()
    expect(screen.queryByTestId('view-welcome')).toBeNull()
    // The model is drawn: the line goes, and nothing takes its place.
    act(() => { drawQuestion() })
    expect(screen.queryByTestId('view-reading')).toBeNull()
    expect(screen.queryByTestId('view-welcome')).toBeNull()
  })
  it('must not change: another scenario\'s View held, or a View with no model, draws no opening line on an empty canvas', () => {
    useCanvasStore.setState({ currentScenarioId: 'u1' } as never)
    useViewStore.setState({ uuid: 'u0', sid: held.id, view: held, status: 'ready', error: null, at: null } as never)
    const { unmount } = render(createElement(ViewWelcome))
    expect(screen.queryByTestId('view-reading')).toBeNull()
    unmount()
    put({ sid: held.id, view: { ...held, model: null }, status: 'ready', error: null })
    expect(screen.queryByTestId('view-reading')).toBeNull()
  })
})
