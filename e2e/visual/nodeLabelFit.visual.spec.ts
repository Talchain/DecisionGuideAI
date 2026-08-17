/**
 * Node titles must not break MID-WORD at the zoom the product settles on.
 *
 * WHY THIS IS A BROWSER TEST AND NOT A jsdom ONE. jsdom has no line boxes and
 * no text metrics, so a passing DOM assertion proves a class is present and
 * proves nothing about what a word does when it meets the edge of its box.
 * `#758`'s regression is invisible to every jsdom test in this repo — it was
 * invisible to `BaseNode.titleWrap.spec.tsx`, which is *about mid-word
 * breaking* and stayed green throughout. Only line boxes can see it.
 *
 * HOW IT MEASURES. For each rendered title, a `Range` is walked one character
 * at a time and `getClientRects()` gives that character's line box. A jump in
 * the box's top edge is a line break. A break is MID-WORD when the characters
 * on either side of it are both non-space and the preceding one is not a
 * hyphen (a hyphen is a legal break point, so "Snowflake-|Native" is fine).
 *
 * WHAT IT ASSERTS, and why it is not a value predicate another object could
 * satisfy: every title is checked BY ITS OWN TEXT, and the failure message
 * names the label and reproduces the rendered lines, so a regression says
 * which label broke and where.
 *
 * STATE-CLASS: fresh. Each starter is seeded into a fresh page and the graph is
 * left at the zoom the POST-LAYOUT AUTO-FIT chooses — deliberately NOT the
 * toolbar's "fit to view", which is an explicit user gesture and is unfloored
 * by design (see `zoomLegibility.ts`). The auto-fit is the only zoom the
 * product picks FOR the user, so it is the only one it owes legibility at.
 *
 * MEASURED AT THE TIP THIS SPEC LANDED ON (Chromium, 5 starters x 2 viewports,
 * 174 rendered titles): 59 mid-word before, 0 after; 79 line-clamped before,
 * 14 after.
 */
import { test, expect } from '@playwright/test'
import { VIEWPORTS, clearNotifications, openCanvas, preparePage, seedStarterDraft } from './harness'

/** Every starter the product ships — the label corpus, from outside this file. */
const STARTERS = [
  'build-vs-buy',
  'headcount-allocation',
  'market-entry',
  'pricing-model',
  'vendor-selection',
] as const

interface TitleReading {
  text: string
  fontSizePx: string
  lines: string[]
  midWordAt: number[]
  hasTitleAttr: boolean
  clamped: boolean
}

interface Reading {
  zoom: number
  labelScale: string
  titles: TitleReading[]
}

/** Runs in the page. Kept self-contained: `page.evaluate` gets no closure. */
const readTitles = (): Reading => {
  const isSpace = (c: string) => /\s/.test(c)
  const viewport = document.querySelector('.react-flow__viewport') as HTMLElement | null
  const zoom = viewport ? new DOMMatrixReadOnly(getComputedStyle(viewport).transform).a : Number.NaN
  const root = document.querySelector('.react-flow') as HTMLElement | null
  const labelScale = root ? getComputedStyle(root).getPropertyValue('--canvas-label-scale').trim() : ''

  const titles: TitleReading[] = []
  for (const element of Array.from(document.querySelectorAll('[data-testid="node-title"]'))) {
    const node = element as HTMLElement
    const text = node.textContent ?? ''
    const textNode = node.firstChild
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) continue

    const range = document.createRange()
    const breaks: number[] = []
    let previousTop: number | null = null
    for (let i = 0; i < text.length; i++) {
      range.setStart(textNode, i)
      range.setEnd(textNode, i + 1)
      const rects = range.getClientRects()
      if (!rects.length) continue
      const top = Math.round(rects[0]!.top * 10) / 10
      if (previousTop !== null && top > previousTop + 1) breaks.push(i)
      previousTop = top
    }

    const lines: string[] = []
    let start = 0
    for (const at of breaks) {
      lines.push(text.slice(start, at))
      start = at
    }
    lines.push(text.slice(start))

    titles.push({
      text,
      fontSizePx: getComputedStyle(node).fontSize,
      lines,
      midWordAt: breaks.filter(
        (i) => i > 0 && !isSpace(text[i - 1]!) && !isSpace(text[i]!) && text[i - 1] !== '-',
      ),
      hasTitleAttr: node.getAttribute('title') === text,
      clamped: node.scrollHeight > node.clientHeight + 1,
    })
  }
  return { zoom, labelScale, titles }
}

test.describe('node titles fit at the settle zoom', () => {
  for (const viewport of VIEWPORTS) {
    for (const starter of STARTERS) {
      test(`${starter} breaks no word mid-word [${viewport.name}]`, async ({ page }) => {
        await preparePage(page, viewport)
        await openCanvas(page)
        await seedStarterDraft(page, starter)
        await clearNotifications(page)
        // The auto-fit runs off layoutVersion, which seedStarterDraft has
        // already awaited; this settles the camera transition it starts.
        await page.waitForTimeout(1200)

        const reading = await page.evaluate(readTitles)

        // The instrument must be pointed at something. A run that measured no
        // titles would otherwise report "no mid-word breaks" and be believed
        // (CLAUDE.md trap 13 — an absence claim needs a positive control).
        expect(
          reading.titles.length,
          'no node titles were measured — the graph did not render, so an absence of breaks means nothing',
        ).toBeGreaterThan(10)

        // The scale is the whole premise: if labels are NOT counter-scaled at
        // this zoom, the fit below is trivially satisfied and proves nothing.
        expect(
          Number(reading.labelScale),
          'canvas labels are not counter-scaled here — this run cannot see the defect',
        ).toBeGreaterThan(1)

        const offenders = reading.titles
          .filter((t) => t.midWordAt.length > 0)
          .map((t) => `  "${t.text}" @${t.fontSizePx} -> ${t.lines.join(' | ')}`)

        expect(
          offenders,
          `titles broke mid-word at zoom ${reading.zoom.toFixed(4)} ` +
            `(label scale ${reading.labelScale}):\n${offenders.join('\n')}`,
        ).toEqual([])

        // Anything the clamp ellipsises must still be reachable in full at a
        // readable size (DS v5 §2.4). Asserted for EVERY title, not only the
        // clamped ones, so the guarantee cannot lapse for the ones that happen
        // to fit at this viewport.
        const unreachable = reading.titles.filter((t) => !t.hasTitleAttr).map((t) => t.text)
        expect(
          unreachable,
          'these titles carry no full-text `title` attribute, so a clamped label is unrecoverable',
        ).toEqual([])
      })
    }
  }
})
