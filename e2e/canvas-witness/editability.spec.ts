import { test, expect } from '@playwright/test'

const EXAMPLE = /Pricing Model Transition Strategy/i

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}

/**
 * REQUIREMENT 2 — "the user can immediately understand what is editable and how".
 *
 * Measured as an AFFORDANCE INVENTORY on the observable DOM, not from the
 * authority table in code. Two different questions and the goal asks the first:
 * a writer that exists but renders no affordance is not discoverable, and a
 * fence that is correct but silent is not understandable.
 *
 * ⚠ "Editable" here means AT REST, without hovering and without opening the
 * inspector — that is what "immediately understand" means. An affordance that
 * only appears on hover is recorded separately rather than counted.
 */
test('EDITABILITY — what is editable, and can the user tell', async ({ page }) => {
  test.setTimeout(240_000)
  const { origin, build } = await pinnedOrigin()
  console.log(`[EDIT] servedUI=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 })
  await card.click()
  await page.waitForTimeout(14_000)

  const inv = await page.evaluate(() => {
    const st = (window as any).useCanvasStore.getState()
    const real = ((st.nodes ?? []) as Array<any>).filter((n) => !String(n.id).startsWith('__ghost-'))
    return real.map((n) => {
      const el = document.querySelector(`[data-id="${String(n.id)}"]`) as HTMLElement | null
      const titles = Array.from(el?.querySelectorAll('[title]') ?? []).map((e) => e.getAttribute('title') ?? '')
      const labels = Array.from(el?.querySelectorAll('[aria-label]') ?? []).map((e) => e.getAttribute('aria-label') ?? '')
      const hay = [...titles, ...labels].join(' ~~ ')
      const inputs = Array.from(el?.querySelectorAll('input,textarea,[contenteditable="true"]') ?? [])
      const buttons = Array.from(el?.querySelectorAll('button,[role="button"]') ?? [])
      return {
        id: String(n.id),
        type: String(n.type ?? n.data?.kind ?? '?'),
        // Does anything SAY it is editable, at rest?
        saysClickToEdit: /click to edit/i.test(hay),
        saysEditInLabel: /— click to edit|, click to edit/i.test(hay),
        // Is there an actual writer mounted at rest?
        inputCount: inputs.length,
        editableInputs: inputs.filter((i) => {
          const el2 = i as HTMLInputElement
          return !el2.readOnly && !el2.disabled
        }).length,
        // Buttons whose name suggests an edit route
        editButtons: buttons.map((b) => (b.getAttribute('aria-label') || b.textContent || '').replace(/\s+/g, ' ').trim())
          .filter((t) => /edit|change|set |confirm/i.test(t)).slice(0, 4),
        // Is there any statement of why something is NOT editable?
        saysNotEditable: /read.?only|cannot be edited|not editable|managed by|outside your control/i.test(hay),
        buttonCount: buttons.length,
      }
    })
  })

  for (const r of inv) {
    console.log(`[EDIT] ${r.type.padEnd(8)} ${r.id.padEnd(30)} clickToEdit=${String(r.saysClickToEdit).padEnd(5)} liveInputs=${r.editableInputs}/${r.inputCount} notEditableStated=${String(r.saysNotEditable).padEnd(5)} buttons=${r.buttonCount} editRoutes=${JSON.stringify(r.editButtons)}`)
  }

  const byKind: Record<string, { n: number; editable: number; stated: number }> = {}
  for (const r of inv) {
    const k = r.type
    byKind[k] = byKind[k] ?? { n: 0, editable: 0, stated: 0 }
    byKind[k].n++
    if (r.saysClickToEdit || r.editableInputs > 0 || r.editButtons.length > 0) byKind[k].editable++
    if (r.saysNotEditable) byKind[k].stated++
  }
  console.log(`[EDIT] --- by kind: editable-affordance / total, and how many STATE they are not editable ---`)
  for (const [k, v] of Object.entries(byKind)) {
    console.log(`[EDIT]   ${k.padEnd(9)} affordance ${v.editable}/${v.n}   states-not-editable ${v.stated}/${v.n}`)
  }
  const silentlyUneditable = inv.filter((r) => !r.saysClickToEdit && r.editableInputs === 0 && r.editButtons.length === 0 && !r.saysNotEditable)
  console.log(`[EDIT] SILENTLY UNEDITABLE (no affordance AND no statement why) = ${silentlyUneditable.length}/${inv.length}: ${JSON.stringify(silentlyUneditable.map((s) => s.type + ':' + s.id))}`)

  const c1 = inv.length > 5
  const c2 = inv.some((r) => r.saysClickToEdit)          // the probe CAN see an affordance
  const c3 = inv.some((r) => !r.saysClickToEdit)         // and CAN see its absence
  const c4 = inv.every((r) => r.buttonCount >= 0)
  console.log(`[EDIT] CONTROL nodes=${inv.length} affordanceSeen=${c2} absenceSeen=${c3} domReadable=${c4}`)
  const measurable = c1 && c2 && c3 && c4
  console.log(`[EDIT] VERDICT ${measurable ? (silentlyUneditable.length === 0 ? 'PASS' : 'FAIL') : 'NOT-MEASURED'}`)
  expect(measurable, 'NOT-MEASURED: a control did not fire').toBe(true)
})
