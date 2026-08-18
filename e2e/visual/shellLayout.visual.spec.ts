/**
 * SHELL LAYOUT — MEASURED IN A REAL BROWSER, at the two viewports the brief names.
 *
 * jsdom cannot prove any of this. `getAllByRole('tab')` proves PRESENCE; it says
 * nothing about whether a tab spilled under the controls beside it, or whether
 * the composer is sitting on top of the last card in the body. Those are layout
 * facts and only a layout engine has them.
 *
 * So this spec measures BOUNDING BOXES and asserts three things the founder
 * reported and the shell contract now owns:
 *
 *   1. the dock is 416px, at both viewports and independently of analysis state;
 *   2. the tab row does not overflow — no horizontal scroll, and every tab's
 *      right edge is inside its nav, with the protected freshness/verify
 *      affordances still painted with a non-zero box;
 *   3. the footer/composer stack does not overlap the body — they are flex
 *      siblings, so their boxes must not intersect.
 *
 * It writes a PNG per viewport as a reviewable artefact. It deliberately does
 * NOT call `captureState`: these are not blessed references, so they do not
 * enter `STATE_NAMES x VIEWPORTS` and cannot confuse the completeness guard,
 * which asserts that set by name in both directions.
 *
 * ⚠ 1920x1080 is measured here and is NOT in `VIEWPORTS`. That is deliberate:
 * adding a third viewport to the blessed set would mint five new references per
 * platform and red the advisory linux job until CI regenerated them. The
 * assertions below are dimensional, not pixel-comparative, so they need no
 * reference to be true — which is why this viewport can be covered today
 * instead of after a re-bless cycle.
 */

import { test, expect, type Page } from '@playwright/test'
import {
  clearNotifications,
  freezeMotion,
  openCanvas,
  preparePage,
  seedStarterDraft,
  waitForVisualQuiescence,
} from './harness'

const STARTER = 'build-vs-buy' as const

/** The two viewports the shell brief names. 1280x800 is also a blessed size. */
const SHELL_VIEWPORTS = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1920x1080', width: 1920, height: 1080 },
] as const

/**
 * `DOCK_RESPONSIVE_MAX_WIDTH`. The dock is capped here at every viewport wide
 * enough to reach it, so both sizes below must land on exactly this number —
 * and the point of asserting it at 1920 as well as 1280 is that the previous
 * regression clamped the dock to 280px at EVERY viewport up to 4K, so a
 * single-viewport check would have missed nothing and proved nothing.
 */
const EXPECTED_DOCK_WIDTH = 416

interface Box { x: number; y: number; width: number; height: number }

async function boxOf(page: Page, selector: string): Promise<Box> {
  const b = await page.locator(selector).first().boundingBox()
  expect(b, `${selector} has no bounding box — it is not laid out`).not.toBeNull()
  return b as Box
}

const overlapPx = (a: Box, b: Box): number =>
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))

test.describe('workspace shell — layout, measured', () => {
  for (const vp of SHELL_VIEWPORTS) {
    test(`dock is ${EXPECTED_DOCK_WIDTH}px, tabs do not overflow, footer does not overlap [${vp.name}]`, async ({
      page,
    }, testInfo) => {
      await preparePage(page, vp)
      await openCanvas(page)
      await seedStarterDraft(page, STARTER)
      await clearNotifications(page)
      await freezeMotion(page)
      await waitForVisualQuiescence(page)

      // ── identity anchors: we are looking at the shell, not at some screen ──
      await expect(page.locator('[data-testid="outputs-dock"]')).toBeVisible()
      await expect(page.locator('nav[aria-label="Outputs sections"]')).toBeVisible()

      // ── 1. THE WIDTH BUDGET ────────────────────────────────────────────────
      const dock = await boxOf(page, '[data-testid="outputs-dock"]')
      expect(
        Math.round(dock.width),
        `the dock must be ${EXPECTED_DOCK_WIDTH}px at ${vp.name}; a regression once clamped it to ` +
          `280px at every viewport up to 4K, costing 35% of the content budget`,
      ).toBe(EXPECTED_DOCK_WIDTH)

      // The shell publishes its live width, so a child can respond to the PANEL
      // rather than to the window. Read from the element, not from a constant.
      const published = await page
        .locator('[data-testid="outputs-dock"]')
        .evaluate(el => getComputedStyle(el).getPropertyValue('--panel-width').trim())
      expect(published, '--panel-width must be published from the live rect').toBe(
        `${EXPECTED_DOCK_WIDTH}px`,
      )

      // ── 1b. CONTAINER QUERIES ARE ACTUALLY AVAILABLE ──────────────────────
      // This shipped ABSENT on a reason that turned out to be false: the
      // comment claimed `container-type` implies `contain: layout` and would
      // reparent the dock's viewport-`fixed` descendants. It does not. Both
      // halves are asserted here against the REAL dock, because the failure
      // mode in each direction is silent — an unmatched `@container` rule just
      // applies its default arm, and a reparented overlay just renders small.
      const containment = await page
        .locator('[data-testid="outputs-dock"]')
        .evaluate(el => {
          const cs = getComputedStyle(el)
          return { containerType: cs.containerType, containerName: cs.containerName, contain: cs.contain }
        })
      expect(
        containment.containerType,
        'the dock must be a size container or every child `@container` rule silently never matches',
      ).toBe('inline-size')
      expect(containment.containerName).toBe('workspace-shell')

      // Direction A: a `@container workspace-shell` rule MUST match inside the
      // dock. Asserted by injecting a probe rather than trusting the property,
      // because `container-type` alone does not prove a rule resolves.
      const containerQueryMatches = await page.evaluate(() => {
        const dock = document.querySelector('[data-testid="outputs-dock"]')!
        const probe = document.createElement('div')
        probe.id = '__shell-cq-probe'
        dock.appendChild(probe)
        const style = document.createElement('style')
        style.textContent =
          '@container workspace-shell (max-width: 9999px) { #__shell-cq-probe { color: rgb(1, 2, 3) } }'
        document.head.appendChild(style)
        const matched = getComputedStyle(probe).color === 'rgb(1, 2, 3)'
        probe.remove()
        style.remove()
        return matched
      })
      expect(containerQueryMatches, 'a @container rule did not match inside the dock').toBe(true)

      // Direction B — the regression this feature was wrongly blocked on, and
      // the assertion has to be the RIGHT one, which took two measurements.
      //
      // The first version asserted that a `fixed` descendant of the dock
      // resolves against the VIEWPORT. It FAILED — [853,13,414,770], i.e. the
      // dock. Isolating the cause showed why, and it is not this feature:
      //
      //   nothing                            [0,0,1280,800]    viewport
      //   container-type: inline-size        [0,0,1280,800]    viewport
      //   backdrop-filter: blur(8px)         [852,12,416,776]  DOCK
      //   backdrop-filter + container-type   [852,12,416,776]  DOCK
      //   contain: layout (control)          [852,12,416,776]  DOCK
      //
      // `backdrop-filter` creates a containing block for fixed descendants,
      // and the dock has carried `blur(8px)` since long before this change. So
      // the dock's three viewport-`fixed` descendants — the scenario-comparison
      // `fixed inset-0` overlay and two toasts — were ALREADY dock-scoped on
      // `staging`. That is a real pre-existing defect (a "full-screen" overlay
      // that is panel-sized) and it is reported, not fixed here; asserting the
      // viewport would be asserting something that has never been true.
      //
      // So the assertion is the DISCRIMINATING one, which is also the only
      // thing this change is answerable for: turning the dock into a size
      // container must move the fixed descendant BY NOTHING. Measured in-page
      // against the real dock, with and without the property.
      const containingBlock = await page.evaluate(() => {
        const dock = document.querySelector('[data-testid="outputs-dock"]') as HTMLElement
        const probe = document.createElement('div')
        probe.style.cssText = 'position:fixed;inset:0;pointer-events:none'
        dock.appendChild(probe)
        const read = () => {
          const b = probe.getBoundingClientRect()
          return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]
        }
        const withContainer = read()
        const saved = dock.style.containerType
        dock.style.containerType = 'normal'
        const withoutContainer = read()
        dock.style.containerType = saved
        probe.remove()
        return { withContainer, withoutContainer, restored: getComputedStyle(dock).containerType }
      })
      expect(
        containingBlock.withContainer,
        `making the dock a size container MOVED a fixed descendant ` +
          `(${JSON.stringify(containingBlock.withoutContainer)} -> ` +
          `${JSON.stringify(containingBlock.withContainer)}). It must change nothing.`,
      ).toEqual(containingBlock.withoutContainer)
      // The toggle must have actually toggled, or the equality above is two
      // reads of the same state agreeing with itself.
      expect(containingBlock.restored).toBe('inline-size')
      // eslint-disable-next-line no-console
      console.log(
        `[shell] ${vp.name}: fixed-descendant box ${JSON.stringify(containingBlock.withContainer)} ` +
          `with container, ${JSON.stringify(containingBlock.withoutContainer)} without — ` +
          `unchanged. (Dock-scoped by pre-existing \`backdrop-filter\`, not by this change.)`,
      )

      // ── 2. THE TAB ROW DOES NOT OVERFLOW ──────────────────────────────────
      const nav = page.locator('nav[aria-label="Outputs sections"]').first()
      const navMetrics = await nav.evaluate(el => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }))
      expect(
        navMetrics.scrollWidth,
        `the tab nav overflows at ${vp.name} (${navMetrics.scrollWidth} > ${navMetrics.clientWidth}). ` +
          `Tabs must shrink, not spill under the controls beside them.`,
      ).toBeLessThanOrEqual(navMetrics.clientWidth)

      const navBox = await boxOf(page, 'nav[aria-label="Outputs sections"]')
      const tabs = nav.locator('button')
      const tabCount = await tabs.count()
      // Journey is hidden by contract, so four surfaces are presented.
      expect(tabCount, 'four presented surfaces: Olumi, Analysis, Compare, Model').toBe(4)
      for (let i = 0; i < tabCount; i++) {
        const t = await tabs.nth(i).boundingBox()
        expect(t, `tab ${i} is not laid out`).not.toBeNull()
        const label = await tabs.nth(i).getAttribute('title')
        expect(
          Math.round(t!.x + t!.width),
          `tab "${label}" spills past the nav's right edge at ${vp.name}`,
        ).toBeLessThanOrEqual(Math.round(navBox.x + navBox.width) + 1)
        expect(t!.width, `tab "${label}" collapsed to nothing`).toBeGreaterThan(8)
      }

      // The controls to the right of the nav must all be inside the dock —
      // the overflow symptom was tabs sliding UNDER these.
      for (const control of ['[data-testid="dock-versions-trigger"]', '[data-testid="dock-collapse-control"]']) {
        const c = await boxOf(page, control)
        expect(
          Math.round(c.x + c.width),
          `${control} is outside the dock at ${vp.name}`,
        ).toBeLessThanOrEqual(Math.round(dock.x + dock.width) + 1)
        expect(c.x, `${control} was pushed off the left of the dock`).toBeGreaterThanOrEqual(dock.x)
      }

      // ── PROTECTED CONTENT: truncation must not have eaten these ───────────
      // `truncate` on the BUTTON would clip exactly the trailing affordances.
      // Bound by testid, so a different icon appearing cannot satisfy it. Each
      // is conditional on product state, so the assertion is: IF mounted, it is
      // PAINTED — never "it is absent, therefore fine".
      const protectedSeen: string[] = []
      for (const protectedTestId of [
        'results-tab-stale-icon',
        'results-tab-cannot-confirm-icon',
        'model-tab-verify-badge',
      ]) {
        const loc = page.locator(`[data-testid="${protectedTestId}"]`)
        if ((await loc.count()) > 0) {
          protectedSeen.push(protectedTestId)
          const b = await loc.first().boundingBox()
          expect(b, `${protectedTestId} is mounted but has no box — it has been clipped away`).not.toBeNull()
          expect(b!.width, `${protectedTestId} clipped to zero width`).toBeGreaterThan(0)
          expect(b!.height, `${protectedTestId} clipped to zero height`).toBeGreaterThan(0)
          expect(
            Math.round(b!.x + b!.width),
            `${protectedTestId} is painted outside the dock`,
          ).toBeLessThanOrEqual(Math.round(dock.x + dock.width) + 1)
        }
      }
      // ⚠ HONESTY, NOT DECORATION. Each of those is conditional on product
      // state, so on a state where none mounts the loop above asserts NOTHING
      // and would report a clean pass having looked at nothing (trap 13). The
      // census is printed so the run says which of them it actually witnessed,
      // and the reader can tell "protected content survives truncation" from
      // "no protected content was on screen".
      // eslint-disable-next-line no-console
      console.log(
        `[shell] ${vp.name}: protected affordances witnessed painted = ` +
          `${protectedSeen.length ? protectedSeen.join(', ') : 'NONE — this state mounts none, so ' +
            'this run is NOT evidence about them'}`,
      )

      // ── 3. THE FOOTER / COMPOSER DOES NOT OVERLAP THE BODY ────────────────
      const body = await boxOf(page, '[data-testid="outputs-dock-body"]')
      const footer = page.locator('[data-testid="ai-panel-footer-stack"]')
      // NOT a conditional. Under the pinned flag posture the footer stack — the
      // composer's host — always mounts with the dock open, and if it ever
      // stops, the overlap assertion below would pass by measuring nothing.
      // Asserting presence first is what stops this being the vacuous shape.
      expect(
        await footer.count(),
        'the footer/composer stack did not mount — the overlap assertion below would be vacuous',
      ).toBeGreaterThan(0)
      {
        const f = await boxOf(page, '[data-testid="ai-panel-footer-stack"]')
        expect(
          overlapPx(body, f),
          `the footer/composer stack overlaps the scrolling body by ${overlapPx(body, f)}px at ` +
            `${vp.name}. They are flex siblings; an overlap means something is pinning itself to ` +
            `the bottom of the scroller instead of rendering into the reserved footer region.`,
        ).toBe(0)
        expect(f.y, 'the footer must sit BELOW the body, not above it').toBeGreaterThanOrEqual(
          body.y + body.height - 1,
        )
        // …and the footer must be inside the dock, not hanging off the bottom.
        expect(Math.round(f.y + f.height)).toBeLessThanOrEqual(Math.round(dock.y + dock.height) + 1)

        // The COMPOSER specifically, not just its host. The footer stack also
        // holds the selection pill and the cog popover, so a stack that fits
        // says nothing on its own about the thing the user types into.
        const composer = page.locator(
          '[data-testid="persistent-strip-composer"], [data-testid="persistent-strip-composer-redirect"], [data-testid="persistent-strip-status"]',
        )
        expect(
          await composer.count(),
          'no composer surface mounted inside the footer stack',
        ).toBeGreaterThan(0)
        const c = await composer.first().boundingBox()
        expect(c, 'the composer is not laid out').not.toBeNull()
        expect(
          overlapPx(body, c as Box),
          `the composer overlaps the scrolling body by ${overlapPx(body, c as Box)}px at ${vp.name}`,
        ).toBe(0)
        expect(
          Math.round(c!.y + c!.height),
          'the composer is cut off by the bottom of the dock',
        ).toBeLessThanOrEqual(Math.round(dock.y + dock.height) + 1)
      }

      // The body must also not overlap the header region above it.
      const header = await boxOf(page, 'nav[aria-label="Outputs sections"]')
      expect(overlapPx(header, body), 'the tab strip overlaps the body').toBe(0)

      // ── 4. THE MODEL SURFACE'S RE-RUN CONTROL IS REACHABLE ────────────────
      // De-stickying `ReanalyseBar` fixed an occlusion and created a worse
      // defect: it fell ~3,300px below the fold, and `AnalysisFooter` — the
      // other always-visible Rerun owner — mounts on the `results` branch
      // only, so the Model tab had no reachable re-run at all. It now lives in
      // the shell's reserved footer region. Asserted ON the Model tab, in the
      // viewport, not merely present in the DOM.
      await page.locator('[data-testid="outputs-dock-tab-diagnostics"]').click()
      await expect(page.locator('[data-testid="model-tab-body"], [data-testid="outputs-dock-body"]').first()).toBeVisible()
      await waitForVisualQuiescence(page)
      const modelBody = await boxOf(page, '[data-testid="outputs-dock-body"]')
      const bar = page.locator('[data-testid="reanalyse-bar"]')
      if ((await bar.count()) > 0) {
        const bb = await boxOf(page, '[data-testid="reanalyse-bar"]')
        expect(
          Math.round(bb.y + bb.height),
          `the Re-analyse bar is below the fold at ${vp.name} (bottom ${Math.round(bb.y + bb.height)} ` +
            `vs dock bottom ${Math.round(dock.y + dock.height)}) — the Model tab's only re-run control`,
        ).toBeLessThanOrEqual(Math.round(dock.y + dock.height) + 1)
        expect(
          overlapPx(modelBody, bb),
          'the Re-analyse bar overlaps the scrolling body again',
        ).toBe(0)
        // eslint-disable-next-line no-console
        console.log(`[shell] ${vp.name}: reanalyse-bar in the footer region, bottom=${Math.round(bb.y + bb.height)} dock bottom=${Math.round(dock.y + dock.height)}`)
      } else {
        // eslint-disable-next-line no-console
        console.log(`[shell] ${vp.name}: reanalyse-bar NOT mounted in this state (analysis not stale) — this run is NOT evidence about it`)
      }

      // ── the artefact the owner reviews ────────────────────────────────────
      const png = await page.locator('[data-testid="outputs-dock"]').screenshot()
      await testInfo.attach(`shell-${vp.name}.png`, { body: png, contentType: 'image/png' })
      // eslint-disable-next-line no-console
      console.log(
        `[shell] ${vp.name}: dock=${Math.round(dock.width)}px  tabs=${tabCount}  ` +
          `nav scrollWidth=${navMetrics.scrollWidth} clientWidth=${navMetrics.clientWidth}  ` +
          `body=${Math.round(body.height)}px`,
      )
    })
  }
})
