/**
 * A MODEL THAT WILL NOT LOAD MUST SAY SO — ON A PRODUCTION BUILD.
 *
 * The defect, witnessed by Paul signed in on 11 Sep 2026: an empty canvas, no
 * message, nothing in the console. Both failure arms of
 * `useScenario.loadScenario` ended in a bare `return` whose only trace was a
 * `console.warn` behind `import.meta.env.DEV` — and staging IS a production
 * build, so on the one environment where this is witnessed the trace was
 * compiled out. A model that failed to load was indistinguishable from a model
 * that is genuinely empty.
 *
 * ⚠ THE ESCAPE THESE TESTS ARE WRITTEN TO CATCH. Vitest runs with DEV truthy,
 * so a case asserting merely "something was logged" would PASS against the code
 * this replaces. Every assertion below targets the BREADCRUMB RING and the
 * TOAST — the two channels the old code never wrote to — and never the console.
 *
 * ⚠ TWO REASONS, ASSERTED APART (trap 21). `not_found` (PGRST116, which also
 * covers a row hidden by row-level security) and `rejected` (every other
 * Supabase error, which THROWS) are different questions. A fix that collapsed
 * them into one message would be a false claim half the time, so the
 * discriminating case below fails if the two ever report the same phase.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import {
  HARNESS_NODES,
  mockSingle,
  supabaseMockModule,
  authMockModule,
  routerMockModule,
  resetScenarioHarness,
  setScenarioRow,
  scenarioRow,
} from '../../test/helpers/useScenarioSupabaseHarness'

vi.mock('../../lib/supabase', () => supabaseMockModule())
vi.mock('react-router-dom', () => routerMockModule())
vi.mock('../../contexts/AuthContext', () => authMockModule())

import { useScenario } from '../useScenario'

type Crumb = { m?: string; data?: Record<string, unknown> }

function crumbs(): Crumb[] {
  const w = window as unknown as { __SAFE_DEBUG__?: { logs?: Crumb[] } }
  return w.__SAFE_DEBUG__?.logs ?? []
}
function loadFailures(): Crumb[] {
  return crumbs().filter(c => typeof c.m === 'string' && c.m.includes('scenario:load:failed'))
}

let toasts: Array<{ message?: string; level?: string }> = []
const onToast = (e: Event) => { toasts.push((e as CustomEvent).detail ?? {}) }

beforeEach(() => {
  resetScenarioHarness()
  toasts = []
  const w = window as unknown as { __SAFE_DEBUG__?: { logs?: Crumb[] } }
  if (w.__SAFE_DEBUG__?.logs) w.__SAFE_DEBUG__.logs.length = 0
  window.addEventListener('topbar:show-toast', onToast)
})
afterEach(() => { window.removeEventListener('topbar:show-toast', onToast) })

async function load(id: string) {
  const { result } = renderHook(() => useScenario())
  await act(async () => { await result.current.loadScenario(id) })
}

describe('useScenario.loadScenario — a load failure reaches a production build', () => {
  it('NOT FOUND: breadcrumbs the reason and tells the user, rather than returning silently', async () => {
    // PRECONDITION (trap 13b): an unseeded id is served Supabase's real
    // PGRST116 by the harness, so this case cannot pass for the wrong reason.
    await load('scenario-that-does-not-exist')

    const hits = loadFailures()
    expect(hits).toHaveLength(1)
    expect(hits[0].data?.phase).toBe('not_found')
    expect(hits[0].data?.scenarioId).toBe('scenario-that-does-not-exist')

    expect(toasts).toHaveLength(1)
    expect(String(toasts[0].message)).toMatch(/could not be opened/i)
    expect(toasts[0].level).toBe('error')
  })

  it('REJECTED: a thrown persistence error is caught, breadcrumbed and announced', async () => {
    // Any non-PGRST116 error makes the service THROW. That rejection was
    // previously unhandled here and still painted a blank canvas.
    mockSingle.mockResolvedValue({ data: null, error: { code: '08006', message: 'connection failure' } })

    await expect(load('scenario-unreachable')).resolves.toBeUndefined()

    const hits = loadFailures()
    expect(hits).toHaveLength(1)
    expect(hits[0].data?.phase).toBe('rejected')
    // The reason is carried, not just the fact — a bare "it failed" names nothing.
    expect(JSON.stringify(hits[0].data?.err ?? {})).toMatch(/connection failure/i)

    expect(toasts).toHaveLength(1)
    expect(String(toasts[0].message)).toMatch(/could not be loaded/i)
  })

  it('DISCRIMINATES the two reasons — one message for both would be false half the time', async () => {
    await load('scenario-that-does-not-exist')
    const notFound = loadFailures()[0]

    const w = window as unknown as { __SAFE_DEBUG__?: { logs?: Crumb[] } }
    if (w.__SAFE_DEBUG__?.logs) w.__SAFE_DEBUG__.logs.length = 0
    toasts = []

    mockSingle.mockResolvedValue({ data: null, error: { code: '08006', message: 'connection failure' } })
    await load('scenario-unreachable')
    const rejected = loadFailures()[0]

    expect(notFound.data?.phase).not.toBe(rejected.data?.phase)
  })

  it('promises no recovery it cannot perform', async () => {
    await load('scenario-that-does-not-exist')
    // ⛔ The not-found arm must not offer a retry: whether the model can be
    // re-fetched is not knowable here. #1473 removed a control that claimed an
    // action it could not do; this must not reintroduce one.
    expect(String(toasts[0].message)).not.toMatch(/try again|retry/i)
  })

  it('CONTROL — a successful load writes no failure crumb and raises no toast', async () => {
    setScenarioRow('scenario-ok', scenarioRow('scenario-ok', { nodes: HARNESS_NODES, edges: [] }))
    await load('scenario-ok')

    // Anti-vacuity: this asserts the absence of a marker, so the case only means
    // something if the load actually happened. The harness served the row above.
    expect(loadFailures()).toHaveLength(0)
    expect(toasts).toHaveLength(0)
  })
})
