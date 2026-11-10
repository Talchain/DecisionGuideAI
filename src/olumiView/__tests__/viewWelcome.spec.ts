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
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
vi.mock('../../lib/supabase', () => ({ supabase: {}, getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../lib/posthog', () => ({ trackEvent: () => undefined }))
import { useViewStore } from '../store'
import { useCanvasStore } from '../../canvas/store'
import { READING_WORDS, ViewWelcome } from '../ViewWelcome'

describe('pre-screen row 9: after Send the canvas is never blank with no words', () => {
  const keep = useViewStore.getState().refresh
  afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, refresh: keep } as never); useCanvasStore.setState({ currentScenarioId: null } as never) })
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
  it('contrast: a scenario whose model is read draws neither', () => {
    put({ sid: held.id, view: held, status: 'ready', error: null })
    expect(screen.queryByTestId('view-reading')).toBeNull()
    expect(screen.queryByTestId('view-welcome')).toBeNull()
  })
})
