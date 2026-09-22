import { test, expect } from '@playwright/test'

const EXAMPLE = /Pricing Model Transition Strategy/i

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}

/**
 * ⛔⛔ WHY THIS DOES NOT REGEX A CARD'S `textContent`.
 *
 * The first version did, and reported `est.` ABSENT on a card whose own text
 * read `"Very highest.35%"`. `textContent` concatenates adjacent elements with
 * no separator, so "Very high" + "est." becomes "highest." and `\best\b` cannot
 * match — there is no word boundary to match on. The probe's positive control
 * caught it (`anyClaimRenderedAtAll=false` while the marker was plainly on
 * screen), which is the entire reason the control exists.
 *
 * ⭐ Claims are therefore read PER ELEMENT, two independent ways:
 *   1. text nodes joined with a VISIBLE DELIMITER, so no boundary can be eaten;
 *   2. the marker's own identity (`title` / `aria-label`), which is what the
 *      component asserts and is immune to sibling concatenation.
 *
 * ⚠ And NOT via `page.addScriptTag` — the deployed build ships a strict CSP
 * (`script-src 'self' 'nonce-…'`) and refuses inline script. `page.evaluate`
 * runs over CDP and is not subject to it. That refusal is the product being
 * correct, not an obstacle to route around.
 */
test('CLAIM DETECTOR — per-element, with controls that must fire', async ({ page }) => {
  test.setTimeout(240_000)
  const { origin, build } = await pinnedOrigin()
  console.log(`[CLAIM] servedUI=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 })
  await card.click()
  await page.waitForTimeout(14_000)

  const out = await page.evaluate(() => {
    const extract = (nodeId: string) => {
      const el = document.querySelector(`[data-id="${nodeId}"]`) as HTMLElement | null
      if (!el) return null
      const clone = el.cloneNode(true) as HTMLElement
      clone.querySelectorAll('.sr-only').forEach((e) => e.remove())
      const parts: string[] = []
      const walk = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT)
      let n: Node | null
      while ((n = walk.nextNode())) {
        const t = (n.textContent ?? '').replace(/\s+/g, ' ').trim()
        if (t) parts.push(t)
      }
      return {
        joined: parts.join(' | '),
        titles: Array.from(el.querySelectorAll('[title]')).map((e) => e.getAttribute('title') ?? '').filter(Boolean),
        labels: Array.from(el.querySelectorAll('[aria-label]')).map((e) => e.getAttribute('aria-label') ?? '').filter(Boolean),
      }
    }
    // `est.` must be its OWN delimited token, or named by a marker title.
    const estToken = (s: string) => /(^|\|)\s*est\.?\s*(\||$)/i.test(s)
    const st = (window as any).useCanvasStore.getState()
    const real = ((st.nodes ?? []) as Array<any>).filter((n) => !String(n.id).startsWith('__ghost-'))
    const rows = real.map((n) => {
      const d = extract(String(n.id))
      const obs = n.data?.observedState ?? n.data?.observed_state ?? null
      const hay = [d?.joined ?? '', ...(d?.titles ?? []), ...(d?.labels ?? [])].join(' | ')
      return {
        id: String(n.id),
        type: String(n.type ?? n.data?.kind ?? '?'),
        hasValue: typeof obs?.value === 'number',
        rendered: d != null,
        est: estToken(d?.joined ?? '') || /estimate not yet confirmed|filled in for you/i.test(hay),
        keyDriver: /key driver/i.test(hay),
        rank: /most influential|of \d+ factors/i.test(hay),
        confidence: /confiden/i.test(hay),
        userEdited: /user edited/i.test(hay),
        joined: (d?.joined ?? '').slice(0, 200),
        titles: (d?.titles ?? []).slice(0, 3),
      }
    })
    return {
      rows,
      // CONTRAST CONTROL: a fabricated card the detector MUST reject, proving it
      // is not simply matching everything it is handed.
      fabricatedMatched: estToken('Some Label | Moderate | 42% | Outcome'),
      // CONTRAST CONTROL: a fabricated card it MUST accept.
      fabricatedPositive: estToken('Bottom-Up Adoption Friction | Very high | est. | 35%'),
    }
  })

  for (const r of out.rows) {
    const flags = [r.est && 'est.', r.keyDriver && 'KeyDriver', r.rank && 'rank', r.confidence && 'confidence', r.userEdited && 'UserEdited'].filter(Boolean).join(',')
    console.log(`[CLAIM] ${r.type.padEnd(8)} ${r.id.padEnd(30)} hasValue=${String(r.hasValue).padEnd(5)} claims=[${flags}]`)
    console.log(`[CLAIM]     "${r.joined}"`)
    if (r.titles.length) console.log(`[CLAIM]     titles=${JSON.stringify(r.titles)}`)
  }

  const valued = out.rows.filter((r) => r.hasValue)
  const valueless = out.rows.filter((r) => !r.hasValue)
  const c1 = out.rows.some((r) => r.est)
  const c2 = valued.length > 0
  const c3 = valueless.length > 0
  const c4 = out.fabricatedPositive === true && out.fabricatedMatched === false
  const c5 = out.rows.every((r) => r.rendered)
  console.log(`[CLAIM] CONTROL detectorSeesRealEst=${c1} valuedPresent=${c2}(${valued.length}) valuelessPresent=${c3}(${valueless.length}) fabricatedPair=${c4} allCardsRendered=${c5}`)

  const measurable = c1 && c2 && c3 && c4 && c5
  const offenders = out.rows.filter((r) => !r.hasValue && (r.est || r.keyDriver || r.rank || r.confidence || r.userEdited))
  const verdict = !measurable ? 'NOT-MEASURED' : offenders.length === 0 ? 'PASS' : 'FAIL'
  console.log(`[CLAIM] VERDICT ${verdict} — valueless=${valueless.length} valuelessCarryingAClaim=${offenders.length} ${JSON.stringify(offenders.map((o) => ({ id: o.id, est: o.est, keyDriver: o.keyDriver, rank: o.rank })))}`)
  expect(measurable, 'NOT-MEASURED: a control did not fire, so no verdict is licensed').toBe(true)
})
