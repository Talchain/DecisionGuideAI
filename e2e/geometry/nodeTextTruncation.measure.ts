/**
 * WHAT IS ACTUALLY TRUNCATED INSIDE A NODE, AND IS THE CARD OR THE RULE AT FAULT?
 *
 * Seen on the deployed build at 1730x900: titles and reference lines ending in
 * an ellipsis inside a card that had just been widened. "The card is too small"
 * and "this element is clamped regardless of card width" are DIFFERENT defects
 * with opposite fixes, so this separates them by measuring, per element, both
 * the overflow AND whether a line-clamp or ellipsis rule is what produced it.
 */
import { test } from '@playwright/test'
import { preparePage, openCanvas, seedStarterDraft, clearNotifications, freezeMotion, waitForVisualQuiescence } from '../visual/harness'

const VP = { name: '1730x900', width: 1730, height: 900 }

test(`NODE TEXT TRUNCATION vendor-selection @${VP.name}`, async ({ page }) => {
  await preparePage(page, VP)
  await openCanvas(page)
  await seedStarterDraft(page, 'vendor-selection')
  await clearNotifications(page)
  await freezeMotion(page)
  await waitForVisualQuiescence(page)

  const m = await page.evaluate(async () => {
    const t0 = performance.now(); let frames = 0
    await new Promise<void>(res => { (function tick(){ frames++; performance.now()-t0 < 600 ? requestAnimationFrame(tick) : res() })() })
    const fps = +(frames / ((performance.now()-t0)/1000)).toFixed(1)

    const clipped: Array<Record<string, unknown>> = []
    for (const node of document.querySelectorAll('.react-flow__node')) {
      for (const el of node.querySelectorAll<HTMLElement>('*')) {
        if (el.children.length > 0) continue          // leaf text only
        const txt = (el.textContent || '').trim()
        if (!txt) continue
        const cs = getComputedStyle(el)
        const overflowsX = el.scrollWidth > el.clientWidth + 1
        const overflowsY = el.scrollHeight > el.clientHeight + 1
        const hasEllipsis = cs.textOverflow === 'ellipsis'
        const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none' ? cs.webkitLineClamp : null
        if (!overflowsX && !overflowsY) continue
        clipped.push({
          text: txt.slice(0, 42),
          cls: el.className.toString().slice(0, 46),
          fontPx: cs.fontSize,
          clientW: Math.round(el.clientWidth), scrollW: Math.round(el.scrollWidth),
          overflowsX, overflowsY, hasEllipsis, lineClamp: clamp,
          // the discriminator: is the box narrower than its text NEEDS, or is a
          // rule clamping it while the box has room?
          cause: overflowsY && clamp ? 'LINE-CLAMP (rule, not width)'
               : overflowsX && hasEllipsis ? 'ELLIPSIS-X (box narrower than text)'
               : overflowsY ? 'HEIGHT-BOUND (rule or reserve)'
               : 'OVERFLOW-X, no ellipsis (silently cut)',
        })
      }
    }
    const byCause: Record<string, number> = {}
    for (const c of clipped) byCause[c.cause as string] = (byCause[c.cause as string] || 0) + 1
    return { fps, nodes: document.querySelectorAll('.react-flow__node').length,
             clippedCount: clipped.length, byCause, sample: clipped.slice(0, 12) }
  })
  console.log('TRUNCATION ' + JSON.stringify(m, null, 1))
})
