/**
 * The canvas boundary must MEET a stalled route chunk, and must not mistake it
 * for the deploy race.
 *
 * ── WHAT SHIPPED, AND WHY THE ASYMMETRY WAS THE DEFECT ──────────────────────
 * A route chunk that FAILS was already handled well: run 33571760150 shows this
 * panel rendering "Something went wrong / Unable to preload CSS for
 * /assets/ReactFlowGraph-*.css" with Reload editor, Copy debug info and Report
 * issue. A route chunk that STALLS had no equivalent at all: the import promise
 * never settled, so this boundary was never involved, and the user held a
 * "Loading Canvas..." spinner — measured still alone on the page after 60 s,
 * with ZERO console output, in runs 33556631726 / 33578060840 / 33581772301 /
 * 33546491489.
 *
 * ⚠ THIS FILE PROVES THE PANEL, NOT THE RACE. jsdom cannot host a real Suspense
 * boundary against a real network stall; the browser proof is
 * `e2e/geometry/lazyChunkStall.measure.ts`. What is pinned here is the part a
 * browser test would be a slow and fragile way to check: that the panel renders,
 * that it names the right cause, and that it does NOT tell the user the build
 * moved.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { CanvasErrorBoundary } from '../ErrorBoundary'
import {
  CHUNK_RELOAD_GUARD_KEY,
  CHUNK_STALL_HEADING_COPY,
  CHUNK_STALL_NOTICE_COPY,
  createChunkStallError,
  STALE_BUILD_NOTICE_COPY,
} from '../../lib/staleBuildRecovery'

vi.mock('../../lib/monitoring', () => ({ captureError: vi.fn(), initMonitoring: vi.fn() }))
vi.mock('../persist/crashFlush', () => ({ flushWorkToAutosave: () => false }))

function Boom({ error }: { error: Error }): JSX.Element {
  throw error
}

const STALL = () => createChunkStallError('The canvas', 45_000)
const STALE_BUILD = () =>
  new Error('Failed to fetch dynamically imported module: /assets/CanvasMVP-BNoXst43.js')
const ORDINARY = () => new Error('Cannot read properties of undefined (reading "id")')

/**
 * The stale-build arm below DELIBERATELY spends the auto-reload, and
 * `attemptStaleBuildReload` defers a real `location.reload()` by setTimeout(0).
 * jsdom answers that with an unhandled "Not implemented: navigation" on the
 * timer queue — noise that reads exactly like a defect in the next reader's log.
 * Stub it: the assertion that matters is the sessionStorage budget, not the
 * navigation, and `ErrorBoundary.recovery.spec.tsx` already owns the reload.
 */
function stubReload() {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: vi.fn(), hash: '#/canvas' },
  })
}

function renderWith(error: Error) {
  render(
    <CanvasErrorBoundary>
      <Boom error={error} />
    </CanvasErrorBoundary>,
  )
}

describe('CanvasErrorBoundary — a route chunk that STALLS', () => {
  let restoreConsole: () => void = () => {}

  beforeEach(async () => {
    // See BootErrorBoundary.staleBuild.spec.tsx: attemptStaleBuildReload defers
    // its reload by setTimeout(0), so drain before installing this mock.
    await new Promise((resolve) => setTimeout(resolve, 0))
    sessionStorage.clear()
    stubReload()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    restoreConsole = () => spy.mockRestore()
  })

  afterEach(() => {
    restoreConsole()
    cleanup()
  })

  it('renders the recovery panel, attributed to the stall', () => {
    renderWith(STALL())
    const panel = screen.getByTestId('canvas-error-panel')
    // Bound by IDENTITY, not by "a panel is visible" — which every crash
    // satisfies (CLAUDE.md trap 19).
    expect(panel).toHaveAttribute('data-error-cause', 'chunk-stall')
    expect(panel).toHaveTextContent(CHUNK_STALL_HEADING_COPY)
    expect(panel).toHaveTextContent(CHUNK_STALL_NOTICE_COPY)
  })

  it('offers the same three ways forward the FAILED case already had', () => {
    // This is the parity the whole change is for: the rejected path had these
    // and the stalled path had nothing.
    renderWith(STALL())
    expect(screen.getByRole('button', { name: /reload editor/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy debug info/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /report issue/i })).toBeInTheDocument()
  })

  it('⭐ does NOT say Olumi was updated — that is the other cause', () => {
    renderWith(STALL())
    const text = screen.getByTestId('canvas-error-panel').textContent ?? ''
    expect(text).not.toContain(STALE_BUILD_NOTICE_COPY)
    expect(text).not.toMatch(/Olumi was updated/i)
  })

  it('⭐ does NOT spend the shared auto-reload budget', () => {
    // A stall that auto-reloaded would stall again and cost a SECOND full bound
    // before anything appeared. See isChunkDeliveryFailure in staleBuildRecovery.
    renderWith(STALL())
    expect(sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)).toBeNull()
  })

  it('prints the stall message, which names the surface and the wait', () => {
    renderWith(STALL())
    expect(screen.getByTestId('canvas-error-panel')).toHaveTextContent(
      'The canvas did not finish loading within 45s',
    )
  })
})

/*
 * ⭐ THE DISCRIMINATING TWINS. Each arm below is the same assertion pointed at a
 * DIFFERENT cause, and its expected answer DIFFERS. Without them, a boundary
 * that rendered the stall panel for every error at all would pass every arm
 * above (CLAUDE.md trap 13e — keep at least one probe whose expected answer
 * differs, because a blind instrument can fake agreement but not a
 * discrimination it is not making).
 */
describe('CanvasErrorBoundary — CONTRAST: the other two causes are unchanged', () => {
  let restoreConsole: () => void = () => {}

  beforeEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
    sessionStorage.clear()
    stubReload()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    restoreConsole = () => spy.mockRestore()
  })
  afterEach(() => {
    restoreConsole()
    cleanup()
  })

  it('a STALE BUILD still gets its own sentence, and still spends the auto-reload', () => {
    renderWith(STALE_BUILD())
    const panel = screen.getByTestId('canvas-error-panel')
    expect(panel).toHaveAttribute('data-error-cause', 'stale-build')
    expect(panel).toHaveTextContent(STALE_BUILD_NOTICE_COPY)
    expect(panel).not.toHaveTextContent(CHUNK_STALL_NOTICE_COPY)
    // The auto-reload is CORRECT for this cause and must survive the change.
    expect(sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)).not.toBeNull()
  })

  it('an ORDINARY crash still gets the generic panel', () => {
    renderWith(ORDINARY())
    const panel = screen.getByTestId('canvas-error-panel')
    expect(panel).toHaveAttribute('data-error-cause', 'unexpected')
    expect(panel).toHaveTextContent('The canvas encountered an unexpected error')
    expect(panel).not.toHaveTextContent(CHUNK_STALL_NOTICE_COPY)
    expect(panel).not.toHaveTextContent(STALE_BUILD_NOTICE_COPY)
    expect(sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)).toBeNull()
  })
})
