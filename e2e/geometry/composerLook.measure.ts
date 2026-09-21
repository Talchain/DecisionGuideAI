/**
 * COMPOSER LOOK + GEOMETRY — the docked Olumi composer, photographed and measured.
 *
 * ⚠ WHY THIS EXISTS. The composer was reshaped from "controls floating over the
 * text" to "controls in a row beneath it", and every claim in that change was
 * made from jsdom class assertions and arithmetic. Nothing had LOOKED at it:
 * `e2e/visual/` reaches the composer only to assert it does not overlap the
 * scroller, never to see it. The two defects the reshape was fixing — a 70px
 * rest state justified by a control cluster deleted in August, and a
 * line-height constant that had drifted 18 against a rendered 19.5 — were both
 * invisible to every existing check.
 *
 * ⚠ THESE ARE NOT PIXEL REFERENCES AND MUST NEVER BE PROMOTED TO ANY. The
 * pinned Playwright build ships no browser in this image, so this launches the
 * installed 1194 chrome by path — a different renderer build.
 *
 * It asserts the two things arithmetic alone cannot settle, and PRINTS the
 * rest, so a run that photographs nothing says so instead of passing quietly.
 *
 * Run deliberately (in no gate):
 *   pnpm exec playwright test -c playwright.geometry.config.ts \
 *     e2e/geometry/composerLook.measure.ts
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
const STARTER = 'build-vs-buy' as const

test.use({
  launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' },
})

async function openOlumiDock(page: Page) {
  await preparePage(page, VP)
  await openCanvas(page)
  await seedStarterDraft(page, STARTER)
  await clearNotifications(page)
  await freezeMotion(page)
  await waitForVisualQuiescence(page)
  // The strip is a COMPOSER only while the Olumi tab is fronted; on any other
  // tab it is a redirect button with no textarea, so a capture taken without
  // this step would photograph the wrong surface and look fine doing it.
  const tab = page.locator('[data-testid="outputs-dock-tab-olumi"]')
  if ((await tab.count()) > 0) await tab.first().click()
  await expect(page.locator('[data-testid="persistent-strip-composer"]')).toBeVisible()
}

const shootFooter = (page: Page, name: string) =>
  page.locator('[data-testid="ai-panel-footer-stack"]').screenshot({ path: `${OUT}/${name}.png` })

test('COMPOSER A — at rest', async ({ page }) => {
  await openOlumiDock(page)

  const box = await page.locator('[data-testid="persistent-strip-composer"]').boundingBox()
  const ta = await page.locator('[data-testid="ai-input-bar-strip-textarea"]').boundingBox()
  const metrics = await page
    .locator('[data-testid="ai-input-bar-strip-textarea"]')
    .evaluate(el => {
      const cs = getComputedStyle(el)
      return {
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
        minHeight: (el as HTMLElement).style.minHeight,
        maxHeight: (el as HTMLElement).style.maxHeight,
        paddingRight: cs.paddingRight,
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
      }
    })

  // ⭐ THE ASSERTION THE ARITHMETIC COULD NOT MAKE. `LINE_HEIGHT_PX = 18` was a
  // hand-copy of a value owned by `typography.panelBody`; the growth maths is
  // now MEASURED, and this is where the measurement is checked against the real
  // stylesheet rather than against the constant that had drifted from it.
  const line = Number.parseFloat(metrics.lineHeight)
  expect(
    Number.isFinite(line) && line > 0,
    `the textarea resolved no numeric line-height (${metrics.lineHeight}); the growth maths ` +
      `would silently fall back to the 18px constant and be wrong by the same ~8% again`,
  ).toBe(true)
  // ⚠ THE PAD IS READ FROM THE ELEMENT, NOT FROM A CONSTANT. Hard-coding 16
  // here is exactly the hand-copy this instrument exists to catch — it went red
  // the moment the composer's own padding changed, which is the right failure
  // for the wrong reason. The claim is "one line plus WHATEVER this box pads",
  // so the box is asked.
  const pad =
    Number.parseFloat(metrics.paddingTop) + Number.parseFloat(metrics.paddingBottom)
  expect(
    metrics.minHeight,
    `the rest height must be ONE measured line plus its own padding, not the retired 70px reservation`,
  ).toBe(`${line * 1 + pad}px`)

  // eslint-disable-next-line no-console
  console.log(
    `[composer] rest: strip ${Math.round(box!.height)}px · textarea ${Math.round(ta!.height)}px · ` +
      `font ${metrics.fontSize}/${metrics.lineHeight} · min ${metrics.minHeight} max ${metrics.maxHeight} · ` +
      `padding ${metrics.paddingTop}/${metrics.paddingBottom}/${metrics.paddingRight}`,
  )
  await shootFooter(page, 'COMPOSER-A-rest')
})

test('COMPOSER B — grown, with the action row beneath', async ({ page }) => {
  await openOlumiDock(page)
  const ta = page.locator('[data-testid="ai-input-bar-strip-textarea"]')
  await ta.click()
  await ta.fill(
    [
      'We are choosing between building the self-serve tier ourselves and buying it in.',
      'The three things I care about are time to market, the ongoing cost of ownership,',
      'and whether we can keep the pricing flexible after launch.',
      'What would change your read here?',
    ].join('\n'),
  )
  const grown = await ta.boundingBox()
  const rest = 0

  // The action row must stay BELOW the text at every height — the whole point
  // of the reshape is that it never sits on top of what is being typed.
  const row = await page.locator('[data-testid="ai-input-bar-strip-actions"]').boundingBox()
  expect(row, 'the composer action row is not laid out').not.toBeNull()
  expect(
    Math.round(row!.y),
    `the action row overlaps the textarea (row y=${row!.y}, textarea bottom=${grown!.y + grown!.height})`,
  ).toBeGreaterThanOrEqual(Math.round(grown!.y + grown!.height) - 1)

  // eslint-disable-next-line no-console
  console.log(
    `[composer] grown: textarea ${Math.round(grown!.height)}px (rest ${rest}) · ` +
      `action row at y=${Math.round(row!.y)} h=${Math.round(row!.height)}`,
  )
  await shootFooter(page, 'COMPOSER-B-grown')
})

test('COMPOSER C — pasted list keeps its shape', async ({ page }) => {
  await openOlumiDock(page)
  const ta = page.locator('[data-testid="ai-input-bar-strip-textarea"]')
  await ta.click()
  // A Word/Google-Docs style paste: the glyphs `safeRichText` does NOT know.
  await page.evaluate(() => {
    const el = document.querySelector(
      '[data-testid="ai-input-bar-strip-textarea"]',
    ) as HTMLTextAreaElement
    const dt = new DataTransfer()
    dt.setData('text/plain', '▪ Keep pricing flexible\r\n▪ Ship before Q3\r\n● Own the roadmap')
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  await expect(ta).toHaveValue('- Keep pricing flexible\n- Ship before Q3\n- Own the roadmap')
  // eslint-disable-next-line no-console
  console.log('[composer] paste: ▪/● + CRLF normalised to the marker safeRichText renders')
  await shootFooter(page, 'COMPOSER-C-pasted-list')
})
