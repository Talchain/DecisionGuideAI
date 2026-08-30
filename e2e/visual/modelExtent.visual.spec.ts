/**
 * THE FIRST VIEW TELLS THE TRUTH ABOUT HOW MUCH OF THE MODEL IT IS SHOWING.
 *
 * WHY THIS EXISTS. Measured 30 Aug 2026 in Chromium at 1280x800: on
 * `build-vs-buy` SIX of twenty nodes are entirely outside the pane on first
 * view — including the DECISION NODE, the goal and all three risks — because
 * the auto-fit clamps at the 0.50 legibility floor and then centres. A tester
 * opening that starter alone sees a view that does not contain the decision,
 * and nothing on screen says so.
 *
 * WHAT THIS PINS, and the second one is the point:
 *  1. The notice APPEARS when part of the model is out of view, and states the
 *     remainder rather than fading.
 *  2. Its button ACTUALLY WORKS — after clicking, every node is inside the
 *     pane and the notice removes itself. A control that cannot do what it says
 *     is the defect class this product cleaned up on 29 Aug; this asserts the
 *     outcome, never the click.
 *  3. It STAYS AWAY when the whole model already fits — otherwise it is noise
 *     on every screen, and a notice that always shows says nothing.
 */
import { test, expect, type Page } from '@playwright/test'
import {
  preparePage, openCanvas, seedStarterDraft, clearNotifications,
  freezeMotion, waitForVisualQuiescence, VIEWPORTS,
} from './harness'

/**
 * Wait until the camera transform stops changing.
 *
 * `waitForVisualQuiescence` watches the LAYOUT store, which is silent about the
 * camera — so it returns while a 400ms fit animation is still in flight, and a
 * measurement taken then reports nodes outside the pane that are on their way
 * in. That is a false RED that looks exactly like a dead control.
 */
async function waitForCameraSettled(page: Page, timeoutMs = 5000): Promise<void> {
  await page.waitForFunction(
    () => {
      const vp = document.querySelector('.react-flow__viewport') as HTMLElement | null
      if (!vp) return false
      const w = window as unknown as { __lastTf?: string; __tfStableFrames?: number }
      const tf = getComputedStyle(vp).transform
      if (w.__lastTf === tf) { w.__tfStableFrames = (w.__tfStableFrames ?? 0) + 1 }
      else { w.__lastTf = tf; w.__tfStableFrames = 0 }
      return (w.__tfStableFrames ?? 0) >= 5
    },
    undefined,
    { timeout: timeoutMs, polling: 50 },
  )
}

/** Nodes wholly inside the pane, and the total, read from the live DOM. */
async function nodeVisibility(page: Page) {
  return page.evaluate(() => {
    const pane = document.querySelector('.react-flow') as HTMLElement | null
    if (!pane) return { paneOk: false, total: 0, fullyVisible: 0, hidden: document.hidden }
    const pr = pane.getBoundingClientRect()
    const els = [...document.querySelectorAll('.react-flow__node')]
    const fullyVisible = els.filter(el => {
      const r = el.getBoundingClientRect()
      return r.top >= pr.top - 1 && r.bottom <= pr.bottom + 1 && r.left >= pr.left - 1 && r.right <= pr.right + 1
    }).length
    return {
      paneOk: pr.width > 0 && pr.height > 0,
      total: els.length,
      fullyVisible,
      hidden: document.hidden,
    }
  })
}

test.describe('the first view discloses its own extent', () => {
  test('build-vs-buy: the notice states the remainder, and the button reveals the whole model', async ({ page }) => {
    await preparePage(page, VIEWPORTS[0])
    await openCanvas(page)
    await seedStarterDraft(page, 'build-vs-buy')
    await clearNotifications(page)
    await freezeMotion(page)
    await waitForVisualQuiescence(page)

    // ENVIRONMENT, asserted before any number is believed.
    const before = await nodeVisibility(page)
    expect(before.hidden, 'document.hidden — a hidden tab measures 0x0 and every result is void').toBe(false)
    expect(before.paneOk, 'the canvas pane has no size — nothing was measured').toBe(true)
    expect(before.total, 'no nodes mounted').toBeGreaterThan(0)

    // PRECONDITION PINNED IN-TEST: this starter really does overflow the pane.
    // Without this the assertions below could pass on a model that fits, which
    // would make the whole spec a tautology.
    expect(
      before.fullyVisible,
      `build-vs-buy is expected to overflow the first view; ${before.fullyVisible}/${before.total} were fully visible`,
    ).toBeLessThan(before.total)

    const notice = page.getByTestId('model-extent-notice')
    await expect(notice, 'part of the model is off-screen and nothing says so').toBeVisible()

    // It states a REMAINDER, with both numbers, not a bare "some hidden".
    const text = (await page.getByTestId('model-extent-count').textContent())?.trim() ?? ''
    expect(text).toMatch(/Showing \d+ of \d+ elements/)
    const [, shown, total] = text.match(/Showing (\d+) of (\d+)/)!.map(Number) as unknown as [string, number, number]
    expect(shown, 'the notice claims everything is visible while the pane disagrees').toBeLessThan(total)

    // THE CONTROL MUST DO WHAT IT SAYS.
    await page.getByTestId('model-extent-show-all').click()
    await waitForCameraSettled(page)

    const after = await nodeVisibility(page)
    expect(after.hidden).toBe(false)
    expect(
      after.fullyVisible,
      `"Show whole model" left ${after.total - after.fullyVisible} node(s) outside the pane`,
    ).toBe(after.total)

    // ...and having done it, the notice has nothing left to say.
    await expect(notice, 'the notice persists after the whole model is visible').toBeHidden()
  })

  test('headcount-allocation: no notice when the model already fits', async ({ page }) => {
    // The discriminating half. A notice that shows on every model is not a
    // signal — this proves it is answering the question, not always saying yes.
    await preparePage(page, VIEWPORTS[0])
    await openCanvas(page)
    await seedStarterDraft(page, 'headcount-allocation')
    await clearNotifications(page)
    await freezeMotion(page)
    await waitForVisualQuiescence(page)

    const v = await nodeVisibility(page)
    expect(v.hidden).toBe(false)
    expect(v.paneOk).toBe(true)
    expect(v.total).toBeGreaterThan(0)

    if (v.fullyVisible === v.total) {
      await expect(
        page.getByTestId('model-extent-notice'),
        'every node is inside the pane, so the notice must not claim otherwise',
      ).toBeHidden()
    } else {
      // Honest about its own precondition: if this starter also overflows, the
      // discrimination this test exists for is untested — say so rather than
      // passing quietly on the branch that proves nothing.
      await expect(page.getByTestId('model-extent-notice')).toBeVisible()
      test.info().annotations.push({
        type: 'warning',
        description: `headcount-allocation overflowed (${v.fullyVisible}/${v.total}); the no-notice branch was NOT exercised`,
      })
    }
  })
})
