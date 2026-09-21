/**
 * ⭐⭐ THE WATCHER LISTENED TO `resize` AND THEN THREW THE ANSWER AWAY.
 *
 * `watchReservedBox` subscribes to `window.resize`, and its own trigger list
 * says so in writing — *"`resize` on window — the viewport itself changed"*.
 * But the DECISION it makes compares `reservedBoxSignature`, which is four px
 * strings describing the PANELS: the dock's 444px, the sidebar, the header
 * banner. None of those change when the user resizes the window. So the
 * trigger fires, `next === last`, and the function returns without re-fitting.
 *
 * That is CLAUDE.md trap 21 — two questions under one name. The caller
 * (`useFitViewOnLayoutVersion`'s reserved-box trigger) needs to know whether
 * THE FRAME THE FIT TARGETS changed. That frame is `pane MINUS reservation`,
 * and only one of those two terms was in the signal.
 *
 * MEASURED, real Chromium, render loop asserted live (38 frames), the repo's
 * own `e2e/geometry/viewportRestoreFit.measure.ts` at 1280x800 / 1440x900 /
 * 1512x982 — reloading once and then RESIZING:
 *
 *     matrix(0.5, 0, 0, 0.5, -326, 61)
 *     matrix(0.5, 0, 0, 0.5, -326, 61)
 *     matrix(0.5, 0, 0, 0.5, -326, 61)
 *
 * One distinct transform across three window sizes. The contrast control in
 * the same run is what makes this the watcher's defect and not the camera's:
 * ARRIVING at each size does re-frame (-326 / -246 / -210), so the fit itself
 * works and is simply never asked to run again.
 *
 * ⚠ THE POSITIVE CONTROL IS THE POINT OF THIS FILE, not decoration. The
 * watcher's governing property is *"a trigger we failed to think of degrades
 * to the previous behaviour (no re-fit), never to a wrong fit"*, and its own
 * header records that a SPURIOUS fire is not free — it cost a measured user
 * their camera in defect #1051. So this pins BOTH directions: a changed pane
 * must fire, and a quiet pane must stay silent.
 */
import { describe, it, expect, vi } from 'vitest'
import { watchReservedBox } from '../reservedBoxWatcher'
import type { FitPadding } from '../computeFitPadding'

const PANELS: FitPadding = { top: '73px', right: '444px', bottom: '29px', left: '76px' }

/** Drives the two coalescing paths the watcher uses: one rAF, one settle timer. */
async function settle(ms = 400): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms))
}

describe('the reserved-box watcher follows the WINDOW, not only the panels', () => {
  it('POSITIVE CONTROL: a pane that does not change does not fire', async () => {
    const onChange = vi.fn()
    const stop = watchReservedBox(onChange, {
      measure: () => PANELS,
      measurePane: () => ({ width: 1280, height: 800 }),
      settleMs: 10,
    })
    window.dispatchEvent(new Event('resize'))
    await settle(80)
    stop()
    expect(
      onChange,
      'the watcher fired with nothing changed — a spurious fire costs the user their camera (#1051)',
    ).not.toHaveBeenCalled()
  })

  it('⭐ a window resize that changes the PANE but not the PANELS re-fits', async () => {
    const onChange = vi.fn()
    let pane = { width: 1280, height: 800 }
    const stop = watchReservedBox(onChange, {
      // The panels are deliberately CONSTANT. This is the exact live state: the
      // dock is 444px before and after the resize, so the old signature was
      // byte-identical across the whole gesture.
      measure: () => PANELS,
      measurePane: () => pane,
      settleMs: 10,
    })
    pane = { width: 1512, height: 982 }
    window.dispatchEvent(new Event('resize'))
    await settle(80)
    stop()
    expect(
      onChange,
      'the window changed size and the camera was never asked to re-frame — this is the measured "the frame does not follow the window" defect',
    ).toHaveBeenCalled()
  })

  it('the pane becoming measurable is itself a change, so a late pane recovers', async () => {
    // The watcher's header names this hole explicitly: the signal is taken at
    // SUBSCRIBE time, and nothing later notices if the box was not yet real.
    const onChange = vi.fn()
    let present = false
    const stop = watchReservedBox(onChange, {
      measure: () => PANELS,
      measurePane: () => (present ? { width: 1280, height: 800 } : null),
      settleMs: 10,
    })
    present = true
    window.dispatchEvent(new Event('resize'))
    await settle(80)
    stop()
    expect(onChange, 'the pane appeared after subscribe and the fit never re-ran').toHaveBeenCalled()
  })
})
