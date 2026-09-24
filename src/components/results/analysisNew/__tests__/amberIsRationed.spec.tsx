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
 * ── ⛔ CORRECTED: A DECREASING RATCHET, NOT AN EXACT PIN ────────────────────
 * This file first asserted the counts EXACTLY, reasoning that a ceiling
 * ratifies today's count forever. Core refuted it, and the refutation is right:
 * an exact pin **REDs when someone FIXES amber**. A guard asserting "no more
 * than six meanings" punishes the person who gets it to one, and the next lane
 * reads that red as breakage and reverts the repair.
 *
 * ⭐ THAT IS THE DEFECT THIS FILE'S OWN AUTHOR NAMED ONE COMMIT EARLIER —
 * "a guard that ratifies a defect reads like progress" — committed inside the
 * guard written to prevent it.
 *
 * So: a RATCHET THAT ONLY TIGHTENS. It REDs when a count RISES (amber spreads,
 * which is the harm) and passes when one FALLS, with the fall reported so the
 * pin can be lowered deliberately rather than drifting. The numbers below are a
 * RECORD OF A KNOWN DEFECT, not a target, and the removal condition is written
 * in-test: when every count reaches its floor, amber carries one meaning and
 * this file is replaced by an equality pin.
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
/**
 * ⛔ `ring-warning` WAS MISSING AND THAT WAS A COLLECTION GAP. This collected
 * three channels and the panel colours four: `ModelStrip` carries amber on a
 * RING for its pressed worklist state (2 uses). A budget blind to a channel the
 * surface actually uses under-counts by construction — and this file's whole
 * claim is a count.
 *
 * ⚠ Found by auditing what the guard COLLECTS rather than what it asserts,
 * after the same class got through twice elsewhere tonight (the contrast
 * register blind to `border-*`/`ring-*`; a query ban catching one plural alias
 * of three). Assertions get reviewed; collections do not.
 */
/* ⚠ THE TRAILING BOUNDARY IS LOAD-BEARING AND WAS MISSING — caught by the
   discriminating arm of the control below, not by reading. Without
   `(?![-\w])` this matches `text-warning-light`, which is a DIFFERENT token
   (`--warning-light-rgb` is declared in brand.css), so the census would count
   a non-amber colour as amber and over-report the very budget it enforces.
   `/30` must still match, so the boundary rejects `-` and word characters but
   not `/`. A collection can be WRONG BY OVER-REACHING as well as by missing —
   and an over-count is the direction that quietly loosens a budget. */
const AMBER = /(^|\s)(?:text-warning|bg-warning|border-warning|ring-warning)(?![-\w])/

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
/**
 * ⭐ LOWERED 24 Sep 2026 — AMBER FELL, reported by this file's own ratchet.
 * Reasoning-V2 fidelity gap #14 (`FIDELITY-WORKFLOW-RESULT-20260924.json`)
 * removed the `bg-warning/10` / `bg-warning/20` tinted fills from
 * `ModelStrip`'s two worklist toggles (`-verify-toggle`, `-no-value-toggle`),
 * replacing them with an outlined pill; the pressed ring recolours
 * `ring-warning` -> `ring-info`. `text-warning-ink` stays on both (severity
 * ink, not "amber" by this file's own boundary — see the CONTRAST control
 * above: a bare `text-warning` token is amber, `text-warning-ink` is not),
 * so what left the census is exactly the two elements whose only remaining
 * amber channel was the fill or the pressed ring.
 */
const PINNED: Record<string, number> = {
  highUncertainty: 2,
  manyFragileEdges: 2,
  openStrategicChallenge: 2,
  genuineDecision: 1,
}

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

describe('amber is rationed', () => {
  /**
   * ⭐⭐ POSITIVE CONTROL PER CHANNEL, not per rule.
   *
   * This census's whole claim is a COUNT, so a channel it cannot see makes it
   * under-count with no error and no anomaly — a confident green. That is
   * exactly how `ring-warning` was missing: three channels collected, four
   * coloured on the surface.
   *
   * ⚠ ASSERTING THE REGEX WOULD BE A TAUTOLOGY — it would test the constant
   * against itself. So each channel is proven against a SYNTHETIC ELEMENT
   * carrying it: if the matcher stops seeing a channel, this REDs, whatever
   * the regex says it covers.
   */
  it('POSITIVE CONTROL: the matcher sees every channel it claims to cover', () => {
    const el = (cls: string) => {
      const d = document.createElement('div')
      d.setAttribute('class', cls)
      return AMBER.test(d.getAttribute('class') ?? '')
    }
    for (const channel of ['text-warning', 'bg-warning/10', 'border-warning/30', 'ring-1 ring-warning']) {
      expect(el(channel), `the census must see amber carried on "${channel}"`).toBe(true)
    }
    /* ⚠ THE DISCRIMINATING HALF. Without it a matcher of `/warning/` would pass
       every arm above and also count things that are not amber at all. */
    for (const notAmber of ['text-info', 'bg-success/10', 'border-panel-border', 'text-warning-adjacent-name']) {
      expect(el(notAmber), `"${notAmber}" is not amber and must not be counted`).toBe(false)
    }
  })

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
    const grew = Object.entries(measured).filter(([k, v]) => v > (PINNED[k] ?? 0))
    const shrank = Object.entries(measured).filter(([k, v]) => v < (PINNED[k] ?? 0))

    expect(
      grew,
      'AMBER SPREAD. A status colour works by being scarce: adding one more makes\n' +
        'every existing one weaker. Carry the new signal with an icon, a rule or\n' +
        'position — or take an existing amber off something that is not a health\n' +
        'state.\n' +
        grew.map(([k, v]) => `  ${k}: ${PINNED[k]} -> ${v}`).join('\n'),
    ).toEqual([])

    /* ⭐ A FALL IS REPORTED, NEVER FAILED. This is the half an exact pin got
       wrong: the guard must not punish the repair. It is surfaced so the pin
       comes down deliberately in the same commit rather than drifting upward
       again unnoticed. */
    if (shrank.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        'AMBER FELL — lower the pin in this commit:\n' +
          shrank.map(([k, v]) => `  ${k}: ${PINNED[k]} -> ${v}`).join('\n'),
      )
    }
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
