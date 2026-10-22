// A/B: the SAME synthetic saved graph rendered by the base and the head build. Every CEE, engine and Supabase call is
// answered locally (graph route) or blocked, so nothing leaves the machine and no AI is called.
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'

const require = createRequire('/private/tmp/dgai-lm-canvas/package.json')
const { chromium } = require('@playwright/test')
const S = '/private/tmp/claude-502/-Users-paulslee-Documents-GitHub/774b1570-6655-4e71-aee1-88d69b74fb89/scratchpad/ab'
const graph = JSON.parse(readFileSync(`${S}/saved-graph.json`, 'utf8'))
const SCN = '0f4e2b9a-1c3d-4e5f-8a7b-6c5d4e3f2a1b'
const entry = process.env.AB_ENTRY ?? '/'
const builds = (process.env.AB_BUILDS ?? 'base:4611,head:4612').split(',').map((s) => s.split(':'))

const browser = await chromium.launch()
try {
  for (const [label, port] of builds) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
    const page = await ctx.newPage()
    const log = []
    page.on('console', (m) => { if (m.type() === 'error') log.push(`console.error ${m.text().slice(0, 200)}`) })
    page.on('pageerror', (e) => log.push(`pageerror ${String(e).slice(0, 300)}`))
    await page.route('**/*', async (route) => {
      const u = new URL(route.request().url())
      if (u.hostname === '127.0.0.1') {
        if (/\/scenarios\/[^/]+\/graph$/.test(u.pathname)) {
          log.push(`graph ${route.request().method()} ${u.pathname}`)
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
            schema: 'scenario_graph.v1', request_id: 'ab', scenario_id: SCN, graph_present: true, graph, graph_hash: 'ab12cd34ef567890' }) })
        }
        if (/^\/(bff|proxy|engine|api|assist)\b/.test(u.pathname)) { log.push(`404 ${u.pathname}`); return route.fulfill({ status: 404, body: '' }) }
        return route.continue()
      }
      log.push(`abort ${u.hostname}${u.pathname}`)
      return route.abort()
    })
    await page.goto(`http://127.0.0.1:${port}${entry}?ai=openai#/scenario/${SCN}`)
    try { await page.waitForSelector('.react-flow__node', { timeout: 45000 }) } catch { log.push('no react-flow nodes within 45 s') }
    await page.waitForTimeout(6000)
    await page.screenshot({ path: `${S}/${label}.png` })
    const nodes = await page.$$eval('.react-flow__node', (els) => els.map((e) => ({
      id: e.getAttribute('data-id'),
      type: [...e.classList].find((c) => c.startsWith('react-flow__node-'))?.slice('react-flow__node-'.length),
      visible: getComputedStyle(e).visibility,
      text: e.innerText.replace(/\s+/g, ' ').slice(0, 120),
    })))
    const edges = await page.$$eval('.react-flow__edge', (els) => els.map((e) => e.getAttribute('data-id') ?? e.getAttribute('aria-label')))
    const goalList = await page.$$eval('[data-testid="goal-other-aims"]', (els) => els.map((e) => e.innerText))
    if (process.env.AB_RELOAD === '1') {
      await page.reload()
      try { await page.waitForSelector('.react-flow__node', { timeout: 45000 }) } catch { log.push('reload: no nodes') }
      await page.waitForTimeout(6000)
      await page.screenshot({ path: `${S}/${label}-reload.png` })
      const boxes = await page.$$eval('.react-flow__node', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { id: e.getAttribute('data-id'), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }))
      const overlaps = []
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j]
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps.push(`${a.id}~${b.id}`)
      }
      log.push(`reload: ${boxes.length} nodes, overlaps ${JSON.stringify(overlaps)}`)
    }
    writeFileSync(`${S}/${label}.json`, JSON.stringify({ label, nodes, edges, goalList, log }, null, 2))
    console.log(`${label}: ${nodes.length} nodes, ${edges.length} edges, goal-list ${goalList.length}, log ${log.length}`)
    await ctx.close()
  }
} finally {
  await browser.close()
}
