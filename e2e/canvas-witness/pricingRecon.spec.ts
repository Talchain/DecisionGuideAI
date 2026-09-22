import { test, expect } from '@playwright/test'

const EXAMPLE = /Pricing Model Transition Strategy/i

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}

test('RECON — canonical state and rendered claims on the pricing model', async ({ page }) => {
  test.setTimeout(240_000)
  const { origin, build } = await pinnedOrigin()
  console.log(`[RECON] servedUI=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 })
  await card.click()
  await page.waitForTimeout(14_000)

  const state = await page.evaluate(() => {
    const st = (window as any).useCanvasStore.getState()
    const nodes = (st.nodes ?? []) as Array<any>
    const edges = (st.edges ?? []) as Array<any>
    const real = nodes.filter((n) => !String(n.id).startsWith('__ghost-'))
    const kinds: Record<string, number> = {}
    for (const n of real) { const k = String(n.type ?? n.data?.kind ?? '?'); kinds[k] = (kinds[k] ?? 0) + 1 }
    return {
      scenario: st.currentScenarioId ?? null,
      lastServerGraphHash: st.lastServerGraphHash ?? null,
      total: real.length,
      ghosts: nodes.length - real.length,
      edges: edges.length,
      kinds,
      nodes: real.map((n) => {
        const d = n.data ?? {}
        const obs = d.observedState ?? d.observed_state ?? null
        return {
          id: String(n.id),
          type: String(n.type ?? d.kind ?? '?'),
          label: String(d.label ?? '').slice(0, 52),
          obs: obs ? { value: obs.value, raw_value: obs.raw_value, unit: obs.unit, cap: obs.cap, source: obs.source, extractionType: obs.extractionType } : null,
          topExtractionType: d.extractionType ?? null,
          provenance: d.provenance ?? null,
          display_value: d.display_value ?? null,
          goal_threshold: d.goal_threshold ?? null,
          goal_threshold_raw: d.goal_threshold_raw ?? null,
          goal_threshold_unit: d.goal_threshold_unit ?? null,
        }
      }),
    }
  })
  console.log(`[RECON] scenario=${state.scenario} nodes=${state.total} (ghosts ${state.ghosts}) edges=${state.edges}`)
  console.log(`[RECON] kinds=${JSON.stringify(state.kinds)}`)
  console.log(`[RECON] clientHash=${state.lastServerGraphHash}`)
  for (const n of state.nodes) {
    console.log(`[RECON] ${n.type.padEnd(9)} ${n.id} "${n.label}" obs=${JSON.stringify(n.obs)} prov=${JSON.stringify(n.provenance)} topExtr=${JSON.stringify(n.topExtractionType)} display=${JSON.stringify(n.display_value)}${n.goal_threshold != null || n.goal_threshold_raw != null ? ` goal_threshold=${JSON.stringify(n.goal_threshold)} raw=${JSON.stringify(n.goal_threshold_raw)} unit=${JSON.stringify(n.goal_threshold_unit)}` : ''}`)
  }

  // Rendered semantic claims, per card, FULL textContent with sr-only stripped.
  const claims = await page.evaluate(() => {
    const st = (window as any).useCanvasStore.getState()
    const real = ((st.nodes ?? []) as Array<any>).filter((n) => !String(n.id).startsWith('__ghost-'))
    return real.map((n) => {
      const el = document.querySelector(`[data-id="${String(n.id)}"]`) as HTMLElement | null
      const clone = el?.cloneNode(true) as HTMLElement | undefined
      clone?.querySelectorAll('.sr-only').forEach((e) => e.remove())
      const t = (clone?.textContent ?? '').replace(/\s+/g, ' ').trim()
      const obs = n.data?.observedState ?? n.data?.observed_state ?? null
      return {
        id: String(n.id),
        type: String(n.type ?? n.data?.kind ?? '?'),
        hasValue: typeof obs?.value === 'number',
        onScreen: el != null,
        est: /\best\.?\b/i.test(t),
        userEdited: /user edited/i.test(t),
        keyDriver: /key driver/i.test(t),
        rank: /most influential|of \d+ factors|of \d+\b/i.test(t),
        confidence: /confiden/i.test(t),
        needsInput: /needs input|not estimated|no value|not set yet/i.test(t),
        text: t.slice(0, 200),
      }
    })
  })
  console.log(`[RECON] --- rendered claims ---`)
  for (const c of claims) {
    const flags = [c.est && 'est.', c.userEdited && 'UserEdited', c.keyDriver && 'KeyDriver', c.rank && 'rank', c.confidence && 'confidence', c.needsInput && 'needsInput'].filter(Boolean).join(',')
    console.log(`[RECON] ${c.type.padEnd(9)} ${c.id} hasValue=${c.hasValue} onScreen=${c.onScreen} claims=[${flags}] text="${c.text}"`)
  }
  const suspect = claims.filter((c) => !c.hasValue && (c.keyDriver || c.rank || c.est || c.confidence))
  console.log(`[RECON] SUSPECT (no canonical value but carries a semantic claim) = ${suspect.length}: ${JSON.stringify(suspect.map((s) => s.id))}`)
  console.log(`[RECON] CONTROL anyClaimRenderedAtAll=${claims.some((c) => c.est || c.keyDriver || c.rank || c.confidence)}`)
  expect(state.total, 'CONTROL: pricing board did not load').toBeGreaterThan(5)
})
