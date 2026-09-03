/**
 * The boot boundary must SHOW the stale-build notice, not merely contain its text.
 *
 * ⚠ WHY THIS FILE EXISTS, AND IT IS THE POINT. The first version of this lane's
 * evidence was a source-level guard asserting that `main.tsx` contained
 * `STALE_BUILD_NOTICE_COPY` and `STALE_BUILD_ACTION_COPY`. A mutant that
 * replaced the branch condition with `if (false)` — making the notice
 * unreachable for every user, forever — left that guard fully GREEN, because
 * the literals were still in the file. Presence of copy is not coverage of the
 * branch that renders it.
 *
 * So the boundary was extracted from `main.tsx` (which self-boots on import and
 * therefore cannot be mounted) and is driven here through a real thrown error.
 * Both arms matter:
 *   · a CHUNK error must produce the truthful notice AND a working action;
 *   · an ORDINARY error must NOT, or the boundary would tell every crashing
 *     user that Olumi was updated — a comfortable lie.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BootErrorBoundary } from '../BootErrorBoundary'
import {
  CHUNK_RELOAD_GUARD_KEY,
  CHUNK_STALL_HEADING_COPY,
  CHUNK_STALL_NOTICE_COPY,
  createChunkStallError,
  STALE_BUILD_NOTICE_COPY,
} from '../lib/staleBuildRecovery'

function Boom({ message }: { message: string }): JSX.Element {
  throw new Error(message)
}

const CHUNK_MESSAGE =
  'Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/html".'

describe('BootErrorBoundary — the surface a mid-session deploy lands on', () => {
  const reload = vi.fn()
  let restoreConsole: () => void = () => {}

  beforeEach(() => {
    reload.mockClear()
    sessionStorage.clear()
    // React logs the caught error; silence it so the run stays readable.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    restoreConsole = () => spy.mockRestore()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload, hash: '#/canvas' },
    })
  })

  afterEach(() => {
    restoreConsole()
    cleanup()
  })

  it('renders the truthful notice when a chunk fails because the build moved', () => {
    // Spend the automatic reload first, so the render path (not the auto-reload)
    // is what this test observes — that is the state a real second failure hits.
    sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, String(Date.now()))

    render(
      <BootErrorBoundary>
        <Boom message={CHUNK_MESSAGE} />
      </BootErrorBoundary>,
    )

    const notice = screen.getByTestId('stale-build-notice')
    expect(notice).toBeInTheDocument()
    expect(notice).toHaveTextContent(STALE_BUILD_NOTICE_COPY)
    // The generic crash panel must NOT also be on screen.
    expect(screen.queryByTestId('boot-render-error')).not.toBeInTheDocument()
  })

  it('the notice never blames the server', () => {
    sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, String(Date.now()))
    render(
      <BootErrorBoundary>
        <Boom message={CHUNK_MESSAGE} />
      </BootErrorBoundary>,
    )
    const text = screen.getByTestId('stale-build-notice').textContent ?? ''
    expect(text).not.toMatch(/server|network|contact support/i)
  })

  it('gives the user a way forward that actually fetches the new build', async () => {
    sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, String(Date.now()))
    render(
      <BootErrorBoundary>
        <Boom message={CHUNK_MESSAGE} />
      </BootErrorBoundary>,
    )

    const button = screen.getByRole('button', { name: /reload/i })
    await userEvent.click(button)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('CONTRAST: an ordinary crash still gets the generic panel, not "Olumi was updated"', () => {
    // Without this arm the boundary could treat EVERY error as a stale build
    // and this suite would applaud.
    render(
      <BootErrorBoundary>
        <Boom message="Cannot read properties of undefined (reading &quot;id&quot;)" />
      </BootErrorBoundary>,
    )

    expect(screen.getByTestId('boot-render-error')).toBeInTheDocument()
    expect(screen.queryByTestId('stale-build-notice')).not.toBeInTheDocument()
  })

  it('CONTRAST: with no error at all, children render untouched', () => {
    render(
      <BootErrorBoundary>
        <div data-testid="child">app</div>
      </BootErrorBoundary>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.queryByTestId('stale-build-notice')).not.toBeInTheDocument()
  })

  it('attempts exactly one automatic reload on a fresh chunk failure', () => {
    // Guard budget untouched → the boundary should spend it once.
    render(
      <BootErrorBoundary>
        <Boom message={CHUNK_MESSAGE} />
      </BootErrorBoundary>,
    )
    expect(sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)).not.toBeNull()
  })
})

/**
 * The boot chunk can STALL as well as fail, and this boundary is what the user
 * meets when it does. Its Suspense fallback is `<Shell/>` — "Loading
 * application…" — so before the bound existed a stalled boot chunk left that
 * sentence on screen indefinitely while it had stopped being true.
 *
 * Both arms of the pair are here on purpose: the stall must produce a notice,
 * and it must NOT produce the stale-build one.
 */
describe('BootErrorBoundary — a boot chunk that STALLS rather than fails', () => {
  const reload = vi.fn()
  let restoreConsole: () => void = () => {}

  beforeEach(async () => {
    /*
     * ⚠ DRAIN FIRST, AND THE ORDER IS THE WHOLE POINT. `attemptStaleBuildReload`
     * DEFERS its reload by `setTimeout(..., 0)` — never mid-render. The describe
     * above spends that budget, so its stray timer fires during THIS describe and
     * lands on whichever `window.location.reload` mock is installed at the time.
     * Flushing it here, BEFORE the mock below replaces `window.location`, keeps
     * that call attributed to the describe that caused it. Without this the
     * reload-button arm reads 2 calls for one click — measured, not theorised.
     */
    await new Promise((resolve) => setTimeout(resolve, 0))
    reload.mockClear()
    sessionStorage.clear()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    restoreConsole = () => spy.mockRestore()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload, hash: '#/canvas' },
    })
  })

  afterEach(() => {
    restoreConsole()
    cleanup()
  })

  function renderStall() {
    const StallBoom = () => {
      throw createChunkStallError('Olumi', 45_000)
    }
    render(
      <BootErrorBoundary>
        <StallBoom />
      </BootErrorBoundary>,
    )
  }

  it('shows a named notice with a way forward, not the generic crash panel', () => {
    renderStall()
    const notice = screen.getByTestId('chunk-stall-notice')
    expect(notice).toHaveTextContent(CHUNK_STALL_HEADING_COPY)
    expect(notice).toHaveTextContent(CHUNK_STALL_NOTICE_COPY)
    expect(screen.queryByTestId('boot-render-error')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument()
  })

  it('⭐ CONTRAST: it does NOT say the build moved', () => {
    // The load-bearing arm. Both causes end in the same button, so a boundary
    // that reused the stale-build sentence would look fine and tell a lie.
    renderStall()
    const text = screen.getByTestId('chunk-stall-notice').textContent ?? ''
    expect(text).not.toContain(STALE_BUILD_NOTICE_COPY)
    expect(text).not.toMatch(/updated/i)
    expect(screen.queryByTestId('stale-build-notice')).not.toBeInTheDocument()
  })

  it('the reload button works', async () => {
    renderStall()
    await userEvent.click(screen.getByRole('button', { name: /reload/i }))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('⭐ does NOT spend the automatic reload — a stall must not re-enter the same wait', () => {
    // A stall that auto-reloaded would stall again and cost the user a SECOND
    // full bound before anything appeared. The stale-build arm above asserts the
    // opposite for its own cause, which is what makes this a discrimination
    // rather than a blanket "never reloads".
    renderStall()
    expect(sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)).toBeNull()
  })
})
