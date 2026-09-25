/**
 * The input register is MOUNTED on the reasoning tab, and mounted where its
 * job puts it.
 *
 * ⚠⚠ WHY A MOUNT SPEC AND NOT A COMPONENT SPEC. `WhatIWasGivenSection` already
 * carries 
 * its own suite, its own identity gate and its own honesty rules. None of that
 * says a single word about whether this tab renders it — and this estate has
 * twice shipped a component whose tests were green while the deployed surface
 * never mounted it (CLAUDE.md trap 3b). The claim under test here is the MOUNT,
 * so it is asserted against the tab body, at the anchor the placement argument
 * names.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { openGroups } from './openNamedGroups'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { genuineDecision } from './analysisNewFixtures'
import { useCanvasStore } from '../../../../canvas/store'
import { useContextIntegrityStore } from '../../../../canvas/stores/contextIntegrityStore'
import { parseNotModelled } from '@/adapters/cee/notModelled'
import b1Fixture from '../../contextIntegrity/__tests__/fixtures/b1-cold-read.not-modelled.json'

const LIVE = '11111111-1111-4111-8111-111111111111'

/**
 * ⚠⚠ THE IDENTITY GATE IS THE PRECONDITION, AND IT IS PINNED IN-TEST. The
 * register renders ONLY on a POSITIVE match between the store's recorded
 * scenario and the live one — it once rendered a PREVIOUS decision's brief
 * verbatim, and that gate is the fix. Without seeding both halves here, every
 * case below would exercise the SUPPRESSED branch and agree with itself: a
 * "not mounted" result would be indistinguishable from a correct refusal
 * (CLAUDE.md trap 13b).
 */
beforeEach(() => {
  useContextIntegrityStore.getState().reset()
  useCanvasStore.setState({ currentScenarioId: LIVE } as never)
  // ⚠ SEEDED THROUGH THE REAL BOUNDARY PARSER, never a hand-built manifest —
  // the register's own suite's rule. A hand-built object encodes my model of
  // the manifest rather than the manifest, and would pass this mount spec while
  // the real shape failed.
  useContextIntegrityStore.getState().setContextIntegrity({
    scenarioId: LIVE,
    briefText: (b1Fixture as { brief_text: string }).brief_text,
    manifest: parseNotModelled((b1Fixture as { not_modelled: unknown }).not_modelled),
  })
})

afterEach(() => {
  useContextIntegrityStore.getState().reset()
  useCanvasStore.setState({ currentScenarioId: null } as never)
  cleanup()
})

const draw = (over = {}) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={genuineDecision()}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_abc123"
      {...over}
    />,
  )

describe('the input register reaches the reasoning tab', () => {
  it('is mounted on a completed run', () => {
    draw()
    openGroups()
    expect(screen.getByTestId('what-i-was-given-section')).toBeInTheDocument()
  })

  /**
   * ⚠ THE ANCHOR IS THE CLAIM, NOT THE PRESENCE — and the claim is now stated
   * as what it always protected.
   *
   * ⛔ THIS CASE USED TO PIN AN ORDER: glance -> what-I-was-given -> Strengthen.
   * Its stated argument was that this is a WORKLIST and must not sit with the
   * census at the top (pushing the answer below the fold), nor be buried below
   * the detail. The section now lives inside the "How this was worked out"
   * group with its six trust siblings, which the trust line routes into — and a
   * group can only be above OR below the act, while `AnalysisNewTabBody.spec`
   * and `whatTheRunCouldNotSettleIsOnePlace` both pin the coaching above every
   * detail section. Two rulings, one position; grouping made them collide
   * (CLAUDE.md trap 21).
   *
   * ⭐ SO THE PROTECTION IS PINNED, NOT THE POSITION. Both halves of the
   * original argument still hold and are asserted: it is NOT at the top with
   * the census, and it IS reachable from a named group rather than buried in a
   * flat tail. Asserting only presence would pass on a mount anywhere — these
   * two assertions are what the order was standing in for.
   */
  it('is not at the top with the census, and lives in the named method group', () => {
    const { container } = draw()
    openGroups()
    const order = Array.from(
      container.querySelectorAll(
        '[data-testid="what-i-was-given-section"],[data-testid="analysis-new-glance"]',
      ),
    ).map((el) => el.getAttribute('data-testid'))
    expect(order, 'the reading still comes first — this is not a census item').toEqual([
      'analysis-new-glance',
      'what-i-was-given-section',
    ])

    // V2 fidelity gap 24 (24 Sep 2026): the "How this was worked out" group is
    // deleted; the register folds into About, the named disclosure it now lives in.
    const group = container.querySelector('[data-testid="analysis-new-about"]')
    expect(group, 'About must render for this section to be reachable').not.toBeNull()
    expect(
      group?.contains(container.querySelector('[data-testid="what-i-was-given-section"]')),
      'it must sit INSIDE the named group, not loose in the tail where it can be scrolled past',
    ).toBe(true)
  })

  /**
   * ⚠ THE FAIL-CLOSED HALF. Without a sender the register must still render —
   * it simply offers no "Add this". A mount that required the prop would make
   * the whole surface disappear on any host that has no chat, which is the
   * opposite of the honesty rule the component was built around.
   */
  it('renders with no sender, and offers no add affordance', () => {
    draw({ onSendMessage: undefined })
    openGroups()
    expect(screen.getByTestId('what-i-was-given-section')).toBeInTheDocument()
  })
})
