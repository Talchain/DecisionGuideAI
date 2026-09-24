/**
 * ⭐⭐ THE GRAMMAR IS OPT-IN, AND THE THING THIS FILE ACTUALLY GUARDS IS THE
 * SURFACE THAT DOES **NOT** OPT IN.
 *
 * `WhatIWasGivenSection` has two consumers:
 *
 *   · `AnalysisNewTabBody`  — the Reasoning tab. In scope. Opts in.
 *   · `ResultsBody`         — the **PARKED** Analysis tab. Out of bounds under
 *                             Paul's scope ruling. Must render exactly as it
 *                             does today.
 *
 * So the interesting assertions here are the NEGATIVE ones. A change that
 * improved the Reasoning tab and quietly moved the Analysis tab with it would
 * pass every positive test in this file.
 *
 * ── WHY THE COMPONENT NEEDED TOUCHING AT ALL ────────────────────────────────
 * On the deployed Reasoning tab it is the single most jarring instance of the
 * inconsistency Paul named — three sections at the same level, one of them
 * boxed:
 *
 *     What would change your mind        3  ›     ← borderless row
 *     ┌────────────────────────────────────┐
 *     │ What you gave me, and what I did … │      ← BOXED
 *     └────────────────────────────────────┘
 *     Strengthen the reasoning           1  ›     ← borderless row
 *
 * A measurement said it was a fourth container treatment. LOOKING said it was
 * the worst one, because its NEIGHBOURS are what it disagrees with, and
 * neighbours are what a reader compares.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../../../canvas/store', () => ({
  useCanvasStore: (sel: (s: unknown) => unknown) => sel({ currentScenarioId: 'scn-1' }),
}))
/**
 * ⚠ A `vi.mock` FACTORY REPLACES THE MODULE, SO THIS OBJECT IS A HAND-MAINTAINED
 * MIRROR OF THE STORE'S SHAPE (CLAUDE.md trap 12, in its original form) — a
 * field added to the store later reads `undefined` here, and a consumer that
 * dereferences it throws inside a suite about container geometry. That is
 * exactly what happened when `modelBuildingNotices` arrived (ROADMAP 2.1379):
 * five tests below RED on a null-guard two panes away.
 *
 * It is listed here because this suite's whole subject is the CONTAINER, and it
 * needs the section to render at all. The consumer was also hardened so an
 * absent field can never throw again — this mirror is the second line, not the
 * first.
 */
vi.mock('../../../../canvas/stores/contextIntegrityStore', () => ({
  useContextIntegrityStore: (sel: (s: unknown) => unknown) =>
    sel({
      scenarioId: 'scn-1',
      briefText: 'a brief',
      manifest: null,
      modelBuildingNotices: null,
    }),
}))

import { WhatIWasGivenSection } from '../../contextIntegrity/WhatIWasGivenSection'
import { PANEL_SURFACE } from '../panelSurfaces'
import { NOT_MODELLED_NOTICES_COPY } from '../../contextIntegrity/notModelledNotices'

const SECTION = 'what-i-was-given-section'
/** The exact container today's PARKED surface renders. */
const PARKED_CLASSNAME = 'rounded-lg border border-panel-border bg-panel px-3 py-1.5'

const box = () => screen.getByTestId(SECTION)

describe('⛔ THE PARKED SURFACE DOES NOT MOVE — the load-bearing half', () => {
  it('⭐ with NO prop, the container is byte-identical to today', () => {
    render(<WhatIWasGivenSection />)
    // Not "contains rounded-lg" — the WHOLE string, so a silent addition to the
    // default is a failure too. `ResultsBody` passes no prop, so this IS the
    // Analysis tab's rendering.
    expect(box().className).toBe(PARKED_CLASSNAME)
  })

  it('…and with the prop explicitly false — the twin', () => {
    render(<WhatIWasGivenSection useSurfaceGrammar={false} />)
    expect(box().className).toBe(PARKED_CLASSNAME)
  })

  it('⭐ `ResultsBody` does not pass the prop — asserted at the SOURCE', () => {
    /**
     * ⚠ THE RENDER TESTS ABOVE PROVE THE DEFAULT IS SAFE. They cannot prove the
     * PARKED CALLER USES IT — someone could opt `ResultsBody` in tomorrow and
     * every test above would stay green while the Analysis tab changed. Only a
     * source assertion binds that, so this reads the caller.
     */
    const src = readFileSync(
      join(__dirname, '..', '..', 'ResultsBody.tsx'),
      'utf8',
    )
    const mount = src.match(/<WhatIWasGivenSection[^>]*\/>/)
    expect(mount, 'ResultsBody no longer mounts it — re-derive this guard').not.toBeNull()
    expect(mount![0]).not.toContain('useSurfaceGrammar')
  })

  it('CONTROL: the scan can SEE the prop when it is present', () => {
    // Without this, the assertion above passes on a broken regex.
    const src = readFileSync(
      join(__dirname, '..', 'AnalysisNewTabBody.tsx'),
      'utf8',
    )
    const mount = src.match(/<WhatIWasGivenSection[^>]*\/>/)
    expect(mount).not.toBeNull()
    expect(mount![0]).toContain('useSurfaceGrammar')
  })
})

describe('the Reasoning tab joins the grammar', () => {
  it('⭐ opting in yields the shared surface geometry', () => {
    render(<WhatIWasGivenSection useSurfaceGrammar={true} />)
    for (const token of PANEL_SURFACE.split(' ')) {
      expect(box().className).toContain(token)
    }
  })

  it('the fill is kept in BOTH modes', () => {
    // `surface('neutral')` carries no fill, and this section sits directly on
    // the panel — without `bg-panel` the open state shows the page through it.
    // The grammar governs geometry; the fill is this section's own.
    render(<WhatIWasGivenSection useSurfaceGrammar={true} />)
    expect(box().className).toContain('bg-panel')
  })

  it('⛔ and the OLD geometry is gone when opted in — the discriminating half', () => {
    render(<WhatIWasGivenSection useSurfaceGrammar={true} />)
    // Without this, a change that merely APPENDED the grammar to the old string
    // would pass every positive assertion above.
    expect(box().className).not.toContain('rounded-lg')
    expect(box().className).not.toContain('py-1.5')
  })
})

/**
 * ⭐ V2 — A COLLAPSED ROW SHOWS ONLY ITS HEADER; THE REFUSAL LIVES INSIDE.
 *
 * Witnessed on the served build (24 Sep 2026): the "If you want to go further"
 * group read as a pile of apologies, and this row was the clearest one —
 * "What you gave me, and what I did with it / I can't show this yet", on the
 * COLLAPSED row.
 *
 * ⚠ THE HONESTY RULE IS KEPT, NOT OVERRIDDEN. This component's header rules
 * that `manifest === null` must refuse EXPLICITLY — "never an empty list, and
 * never silence". So the row still mounts (the fixture above has a brief and no
 * manifest), and opening it still shows the explicit refusal. What moves is
 * WHERE the apology sits: off the resting row, into the opened body.
 *
 * Reasoning tab only: the PARKED Analysis tab keeps its resting subtitle.
 */
describe('⭐ the resting row carries no empty-state sentence (Reasoning tab)', () => {
  it('⛔ opted in, at rest: no "I can\'t show this yet" under the heading', () => {
    render(<WhatIWasGivenSection useSurfaceGrammar={true} />)
    expect(screen.getByTestId('what-i-was-given-toggle')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('what-i-was-given-summary')).toBeNull()
    expect(box().textContent ?? '').not.toContain("I can't show this yet")
  })

  it('⭐ the row still MOUNTS — silence would break the honesty rule', () => {
    render(<WhatIWasGivenSection useSurfaceGrammar={true} />)
    expect(box()).toBeInTheDocument()
    expect(box().textContent ?? '').toContain('What you gave me, and what I did with it')
  })

  it('⭐ opened, the explicit refusal is there, whole', () => {
    render(<WhatIWasGivenSection useSurfaceGrammar={true} />)
    fireEvent.click(screen.getByTestId('what-i-was-given-toggle'))
    expect(screen.getByTestId('what-i-was-given-unknown').textContent).toBe(NOT_MODELLED_NOTICES_COPY.unknown)
  })

  it('⛔ the PARKED surface keeps its resting subtitle — the twin that must not move', () => {
    render(<WhatIWasGivenSection />)
    expect(screen.getByTestId('what-i-was-given-summary').textContent).toBe("I can't show this yet")
  })
})
