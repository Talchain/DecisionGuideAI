/** Node-fit exploration: paired runtime artefacts, never an aesthetic gate. */
import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { GATE_TAG } from './canvasGateSet'
import {
  openCanvas, preparePage, seedStarterDraft,
  waitForVisualQuiescence, type StarterId,
} from '../visual/harness'

const VIEWPORT = { width: 1440, height: 900 }
const OUT = join(process.cwd(), 'test-results', 'canvas-gate', 'node-width')
const BOARDS = ['mrr-90b8f080', 'pricing-model', 'vendor-selection'] as const

type Json = Record<string, unknown>

async function seed(page: Page, board: typeof BOARDS[number]): Promise<void> {
  if (!board.startsWith('mrr-')) {
    await seedStarterDraft(page, board as StarterId)
    return
  }
  const fixture = JSON.parse(readFileSync(join(process.cwd(), 'e2e', 'geometry', 'fixtures', `${board}.fixture.json`), 'utf8')) as { draft: Json }
  await page.evaluate(async (draft) => {
    const path = '/src/canvas/utils/applyDraftResult.ts'
    const mod = (await import(/* @vite-ignore */ path)) as { applyDraftResult: (value: unknown) => unknown }
    mod.applyDraftResult(draft)
  }, fixture.draft)
}

async function readGeometry(page: Page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll<HTMLElement>('.react-flow__node [role="group"][data-kind]')]
      .map((card) => {
        const title = card.querySelector<HTMLElement>('h3')
        const emptySlots = [...card.querySelectorAll<HTMLElement>('[data-testid^="option-share-slot-"], [data-testid^="factor-driver-slot-"]')]
          .filter((slot) => (slot.textContent ?? '').trim() === '')
        return {
          id: card.closest<HTMLElement>('.react-flow__node')?.dataset.id ?? '',
          kind: card.dataset.kind ?? '', title: title?.textContent?.trim() ?? '',
          titleLines: title ? Math.max(1, Math.round(title.scrollHeight / parseFloat(getComputedStyle(title).lineHeight))) : 0,
          width: card.offsetWidth, height: card.offsetHeight,
          unusedTitleWidth: title ? Math.max(0, title.clientWidth - title.scrollWidth) : 0,
          emptyReservedSlotHeight: emptySlots.reduce((sum, slot) => sum + slot.offsetHeight, 0),
          heightWouldChangeAfterRun: emptySlots.length > 0,
          clippedTitle: title ? title.scrollWidth > title.clientWidth + 1 || title.scrollHeight > title.clientHeight + 1 : false,
          rect: card.getBoundingClientRect().toJSON(),
        }
      })
    let overlaps = 0
    for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i].rect; const b = cards[j].rect
      if (Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1) overlaps++
    }
    const left = Math.min(...cards.map((c) => c.rect.left)); const right = Math.max(...cards.map((c) => c.rect.right))
    const transform = getComputedStyle(document.querySelector<HTMLElement>('.react-flow__viewport')!).transform
    const zoom = transform === 'none' ? 1 : Number(transform.split(',')[0].replace('matrix(', ''))
    return { cards: cards.map(({ rect: _rect, ...card }) => card), rowOverlaps: overlaps, clippedTitles: cards.filter((c) => c.clippedTitle).length, boardBoundingWidth: right - left, fitZoom: zoom }
  })
}

test.describe.configure({ mode: 'serial' })
test.describe('node width prototype', () => {
  for (const board of BOARDS) {
    test(`NODE WIDTH PROTOTYPE @${board} 1440x900`, { tag: GATE_TAG }, async ({ page }) => {
      mkdirSync(OUT, { recursive: true })
      const readings: Record<string, unknown> = {}
      for (const mode of ['fixed', 'content'] as const) {
        await preparePage(page, VIEWPORT)
        await openCanvas(page)
        if (mode === 'content') await page.goto('/?nodeFit=content#/canvas')
        await seed(page, board)
        await waitForVisualQuiescence(page)
        const reading = await readGeometry(page)
        expect(reading.rowOverlaps, `${board}/${mode}: cards overlap`).toBe(0)
        expect(reading.clippedTitles, `${board}/${mode}: titles clip`).toBe(0)
        readings[mode] = reading
        await page.screenshot({ path: join(OUT, `${board}-${mode}.png`), fullPage: true })
      }
      const metricsPath = join(OUT, 'metrics.json')
      let all: Record<string, unknown> = {}
      try { all = JSON.parse(readFileSync(metricsPath, 'utf8')) as Record<string, unknown> } catch { /* first board */ }
      all[board] = readings
      writeFileSync(metricsPath, `${JSON.stringify(all, null, 2)}\n`)
    })
  }
})
