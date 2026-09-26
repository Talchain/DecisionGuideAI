/**
 * FLOATING OLUMI COMPOSER — the half of the composer change that shipped
 * unphotographed.
 *
 * ⭐ WHY THIS EXISTS. The composer rework of 20 Sep 2026 keyed its whole layout
 * on ONE discriminator — `hasActionRow = isStrip || isFloating` — so the
 * floating panel's composer changed in exactly the same four ways the strip's
 * did: rest height 3 lines → 1, padding 16px → 12px, controls moved out of the
 * textarea onto a row beneath it, ceiling 8 lines → 10. The strip was measured
 * in a browser. The floating panel was verified by specs and DOM reads ONLY,
 * and shipped that way, with the gap reported rather than closed.
 *
 * ⚠ AND IT IS NOT A SIDE SURFACE. `FirstUseComposer` opens it
 * (`useFloatingPanelState.open`, FirstUseComposer.tsx:149) — it is the panel a
 * first-run user is looking at while their model is drafted. A layout defect
 * here lands on the first journey, not a corner of it.
 *
 * ⚠ THE ROUTE IS CLICKED, NOT SET. The panel could be mounted by writing the
 * zustand store, and that would photograph a state no user can reach. This
 * drives the real affordance — the strip's chevron, which the rework MOVED into
 * the new action row — so the capture is also the proof that the moved control
 * still opens what it advertises.
 *
 * Asserts the affordance works, and otherwise measures. Run deliberately:
 *   pnpm exec playwright test -c playwright.geometry.config.ts \
 *     e2e/geometry/floatingComposerLook.measure.ts
 */
import { test, expect, type Page } from '@playwright/test'
import {
  clearNotifications,
  freezeMotion,
  openCanvas,
  preparePage,
  seedStarterDraft,
  waitForVisualQuiescence,
} from '../visual/harness'

const VP = { width: 1440, height: 900 }
const OUT = process.env.SHOT_DIR ?? 'test-results/look'

test.use({
  launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' },
})

/**
 * Read the geometry that the rework actually changed, from the element rather
 * than from a constant. `composerLook` hard-coded the pad once and went red the
 * day the pad moved; the lesson was to ask the browser.
 */
async function measureComposer(page: Page, base: string) {
  return page.evaluate((b) => {
    const q = (sel: string) => document.querySelector(sel) as HTMLElement | null
    const ta = q(`[data-testid="${b}-textarea"]`) ?? q(`[data-testid="${b}"] textarea`)
    const row = q(`[data-testid="${b}-actions"]`)
    if (!ta) return { found: false as const, base: b }
    const cs = getComputedStyle(ta)
    const r = ta.getBoundingClientRect()
    const rowR = row?.getBoundingClientRect() ?? null
    const btns = row
      ? Array.from(row.querySelectorAll('button')).map((el) => {
          const br = el.getBoundingClientRect()
          return {
            testid: el.getAttribute('data-testid'),
            label: el.getAttribute('aria-label'),
            w: Math.round(br.width),
            h: Math.round(br.height),
          }
        })
      : []
    return {
      found: true as const,
      base: b,
      textarea: { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) },
      lineHeight: cs.lineHeight,
      padTop: cs.paddingTop,
      padBottom: cs.paddingBottom,
      padRight: cs.paddingRight,
      minHeight: ta.style.minHeight,
      maxHeight: ta.style.maxHeight,
      actionRow: rowR ? { w: Math.round(rowR.width), h: Math.round(rowR.height), top: Math.round(rowR.top) } : null,
      // The vertical distance from the bottom of the text box to the top of the
      // control row: the "dead band" the strip fix was about.
      gapTextToRow: rowR ? Math.round(rowR.top - r.bottom) : null,
      buttons: btns,
    }
  }, base)
}

async function seeded(page: Page) {
  await preparePage(page, VP)
  await openCanvas(page)
  const applied = await seedStarterDraft(page, 'build-vs-buy')
  expect(applied.nodeCount, 'starter seeded no nodes — nothing to measure').toBeGreaterThan(0)
  await clearNotifications(page)
  await freezeMotion(page)
  await waitForVisualQuiescence(page)
}

/**
 * ⚠ THE DOCK DOES NOT DEFAULT TO THE OLUMI TAB, AND THE STRIP IS A DIFFERENT
 * COMPONENT WHEN IT IS NOT.
 *
 * First run of this instrument reported `chevron: 0` on a canvas that plainly
 * showed a composer with a chevron. Both were true: the dock had come up on
 * `Reasoning`, and `PersistentInputStrip` renders REDIRECT mode on every
 * non-Olumi tab (`persistent-strip-composer-redirect`) — a button dressed as a
 * text box, with its own 28px chevron OUTSIDE the border and no `AIInputBar` at
 * all. So `ai-input-bar-strip-*` legitimately does not exist there. Selecting
 * the tab is a precondition of measuring the strip, not a nicety.
 */
async function openOlumiTab(page: Page) {
  const tab = page.locator('[data-testid="outputs-dock-tab-olumi"]')
  await expect(tab, 'the dock has no Olumi tab').toHaveCount(1)
  await tab.first().click()
  await waitForVisualQuiescence(page)
  await expect(
    page.locator('[data-testid="persistent-strip-composer"]'),
    'Olumi tab selected but the strip is still in redirect mode',
  ).toBeVisible({ timeout: 10_000 })
}

/**
 * Open the floating panel the way a person can, and say which way worked.
 * Two routes are advertised and both are worth proving: the minimised pill the
 * first-use flow leaves behind, and the chevron the rework moved into the
 * strip's new action row.
 */
async function openFloating(page: Page, route: 'pill' | 'chevron'): Promise<void> {
  if (route === 'pill') {
    // v3.1 DESIGN-GAP #29 (26 Sep 2026): the restore pill is not drawn over the
    // canvas while the dock is EXPANDED (its own Olumi tab is the way back), so
    // the pill route starts from the collapsed rail — the state in which the
    // pill is the way back.
    const collapse = page.getByRole('button', { name: 'Collapse outputs dock' })
    if (await collapse.count()) {
      await collapse.first().click()
      await waitForVisualQuiescence(page)
    }
    const pill = page.locator('[data-testid="floating-olumi-panel-pill"]')
    await expect(pill, 'no minimised floating pill to restore from').toBeVisible({ timeout: 10_000 })
    await pill.first().click()
  } else {
    await openOlumiTab(page)
    const chevron = page.locator('[data-testid="ai-input-bar-strip-chevron"]')
    await expect(chevron, 'the strip action row carries no chevron').toHaveCount(1)
    await chevron.first().click()
  }
  await expect(
    page.locator('[data-testid="floating-olumi-panel"]'),
    `the ${route} route did not open the floating Olumi panel`,
  ).toBeVisible({ timeout: 10_000 })
  await waitForVisualQuiescence(page)
}

test('FLOATING A — the pill route opens the panel, and the empty state is photographed', async ({ page }) => {
  await seeded(page)
  await page.screenshot({ path: `${OUT}/FLOAT-0-before.png` })

  // Route 1: the pill the first-use flow leaves behind.
  await openFloating(page, 'pill')
  await page.screenshot({ path: `${OUT}/FLOAT-A-pill.png` })
  const panel = page.locator('[data-testid="floating-olumi-panel"]')
  await panel.screenshot({ path: `${OUT}/FLOAT-A-panel.png` })

  const m = await measureComposer(page, 'ai-input-bar-floating')
  console.log('[floating] REST ' + JSON.stringify(m, null, 2))
  expect(m.found, 'the floating panel opened but carries no composer textarea').toBe(true)

  /**
   * ⭐ THE ONE PRODUCT ORACLE IN THIS FILE, and it is here because this is the
   * only place that can hold it. On an empty conversation this panel rendered a
   * blank 400×550 box while the docked tab, in the same frame and the same
   * state, rendered an invitation. No unit test could see the disagreement:
   * each host's specs were correct about their own host — the same shape as the
   * defect the invitation was introduced to fix in the first place.
   *
   * It asserts PRESENCE and NON-EMPTINESS, never wording. The sentence is
   * resolved by `useConversationStage`, and pinning its text here would make
   * this a second authority on what it says.
   */
  const floatingInvitation = page.locator('[data-testid="olumi-floating-empty-invitation"]')
  await expect(
    floatingInvitation,
    'the floating panel renders an empty conversation as a blank box',
  ).toBeVisible({ timeout: 10_000 })
  const floatingText = (await floatingInvitation.innerText()).trim()
  expect(floatingText.length, 'the invitation element is present but says nothing').toBeGreaterThan(0)
  console.log(`[floating] invitation: ${JSON.stringify(floatingText)}`)
})

test('FLOATING B — grown, with the action row beneath', async ({ page }) => {
  await seeded(page)
  await openFloating(page, 'pill')

  const rest = await measureComposer(page, 'ai-input-bar-floating')

  const ta = page.locator('[data-testid="ai-input-bar-floating-textarea"]')
  await ta.click()
  await ta.fill(
    'We are weighing building the ingestion pipeline in-house against buying the managed ' +
      'connector product. The build route costs two engineers for a quarter and leaves us ' +
      'owning the maintenance; the buy route is faster to first value but prices per seat ' +
      'and we would be renegotiating at renewal with no leverage. What should we weigh?',
  )
  await waitForVisualQuiescence(page)

  const grown = await measureComposer(page, 'ai-input-bar-floating')
  console.log('[floating] GROWN ' + JSON.stringify(grown, null, 2))
  console.log(
    `[floating] rest h=${rest.found ? rest.textarea.h : '?'} -> grown h=${grown.found ? grown.textarea.h : '?'}`,
  )

  await page.screenshot({ path: `${OUT}/FLOAT-B-grown.png` })
  await page.locator('[data-testid="floating-olumi-panel"]').screenshot({ path: `${OUT}/FLOAT-B-panel.png` })

  expect(grown.found && rest.found, 'composer not found in one of the two states').toBe(true)
  if (grown.found && rest.found) {
    expect(grown.textarea.h, 'the floating composer did not grow on type').toBeGreaterThan(rest.textarea.h)
  }
})

test('FLOATING C — the strip, on the tab that actually renders it', async ({ page }) => {
  await seeded(page)
  await openOlumiTab(page)
  const m = await measureComposer(page, 'ai-input-bar-strip')
  console.log('[strip] REST ' + JSON.stringify(m, null, 2))
  await page.screenshot({ path: `${OUT}/FLOAT-C-strip.png` })
  const dock = page.locator('[data-testid="outputs-dock"]')
  await dock.screenshot({ path: `${OUT}/FLOAT-C-dock.png` })
  expect(m.found, 'the Olumi tab is selected but the strip composer has no textarea').toBe(true)
})

/**
 * FLOATING D — ONE CLICK OPENS THE FLOATING PANEL, AT EVERY VIEWPORT, AND THE
 * CONSTRAINED WIDTHS STILL SHOW ONLY ONE EXPANDED SURFACE.
 *
 * ⭐ WHAT THIS PINNED BEFORE, AND WHY THE HISTORY STAYS. Written on 21 Sep 2026
 * this file asserted TWO clicks at 1280 and 1440 and one at 1680 and 1920,
 * because that is what the product did: at the narrow widths the panel opened
 * and was immediately minimised to the restore pill, so the chevron's label
 * ("Open Olumi in floating panel") was a promise the click did not keep. Those
 * are the ordinary laptop widths, so the two-click path was the one most people
 * got. The cells are kept, flipped to one click, so the defect cannot return
 * quietly — a regression puts a pill back and these go red by name.
 *
 * ⭐ THE CAUSE, ESTABLISHED BY TRACE RATHER THAN BY READING. Three plausible
 * mechanisms were tested against the live sequence and all three refuted
 * (`fitsAtMinSize` — ample room at 1440; the shell listener's own
 * `setShowResultsPanel(false)` microtask — that effect returns early once the
 * flag is false; a re-minimise of the pill-restored panel — it survives). The
 * answer came from capturing a stack at every write of the dock's `isOpen`,
 * AT THE CALL rather than inside the updater, where React's reducer is all a
 * stack can show: `floatOutToWindow`'s own tab bookkeeping moved `externalTab`,
 * which woke the external-tab sync effect, which read the just-collapsed dock
 * as a state to correct and re-opened it. The fix defers the surface request by
 * one frame so that effect settles against an open dock first. It is recorded
 * beside the code it changed.
 *
 * ⚠ THE SECOND ASSERTION IS THE ONE THAT KEEPS THE FIX HONEST. "One click" is
 * easy to get by simply not collapsing the dock — which would put two expanded
 * thinking surfaces side by side at 1280 and silently repeal the
 * constrained-composition rule (`needsSingleExpandedPanel`) that the collapse
 * exists to satisfy. So at the constrained widths this also requires the dock
 * to have actually yielded. Without it, this file would call the rule's
 * repeal a success.
 */
for (const vp of [
  { width: 1280, height: 800, constrained: true },
  { width: 1440, height: 900, constrained: true },
  { width: 1680, height: 1050, constrained: false },
  { width: 1920, height: 1080, constrained: false },
] as const) {
  test(`FLOATING D ${vp.width} — one click opens the panel${vp.constrained ? ', and the dock yields' : ''}`, async ({
    page,
  }) => {
    await preparePage(page, { width: vp.width, height: vp.height })
    await openCanvas(page)
    const applied = await seedStarterDraft(page, 'build-vs-buy')
    expect(applied.nodeCount).toBeGreaterThan(0)
    await clearNotifications(page)
    await freezeMotion(page)
    await waitForVisualQuiescence(page)
    await openOlumiTab(page)

    const dockWidthBefore = await page.evaluate(() => {
      const d = document.querySelector('aside[aria-label="Outputs dock"]')
      return d ? Math.round(d.getBoundingClientRect().width) : -1
    })

    await page.locator('[data-testid="ai-input-bar-strip-chevron"]').first().click()
    await waitForVisualQuiescence(page)

    const panel = page.locator('[data-testid="floating-olumi-panel"]')
    const pillCount = await page.locator('[data-testid="floating-olumi-panel-pill"]').count()
    const dockWidthAfter = await page.evaluate(() => {
      const d = document.querySelector('aside[aria-label="Outputs dock"]')
      return d ? Math.round(d.getBoundingClientRect().width) : -1
    })
    console.log(
      `[chevron ${vp.width}] panel visible: ${await panel.isVisible()}, pill: ${pillCount}, ` +
        `dock ${dockWidthBefore} -> ${dockWidthAfter}`,
    )

    await expect(
      panel,
      'one click on "Open Olumi in floating panel" did not open the floating Olumi panel',
    ).toBeVisible({ timeout: 10_000 })
    expect(pillCount, 'the panel opened but a restore pill was left behind — it bounced').toBe(0)

    if (vp.constrained) {
      expect(
        dockWidthAfter,
        'the panel opened WITHOUT the dock yielding — two expanded surfaces at a constrained width ' +
          'repeals the rule the collapse exists to satisfy',
      ).toBeLessThan(dockWidthBefore)
    }

    await page.screenshot({ path: `${OUT}/FLOAT-D-${vp.width}.png` })
  })
}
