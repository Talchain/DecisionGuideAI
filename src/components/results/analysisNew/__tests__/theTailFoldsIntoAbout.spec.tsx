/**
 * ⭐ V2 FIDELITY GAPS 24 + 27 — the tail folds into About, and About is a quiet
 * audit footer.
 *
 * 24: the prototype's `reasoningHTML()` ends
 *     `${challengeHTML()}${commitHTML()}${aboutHTML()}` — nothing between
 *     "Move towards commitment" and About. Staging put a zone label ("If you
 *     want to go further") and two group shells ("Coaching and method", "How
 *     this was worked out") there. The label and shells go; every block they
 *     held must STILL be reachable, now from About, at the same one-click reach.
 * 27: About's toggle is the prototype's `.about .disclose` — 11px light text,
 *     chevron first — not a 14px peer-section heading.
 *
 * ⚠ BOUND BY IDENTITY: testids of the exact blocks, and the typography
 * constants, never a value another element could satisfy. Every absence has a
 * present control in the same case.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ABOUT_COPY } from '../sections/AboutThisAnalysis'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { buildBiasGrounding } from '../biasGrounding'
import { typography } from '../../../../styles/typography'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { useContextIntegrityStore } from '../../../../canvas/stores/contextIntegrityStore'
import { parseNotModelled } from '@/adapters/cee/notModelled'
import b1Fixture from '../../contextIntegrity/__tests__/fixtures/b1-cold-read.not-modelled.json'
import { genuineDecision, openStrategicChallenge } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const LIVE = '11111111-1111-4111-8111-111111111111'
const ABOUT = 'analysis-new-about'

/** The old tail's own furniture — each must be gone. */
const OLD_TAIL = [
  'analysis-new-zone-further-group',
  'analysis-new-zone-further',
  'analysis-new-coaching-and-method',
  'analysis-new-how-worked-out',
] as const

const FINDING = {
  id: 'overconfidence_narrow_belief_band',
  code: 'OVERCONFIDENCE',
  category: 'other',
  citation: 'Lichtenstein et al. (1982) - Judgment Under Uncertainty',
  severity: 'high',
  mechanism: 'Excessive certainty in own judgments.',
  explanation: 'Edge beliefs are all high and tightly clustered.',
  confidence_band: 'medium',
  micro_intervention: { steps: ['List three things you might be wrong about'], estimated_minutes: 3 },
}

let previousReady: unknown
beforeEach(() => {
  previousReady = useCanvasStore.getState().ceeAnalysisReady
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
  useContextIntegrityStore.getState().reset()
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState({ ceeAnalysisReady: previousReady, currentScenarioId: null } as never)
  useContextIntegrityStore.getState().reset()
})

/** Seeds the input register through the real boundary parser, behind its identity gate. */
function seedRegister(): void {
  useCanvasStore.setState({ currentScenarioId: LIVE } as never)
  useContextIntegrityStore.getState().setContextIntegrity({
    scenarioId: LIVE,
    briefText: (b1Fixture as { brief_text: string }).brief_text,
    manifest: parseNotModelled((b1Fixture as { not_modelled: unknown }).not_modelled),
  })
}

function seedGrounding(): void {
  useCanvasStore.setState({
    ceeAnalysisReady: { ...(previousReady as object), bias_findings: [FINDING] },
  } as never)
}

const draw = (data: ResultsSectionDataReturn, isPreRun = false) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={isPreRun}
      isRunning={false}
      isStale={false}
      responseHash="run_abc123"
    />,
  )

const openAbout = () => {
  const toggle = screen.getByTestId(`${ABOUT}-toggle`)
  expect(toggle, 'About is closed at rest').toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
}

describe('gap 24 — nothing between the commitment and About at rest', () => {
  it('the old tail furniture is gone, and About directly follows the last zone', () => {
    seedRegister()
    seedGrounding()
    draw(genuineDecision())

    // Present controls first: the answer zone and About both render here.
    const answer = screen.getByTestId('analysis-new-zone-answer-group')
    const about = screen.getByTestId(ABOUT)
    for (const id of OLD_TAIL) expect(screen.queryByTestId(id), `${id} must be gone`).toBeNull()

    const prev = about.previousElementSibling
    expect(prev, 'something precedes About').not.toBeNull()
    const prevId = prev?.getAttribute('data-testid')
    expect(
      ['analysis-new-zone-answer-group', 'analysis-new-zone-focus-group'],
      `About must follow the answer (or its run-earned focus) zone directly, not ${prevId}`,
    ).toContain(prevId)
    if (screen.queryByTestId('analysis-new-zone-focus-group') === null) {
      expect(prev, 'with no focus zone, the commitment zone is directly above About').toBe(answer)
    }
    expect(about.nextElementSibling, 'About is the last block on the tab').toBeNull()
  })

  it('at rest the tail is ONE closed line: none of the folded blocks is on screen', () => {
    seedRegister()
    seedGrounding()
    draw(openStrategicChallenge())
    expect(screen.getByTestId(`${ABOUT}-toggle`)).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId(`${ABOUT}-region`)).toBeNull()
    for (const id of [
      'analysis-new-bias-grounding',
      'analysis-new-key-insights',
      'what-i-was-given-section',
      'analysis-new-uncertainty',
    ]) {
      expect(screen.queryByTestId(id), `${id} must be closed at rest`).toBeNull()
    }
  })
})

describe('gap 24 — every block the tail held is still reachable, one click away inside About', () => {
  it('PRECONDITION: the fixtures make each folded block render', () => {
    expect(buildBiasGrounding([FINDING] as never).length).toBeGreaterThan(0)
    const vm = buildAnalysisNewViewModel({
      data: openStrategicChallenge(),
      recommendations: [],
      isPreRun: false,
      isRunning: false,
      isStale: false,
    })
    expect(vm.keyInsights.insights.length, 'key insights has rows on this fixture').toBeGreaterThan(0)
  })

  it('bias grounding, key insights, the input register and uncertainty all open from About', () => {
    seedRegister()
    seedGrounding()
    draw(openStrategicChallenge())
    openAbout()
    const about = screen.getByTestId(ABOUT)
    for (const id of [
      'analysis-new-bias-grounding',
      'analysis-new-key-insights',
      'what-i-was-given-section',
      'analysis-new-uncertainty',
    ]) {
      expect(within(about).queryByTestId(id), `${id} must be reachable inside About`).not.toBeNull()
    }
    // The grounding's CONTENT arrived, not just its frame.
    expect(within(about).getByTestId('analysis-new-bias-grounding')).toHaveTextContent(FINDING.mechanism)
    // And About's own audit rows are still there (contrast: the fold did not replace them).
    expect(within(about).getByTestId(`${ABOUT}-rows`)).toBeInTheDocument()
  })

  it('PRE-RUN the input register is still reachable — About renders for it, with no run rows', () => {
    seedRegister()
    draw(genuineDecision(), true)
    openAbout()
    const about = screen.getByTestId(ABOUT)
    expect(within(about).getByTestId('what-i-was-given-section')).toBeInTheDocument()
    expect(within(about).queryByTestId(`${ABOUT}-rows`), 'no statement about a run pre-run').toBeNull()
    expect(within(about).queryByTestId(`${ABOUT}-ask`)).toBeNull()
  })

  it('CONTRAST: pre-run with nothing to fold, About still renders nothing', () => {
    draw(genuineDecision(), true)
    expect(screen.queryByTestId(ABOUT)).toBeNull()
  })
})

describe('gap 27 — About is a quiet audit footer', () => {
  it('the toggle is meta-sized light text with the chevron first, and the rule runs full width', () => {
    draw(genuineDecision())
    const about = screen.getByTestId(ABOUT)
    const toggle = screen.getByTestId(`${ABOUT}-toggle`)
    // A footer line, not a peer-section title: no h1-h3 inside About at rest.
    expect(about.querySelector('h1,h2,h3')).toBeNull()
    // Still a labelled region, named by its title.
    expect(document.getElementById(about.getAttribute('aria-labelledby') ?? '')).toHaveTextContent(ABOUT_COPY.title)
    const cls = toggle.className.split(/\s+/)
    for (const c of typography.panelMeta.split(/\s+/)) expect(cls, `meta class ${c}`).toContain(c)
    // Contrast: the peer-section heading size is gone.
    const headerOnly = typography.panelHeader.split(/\s+/).filter((c) => !typography.panelMeta.split(/\s+/).includes(c))
    expect(headerOnly.length, 'precondition: the two sizes differ').toBeGreaterThan(0)
    for (const c of headerOnly) expect(cls, `header class ${c}`).not.toContain(c)
    expect(cls).toContain('text-text-light')

    const chevron = screen.getByTestId(`${ABOUT}-chevron`)
    expect(toggle.firstElementChild, 'the chevron leads the line').toBe(chevron)
    expect(chevron.getAttribute('class') ?? '').not.toMatch(/\brotate-90\b/)
    fireEvent.click(toggle)
    expect(screen.getByTestId(`${ABOUT}-chevron`).getAttribute('class') ?? '').toMatch(/\brotate-90\b/)

    expect(about.className.split(/\s+/)).toEqual(expect.arrayContaining(['-mx-4', 'px-4', 'border-t']))
  })
})
