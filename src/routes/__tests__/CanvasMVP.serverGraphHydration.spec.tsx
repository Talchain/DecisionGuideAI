/**
 * The WIRING pin — adversarial-review finding A2.
 *
 * Before this file, deleting the one `useServerGraphHydration(...)` call in
 * CanvasMVP left every other spec GREEN: the client, the merge and the boot
 * orchestration were all pinned in isolation while the line that makes the
 * feature exist at all was pinned by nothing. That is the trap-19 proof
 * obligation unmet at the mounting layer — delete the producer and the tests
 * must go red.
 *
 * This renders the REAL CanvasMVP (heavy children stubbed) and asserts the hook
 * is actually invoked. `useServerGraphHydration` is the single module under
 * spy; everything else is stubbed only to make the route mountable in jsdom.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const hydrationSpy = vi.fn()

vi.mock('../../canvas/hooks/useServerGraphHydration', () => ({
  useServerGraphHydration: (id?: string | null) => hydrationSpy(id),
}))

// ── Heavy children, stubbed to keep the route mountable in jsdom ────────────
vi.mock('../../canvas/ReactFlowGraph', () => ({
  default: () => <div data-testid="rfg-stub" />,
}))
vi.mock('../../components/layout/TopBar', () => ({ TopBar: () => <div /> }))
vi.mock('../../components/DebugTray', () => ({ DebugTray: () => <div /> }))
vi.mock('../../canvas/hooks/useResultsRun', () => ({
  useResultsRun: () => ({ run: vi.fn() }),
}))
vi.mock('../../canvas/hooks/useDebugShortcut', () => ({
  useDebugShortcut: () => ({ showDebug: false }),
}))
vi.mock('../../canvas/utils/sandboxTelemetry', () => ({ trackCanvasOpened: vi.fn() }))
vi.mock('../../hooks/useScenario', () => ({
  useScenario: () => ({
    loadScenario: vi.fn(),
    saveStatus: 'saved',
    lastSavedAt: null,
    saveError: null,
    isPersistenceActive: false,
    createSharedBrief: vi.fn(),
  }),
}))
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: ROUTE_ID }),
}))

const ROUTE_ID = '11111111-2222-4333-8444-555555555555'

import CanvasMVP from '../CanvasMVP'

beforeEach(() => {
  hydrationSpy.mockClear()
})

describe('CanvasMVP — the hydration hook is actually mounted (A2)', () => {
  it('CALLS useServerGraphHydration on render — delete the call and this goes RED', () => {
    render(<CanvasMVP />)
    expect(hydrationSpy).toHaveBeenCalled()
  })

  it('passes the ROUTE scenario id through, not something else', () => {
    render(<CanvasMVP />)
    expect(hydrationSpy).toHaveBeenCalledWith(ROUTE_ID)
  })
})

describe('CanvasMVP — boot ORDERING invariant (A5)', () => {
  /**
   * Restore-before-hydrate is what makes this a MERGE rather than a race: the
   * canvas is populated by `ReactFlowGraph`'s init effect (child effects run
   * before parent effects), so the overlay lands on real local nodes carrying
   * real local positions.
   *
   * ⚠ THAT RESTS ENTIRELY ON `ReactFlowGraph` BEING A STATIC IMPORT. A child
   * behind `lazy()` + `Suspense` does not mount in the same commit, so its init
   * effect would run AFTER this hook's — and hydration would overlay an EMPTY
   * store, losing every position with no error anywhere. `TemplatesPanel` is
   * already `lazy()` one section up in this same file, so the tidy-up that
   * breaks this is both plausible and silent. Pin the invariant, not the hope.
   */
  it('imports ReactFlowGraph STATICALLY (a lazy() here would silently break the merge)', () => {
    const dir = path.dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(path.join(dir, '..', 'CanvasMVP.tsx'), 'utf8')

    expect(src).toMatch(/^import ReactFlowGraph from '\.\.\/canvas\/ReactFlowGraph'$/m)
    expect(src).not.toMatch(/lazy\(\s*\(\)\s*=>\s*import\('\.\.\/canvas\/ReactFlowGraph'\)/)

    // POSITIVE CONTROL (trap 13): the same matcher DOES find the lazy form on
    // the sibling that genuinely uses it, so a green above is an observation
    // rather than a matcher that can never fire.
    expect(src).toMatch(/lazy\(\s*\(\)\s*=>\s*import\('\.\.\/canvas\/panels\/TemplatesPanel'\)/)
  })
})
