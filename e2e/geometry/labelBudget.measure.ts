/**
 * LABEL BUDGET — how many characters actually fit on one line inside a card,
 * measured, against the character counts the code hardcodes.
 *
 * Three independent JS truncations cut canvas text by CHARACTER COUNT while the
 * card they sit in is sized in PIXELS. Each was set against a card width that
 * has since changed (`NODE_CARD_MAX_W` 320 -> 336 at #1527):
 *
 *     ConnRow                30 chars   (PR #1531)
 *     edge label half-width  80 px      (PR #1560)
 *     compactFactorLabel     20 / 22    (unfixed)
 *
 * This measures the real capacity so the budget can be DERIVED rather than
 * guessed again. Output: one `BUDGET {...}` line on stdout.
 */
import { test } from '@playwright/test'
import {
  openCanvas, preparePage, seedStarterDraft, clearNotifications,
  minimiseFloatingOlumiPanel, waitForVisualQuiescence, type StarterId,
} from '../visual/harness'

const VP = { width: 1600, height: 1000 }

test('BUDGET pricing-model', async ({ page }) => {
  await preparePage(page, VP)
  await openCanvas(page)
  await seedStarterDraft(page, 'pricing-model' as StarterId)
  await clearNotifications(page)
  await minimiseFloatingOlumiPanel(page)
  await waitForVisualQuiescence(page)

  const out = await page.evaluate(() => {
    // ⚠ `getBoundingClientRect()` APPLIES THE CANVAS TRANSFORM, so it returns
    // 168 for a 336-wide card at zoom 0.5 and every derived figure is half what
    // it should be. `offsetWidth` is the LAYOUT width, which is the frame the
    // truncation budget is actually spent in. A first version of this probe
    // used the rect and reported a 68px row; that number was about the camera,
    // not the card.
    const card = document.querySelector('.react-flow__node [role="group"]') as HTMLElement | null
    if (!card) return { error: 'no card' }

    // The intervention rows are <li> inside the deltas <ul>; their text block is
    // the min-w-0 flex child. Bind to that, not to any span.
    const li = Array.from(document.querySelectorAll('.react-flow__node li'))
      .find(el => (el.textContent ?? '').includes('→')) as HTMLElement | undefined
    const textBlock = (li?.querySelector('.min-w-0') ?? li) as HTMLElement | undefined
    const probeEl = (textBlock?.querySelector('span') ?? textBlock) as HTMLElement | undefined
    if (!probeEl || !textBlock) return { error: 'no intervention row', cardOffsetW: card.offsetWidth }

    const cs = getComputedStyle(probeEl)
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} / ${cs.lineHeight} ${cs.fontFamily}`
    const inner = textBlock.offsetWidth
    const c = document.createElement('canvas').getContext('2d')!
    c.font = font

    const sample = 'Usage-based pricing exposure across enterprise accounts and renewals'
    let fit = 0
    for (let n = 1; n <= sample.length; n++) {
      if (c.measureText(sample.slice(0, n)).width <= inner) fit = n; else break
    }
    return {
      cardOffsetW: card.offsetWidth,
      rowTextBlockW: inner,
      font, fontSizePx: cs.fontSize,
      avgCharPx: Number((c.measureText(sample).width / sample.length).toFixed(2)),
      charsThatFitOneLine: fit,
      hardcoded: { connRow: 30, compactFactorLabelOption: 22, compactFactorLabelDifferentiator: 20 },
      probeText: (probeEl.textContent ?? '').slice(0, 40),
      rowText: (li?.textContent ?? '').slice(0, 60),
    }
  })
  console.log('BUDGET ' + JSON.stringify(out))
})
