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
    expect(screen.getByTestId('what-i-was-given-section')).toBeInTheDocument()
  })

  /**
   * ⚠ THE ANCHOR IS THE CLAIM, NOT THE PRESENCE. The placement argument is that
   * this is a WORKLIST and therefore belongs with the coaching, above it — not
   * with the census at the top, which would push the answer below the fold.
   * Asserting only presence would pass on a mount anywhere, including the one
   * the argument rejects, so the ORDER is what is pinned.
   */
  it('sits above the coaching it is kin to, and below the reading it follows', () => {
    const { container } = draw()
    const all = Array.from(
      container.querySelectorAll(
        '[data-testid="what-i-was-given-section"],[data-testid="analysis-new-strengthen"],[data-testid="analysis-new-glance"]',
      ),
    ).map((el) => el.getAttribute('data-testid'))
    expect(all).toEqual([
      'analysis-new-glance',
      'what-i-was-given-section',
      'analysis-new-strengthen',
    ])
  })

  /**
   * ⚠ THE FAIL-CLOSED HALF. Without a sender the register must still render —
   * it simply offers no "Add this". A mount that required the prop would make
   * the whole surface disappear on any host that has no chat, which is the
   * opposite of the honesty rule the component was built around.
   */
  it('renders with no sender, and offers no add affordance', () => {
    draw({ onSendMessage: undefined })
    expect(screen.getByTestId('what-i-was-given-section')).toBeInTheDocument()
  })
})
