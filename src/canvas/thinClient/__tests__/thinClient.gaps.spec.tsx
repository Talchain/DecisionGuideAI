/**
 * THIN CLIENT — GAP-1 and GAP-2 (DL, after #2511).
 *
 * GAP-1: a signed-in page keeps no local model, so a server read that ENDS without one must say so — never a silent
 * empty canvas. Every ending outcome is a row (the class is the six `ServerGraphTerminalReason`s), each beside the GUEST
 * row that shows today's behaviour unchanged (nothing set).
 *
 * GAP-2: a signed-in page is not offered "Save Current Canvas" (the save would be refused, and the old toast blamed
 * storage quota). Guest contrast: still offered.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, screen } from '@testing-library/react'

import { useServerGraphHydration } from '../../hooks/useServerGraphHydration'
import * as hydration from '../../hydrate/serverGraphHydration'
import type { HydrationOutcome } from '../../hydrate/serverGraphHydration'
import { useServerGraphRetryStore, type ServerGraphTerminalReason } from '../../stores/serverGraphRetryStore'
import {
  ServerGraphRetryNotice,
  SERVER_GRAPH_RETRY_ACTION_COPY,
  SERVER_GRAPH_RETRY_NOTICE_TESTID,
  SERVER_GRAPH_TERMINAL_COPY,
} from '../../components/ServerGraphRetryNotice'
import { SnapshotManager, SNAPSHOTS_NOT_KEPT_SIGNED_IN } from '../../components/SnapshotManager'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'
import { __resetThinClientForTests } from '../thinClient'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'

let user: { id: string } | null = { id: 'u' }
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user }) }))

const A = '11111111-2222-4333-8444-555555555555'
const REASONS: ServerGraphTerminalReason[] = ['notReadable', 'unavailable', 'signInRequired', 'refused', 'unusable', 'mergeRefused']

const signIn = () => localStorage.setItem('sb-testproject-auth-token', '{"access_token":"t","user":{"id":"u"}}')

beforeEach(() => {
  localStorage.clear()
  __resetThinClientForTests()
  __resetPersistenceSessionForTests()
  useServerGraphRetryStore.getState().clear()
  useDraftStore.getState().resetDraft()
  useCanvasStore.setState({ currentScenarioId: A, nodes: [], edges: [] } as never)
})
afterEach(() => { vi.restoreAllMocks() })

async function readEnds(outcome: HydrationOutcome) {
  vi.spyOn(hydration, 'hydrateCanvasFromServer').mockResolvedValue(outcome)
  renderHook(() => useServerGraphHydration(A))
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)) })
  return useServerGraphRetryStore.getState()
}

describe('GAP-1 — a thin read that ends without a model says so (the hook)', () => {
  it.each(REASONS)('CONTRAST — guest, %s: nothing is set (unchanged behaviour)', async (reason) => {
    const st = await readEnds(reason)
    expect(st.stage).toBe('idle')
  })

  it.each(REASONS)('thin, %s: the terminal stage names the ending, keyed to the scenario', async (reason) => {
    signIn()
    const st = await readEnds(reason)
    expect({ stage: st.stage, reason: st.reason, scenarioId: st.scenarioId }).toEqual({ stage: 'terminal', reason, scenarioId: A })
  })

  it('thin, merged: nothing to say', async () => {
    signIn()
    const st = await readEnds('merged')
    expect(st.stage).toBe('idle')
  })
})

describe('GAP-1 — the words and the action for each ending (the notice)', () => {
  const show = (reason: ServerGraphTerminalReason) => {
    useServerGraphRetryStore.getState().setTerminal({ scenarioId: A, reason })
    render(<ServerGraphRetryNotice />)
    return screen.getByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)
  }

  it.each(REASONS)('%s: its own sentence, no spinner', (reason) => {
    const el = show(reason)
    expect(el.textContent).toContain(SERVER_GRAPH_TERMINAL_COPY[reason])
    expect(el.querySelector('.animate-spin')).toBeNull()
  })

  it('signInRequired: offers Sign in (#/login) and NEVER "Reload the page"', () => {
    const el = show('signInRequired')
    const action = screen.getByTestId(`${SERVER_GRAPH_RETRY_NOTICE_TESTID}-action`)
    expect(action.getAttribute('href')).toBe('#/login')
    expect(el.textContent).not.toContain(SERVER_GRAPH_RETRY_ACTION_COPY)
  })

  it('notReadable: offers the decisions list (#/), not a reload that cannot change a 404', () => {
    const el = show('notReadable')
    expect(screen.getByTestId(`${SERVER_GRAPH_RETRY_NOTICE_TESTID}-action`).getAttribute('href')).toBe('#/')
    expect(el.textContent).not.toContain(SERVER_GRAPH_RETRY_ACTION_COPY)
  })

  it.each(['unavailable', 'refused', 'unusable', 'mergeRefused'] as const)('%s: offers "Reload the page"', (reason) => {
    show(reason)
    expect(screen.getByTestId(`${SERVER_GRAPH_RETRY_NOTICE_TESTID}-action`).textContent).toBe(SERVER_GRAPH_RETRY_ACTION_COPY)
  })

  it('a terminal stage with no reason says nothing (never the "Looking…" sentence)', () => {
    useServerGraphRetryStore.setState({ scenarioId: A, stage: 'terminal', reason: null })
    render(<ServerGraphRetryNotice />)
    expect(screen.queryByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)).toBeNull()
  })
})

describe('GAP-2 — Snapshot Manager', () => {
  const open = () => render(<ToastProvider><SnapshotManager isOpen onClose={() => undefined} /></ToastProvider>)

  it('CONTRAST — guest: "Save Current Canvas" is offered', () => {
    open()
    expect(screen.getByRole('button', { name: /Save Current Canvas/ })).toBeTruthy()
    expect(screen.queryByTestId('snapshot-manager-thin-note')).toBeNull()
  })

  it('thin: not offered; the page says snapshots are not kept here', () => {
    signIn()
    open()
    expect(screen.queryByRole('button', { name: /Save Current Canvas/ })).toBeNull()
    expect(screen.getByTestId('snapshot-manager-thin-note').textContent).toBe(SNAPSHOTS_NOT_KEPT_SIGNED_IN)
  })
})
