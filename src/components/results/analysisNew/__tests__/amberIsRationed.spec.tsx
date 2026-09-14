/**
 * ⭐⭐ AMBER IS A BUDGET, NOT A PALETTE ENTRY — Paul's ruling, 14 Sep 2026:
 * *"if it is more of this, it needs an attention colour. The problem is, if you
 * use it too much, it loses its value."*
 *
 * The second sentence is the one nothing enforced. A status colour's whole
 * function is scarcity: it means "look here" only while most things are not it.
 * This panel had drifted to SEVEN amber elements in one 420px viewport on the
 * build Paul screenshotted — three critique strips, a staleness ribbon, a
 * "Mixed" verdict badge, a flip-threshold line and a worklist count — at which
 * point amber marks the panel rather than anything in it.
 *
 * ── WHY A RENDERED CENSUS AND NOT A SOURCE SCAN ────────────────────────────
 * ⚠ A source scan counts RENDER SITES; the rule is about what is ON SCREEN AT
 * ONCE, and those differ by exactly the thing that matters — conditional
 * rendering. A tree with twenty amber sites of which one ever fires is fine; a
 * tree with seven that all fire together is the defect. Only a render can tell
 * them apart, so this reads the DOM.
 *
 * ── WHY AN EXACT SET AND NOT A CEILING ─────────────────────────────────────
 * ⭐ A ceiling REDs only upward, so it ratifies today's count forever and the
 * next four additions are free until they cross it. Pinned EXACTLY, this REDs
 * when the count GROWS (amber spreads) **and** when it SHRINKS (a reduction
 * lands and the record is not updated) — the same discipline
 * `reasoning-model-text-contrast-per-site` uses on its unrepaired set, and for
 * the same reason: a one-directional baseline becomes permanent (trap 12).
 *
 * ── ⛔ WHAT THIS FILE DELIBERATELY DOES NOT DO ─────────────────────────────
 * It does NOT move the worklist counts to an attention colour, which is the
 * other half of Paul's ruling. That half is BLOCKED at the palette and the
 * block is measured, not argued: of the 21 `--*-rgb` tokens brand.css declares,
 * exactly three clear SC 1.4.3's 4.5:1 as panel text — `--text-header`,
 * `--text-light`, `--info` — and **not one semantic colour clears even 3:1**
 * (`reasoning-model-text-contrast-per-site.spec.ts`, which derives the ratios
 * every run). Amber is 1.92:1; every amber text site counted below is already
 * pinned there as a LIVE failure, not an exemption. So minting an attention
 * hue today would add a new accessibility failure rather than fix a semantic
 * one, and the choice needs a design review with the measured options in hand.
 *
 * ⭐ What this file does is make that later choice SAFE: whatever colour is
 * picked, it cannot quietly spread, because the count is pinned.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { genuineDecision, highUncertainty, manyFragileEdges, openStrategicChallenge } from './analysisNewFixtures'

/** Any element whose own class carries the status hue. */
const AMBER = /(^|\s)(?:text-warning|bg-warning|border-warning)/

/**
 * ⚠ `isStale: true` ON EVERY ARM, DELIBERATELY. Staleness is the single
 * commonest amber on this panel and the state Paul was in, so a census taken
 * on fresh runs would measure the panel at its quietest and pin a budget that
 * never binds.
 */
const census = (data: ResultsSectionDataReturn): number => {
  const { container } = render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={true}
      responseHash="amber_budget"
    />,
  )
  return [...container.querySelectorAll<HTMLElement>('*')].filter((el) =>
    AMBER.test(el.getAttribute('class') ?? ''),
  ).length
}

/** MEASURED, not chosen. Update only with a stated reason. */
const PINNED: Record<string, number> = {
  highUncertainty: 5,
  manyFragileEdges: 4,
  openStrategicChallenge: 4,
  genuineDecision: 4,
}

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

describe('amber is rationed', () => {
  it('PRECONDITION: the census can see amber at all', () => {
    // ⚠ A census that counts zero everywhere would pass a pin of zero and
    // prove nothing (trap 13). This asserts the instrument before the rule.
    expect(census(highUncertainty()), 'the probe must find amber on a stale run').toBeGreaterThan(0)
  })

  it('the simultaneous amber count is PINNED EXACTLY per state', () => {
    const measured: Record<string, number> = {}
    for (const [name, make] of [
      ['highUncertainty', highUncertainty],
      ['manyFragileEdges', manyFragileEdges],
      ['openStrategicChallenge', openStrategicChallenge],
      ['genuineDecision', genuineDecision],
    ] as const) {
      measured[name] = census(make())
      cleanup()
    }
    expect(
      measured,
      'Amber spread (or shrank) on the Reasoning tab.\n' +
        'GREW  — a status colour works by being scarce; adding one more makes every\n' +
        '        existing one weaker. Carry the new signal with an icon, a rule or\n' +
        '        position, or take an existing amber off something that is not a\n' +
        '        health state.\n' +
        'SHRANK — good; update the pin in the same commit and say what you removed.',
    ).toEqual(PINNED)
  })

  /**
   * ⭐ THE DISCRIMINATOR. Without this the pin above passes on a panel that
   * renders no amber at all, which is a different product rather than a
   * compliant one — and it is the shape a careless "fix" would take.
   */
  it('DISCRIMINATOR: the pin is a budget, not an absence', () => {
    expect(Object.values(PINNED).every((n) => n > 0), 'amber must still be doing a job').toBe(true)
    expect(
      Math.max(...Object.values(PINNED)),
      'no single state may carry more amber than the screenshot that commissioned this rule',
    ).toBeLessThanOrEqual(7)
  })
})
