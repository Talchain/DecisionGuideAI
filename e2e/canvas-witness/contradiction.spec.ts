import { test, expect } from '@playwright/test'

const EXAMPLE = /Pricing Model Transition Strategy/i

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}

/**
 * Does a card ASSERT THE ABSENCE of data the canonical model actually holds?
 *
 * Requirement 1 of the Canvas goal: "values, units, provenance, uncertainty and
 * unknowns are shown correctly" and "no semantic claim appears unless the
 * underlying canonical/analysis state supports it". An assertion of ABSENCE is a
 * semantic claim like any other, and it is checkable in the opposite direction
 * from the one I had been testing: not "a claim with no state behind it" but
 * "a denial of state that is present".
 */
test('CONTRADICTION — does a card deny data the model holds', async ({ page }) => {
  test.setTimeout(240_000)
  const { origin, build } = await pinnedOrigin()
  console.log(`[CONTRA] servedUI=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 })
  await card.click()
  await page.waitForTimeout(14_000)

  const out = await page.evaluate(() => {
    const st = (window as any).useCanvasStore.getState()
    const real = ((st.nodes ?? []) as Array<any>).filter((n) => !String(n.id).startsWith('__ghost-'))
    return real.map((n) => {
      const el = document.querySelector(`[data-id="${String(n.id)}"]`) as HTMLElement | null
      const obs = n.data?.observedState ?? n.data?.observed_state ?? null
      // EVERY title and aria-label, not the first three.
      const titles = Array.from(el?.querySelectorAll('[title]') ?? []).map((e) => e.getAttribute('title') ?? '').filter(Boolean)
      const labels = Array.from(el?.querySelectorAll('[aria-label]') ?? []).map((e) => e.getAttribute('aria-label') ?? '').filter(Boolean)
      const hay = [...titles, ...labels].join(' ~~ ')
      return {
        id: String(n.id),
        type: String(n.type ?? n.data?.kind ?? '?'),
        canonicalValue: obs && typeof obs.value === 'number' ? obs.value : null,
        source: obs?.source ?? null,
        extractionType: obs?.extractionType ?? null,
        // The denial strings, matched on the product's own words.
        deniesObservedData: /no observed data/i.test(hay),
        deniesValue: /not set yet|no value|not estimated/i.test(hay),
        saysConfidence: /confiden/i.test(hay),
        titles, labels,
      }
    })
  })

  for (const r of out) {
    console.log(`[CONTRA] ${r.type.padEnd(8)} ${r.id.padEnd(30)} canonicalValue=${JSON.stringify(r.canonicalValue)} source=${JSON.stringify(r.source)} extr=${JSON.stringify(r.extractionType)} deniesObservedData=${r.deniesObservedData} saysConfidence=${r.saysConfidence}`)
    for (const t of r.titles) console.log(`[CONTRA]     title: "${t}"`)
    for (const l of r.labels) console.log(`[CONTRA]     label: "${l}"`)
  }

  const factors = out.filter((r) => r.type === 'factor')
  const withValue = factors.filter((r) => r.canonicalValue !== null)
  const withoutValue = factors.filter((r) => r.canonicalValue === null)
  // THE CONTRADICTION: the model holds a value AND the card denies observed data.
  const contradictions = withValue.filter((r) => r.deniesObservedData)
  // THE INVERSE, as a control on the mapping: do the ones with NO value get the denial?
  const correctlyDenied = withoutValue.filter((r) => r.deniesObservedData)

  const c1 = factors.length > 0
  const c2 = withValue.length > 0
  const c3 = withoutValue.length > 0
  const c4 = out.some((r) => r.titles.length > 0)   // titles are readable at all
  console.log(`[CONTRA] CONTROL factors=${factors.length} withValue=${withValue.length} withoutValue=${withoutValue.length} titlesReadable=${c4}`)
  const measurable = c1 && c2 && c3 && c4
  const verdict = !measurable ? 'NOT-MEASURED' : contradictions.length === 0 ? 'PASS' : 'FAIL'
  console.log(`[CONTRA] VERDICT ${verdict}`)
  console.log(`[CONTRA]   factors WITH a canonical value whose card denies observed data = ${contradictions.length}/${withValue.length}: ${JSON.stringify(contradictions.map((c) => ({ id: c.id, value: c.canonicalValue })))}`)
  console.log(`[CONTRA]   factors WITHOUT a value whose card denies observed data       = ${correctlyDenied.length}/${withoutValue.length}: ${JSON.stringify(correctlyDenied.map((c) => c.id))}`)
  expect(measurable, 'NOT-MEASURED: a control did not fire').toBe(true)
})
