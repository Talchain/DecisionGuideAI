/**
 * ⭐ V2 FIDELITY GAP 16 — "Challenge the thinking" is a SECTION TITLE, and its
 * finding is the question under it.
 *
 * Staging rendered the zone name as an 11px grey caption and the finding as a
 * bold 14px h3, so the zone read as a footnote to its own item. The prototype
 * (`challengeHTML`): `h3.section-title` (14px/600), then
 * `.challenge-question` (14px/500) with a quiet leading dot. The finding stays
 * `.title` VERBATIM (ruling §3); only its level changes.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ChallengeCard } from '../sections/ChallengeCard'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import type { Recommendation } from '../../strengthen/strengthenTypes'
import { genuineDecision } from './analysisNewFixtures'
import { typography } from '../../../../styles/typography'

beforeEach(() => useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never))
afterEach(cleanup)

const rec = {
  id: 'strengthen:flip:edge_9',
  helpType: 'challenge',
  title: 'Test the assumption about Price elasticity',
  signal: 's',
  whyNow: 'w',
  tryThis: null,
  sourceLine: 'x',
  action: { kind: 'ai-dialogue', label: 'Work through with Olumi', prompt: 'Test it' },
  targetId: null,
  priority: 1,
} as unknown as Recommendation

describe('"Challenge the thinking" is a section title over its question', () => {
  it('the zone name is a 14px semibold h3, like "Move towards commitment"', () => {
    render(<AnalysisNewTabBody resultsSectionData={genuineDecision()} isPreRun={false} isRunning={false} isStale={false} responseHash="h" />)
    const title = screen.getByTestId('analysis-new-zone-also')
    expect(title.tagName).toBe('H3')
    expect(title.className).toContain('text-sm')
    expect(title.className).toContain('font-semibold')
    expect(title).toHaveTextContent('Challenge the thinking')
  })

  it('the finding is the 14px-medium question under it, not a second h3, and still the title verbatim', () => {
    const vm = buildAnalysisNewViewModel({ data: genuineDecision(), recommendations: [rec], isPreRun: false, isRunning: false, isStale: false })
    const shown = vm.strengthen.interventions.find((i) => i.id === rec.id) ?? rec
    render(<ChallengeCard intervention={shown} methodId={null} onRunIntervention={vi.fn()} onRunMethod={vi.fn()} analysisHash="h" />)
    const heading = screen.getByTestId('analysis-new-challenge-heading')
    expect(heading.textContent).toBe(shown.title)
    expect(heading.closest('h1,h2,h3,h4,h5,h6')).toBeNull()
    const line = heading.parentElement as HTMLElement
    // V2 prototype `.challenge-question`: 14px/500 through the panel's own
    // question token, so it is not the h3's 14px/600 weight either.
    expect(line.className).toContain(typography.panelQuestion)
    expect(line.className).not.toContain(typography.panelHeader)
    expect(line.tagName).not.toMatch(/^H[1-6]$/)
  })
})
