/**
 * THREAD AUTO-SCROLL + MOUNT GEOMETRY — a MEASUREMENT instrument, not a gate.
 *
 * Real Chromium, real layout, real CSS. jsdom cannot prove that content is on
 * screen (CLAUDE.md trap 3), and a 0x0 opacity-0 element is "present" and
 * useless — that trap is exactly what produced the false "dead affordance"
 * finding this lane was sent to explain. Every visibility claim in the PR body
 * comes from HERE; the jsdom specs make only trigger/mount-count claims.
 *
 * Run deliberately (it is in no gate):
 *   pnpm exec playwright test -c playwright.geometry.config.ts
 *
 * Output: one `SCROLLJSON {...}` / `MOUNTJSON {...}` line per cell on stdout.
 */
import { test } from '@playwright/test'
import { openCanvas, preparePage, seedStarterDraft } from '../visual/harness'

const VP = { width: 1440, height: 900 }

/**
 * PART 1 — mount geometry on the REAL product.
 *
 * The COUNT claim is made by the jsdom spec (a count is not a visibility
 * claim). What only a browser can settle is whether a mount is HIT-TESTABLE:
 * `display:none` generates no box, so a testid selector still resolves to it
 * while a human click cannot possibly land on it. Those are different claims
 * and the fix for each is different.
 */
test('MOUNT geometry — chat-thread mounts, their boxes and hit-testability', async ({ page }) => {
  await preparePage(page, VP)
  await openCanvas(page)
  await seedStarterDraft(page, 'vendor-selection')
  await page.waitForTimeout(1200)

  const m = await page.evaluate(() => {
    const probe = (sel: string) => {
      const nodes = [...document.querySelectorAll(sel)] as HTMLElement[]
      return nodes.map((el) => {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        const hit =
          r.width > 0 && r.height > 0
            ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
            : null
        const chain: string[] = []
        for (let p: HTMLElement | null = el.parentElement; p && chain.length < 8; p = p.parentElement) {
          const tid = p.getAttribute('data-testid')
          if (tid) chain.push(tid)
        }
        return {
          rect: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top) },
          display: cs.display,
          opacity: cs.opacity,
          visibility: cs.visibility,
          hitTestable: hit !== null && el.contains(hit),
          ancestorTestids: chain,
        }
      })
    }
    return {
      chatThreadCanonical: { count: document.querySelectorAll('[data-testid="chat-thread"]').length, mounts: probe('[data-testid="chat-thread"]') },
      chatThreadFloating: { count: document.querySelectorAll('[data-testid="chat-thread-floating"]').length, mounts: probe('[data-testid="chat-thread-floating"]') },
      floatingPanel: probe('[data-testid="floating-olumi-panel"]'),
      olumiTabWrapper: probe('[data-testid="olumi-tab-wrapper"]'),
    }
  })
  // eslint-disable-next-line no-console
  console.log(`MOUNTJSON ${JSON.stringify(m)}`)
})

/**
 * PART 2 — is content that grows ON AN EXISTING MESSAGE scrolled to?
 *
 * Mounts the REAL `ChatThread` (real `useSmartScroll`, real stylesheet) through
 * Vite's dev module graph. See `threadMountProbe.ts` for why that indirection
 * exists and for the derivation of the growth shape.
 */
test('SCROLL — content growing on an existing message', async ({ page }) => {
  await preparePage(page, VP)
  await openCanvas(page)

  const out = await page.evaluate(async () => {
    const path = '/e2e/geometry/threadMountProbe.ts'
    const mod = (await import(/* @vite-ignore */ path)) as {
      measureThreadGrowth: () => Promise<unknown>
    }
    return mod.measureThreadGrowth()
  })

  // eslint-disable-next-line no-console
  console.log(`SCROLLJSON ${JSON.stringify(out)}`)
})
