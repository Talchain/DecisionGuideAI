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
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { VIEWPORTS, clearNotifications, openCanvas, preparePage, seedStarterDraft } from './harness'
import {
  NODE_CARD_MAX_W,
  NODE_CARD_PADDING_X,
  NODE_HEADER_RESERVE_PX,
  NODE_TITLE_MIN_MEASURE_PX,
  NODE_TITLE_WIDEST_WORD_PX,
} from '../../src/canvas/utils/nodeLayoutConstants'
import { MAX_LABEL_COUNTER_SCALE } from '../../src/canvas/utils/zoomLegibility'

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

const STARTER_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../src/canvas/starters/data')

/** Every node label the shipped starters contain. Derived, never hand-listed. */
function starterLabels(): string[] {
  const out: string[] = []
  for (const file of readdirSync(STARTER_DIR).filter((f) => f.endsWith('.draft.json'))) {
    const parsed = JSON.parse(readFileSync(join(STARTER_DIR, file), 'utf8')) as {
      nodes?: Array<{ data?: { label?: unknown }; label?: unknown }>
    }
    for (const node of parsed.nodes ?? []) {
      const label = (node.data?.label ?? node.label) as unknown
      if (typeof label === 'string' && label) out.push(label)
    }
  }
  return out
}

/**
 * The longest run that must fit a line box as one unit. A hyphen is a legal
 * break point, so "Snowflake-Native" is two units.
 */
function unbreakableRuns(labels: string[]): string[] {
  return [...new Set(labels.flatMap((l) => l.split(/[\s-]+/)).filter(Boolean))]
}

/**
 * ⭐ THE COMPLETENESS CHECK, AND WHY IT LIVES HERE RATHER THAN IN jsdom.
 *
 * `NODE_TITLE_WIDEST_WORD_PX` is a bound on the WIDTH of the widest word the
 * product's own content contains. The first version of this guard checked the
 * widest word's CHARACTER COUNT, which is a proxy — and a proxy that fails in
 * the direction of SILENCE. An adversarial review proved it: "Commoditisation"
 * is exactly as long as "Cannibalization" (15 characters) and materially wider
 * in pixels, so it would enter a starter, re-open mid-word breaking, and leave
 * the guard GREEN. `Recommendation` is WIDER at FOURTEEN characters. Counting
 * cannot see any of that.
 *
 * So the check measures, against the live font of a real mounted node title —
 * not a hand-built probe span, whose font stack can differ from the one the
 * product actually resolves. The declared size is derived from the element
 * itself (`computed font-size ÷ --canvas-label-scale`) rather than assuming 13.
 */
const measureWords = (input: { words: string[]; control: string[] }) => {
  const sample = document.querySelector('[data-testid="node-title"]') as HTMLElement | null
  if (!sample) return null
  const cs = getComputedStyle(sample)
  const root = document.querySelector('.react-flow') as HTMLElement | null
  const scale = Number(
    (root ? getComputedStyle(root).getPropertyValue('--canvas-label-scale').trim() : '') || '1',
  )
  const declaredPx = parseFloat(cs.fontSize) / scale

  const span = document.createElement('span')
  span.style.position = 'absolute'
  span.style.visibility = 'hidden'
  span.style.whiteSpace = 'pre'
  span.style.fontFamily = cs.fontFamily
  span.style.fontWeight = cs.fontWeight
  span.style.fontStyle = cs.fontStyle
  span.style.fontFeatureSettings = cs.fontFeatureSettings
  span.style.letterSpacing = cs.letterSpacing
  span.style.fontSize = `${declaredPx}px`
  document.body.appendChild(span)

  const widthOf = (w: string) => {
    span.textContent = w
    return Math.round(span.getBoundingClientRect().width * 100) / 100
  }
  const measure = (list: string[]) =>
    list.map((w) => ({ word: w, px: widthOf(w) })).sort((a, b) => b.px - a.px)

  const corpus = measure(input.words)
  const control = measure(input.control)
  span.remove()
  return { declaredPx, scale, letterSpacing: cs.letterSpacing, fontFamily: cs.fontFamily, corpus, control }
}

test.describe('the widest-word bound covers the product’s own content', () => {
  test('MEASURED, not counted — and the guard is shown to discriminate', async ({ page }) => {
    await preparePage(page, VIEWPORTS[0])
    await openCanvas(page)
    await seedStarterDraft(page, 'build-vs-buy')
    await clearNotifications(page)
    await page.waitForTimeout(1200)

    const words = unbreakableRuns(starterLabels())
    expect(words.length, 'no starter words were read — the corpus check would be vacuous').toBeGreaterThan(150)

    // NEGATIVE CONTROL. Ordinary business words that are NOT in the corpus and
    // that the review measured as WIDER than the bound. If these came back
    // under it, this test could not distinguish a safe corpus from an unsafe
    // one, and its pass would mean nothing.
    const control = ['Commoditisation', 'Recommendation', 'Communications', 'Mismanagement', 'Accommodation']

    const result = await page.evaluate(measureWords, { words, control })
    expect(result, 'no mounted node title to take the live font from').not.toBeNull()
    const { declaredPx, corpus, control: controlPx } = result!

    // eslint-disable-next-line no-console
    console.log(
      `[labelfit] declared title size ${declaredPx}px; widest 6 of ${corpus.length} corpus words:\n` +
        corpus.slice(0, 6).map((c) => `    ${c.word.padEnd(18)} ${c.px}px`).join('\n') +
        `\n  negative control (must exceed ${NODE_TITLE_WIDEST_WORD_PX}px):\n` +
        controlPx.map((c) => `    ${c.word.padEnd(18)} ${c.px}px`).join('\n'),
    )

    // The declared size must be the DS v5 §2.3 canvas title size. If this drifts
    // the measurement below is being taken at the wrong size and means nothing.
    expect(declaredPx).toBeCloseTo(13, 1)

    /*
     * ⚠ FONT METRICS ARE PLATFORM-DEPENDENT, AND THE BOUND WAS MEASURED ON ONE
     * PLATFORM. Found by this guard on its first CI run — linux Chromium renders
     * the title font ~16% wider than darwin:
     *
     *     word              darwin    linux    over the 100px bound?
     *     Cannibalization    97.77   113.47    linux only
     *     Concentration      90.19   103.77    linux only
     *     Improvement        83.55    98.16    no
     *     International      80.39    95.66    no
     *
     * TWO words, and the set below was wrong on its first attempt for exactly
     * that reason: it pinned the WIDEST word rather than EVERY word over the
     * bound, and CI named the one it had missed ("Concentration 103.77px"). Pin
     * the whole set, never its head. Both live in `pricing-model`.
     *
     * So on linux metrics the widest word in the product's own content needs
     * 226.94px at the maximum counter-scale, against a COMPRESSED-branch measure
     * of 200px — 26.94px short. It does not break today, and the ten fit tests
     * below prove that directly on both platforms; it is safe because
     * "Cannibalization" lives in `pricing-model`, whose factor tier lands on the
     * WIDE branch (measure 276px). **It is protected by layout placement, not by
     * the floor** — a latent condition, and exactly what this guard exists to
     * surface.
     *
     * Recorded as an explicit KNOWN-GAP set rather than smoothed away: the suite
     * stays green for a stated reason, and REDs if the set GROWS. Closing it
     * means raising the bound to cover the widest platform (~116), which widens
     * every compressed card 244 -> 276 and worsens the fit-zoom trade this change
     * already pays — a geometry decision, not a test decision, so it is reported
     * rather than taken here.
     */
    const KNOWN_OVER_BOUND = new Set(['Cannibalization', 'Concentration'])
    const over = corpus.filter((c) => c.px > NODE_TITLE_WIDEST_WORD_PX)
    const unexpected = over.filter((c) => !KNOWN_OVER_BOUND.has(c.word))

    expect(
      unexpected.map((c) => `${c.word} ${c.px}px`),
      `these corpus words exceed the ${NODE_TITLE_WIDEST_WORD_PX}px bound and are NOT in the ` +
        `recorded known-gap set. The card floor is derived from that bound, so they can break ` +
        `mid-word on the compressed branch. Raise the constant to cover them (and accept the ` +
        `wider cards), or take the words out of the starters.`,
    ).toEqual([])

    // WHY THE KNOWN GAP IS SAFE, asserted rather than asserted-about: every word
    // in it must still fit the WIDE branch at maximum counter-scale. That is the
    // margin actually keeping it off a mid-word break, so if it goes, this REDs
    // before a user sees a split word.
    const wideBranchMeasure = NODE_CARD_MAX_W - NODE_CARD_PADDING_X - NODE_HEADER_RESERVE_PX
    for (const c of corpus.filter((c) => KNOWN_OVER_BOUND.has(c.word))) {
      expect(
        c.px * MAX_LABEL_COUNTER_SCALE,
        `known-gap word "${c.word}" needs ${(c.px * MAX_LABEL_COUNTER_SCALE).toFixed(2)}px at ` +
          `maximum counter-scale, which no longer fits even the WIDE branch (${wideBranchMeasure}px). ` +
          `The gap is no longer latent — it will break mid-word. Raise NODE_TITLE_WIDEST_WORD_PX.`,
      ).toBeLessThanOrEqual(wideBranchMeasure)
    }

    // …and record how much margin the COMPRESSED branch is short by, so the
    // number is in the log rather than in someone's head.
    const worst = corpus[0]!
    // eslint-disable-next-line no-console
    console.log(
      `[labelfit] compressed-branch measure ${NODE_TITLE_MIN_MEASURE_PX}px vs widest word ` +
        `"${worst.word}" needing ${(worst.px * MAX_LABEL_COUNTER_SCALE).toFixed(2)}px at max scale ` +
        `(${(NODE_TITLE_MIN_MEASURE_PX - worst.px * MAX_LABEL_COUNTER_SCALE).toFixed(2)}px of margin); ` +
        `wide-branch measure ${wideBranchMeasure}px.`,
    )

    // DISCRIMINATION: every control word must be OVER the bound, i.e. the guard
    // would fire if one of them entered the corpus. Without this the assertion
    // above passes on any bound large enough to be useless.
    for (const c of controlPx) {
      expect(
        c.px,
        `negative control "${c.word}" measures ${c.px}px, NOT above the ${NODE_TITLE_WIDEST_WORD_PX}px ` +
          `bound — this test can no longer tell a safe corpus from an unsafe one`,
      ).toBeGreaterThan(NODE_TITLE_WIDEST_WORD_PX)
    }
  })
})

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
