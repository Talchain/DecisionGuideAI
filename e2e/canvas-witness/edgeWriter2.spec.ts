import { test, expect } from '@playwright/test'

const EXAMPLE = /Pricing Model Transition Strategy/i

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}

/**
 * ⛔ WHY THIS IS ROLE-AGNOSTIC. The previous run reported FAIL because
 * `getByRole('button', { name: /^Change this$/ })` found nothing — but the panel
 * text plainly contained "Change this". It is a TAB, not a button. A locator
 * miss reported as a product failure is the same error class as
 * `getByText` on a two-line label, and it would have been published.
 *
 * ⚠ Also: a live `<input>` is present AT REST — it is the Olumi chat composer
 * ("Minimise / Dock to panel / Send"). Counting it as an edge writer would make
 * every stage read as already-writable. Writers are therefore counted INSIDE the
 * inspector dialog only, and the composer is excluded by name.
 */
test('EDGE WRITER v2 — role-agnostic, composer excluded', async ({ page }) => {
  test.setTimeout(240_000)
  const { origin, build } = await pinnedOrigin()
  console.log(`[EW2] servedUI=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 })
  await card.click()
  await page.waitForTimeout(14_000)
  await page.getByRole('button', { name: /fit to view/i }).first().click().catch(() => {})
  await page.waitForTimeout(3_000)

  const snap = async (stage: string) => {
    const s = await page.evaluate(() => {
      // The inspector is the dialog that is NOT the Olumi composer.
      const dlgs = Array.from(document.querySelectorAll('[role="dialog"]')) as HTMLElement[]
      const inspector = dlgs
        .filter((d) => !/Minimise|Dock to panel/i.test(d.textContent ?? ''))
        .sort((a, b) => (b.textContent ?? '').length - (a.textContent ?? '').length)[0] ?? null
      const scope: ParentNode = inspector ?? document
      const writers = Array.from(scope.querySelectorAll('input,textarea,[contenteditable="true"],[role="slider"]'))
        .filter((i) => { const e = i as HTMLInputElement; return !e.readOnly && !e.disabled })
      return {
        inspectorFound: inspector != null,
        writersInInspector: writers.length,
        writerKinds: writers.map((w) => `${w.tagName.toLowerCase()}${(w as HTMLInputElement).type ? ':' + (w as HTMLInputElement).type : ''}`).slice(0, 5),
        placeholders: writers.map((w) => (w as HTMLInputElement).placeholder || w.getAttribute('aria-label') || '').filter(Boolean).slice(0, 4),
        // EVERY interactive thing in the inspector, role-agnostic.
        interactives: Array.from(scope.querySelectorAll('button,[role="button"],[role="tab"],a[href]'))
          .map((b) => `${b.getAttribute('role') ?? b.tagName.toLowerCase()}:${(b.getAttribute('aria-label') || b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 44)}`)
          .filter((t) => !/Minimise|Dock to panel|:Send$/i.test(t)).slice(0, 14),
      }
    })
    console.log(`[EW2] ${stage}: inspector=${s.inspectorFound} writersInInspector=${s.writersInInspector} kinds=${JSON.stringify(s.writerKinds)} placeholders=${JSON.stringify(s.placeholders)}`)
    console.log(`[EW2]    interactives=${JSON.stringify(s.interactives)}`)
    return s
  }

  const geo = await page.evaluate(() => {
    const doms = Array.from(document.querySelectorAll('.react-flow__edge')) as HTMLElement[]
    for (const g of doms) {
      if (!/double-click to set its strength/i.test(g.getAttribute('aria-label') ?? '')) continue
      const p = g.querySelector('path.react-flow__edge-interaction') ?? g.querySelector('path')
      const r = (p as SVGPathElement | null)?.getBoundingClientRect()
      if (!r || r.width < 8) continue
      if (r.left < 0 || r.top < 0 || r.right > window.innerWidth || r.bottom > window.innerHeight) continue
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
    }
    return null
  })
  expect(geo, 'CONTROL: no on-screen edge advertising the promise').not.toBeNull()
  const g = geo as NonNullable<typeof geo>

  await snap('0 · at rest')
  await page.mouse.move(g.x, g.y); await page.waitForTimeout(500)
  await page.mouse.dblclick(g.x, g.y)
  await page.waitForTimeout(4_500)
  const s1 = await snap('2 clicks · after double-click')

  // Role-agnostic: find "Change this" by text, whatever element it is.
  const changeThis = page.locator('[role="dialog"]').locator('text="Change this"').first()
  const found = await changeThis.count()
  console.log(`[EW2] "Change this" elements found (role-agnostic) = ${found}`)
  if (found > 0) {
    await changeThis.click()
    await page.waitForTimeout(4_000)
    const s2 = await snap('3 clicks · after "Change this"')
    const reached = s2.writersInInspector > 0
    console.log(`[EW2] VERDICT ${reached ? 'PASS' : 'FAIL'} — edge-strength writer ${reached ? 'reached' : 'NOT reached'} after 3 clicks (the promise implies 2)`)
    if (reached) console.log(`[EW2] extraActionsBeyondPromise=1 ("Change this" tab); promiseWordingImpliesDirect=true`)
  } else {
    console.log(`[EW2] VERDICT NOT-MEASURED — no "Change this" element found by text either; onward route unknown`)
    console.log(`[EW2]   interactives were ${JSON.stringify(s1.interactives)}`)
  }
})
