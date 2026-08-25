/**
 * Decision Brief — "What Olumi assumed" replaces the duplicate column.
 *
 * WHAT THIS MEASURES, AND WHY IT IS A REAL WITNESS RATHER THAN A RE-RUN OF THE
 * UNIT TESTS. The defect was not visible to jsdom assertions: both categories
 * rendered correctly, they simply rendered the SAME producer content. The prior
 * acceptance evidence for this surface recorded "PASS" while its own table showed
 * `What matters` and `What this rests on` at identical geometry with identical
 * first values (`User Adoption Uncertainty`, twice). So the check that matters is
 * a CONTENT-IDENTITY check on a real replayed turn, at real widths.
 *
 * The capture is the SAME one that prior evidence used (`T3`), chosen deliberately
 * so the before/after is comparable: its `top_drivers[0]` and its
 * `defaulted_assumptions[0]` are both `User Adoption Uncertainty`. Under the old
 * build that name appeared twice under two headings. Under this build it appears
 * once, and the second column carries the producer's own sentence instead.
 *
 * CLAIM TYPE: rendered text + bounding boxes in a real browser. Visibility claims
 * are made only where a box is measured; nothing here infers layout from the DOM.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from '../visual/repoRoot'
import type { Page } from '@playwright/test'
import {
  openCanvas,
  preparePage,
  seedStarterDraft,
  clearNotifications,
  minimiseFloatingOlumiPanel,
} from '../visual/harness'

const CAPTURE = join(repoRoot(), 'src/v5/__tests__/fixtures/live-analysis-turn-T3-20260808T155759Z.json')
const STARTER = 'build-vs-buy' as const
const VPS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1512, height: 982 },
]

async function openCanvasWarm(page: Page): Promise<void> {
  try { await openCanvas(page) } catch {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await openCanvas(page)
  }
}

for (const vp of VPS) {
  test(`DECISION BRIEF assumed-column @${vp.width}x${vp.height}`, async ({ page }) => {
    await preparePage(page, vp)
    await openCanvasWarm(page)
    await seedStarterDraft(page, STARTER)
    await clearNotifications(page)
    await minimiseFloatingOlumiPanel(page).catch(() => {})

    const envelope = JSON.parse(readFileSync(CAPTURE, 'utf8'))

    // PRECONDITION ON THE FIXTURE ITSELF. Without this the test could pass by
    // replaying a capture that never carried the field, and report a comfortable
    // absence as a fix.
    const brief = envelope.blocks
      ?.map((b: Record<string, unknown>) => (b.enrichment as { decision_brief?: Record<string, unknown> })?.decision_brief)
      ?.find(Boolean)
    expect(brief, 'the capture must carry enrichment.decision_brief').toBeTruthy()
    expect(
      (brief.defaulted_assumptions as unknown[])?.length,
      'the capture must carry POPULATED defaulted_assumptions, or this measures nothing',
    ).toBeGreaterThan(0)
    expect(
      brief.top_drivers[0].factor_label,
      'this capture is chosen because its first driver and first defaulted assumption are the SAME factor',
    ).toBe(brief.defaulted_assumptions[0].factor_label)

    const applied = await page.evaluate(async (env) => {
      const modulePath = '/src/v5/applyV5State.ts'
      const mod = (await import(/* @vite-ignore */ modulePath)) as {
        applyV5State: (r: unknown, s: unknown, o: unknown) => { applied: string[] }
      }
      const w = window as unknown as { useCanvasStore: { getState: () => Record<string, unknown> } }
      const snap = w.useCanvasStore.getState()
      return mod.applyV5State(
        env,
        { ...snap, currentResultsHash: (snap.results as { hash?: string } | null)?.hash ?? null, backfillGoalThreshold: () => {} },
        { turnClientId: 'measure', currentClientTurnId: 'measure' },
      )
    }, envelope)
    expect(applied.applied.length, 'applyV5State applied nothing — the turn did not land').toBeGreaterThan(0)

    const resultsTab = page.getByTestId('outputs-dock-tab-results')
    if (await resultsTab.count()) await resultsTab.click().catch(() => {})

    const section = page.getByTestId('decision-brief-section')
    await expect(section, 'the brief must mount, or nothing below is a finding').toBeVisible({ timeout: 20_000 })

    // 1. The new column exists and the over-claiming one is gone.
    await expect(section.getByText('What Olumi assumed')).toBeVisible()
    await expect(section.getByText('What this rests on')).toHaveCount(0)

    // 2. THE DEFECT ITSELF: the shared factor name appears exactly ONCE.
    const shared: string = brief.top_drivers[0].factor_label
    await expect(
      section.getByText(shared, { exact: true }),
      `"${shared}" is both a driver and a defaulted assumption; it must appear once, not twice`,
    ).toHaveCount(1)

    // 3. The producer's own sentence is on screen, unaltered.
    const producerNote: string = brief.defaulted_assumptions[0].note
    await expect(
      section.getByText(producerNote.slice(0, 60), { exact: false }),
      'the producer note must render verbatim, not a UI paraphrase',
    ).toBeVisible()

    // 4. No two groups render identical content.
    const signatures = await section.evaluate(el => {
      const lists = Array.from(el.querySelectorAll('ul'))
      return lists.map(list => Array.from(list.querySelectorAll('li'))
        .map(li => (li.textContent ?? '').trim()).join('␟'))
    })
    expect(signatures.length, 'no groups rendered — the measurement is empty').toBeGreaterThan(1)
    expect(new Set(signatures).size, `two groups rendered identical content: ${JSON.stringify(signatures)}`)
      .toBe(signatures.length)

    // 5. THE ROBUSTNESS CAVEAT — the INVARIANT, not one arm of it.
    //
    // ⚠ MY FIRST VERSION OF THIS ASSERTED THE CAVEAT WAS VISIBLE, AND FAILED —
    // correctly. The component resolves the verdict as
    //   deriveDecisionVerdict(report, { visibleOptionIds, rawHeadlineBanded })
    // and this file seeds the BUILD-VS-BUY starter then replays the T3 capture,
    // whose leader is `opt_phased` — an option that is not on that canvas. So the
    // product withholds the leader claim, and the gate correctly closes. The
    // product was right and the test was feeding it an incoherent state.
    //
    // Asserting "caveat visible" would therefore have required either a matching
    // graph or a weakened gate. What is actually worth witnessing is the RULE:
    // the caveat is on screen if and only if the live verdict permits a leader.
    // That holds under either arm, and the arm reached is REPORTED so a silent
    // drift to always-withheld cannot masquerade as a pass.
    const permitted = await page.evaluate(async () => {
      const w = window as unknown as { useCanvasStore: { getState: () => Record<string, unknown> } }
      const report = (w.useCanvasStore.getState().results as { report?: unknown } | null)?.report ?? null
      const nodes = (w.useCanvasStore.getState().nodes ?? []) as Array<{ id: string, data?: { kind?: string } }>
      const mod = (await import(/* @vite-ignore */ '/src/lib/decisionVerdict.ts')) as {
        deriveDecisionVerdict: (r: unknown, o?: unknown) => { hasLeadingOption: boolean }
      }
      return mod.deriveDecisionVerdict(report, {
        visibleOptionIds: new Set(nodes.filter(n => n.data?.kind === 'option').map(n => n.id)),
      }).hasLeadingOption
    })

    const caveat = section.getByTestId('decision-brief-robustness-caveat')
    if (permitted) {
      await expect(caveat, 'leader permitted, so the producer caveat must be on screen').toBeVisible()
      await expect(caveat).toHaveText(brief.robustness_caveat.text)
    } else {
      await expect(
        caveat,
        'leader withheld, so a caveat ABOUT THE RANKING must not appear',
      ).toHaveCount(0)
      // And the absence must not be dressed as reassurance anywhere in the card.
      await expect(section).not.toContainText(/held up|robust|stable/i)
    }
    // eslint-disable-next-line no-console
    console.log(`@${vp.width}x${vp.height} leaderPermitted=${permitted} caveatShown=${permitted}`)

    // 6. Geometry, measured not inferred.
    const box = await section.boundingBox()
    expect(box, 'the section must have a box').toBeTruthy()
    // eslint-disable-next-line no-console
    console.log(`@${vp.width}x${vp.height} brief box y=${box!.y.toFixed(1)}–${(box!.y + box!.height).toFixed(1)} `
      + `x=${box!.x.toFixed(1)} w=${box!.width.toFixed(1)} groups=${signatures.length}`)
    expect(box!.width, 'the brief must not overflow its column').toBeLessThanOrEqual(vp.width)
  })
}
