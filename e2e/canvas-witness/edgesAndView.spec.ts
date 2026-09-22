import { test } from '@playwright/test'

const EXAMPLE = /Pricing Model Transition Strategy/i

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}

test('EDGES + a capture for design critique', async ({ page }) => {
  test.setTimeout(240_000)
  const { origin, build } = await pinnedOrigin()
  console.log(`[EDGE] servedUI=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 })
  await card.click()
  await page.waitForTimeout(14_000)

  // R2: "relationships where supported" — is any edge editable, and does the
  // canvas SAY so either way?
  const edges = await page.evaluate(() => {
    const st = (window as any).useCanvasStore.getState()
    const list = (st.edges ?? []) as Array<any>
    const doms = Array.from(document.querySelectorAll('[data-testid^="rf__edge"], .react-flow__edge'))
    const sample = doms.slice(0, 6).map((e) => {
      const g = e as HTMLElement
      const titles = Array.from(g.querySelectorAll('[title]')).map((x) => x.getAttribute('title') ?? '')
      const labels = Array.from(g.querySelectorAll('[aria-label]')).map((x) => x.getAttribute('aria-label') ?? '')
      const own = g.getAttribute('aria-label') ?? ''
      return { own: own.slice(0, 110), titles: titles.filter(Boolean).slice(0, 3), labels: labels.filter(Boolean).slice(0, 2) }
    })
    const hay = doms.map((e) => {
      const g = e as HTMLElement
      return [g.getAttribute('aria-label') ?? '', ...Array.from(g.querySelectorAll('[title],[aria-label]')).map((x) => x.getAttribute('title') || x.getAttribute('aria-label') || '')].join(' ~~ ')
    }).join(' || ')
    return {
      storeEdges: list.length,
      domEdges: doms.length,
      anyClickToEdit: /click to edit/i.test(hay),
      anyEditableWord: /edit|change strength|adjust/i.test(hay),
      anyStatesReadOnly: /read.?only|cannot be edited|not editable/i.test(hay),
      sample,
    }
  })
  console.log(`[EDGE] storeEdges=${edges.storeEdges} domEdges=${edges.domEdges}`)
  console.log(`[EDGE] anyEdgeSaysClickToEdit=${edges.anyClickToEdit} anyEdgeSaysEditable=${edges.anyEditableWord} anyEdgeStatesReadOnly=${edges.anyStatesReadOnly}`)
  for (const s of edges.sample) console.log(`[EDGE]   own="${s.own}" titles=${JSON.stringify(s.titles)}`)

  // Opening view, for the design critique.
  const view = await page.evaluate(() => {
    const vp = document.querySelector('.react-flow__viewport') as HTMLElement | null
    const m = vp?.style.transform?.match(/scale\(([\d.]+)\)/)
    const nodes = Array.from(document.querySelectorAll('.react-flow__node')) as HTMLElement[]
    const vpBox = { w: window.innerWidth, h: window.innerHeight }
    const visible = nodes.filter((n) => {
      const r = n.getBoundingClientRect()
      return r.right > 0 && r.bottom > 0 && r.left < vpBox.w && r.top < vpBox.h
    }).length
    return { scale: m ? Number(m[1]) : null, totalNodes: nodes.length, visibleNodes: visible, viewport: vpBox }
  })
  console.log(`[EDGE] openingView scale=${view.scale} visibleNodes=${view.visibleNodes}/${view.totalNodes} viewport=${JSON.stringify(view.viewport)}`)

  await page.screenshot({ path: 'pricing-opening-view.png', fullPage: false })
  const fit = page.getByRole('button', { name: /fit to view/i }).first()
  if (await fit.count() > 0) { await fit.click(); await page.waitForTimeout(3_000) }
  const fitted = await page.evaluate(() => {
    const vp = document.querySelector('.react-flow__viewport') as HTMLElement | null
    const m = vp?.style.transform?.match(/scale\(([\d.]+)\)/)
    const nodes = Array.from(document.querySelectorAll('.react-flow__node')) as HTMLElement[]
    const visible = nodes.filter((n) => { const r = n.getBoundingClientRect(); return r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight }).length
    return { scale: m ? Number(m[1]) : null, visible, total: nodes.length }
  })
  console.log(`[EDGE] afterFitToView scale=${fitted.scale} visibleNodes=${fitted.visible}/${fitted.total}`)
  await page.screenshot({ path: 'pricing-fit-to-view.png', fullPage: false })
  console.log('[EDGE] captures written: pricing-opening-view.png, pricing-fit-to-view.png')
})
