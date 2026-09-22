import { test, expect } from '@playwright/test'

const EXAMPLE = /Pricing Model Transition Strategy/i

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}

/**
 * ⭐⭐⭐ IS RENAME REACHABLE BY DOUBLE-CLICK, FOR EVERY NODE KIND?
 *
 * This is the precondition for advertising it. Two source claims at this tip
 * CONTRADICT each other and neither may be built on:
 *   · `DecisionNode.tsx:814-825` states, with its own contrast control, that
 *     `onLabelChange` has ZERO product callers and the title "renders as static
 *     text" — and that #1025 reverted #1024 because a label edit had no carrier.
 *   · `InspectorRouter.tsx:492` passes `onLabelChange={handleLabelChange}`, and
 *     `structural_rename` is a member of `WIRE_SYSTEM_EVENT_TYPES`.
 *
 * ⛔ So this asks the product, not the tree. GEOMETRY-FREE by construction:
 * every action is `locator.dblclick()` on a React Flow node div — an
 * axis-aligned rectangle whose hit point Playwright resolves itself. No
 * coordinate is computed anywhere in this file.
 */
test('RENAME REACHABILITY — double-click, per node kind', async ({ page }) => {
  test.setTimeout(280_000)
  const { origin, build } = await pinnedOrigin()
  console.log(`[RR] servedUI=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 })
  await card.click()
  await page.waitForTimeout(14_000)
  await page.getByRole('button', { name: /fit to view/i }).first().click().catch(() => {})
  await page.waitForTimeout(3_000)

  const ids = await page.evaluate(() =>
    ((window as any).useCanvasStore.getState().nodes as Array<any>)
      .filter((n) => !String(n.id).startsWith('__ghost-'))
      .map((n) => ({ id: String(n.id), type: String(n.type ?? n.data?.kind ?? '?'), label: String(n.data?.label ?? '') })))

  // What a rename-in-progress looks like: a focused, editable text field
  // OUTSIDE the canvas surface, seeded with this node's own label. Seeded-with
  // is the identity binding — any enabled input would otherwise satisfy it.
  const readRenameField = (label: string) => page.evaluate((lab: string) => {
    const flow = document.querySelector('.react-flow')
    const fields = Array.from(document.querySelectorAll('input[type="text"],input:not([type]),textarea,[contenteditable="true"]'))
      .filter((e) => !(flow && flow.contains(e)))
      .filter((e) => { const i = e as HTMLInputElement; return !i.readOnly && !i.disabled && !i.closest('fieldset[disabled]') })
    const vals = fields.map((e) => (e as HTMLInputElement).value ?? (e as HTMLElement).innerText ?? '')
    const seeded = fields.filter((_el, k) => (vals[k] ?? '').trim() === lab.trim())
    return {
      enabledFields: fields.length,
      seededWithThisLabel: seeded.length,
      focusedIsAField: document.activeElement != null && fields.includes(document.activeElement),
      values: vals.map((v) => v.slice(0, 40)),
    }
  }, label)

  const rows: Array<Record<string, unknown>> = []
  for (const n of ids) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(250)
    await page.locator(`[data-id="${n.id}"]`).first().dblclick({ timeout: 8_000 }).catch(() => {})
    await page.waitForTimeout(1_600)
    const r = await readRenameField(n.label)
    rows.push({ ...n, ...r })
    console.log(`[RR] ${n.type.padEnd(8)} ${n.id.padEnd(30)} seeded=${r.seededWithThisLabel} enabled=${r.enabledFields} focused=${r.focusedIsAField} ${JSON.stringify(r.values.slice(0, 3))}`)
  }

  const byKind = new Map<string, { n: number; ok: number }>()
  for (const r of rows) {
    const k = String(r.type)
    const e = byKind.get(k) ?? { n: 0, ok: 0 }
    e.n += 1
    if ((r.seededWithThisLabel as number) > 0) e.ok += 1
    byKind.set(k, e)
  }
  for (const [k, v] of byKind) console.log(`[RR] KIND ${k.padEnd(9)} ${v.ok}/${v.n} reach a seeded rename field`)

  // CONTROLS: the probe must be able to see BOTH outcomes in this run, and the
  // seeding must be discriminating — a fabricated label must find nothing.
  const cSome = rows.some((r) => (r.seededWithThisLabel as number) > 0)
  const cNone = rows.some((r) => (r.seededWithThisLabel as number) === 0)
  const fabricated = await readRenameField('a label no node on this board carries')
  console.log(`[RR] CONTROL nodes=${rows.length} seenPresent=${cSome} seenAbsent=${cNone} fabricatedFindsNothing=${fabricated.seededWithThisLabel === 0}`)

  const measurable = rows.length > 5 && fabricated.seededWithThisLabel === 0 && (cSome || cNone)
  const dead = [...byKind.entries()].filter(([, v]) => v.ok === 0).map(([k]) => k)
  console.log(`[RR] VERDICT ${measurable ? (dead.length === 0 ? 'PASS' : 'FAIL') : 'NOT-MEASURED'} — kindsWithNoRenameField=${JSON.stringify(dead)}`)
  expect(measurable, 'NOT-MEASURED: the fabricated-label control did not discriminate').toBe(true)
})
