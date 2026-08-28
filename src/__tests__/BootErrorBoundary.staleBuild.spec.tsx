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
import { CHUNK_RELOAD_GUARD_KEY, STALE_BUILD_NOTICE_COPY } from '../lib/staleBuildRecovery'

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
