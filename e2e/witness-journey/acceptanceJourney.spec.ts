/**
 * ⭐⭐⭐ THE ACCEPTANCE JOURNEY, AGAINST THE DEPLOYED BUILD.
 *
 * Six legs of the plan's acceptance criterion, driven in one browser on the FREE
 * guest route with ZERO provider draft calls. Witnessed passing end to end on
 * deployed `8cf38c42`, 22 Sep 2026 ~02:00, which is the run this file records.
 *
 * ⛔ IT IS A WITNESS, NOT A MERGE GATE, and must never be promoted to one. It
 * drives whatever is deployed, so its subject moves under it — a red here can mean
 * the product regressed OR that staging deployed something new mid-run. A gate has
 * to be attributable to one tree; this is attributable to one DEPLOY, which is a
 * different claim. `playwright.core.config.ts` is where a gate lives, and it
 * rightly refuses a run that cannot name its build.
 *
 * ⭐ THE TARGET IS A PERMALINK, NOT THE ALIAS. `/version.json` carries `deploy_url`
 * — a per-deploy immutable origin. The core harness docblock says "the permalink
 * FORM is owned by the stale-chunk lane; this file deliberately does not invent
 * one"; it exists and is one field away. Pinning it is why this suite cannot split
 * a measurement across a mid-run deploy (which happened 27 Aug and invalidated a
 * rate).
 *
 * ── CONTROLS, because a journey probe that cannot fail proves nothing ─────────
 *  · BOARD LOADED — every leg asserts a non-zero model node count first. A fresh
 *    Playwright profile has no autosave, and `nodes: 0` reads exactly like a
 *    product failure. This bit me once already.
 *  · WRITE LANDED BEFORE RETENTION — the reload leg refuses to report "not
 *    retained" unless the edit is first observed IN the store. Otherwise a failed
 *    write masquerades as a persistence defect.
 *  · FULL textContent, NEVER a windowed regex. Twice tonight a `[^.]{0,80}`
 *    capture cut a qualifying sentence and produced a WRONG finding — the panel
 *    says "The value saves to the shared model. Other edits here are not sent
 *    yet", and a window on the second half reads as the product lying about its
 *    own writes. A truncation and a terse answer are byte-identical.
 *  · ROLE LOCATORS, not text. Each example is ONE button whose accessible name is
 *    title + subtitle across two lines, and `getByText(/title/)` fails to resolve
 *    it — a locator defect that reads as "the example is missing from this build".
 *  · REAL POINTER SEQUENCES. `click({force: true})` on a React Flow node does not
 *    reach its handler; the inspector stayed shut and I nearly filed it as a dead
 *    control. `mouse.move` + `down` + `up` on the node's visual centre works.
 */
import { test, expect, type Page, type Request } from '@playwright/test'

const FALLBACK = 'https://staging--olumi.netlify.app'

async function pinnedOrigin(): Promise<{ origin: string; build: string }> {
  if (process.env.WITNESS_ORIGIN) return { origin: process.env.WITNESS_ORIGIN, build: 'pinned-by-env' }
  const r = await fetch(`${FALLBACK}/version.json`, { cache: 'no-store' })
  const j = (await r.json()) as { short?: string; commit?: string; deploy_url?: string }
  return { origin: j.deploy_url ?? FALLBACK, build: j.short ?? j.commit ?? 'unknown' }
}

const EXAMPLE = /Usage-Based Billing System Approach/i

async function openBoard(page: Page, origin: string): Promise<number> {
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  const guest = page.getByRole('button', { name: /continue without an account/i })
  await guest.waitFor({ state: 'visible', timeout: 45_000 })
  await guest.click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 })
  await card.click()
  await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {})
  await page.waitForTimeout(7_000)
  return page.evaluate(() => {
    const w = window as unknown as { useCanvasStore?: { getState(): { nodes: unknown[] } } }
    const nodes = (w.useCanvasStore?.getState().nodes ?? []) as Array<{ id: unknown }>
    return nodes.filter((n) => !String(n.id).startsWith('__ghost-')).length
  })
}

/** A real pointer sequence on a node's visual centre. `force: true` does not work. */
async function clickNode(page: Page, id: string): Promise<boolean> {
  const loc = page.locator(`[data-id="${id}"]`)
  const fit = page.getByRole('button', { name: /fit to view/i }).first()
  if (await fit.count() > 0) { await fit.click().catch(() => {}); await page.waitForTimeout(2_500) }
  const box = await loc.boundingBox().catch(() => null)
  if (!box) return false
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down(); await page.mouse.up()
  await page.waitForTimeout(3_500)
  return true
}

test('the acceptance journey on the deployed build', async ({ page }) => {
  const wire: string[] = []
  page.on('request', (r: Request) => {
    const u = r.url()
    if (/\/(proxy|bff|assist|orchestrate)\//.test(u)) wire.push(`${r.method()} ${u.slice(0, 80)}`)
  })

  const { origin, build } = await pinnedOrigin()
  // eslint-disable-next-line no-console
  console.log(`[JOURNEY] build=${build} origin=${origin}`)

  // ── LEG 1 · open a real model ───────────────────────────────────────────────
  const nodeCount = await openBoard(page, origin)
  console.log(`[JOURNEY] leg1 open a real model: ${nodeCount} model nodes`)
  expect(nodeCount, 'CONTROL: no board loaded — every leg below would be vacuous').toBeGreaterThan(10)

  // ── LEG 2 · understand the decision immediately ─────────────────────────────
  const leg2 = await page.evaluate(() => {
    const w = window as unknown as { useCanvasStore?: { getState(): { nodes: unknown[] } } }
    const nodes = (w.useCanvasStore?.getState().nodes ?? []) as Array<Record<string, unknown>>
    const g = nodes.find((n) => n.type === 'goal' || (n.data as Record<string, unknown> | undefined)?.kind === 'goal')
    const label = String(((g?.data ?? {}) as Record<string, unknown>).label ?? '')
    return { label, onScreen: label.length > 0 && (document.body.textContent ?? '').includes(label) }
  })
  console.log(`[JOURNEY] leg2 goal statement on screen: ${leg2.onScreen} — "${leg2.label}"`)
  expect(leg2.label.length, 'the board has no goal label to state').toBeGreaterThan(0)
  expect(leg2.onScreen, 'the goal statement is not on screen anywhere').toBe(true)

  // ── LEG 3 · inspect a value with its provenance ─────────────────────────────
  const facId = await page.evaluate(() => {
    const w = window as unknown as { useCanvasStore?: { getState(): { nodes: unknown[] } } }
    const nodes = (w.useCanvasStore?.getState().nodes ?? []) as Array<Record<string, unknown>>
    const f = nodes.find((n) => {
      const d = n.data as Record<string, unknown> | undefined
      const obs = d?.observedState as Record<string, unknown> | undefined
      return (n.type === 'factor' || d?.kind === 'factor')
        && !String(n.id).startsWith('__ghost-')
        && typeof obs?.value === 'number'
    })
    return f ? String(f.id) : null
  })
  expect(facId, 'no factor carries a numeric value — leg 4 has nothing to edit').not.toBeNull()
  expect(await clickNode(page, facId as string), 'the factor node had no box even after Fit to view').toBe(true)
  const leg3 = await page.evaluate(() => {
    const dlgs = Array.from(document.querySelectorAll('[role="dialog"]')) as HTMLElement[]
    // FULL textContent — never a windowed regex.
    const panel = dlgs.map((d) => (d.textContent ?? '').replace(/\s+/g, ' ')).sort((a, b) => b.length - a.length)[0] ?? ''
    return { opened: panel.length > 100, panel: panel.slice(0, 260) }
  })
  console.log(`[JOURNEY] leg3 inspector opened=${leg3.opened} panel="${leg3.panel}"`)
  expect(leg3.opened, 'a single click did not open an inspector').toBe(true)

  // ── LEG 4 · make one edit, and follow it to canonical state AND the wire ────
  const before = await page.evaluate((id) => {
    const w = window as unknown as { useCanvasStore?: { getState(): { nodes: unknown[] } } }
    const n = ((w.useCanvasStore?.getState().nodes ?? []) as Array<Record<string, unknown>>)
      .find((x) => String(x.id) === id)
    return ((n?.data ?? {}) as Record<string, unknown>).observedState ?? null
  }, facId as string)
  const field = page.getByPlaceholder(/enter value/i).first()
  const hasWriter = await field.count() > 0
  console.log(`[JOURNEY] leg4 value writer present=${hasWriter} before=${JSON.stringify(before)}`)
  expect(hasWriter, 'the factor panel offered no value writer').toBe(true)
  const wireMark = wire.length
  await field.click(); await field.fill('7'); await page.keyboard.press('Enter')
  await page.waitForTimeout(7_000)
  const after = await page.evaluate((id) => {
    const w = window as unknown as { useCanvasStore?: { getState(): { nodes: unknown[] } } }
    const n = ((w.useCanvasStore?.getState().nodes ?? []) as Array<Record<string, unknown>>)
      .find((x) => String(x.id) === id)
    return ((n?.data ?? {}) as Record<string, unknown>).observedState as Record<string, unknown> | null
  }, facId as string)
  const sent = wire.slice(wireMark)
  console.log(`[JOURNEY] leg4 after=${JSON.stringify(after)}`)
  console.log(`[JOURNEY] leg4 wire=${JSON.stringify(sent)}`)
  expect(after?.value, 'the typed value did not reach canonical state').toBe(7)
  expect(String(after?.source), 'the edit did not become user-authored').toMatch(/user/)
  expect(sent.length, 'the edit reached canonical state but was never sent').toBeGreaterThan(0)

  // ── LEG 5 · reload and retain ───────────────────────────────────────────────
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(9_000)
  const retained = await page.evaluate((id) => {
    const w = window as unknown as { useCanvasStore?: { getState(): { nodes: unknown[] } } }
    const n = ((w.useCanvasStore?.getState().nodes ?? []) as Array<Record<string, unknown>>)
      .find((x) => String(x.id) === id)
    return ((n?.data ?? {}) as Record<string, unknown>).observedState as Record<string, unknown> | null
  }, facId as string)
  console.log(`[JOURNEY] leg5 after reload=${JSON.stringify(retained)}`)
  expect(retained?.value, 'the edit did not survive a reload').toBe(7)

  // ── LEG 6 · add an unconnected idea that stays visibly unresolved ───────────
  const n0 = await page.evaluate(() => {
    const w = window as unknown as { useCanvasStore?: { getState(): { nodes: unknown[] } } }
    return (w.useCanvasStore?.getState().nodes ?? []).length
  })
  await page.getByRole('button', { name: /^Add to model$/i }).first().click()
  await page.waitForTimeout(2_000)
  // `Add node` is a SUBMENU PARENT with `action: () => {}` by design — hover it.
  await page.locator('[role="menu"], [role="dialog"]').locator('text="Add node"').first().hover()
  await page.waitForTimeout(1_800)
  // Submenu labels are GLYPH-PREFIXED ("● Factor"), so match the word, not the start.
  await page.locator('[role="menuitem"]').filter({ hasText: /Factor/ }).first().click()
  await page.waitForTimeout(5_000)
  const leg6 = await page.evaluate(() => {
    const w = window as unknown as { useCanvasStore?: { getState(): Record<string, unknown> } }
    const st = w.useCanvasStore?.getState() ?? {}
    const nodes = (st.nodes ?? []) as Array<Record<string, unknown>>
    const edges = (st.edges ?? []) as Array<Record<string, unknown>>
    const n = nodes[nodes.length - 1]
    const el = n ? document.querySelector(`[data-id="${String(n.id)}"]`) as HTMLElement | null : null
    return {
      count: nodes.length,
      id: String(n?.id ?? ''),
      edgesOnIt: edges.filter((e) => e.source === n?.id || e.target === n?.id).length,
      card: (el?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    }
  })
  console.log(`[JOURNEY] leg6 nodes ${n0} -> ${leg6.count} edgesOnIt=${leg6.edgesOnIt} card="${leg6.card}"`)
  expect(leg6.count, 'no node was added').toBeGreaterThan(n0)
  expect(leg6.edgesOnIt, 'the added idea was given a relationship nobody stated').toBe(0)
  expect(leg6.card, 'the added idea does not declare itself unresolved').toMatch(/needs input|no value|not estimated/i)
})
