/**
 * "What your model implies" is on the panel.
 *
 * ── THE DEFECT: A FINISHED CAPABILITY NOBODY PLUGGED IN ────────────────────
 * `sections/ModelImplication.tsx` is written, typed, gated, built onto the view
 * model (`buildAnalysisNewViewModel.ts:2307`) and covered by two spec files —
 * and had ZERO production importers. The estate already knew:
 * `analysis-hero/__tests__/heroWithholdsOnTheSameCells.spec.ts:30` says so in
 * as many words. So every sentence in `analysisNewCopy.ts:108-178` —
 * `divergedLead`, `divergedResolve`, `alignedLead`, `alignedResolve`,
 * `needsTargetLead`, `needsTargetUnlock` — reached no screen.
 *
 * It is the design pack's CENTREPIECE. `10-REASONING-PANEL-revised.html` gives
 * "What your model implies" its own block between the coaching cards and the
 * collapsed rows; the shipped tab had the option ROWS and not the sentence that
 * says what they mean.
 *
 * ── WHY IT MOUNTS ABOVE THE OPTION ROWS ────────────────────────────────────
 * The component's own header argues it must NOT be a collapsed row: when the
 * two readings disagree, that is the most decision-relevant sentence the run
 * produced, and "a finding that changes the decision cannot rest behind a
 * chevron." The prototype agrees — the implication leads, the rows support it.
 *
 * ── WHAT THIS DOES NOT DO ──────────────────────────────────────────────────
 * It adds no claim. Every sentence arrives pre-composed and already gated:
 * `{kind:'none'}` for pre-run, for a single option, and on any run whose
 * verdict withholds the leader claim. This spec pins that the DARK STATES STAY
 * DARK, because "mount the thing" is exactly the change that would make a
 * withheld claim visible if the mount ignored the gate.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { ModelImplication } from '../sections/ModelImplication'
import type { ModelImplication as Model } from '../analysisNewTypes'

const CLAIM = (sentence: string) => ({ sentence }) as never

const DIVERGED: Model = {
  kind: 'diverged',
  outcome: CLAIM('Adopt Segment has the highest expected outcome.'),
  goal: CLAIM('Accelerator or Bridge Funding is likeliest to hit the goal.'),
}

describe('the implication block reaches a screen', () => {
  it('CONTROL: the component renders its title and both readings', () => {
    // Establishes the probe can see the block at all, so the mount assertion
    // below is about the WIRING and not about a broken renderer.
    cleanup()
    render(<ModelImplication implication={DIVERGED} />)
    expect(screen.getByTestId('analysis-new-implication')).toBeVisible()
    expect(screen.getByTestId('analysis-new-implication-outcome')).toHaveTextContent(
      'highest expected outcome',
    )
    expect(screen.getByTestId('analysis-new-implication-goal')).toHaveTextContent(
      'likeliest to hit the goal',
    )
  })

  it('THE WIRING: the tab body imports and mounts it', () => {
    // ⚠ A SOURCE SCAN, DELIBERATELY. Rendering the whole tab needs a full
    // producer capture, and this property is about a MOUNT existing — the exact
    // thing two spec files and a working component could not establish between
    // them. A guard on the renderer is not a guard on the wiring.
    const src = readTabBody()
    expect(src, 'no import of the implication section').toMatch(
      /import\s*\{[^}]*\bModelImplication\b[^}]*\}\s*from\s*'\.\/sections\/ModelImplication'/,
    )
    expect(src, 'imported but never rendered').toMatch(/<ModelImplication\b/)
    expect(src, 'must be fed the view model, not a literal').toMatch(
      /<ModelImplication[\s\S]{0,160}implication=\{vm\.modelImplication\}/,
    )
  })

  it('it leads the option rows rather than following them', () => {
    // The prototype's order: the sentence that says what the rows mean comes
    // first. Asserted by POSITION in the source, which is what decides render
    // order in a JSX block with no reordering wrapper.
    const src = readTabBody()
    const implication = src.indexOf('<ModelImplication')
    const options = src.indexOf('<OptionsComparison')
    expect(implication, 'implication must be mounted').toBeGreaterThan(-1)
    expect(options, 'options must be mounted').toBeGreaterThan(-1)
    expect(implication, 'the implication must precede the option rows').toBeLessThan(options)
  })

  it('a STALE run says so on the block itself, not only in the ribbon far above', () => {
    // ⚠ RAISED BY REVIEW, AND IT IS EXPOSURE THIS MOUNT CREATED. Before the
    // mount the component had no importers, so it could not mislead anyone.
    // It is now the ONLY block on the panel that does not rest behind a
    // chevron, and it makes the strongest claim on the surface — so it carries
    // its own qualifier rather than relying on a ribbon several sections up.
    cleanup()
    render(<ModelImplication implication={DIVERGED} isStale />)
    expect(screen.getByTestId('analysis-new-implication-stale')).toBeVisible()
  })

  it('DISCRIMINATOR: a fresh run carries NO stale marker', () => {
    // The cheapest wrong implementation stamps every render. That would make
    // the marker meaningless, which is worse than not having one.
    cleanup()
    render(<ModelImplication implication={DIVERGED} />)
    expect(screen.queryByTestId('analysis-new-implication-stale')).toBeNull()
  })

  it('does not become a THIRD request for the success target', () => {
    // ⚠ RAISED BY REVIEW. The `needs_target` reading closes with an ASK, and the
    // model strip asks for the same thing. `successTargetAskedOnce.spec.tsx`
    // exists because this panel once put one fact on screen four times — and it
    // mentions neither `implication` nor `needs_target`, so the new claimant
    // this mount created was invisible to the guard written to prevent exactly
    // it. The finding survives; the duplicate ask does not.
    const NEEDS: Model = {
      kind: 'needs_target',
      outcome: CLAIM('Adopt Segment has the highest expected outcome.'),
    }
    cleanup()
    render(<ModelImplication implication={NEEDS} targetAskedElsewhere />)
    expect(screen.getByTestId('analysis-new-implication-outcome')).toBeVisible()
    expect(
      screen.queryByTestId('analysis-new-implication-resolve'),
      'a third request for one target',
    ).toBeNull()
  })

  it('DISCRIMINATOR: when NOTHING else asks, this block still does', () => {
    // The cheapest wrong fix deletes the ask outright. Then a user with no
    // target and no strip affordance is never told the run could answer more.
    const NEEDS: Model = {
      kind: 'needs_target',
      outcome: CLAIM('Adopt Segment has the highest expected outcome.'),
    }
    cleanup()
    render(<ModelImplication implication={NEEDS} />)
    expect(screen.getByTestId('analysis-new-implication-resolve')).toBeVisible()
  })

  it('DISCRIMINATOR: a DIVERGED reading keeps its close either way', () => {
    // The suppression is scoped to the arm that asks. Diverged closes with what
    // to do about the disagreement, which is not a target request.
    cleanup()
    render(<ModelImplication implication={DIVERGED} targetAskedElsewhere />)
    expect(screen.getByTestId('analysis-new-implication-resolve')).toBeVisible()
  })

  it('THE WIRING: the tab body passes staleness through', () => {
    const src = readTabBody()
    expect(src, 'the block would assert a stale finding unqualified').toMatch(
      /<ModelImplication[\s\S]{0,200}isStale=\{vm\.status\.isStale\}/,
    )
    expect(src, 'the ask-once suppression is not wired').toMatch(
      /<ModelImplication[\s\S]{0,260}targetAskedElsewhere=\{stripOffersTarget\}/,
    )
  })

  it('DISCRIMINATOR: a withheld or pre-run implication still renders nothing', () => {
    // The load-bearing one. `{kind:'none'}` is what a withheld-leader run and a
    // pre-run both produce, and mounting a component is precisely the change
    // that could put a withheld claim on screen. If this ever renders chrome,
    // the mount has outrun its gate.
    cleanup()
    const { container } = render(<ModelImplication implication={{ kind: 'none' }} />)
    expect(container).toBeEmptyDOMElement()
  })
})

function readTabBody(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require('node:fs') as typeof import('node:fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join } = require('node:path') as typeof import('node:path')
  const src = readFileSync(join(__dirname, '..', 'AnalysisNewTabBody.tsx'), 'utf8')
  expect(src.length, 'the tab body must be readable and non-empty').toBeGreaterThan(1000)
  return src
}
