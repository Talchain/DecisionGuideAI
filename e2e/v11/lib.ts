import { expect, test, type Page } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { measure, type Audit } from './measure'

const DATA = process.env.V11J_DATA!, ADMIN = process.env.V11J_ADMIN!
export const PORT = Number(process.env.V11J_PORT ?? 3966)
export const base = (offset = 0) => `http://127.0.0.1:${PORT + offset}`
export const STORES = process.env.V11J_STORES ?? null
export const storeDir = (name: string) => join(DATA, name)

/** Paul's hiring brief, as core's own fixture holds it (the scripted drafter answers it with that fixture's model). */
export const BRIEF = readFileSync(join(process.env.CORE_DIR!, 'src/contract/__tests__/fixtures/paul-extraction.ts'), 'utf8').match(/export const PAUL_BRIEF = "(.*)";/)![1]!

/** Every step the suite must run; globalTeardown fails the run when one did not pass. */
export const EXPECTED = ['p1.1', 'p1.2', 'p1.3', 'p1.4', 'p1.5', 'p2.6.1', 'p2.6.2', 'p2.6.3', 'p2.6.4', 'p2.6.5', 'audit.walk', 'audit.contrast',
  ...(STORES ? ['audit.hiring', 'audit.j1', 'audit.reveal'] : [])]
/** Marks a step passed, only when the test has no failure, soft ones included. */
export const passed = (id: string) => { if (test.info().errors.length > 0) return; mkdirSync(join(DATA, 'steps'), { recursive: true }); writeFileSync(join(DATA, 'steps', id), '') }
export const passedSteps = () => (existsSync(join(DATA, 'steps')) ? readdirSync(join(DATA, 'steps')) : [])

/** A person's private link, minted on the local core (admin route). */
export async function mint(name: string, scenario?: string, offset = 0): Promise<string> {
  const r = await fetch(`${base(offset)}/api/admin/people`, { method: 'POST', headers: { 'x-olumi-admin': ADMIN, 'content-type': 'application/json' }, body: JSON.stringify({ name, ...(scenario ? { scenario } : {}) }) })
  expect(r.ok, `core mints a link (${r.status})`).toBe(true)
  return (await r.json()).link
}
export const scenarioUrl = (sid: string, offset = 0) => `${base(offset)}/#/scenario/00000000-0000-4000-8000-${sid.slice(2)}`

// The View as the page's own cookie reads it.
export type Card = { id: string; family: string; heading: string; author?: { by: string; text: string } | null; figure?: { text: string; edit?: unknown } | null; headline?: { text: string } | null; rows?: { text: string }[] }
export type View = { title: string; version: { id: string; n: number } | null; proposal: unknown; model: { cards: Card[]; links?: unknown[]; holdable?: unknown[] } | null; chat?: { answer?: { answer: { text?: string }[]; next?: { text: { text?: string }[] } } }[]; collab?: { shared?: unknown[] } }
export const view3 = (p: Page, sid: string): Promise<View | null> => p.evaluate(async (u) => { const r = await fetch(u); return r.ok ? r.json() : null }, `/api/scenarios/${sid}/view?schema=3`)
export async function until<T>(p: Page, f: () => Promise<T | null | undefined | false>, ms = 60_000): Promise<T> {
  for (const end = Date.now() + ms; Date.now() < end;) { const v = await f(); if (v) return v; await p.waitForTimeout(400) }
  throw new Error(`timed out after ${ms} ms`)
}
export const chancesOf = (v: View | null) => (v?.model?.cards ?? []).filter((c) => c.family === 'option').map((c) => [c.id, c.headline?.text ?? null])
export const words = (t: { text?: string }[] | undefined) => (t ?? []).map((x) => x.text ?? '').join('')

/** Whole on screen: inside the canvas pane and left of the dock. */
export const wholeOnBoard = (p: Page) => p.evaluate(() => {
  const P = document.querySelector('.react-flow')!.getBoundingClientRect(), d = document.querySelector('[data-testid="outputs-dock"]')?.getBoundingClientRect()
  const right = d && d.left > P.left + 100 ? d.left : P.right
  return [...document.querySelectorAll('.react-flow__node-viewCard')].filter((n) => { const r = n.getBoundingClientRect(); return r.left >= P.left - 1 && r.top >= P.top - 1 && r.right <= right + 1 && r.bottom <= Math.min(P.bottom, innerHeight) + 1 }).map((n) => n.getAttribute('data-id'))
})

/** Opens a dock tab; a new scenario's dock may first show the brief panel, whose own control leads to the tabs. */
export async function openTab(p: Page, tab: string): Promise<void> {
  const allTabs = p.getByTestId('brief-panel-all-tabs')
  if (await allTabs.count()) { await allTabs.click(); await p.waitForTimeout(800) }
  await p.getByTestId(`outputs-dock-tab-${tab}`).click(); await p.waitForTimeout(1000)
}

/** The dock floats as the comp's card (DL 9 Nov): 8 px (± 1) from the header, the right edge and the window's foot. Was: gap 0 at the foot. */
const dockFloats = (a: Audit, label: string) => {
  expect.soft(a.dockGaps, `${label}: the dock is drawn`).not.toBeNull()
  for (const [side, gap] of Object.entries(a.dockGaps ?? {})) expect.soft(Math.abs(gap - 8), `${label}: dock gap ${side} ${gap} px (8 ± 1)`).toBeLessThanOrEqual(1)
}

/** The 1232 audit on the open board, then on each dock tab; the zero-class numbers are asserted exactly, the layout counts as ceilings. */
export async function audit(p: Page, limits: { out: number; crossings: number }, label: string): Promise<Audit> {
  await p.waitForTimeout(1500)
  const a = await p.evaluate(measure)
  expect.soft(a.wordsOver, `${label}: link words over cards`).toBe(0)
  expect.soft(a.underZoom, `${label}: cards under the zoom panel`).toEqual([])
  expect.soft(a.trunc, `${label}: cut text`).toEqual([])
  expect.soft(a.smallTargets, `${label}: controls under 24 px`).toEqual([])
  dockFloats(a, label)
  expect.soft(a.sizes, `${label}: type sizes on screen`).toEqual([12, 14, 18])
  expect.soft(a.out.length, `${label}: cards off the board (at most ${limits.out})`).toBeLessThanOrEqual(limits.out)
  expect.soft(a.crossings, `${label}: links behind cards (at most ${limits.crossings})`).toBeLessThanOrEqual(limits.crossings)
  // A new scenario's dock may open on the brief panel; its own control leads to the tabs.
  const allTabs = p.getByTestId('brief-panel-all-tabs')
  if (await allTabs.count()) { await allTabs.click(); await p.waitForTimeout(800) }
  for (const tab of ['results', 'analysisNew', 'compare', 'diagnostics', 'team']) {
    const t = p.getByTestId(`outputs-dock-tab-${tab}`)
    await expect(t, `${label}: the ${tab} tab is drawn`).toBeVisible()
    await t.click(); await expect(t).toHaveAttribute('aria-selected', 'true'); await p.waitForTimeout(1000)
    const m = await p.evaluate(measure)
    expect.soft(m.trunc, `${label} ${tab}: cut text`).toEqual([])
    expect.soft(m.sizes.filter((s) => ![12, 14, 18].includes(s)), `${label} ${tab}: type sizes off 12/14/18`).toEqual([])
    dockFloats(m, `${label} ${tab}`)
  }
  await p.getByTestId('outputs-dock-tab-olumi').click()
  return a
}
