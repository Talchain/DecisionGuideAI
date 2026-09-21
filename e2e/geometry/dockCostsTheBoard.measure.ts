/**
 * WHAT THE DOCK COSTS THE BOARD — sizing the prize before anyone builds anything.
 *
 * `canvasFit` reads `clipped: 12 of 20` at 1440x900 with `dock: [1012, 416]`.
 * The dock reserves 416px of a 1440px laptop — 29% of the canvas width — and the
 * measured width gap (528px short) is LARGER than the height gap (390px short).
 * Two height levers have already been refuted against `clipped`, so this measure
 * asks the only remaining question: does collapsing the dock move the metric?
 *
 * ⛔ ASSERTS NOTHING. Instrument only. It reads `clipped` EXPANDED then COLLAPSED
 * in the same page, so the two readings share a layout, a camera and a build.
 *
 * CONTROL (trap 13): the collapse must actually change `freeRight`. If the dock's
 * box does not move, the second reading is the first one wearing a label, and the
 * run says so instead of reporting a saving.
 */
import { test, type Page } from '@playwright/test'
import {
  clearNotifications, freezeMotion, openCanvas, preparePage, seedStarterDraft,
  waitForVisualQuiescence, type StarterId,
} from '../visual/harness'

const VP = { width: 1440, height: 900 }

async function read(page: Page) {
  return page.evaluate(() => {
    const dock = document.querySelector('[data-testid="outputs-dock"]') as HTMLElement | null
    const nodes = Array.from(document.querySelectorAll('.react-flow__node')) as HTMLElement[]
    const dockBox = dock?.getBoundingClientRect()
    const freeRight = dockBox ? dockBox.x : window.innerWidth
    let clipped = 0
    for (const n of nodes) {
      const b = n.getBoundingClientRect()
      if (b.x < 0 || b.y < 0 || b.x + b.width > freeRight || b.y + b.height > window.innerHeight) clipped++
    }
    const vpEl = document.querySelector('.react-flow__viewport') as HTMLElement | null
    // ⚠ THE SELECTOR THE FIT ACTUALLY USES. `computeFitPadding` keys on
    // `DOCK_SELECTOR = 'aside[aria-label="Outputs dock"]'`, NOT the testid this
    // measure first used. Two spellings of "the dock" is the hand-maintained
    // mirror (trap 12), and a reading taken through the wrong one says nothing
    // about what the camera sees. Both are reported so they can be compared.
    const fitDock = document.querySelector('aside[aria-label="Outputs dock"]') as HTMLElement | null
    const fitBox = fitDock?.getBoundingClientRect()
    const flowEl = document.querySelector('.react-flow') as HTMLElement | null
    const flowRect = flowEl?.getBoundingClientRect()
    return {
      n: nodes.length, clipped,
      freeRight: Math.round(freeRight),
      dockW: dockBox ? Math.round(dockBox.width) : 0,
      // Is the fit's dock the SAME ELEMENT as the testid's?
      sameEl: !!dock && !!fitDock && dock === fitDock,
      fitDockLeft: fitBox ? Math.round(fitBox.left) : null,
      // The exact quantity `computeFitPadding` derives: flowRect.right - dock.left.
      fitOverlap: fitBox && flowRect ? Math.round(Math.max(0, flowRect.right - fitBox.left)) : null,
      tf: vpEl ? getComputedStyle(vpEl).transform : 'none',
    }
  })
}

async function report(page: Page, starter: StarterId) {
  await preparePage(page, VP)
  await openCanvas(page)
  await seedStarterDraft(page, starter)
  await clearNotifications(page)
  await freezeMotion(page)
  await waitForVisualQuiescence(page)

  const expanded = await read(page)

  const control = page.getByTestId('dock-collapse-control')
  const label = await control.getAttribute('aria-label').catch(() => null)
  if (label === 'Collapse outputs dock') await control.click()
  await waitForVisualQuiescence(page)

  // ⚠ THE RE-FIT IS RACY AND A SINGLE READ HIDES IT. Measured 22 Sep: the camera
  // re-framed (x -246 -> -58) in ONE of three otherwise identical runs, so a lone
  // post-collapse read reports "did not re-frame" two times in three and "did"
  // the third. That intermittency is the finding; sample it rather than average
  // it away, and report every distinct transform seen.
  const samples: string[] = []
  let collapsed = await read(page)
  samples.push(collapsed.tf)
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(250)
    const again = await read(page)
    if (again.tf !== samples[samples.length - 1]) samples.push(again.tf)
    collapsed = again
  }

  const moved = collapsed.freeRight !== expanded.freeRight
  console.log(`[dock] ${starter}: expanded=${JSON.stringify(expanded)}`)
  console.log(`[dock] ${starter}: collapsed=${JSON.stringify(collapsed)}`)
  const reframed = collapsed.tf !== expanded.tf
  console.log(`[dock] ${starter}: tf samples after collapse = ${JSON.stringify(samples)}`)
  console.log(`[dock] ${starter}: VERDICT clipped ${expanded.clipped} -> ${collapsed.clipped} of ${expanded.n}` +
    `  reframed=${reframed}` +
    (moved ? '' : '  ⛔ CONTROL FAILED — freeRight did not move, reading is void'))
}

for (const starter of ['build-vs-buy', 'pricing-model'] as const) {
  test(`DOCK — ${starter}`, async ({ page }) => { await report(page, starter) })
}
