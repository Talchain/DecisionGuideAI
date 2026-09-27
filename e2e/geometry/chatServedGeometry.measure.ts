/**
 * ⭐ D-2 CHAT ARM (build train #70 5855068711, slice D, R7): the chat, rendered in a real browser from SERVED turns,
 * at the dock's real widths, with every disclosure open, has:
 *   (a) nothing overhanging the thread (the dock clips it, so a word or control would be cut off);
 *   (b) no text clipped without an ellipsis or a line clamp (a sentence silently cut);
 *   (c) no control whose centre another element covers (a chip the user cannot press).
 *
 * The turns are the five producer bodies in #2175's fixture (DL acceptance runs, 26–27 Sep, verbatim), built into
 * messages by the shipped chain inside the page (`chatServedGeometryProbe.ts`). jsdom returns 0 for every rect,
 * so no unit test can see this class.
 */
import { test, expect } from '@playwright/test'
import { openCanvas, preparePage } from '../visual/harness'
import type { ChatGeometryReading } from './chatServedGeometryProbe'
import { GATE_TAG } from './canvasGateSet'

/** The dock's measured range: 319px at the laptop default, 416px at its widest (DS v5 §21; Atlas review). */
const DOCK_WIDTHS = [319, 416] as const

test.describe('chat served geometry', () => {
for (const width of DOCK_WIDTHS) {
  test(`CHAT SERVED TURNS — no overhang, no silent clip, no covered control, dock ${width}px`, { tag: GATE_TAG }, async ({ page }) => {
    await preparePage(page, { width: 1440, height: 900 })
    await openCanvas(page)

    const reading = (await page.evaluate(async (w) => {
      const path = '/e2e/geometry/chatServedGeometryProbe.ts'
      const mod = (await import(/* @vite-ignore */ path)) as { measureServedChat: (w: number) => Promise<unknown> }
      return mod.measureServedChat(w)
    }, width)) as ChatGeometryReading

    console.log(`CHATGEOMJSON ${JSON.stringify(reading)}`)

    // The probe measured something: all five turns mounted, with real elements and controls.
    expect(reading.messages, 'every served turn mounted').toBe(reading.turns)
    expect(reading.turns).toBe(5)
    expect(reading.elements).toBeGreaterThan(200)
    expect(reading.buttons).toBeGreaterThan(5)
    expect(reading.disclosuresOpened, 'the disclosures were opened, so their contents were measured').toBeGreaterThan(0)
    expect(reading.menusChecked, 'at least one message menu was opened and its items checked').toBeGreaterThan(0)

    const by = (k: string) => reading.offenders.filter((o) => o.kind === k).map((o) => `${o.testid ?? o.tag}: ${o.detail} — "${o.text}"`)
    expect(by('overhang'), '(a) overhang past the thread').toEqual([])
    expect(by('clipped'), '(b) text clipped without an ellipsis or clamp').toEqual([])
    expect(by('covered'), '(c) a control covered at its centre').toEqual([])
    expect(reading.threadScroll.scrollWidth, 'the thread never scrolls sideways').toBeLessThanOrEqual(reading.threadScroll.clientWidth)
  })
}
})
