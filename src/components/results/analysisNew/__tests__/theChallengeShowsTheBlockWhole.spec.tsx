/**
 * Slice D-4, the block whole (R&C #70 5854950955; Panel L8 R7). Paul's MRR
 * model, export 17d1cd3a, served block `f9860cff…` (coaching, assumption_check):
 * the Challenge card showed its title alone, "Check the figure your limit was
 * checked against", which names neither the limit nor the figure. Only the
 * body does, and the producer's act ("Give the real figure") never showed.
 *
 * The recommendation is built from the served block's fields exactly as the
 * mapper builds a phase-3 item (`buildRecommendations.ts`: title verbatim;
 * signal and whyNow = body; action.label = action_label), then passed through
 * the view model as the body receives it.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))

import { ChallengeCard } from '../sections/ChallengeCard'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import type { Recommendation } from '../../strengthen/strengthenTypes'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { useCanvasStore } from '../../../../canvas/store'
import { genuineDecision } from './analysisNewFixtures'

// Verbatim from export 17d1cd3a `phase3_blocks_from_blocks_array[0]`.
const SERVED = {
  block_id: 'f9860cff-d898-5d0f-91c0-062ab2d08d5d',
  title: 'Check the figure your limit was checked against',
  body: 'Your limit on “Monthly churn” was checked against Olumi\'s estimate that it is about 3% per month today, not a figure you gave. If you know the real figure, it is worth saying.',
  action_label: 'Give the real figure',
}

const REC = {
  id: `strengthen:phase3:${SERVED.block_id}`,
  helpType: 'clarify',
  title: SERVED.title,
  signal: SERVED.body,
  whyNow: SERVED.body,
  tryThis: null,
  sourceLine: 'From Olumi’s review of this run.',
  action: { kind: 'ai-dialogue', label: SERVED.action_label, prompt: 'Ask me what the real figure is.' },
  targetId: 'monthly_churn',
  priority: 1,
} as unknown as Recommendation

const viaVm = (r: Recommendation): Recommendation => {
  const vm = buildAnalysisNewViewModel({ data: genuineDecision(), recommendations: [r], isPreRun: false, isRunning: false, isStale: false })
  const out = vm.strengthen.interventions.find((i) => i.id === r.id)
  if (!out) throw new Error('PRECONDITION: the view model dropped the recommendation')
  return out
}

const renderCard = (props: Partial<Parameters<typeof ChallengeCard>[0]>) =>
  render(<ChallengeCard intervention={null} methodId={null} onRunIntervention={vi.fn()} onRunMethod={vi.fn()} analysisHash="hash_1" {...props} />)

beforeEach(() => {
  useStrengthenStore.getState()._reset()
  useCanvasStore.setState({ currentScenarioId: 'd4-block-whole' })
})
afterEach(cleanup)

describe('the Challenge card renders a producer block whole', () => {
  it('⭐ the title AND the body at rest: the limit and the figure are named', () => {
    renderCard({ intervention: viaVm(REC) })
    expect(screen.getByTestId('analysis-new-challenge-heading')).toHaveTextContent(SERVED.title)
    expect(screen.getByTestId('analysis-new-challenge-body')).toHaveTextContent(SERVED.body)
    expect(screen.getByTestId('analysis-new-challenge-body')).toHaveTextContent(/Monthly churn/)
    expect(screen.getByTestId('analysis-new-challenge-body')).toHaveTextContent(/3% per month/)
  })

  it('⭐ the producer’s act names the AI act', () => {
    renderCard({ intervention: viaVm(REC) })
    expect(screen.getByTestId('analysis-new-challenge-work-through')).toHaveAttribute('aria-label', SERVED.action_label)
  })

  it('the body is said once: "Why this?" no longer repeats it', () => {
    renderCard({ intervention: viaVm(REC) })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-more'))
    fireEvent.click(screen.getByTestId('analysis-new-challenge-why'))
    expect(screen.getByTestId('analysis-new-challenge-basis')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-challenge-basis-why')).toBeNull()
    expect(screen.getAllByText(SERVED.body)).toHaveLength(1)
  })

  it('CONTRAST: a method (a self-standing question) shows no body line and keeps its basis', () => {
    renderCard({ methodId: 'opposite' })
    expect(screen.queryByTestId('analysis-new-challenge-body')).toBeNull()
  })
})
