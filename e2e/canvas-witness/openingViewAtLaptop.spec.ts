import { test, expect, type Browser } from '@playwright/test'

const EXAMPLE = /Pricing Model Transition Strategy/i

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}

/**
 * ⭐ THE OPENING VIEW AT A REAL LAPTOP, NOT AT A TEST VIEWPORT.
 *
 * Paul's own manual test shows, on arrival, the strip *"Zoomed out — showing
 * less on each card · Zoom in for detail"* — the board opens BELOW the
 * legibility floor at the size he uses. That is the "responsive usability at
 * normal laptop sizes" criterion and it has never been measured at these
 * widths.
 *
 * ⛔ A FRESH CONTEXT PER SIZE, AND THE FIRST VERSION OF THIS FILE IS WHY. It
 * reused one page across the three sizes; after the first, the guest session
 * had the board already open, so the example-picker locator matched three NODE
 * ACTION buttons whose aria-labels contain the same board name. A restored
 * board is a CONTAMINATED scenario and the run is void — the goal says so in
 * terms. Each size now gets its own context, and the picker's presence is
 * asserted as a PRECONDITION so a restored board fails loudly as NOT-MEASURED
 * instead of being measured by accident.
 */
const SIZES = [
  { name: 'macbook-13', width: 1280, height: 800 },
  { name: 'macbook-14', width: 1440, height: 900 },
  { name: 'pauls-capture', width: 1512, height: 982 },
]

async function measure(browser: Browser, origin: string, size: typeof SIZES[number]) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height } })
  const page = await ctx.newPage()
  try {
    await page.goto(origin, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /continue without an account/i }).click()

    // PRECONDITION, not an action: exactly one picker card with this name.
    const picker = page.getByRole('button', { name: EXAMPLE })
    await picker.first().waitFor({ state: 'visible', timeout: 45_000 })
    const matches = await picker.count()
    if (matches !== 1) return { size, contaminated: true, matches }

    await picker.first().click()
    await page.waitForTimeout(14_000)

    const m = await page.evaluate(() => {
      const store = (window as any).useCanvasStore?.getState?.()
      const nodes = (store?.nodes ?? []).filter((n: any) => !String(n.id).startsWith('__ghost-'))
      const pane = document.querySelector('.react-flow__pane') ?? document.querySelector('.react-flow')
      const pr = pane?.getBoundingClientRect()
      let visible = 0
      let titlesReadable = 0
      const sizes: number[] = []
      for (const n of nodes) {
        const el = document.querySelector(`[data-id="${n.id}"]`) as HTMLElement | null
        if (!el || !pr) continue
        const r = el.getBoundingClientRect()
        if (r.right > pr.left && r.left < pr.right && r.bottom > pr.top && r.top < pr.bottom) {
          visible += 1
          const t = el.querySelector('[data-testid="node-title"]') as HTMLElement | null
          if (t) {
            const fs = parseFloat(getComputedStyle(t).fontSize || '0')
            sizes.push(Math.round(fs * 10) / 10)
            if (fs >= 11) titlesReadable += 1
          }
        }
      }
      const body = document.body.innerText
      return {
        nodes: nodes.length,
        visible,
        titlesReadable,
        titleFontSizes: [...new Set(sizes)].sort((a, b) => a - b),
        zoomedOutNotice: /zoomed out/i.test(body),
        zoomInPrompt: /zoom in for detail/i.test(body),
        lodRung: store?.lodRung ?? null,
        paneW: Math.round(pr?.width ?? 0),
        paneH: Math.round(pr?.height ?? 0),
      }
    })
    await page.screenshot({ path: `opening-${size.name}.png` })
    return { size, contaminated: false, ...m }
  } finally {
    await ctx.close()
  }
}

test('OPENING VIEW — what a laptop sees on arrival', async ({ browser }) => {
  test.setTimeout(280_000)
  const { origin, build } = await pinnedOrigin()
  console.log(`[OV] servedUI=${build}`)

  const rows: Array<Record<string, unknown>> = []
  for (const size of SIZES) {
    const r = await measure(browser, origin, size)
    rows.push(r as Record<string, unknown>)
    if ((r as { contaminated?: boolean }).contaminated) {
      console.log(`[OV] ${size.name} VOID — picker matched ${(r as { matches?: number }).matches} elements, board likely restored`)
      continue
    }
    const m = r as never as { paneW: number; paneH: number; nodes: number; visible: number; titlesReadable: number; titleFontSizes: number[]; lodRung: string; zoomedOutNotice: boolean; zoomInPrompt: boolean }
    console.log(
      `[OV] ${size.name.padEnd(14)} ${size.width}x${size.height} pane=${m.paneW}x${m.paneH} `
      + `nodes=${m.nodes} visible=${m.visible} titlesReadable=${m.titlesReadable} `
      + `titlePx=${JSON.stringify(m.titleFontSizes)} lodRung=${m.lodRung} `
      + `zoomedOutNotice=${m.zoomedOutNotice} zoomInPrompt=${m.zoomInPrompt}`,
    )
  }

  const clean = rows.filter((r) => !r.contaminated)
  const sawNodes = clean.some((r) => (r.nodes as number) > 0)
  const sawPane = clean.every((r) => (r.paneW as number) > 0)
  console.log(`[OV] CONTROL sizes=${rows.length} clean=${clean.length} sawNodes=${sawNodes} paneMeasured=${sawPane}`)
  const measurable = clean.length === SIZES.length && sawNodes && sawPane
  const belowFloor = clean.filter((r) => r.zoomedOutNotice === true).map((r) => (r.size as { name: string }).name)
  console.log(`[OV] VERDICT ${measurable ? (belowFloor.length === 0 ? 'PASS' : 'FAIL') : 'NOT-MEASURED'} — opensBelowLegibilityFloor=${JSON.stringify(belowFloor)}`)
  expect(measurable, 'NOT-MEASURED: a size was contaminated or unmeasurable').toBe(true)
})
