/**
 * WHAT SOMEONE TYPED MUST NOT VANISH WITH THE ROW IT WAS TYPED IN.
 *
 * This file already names the standard one screen from the defect: *"Losing what
 * someone typed because a POST failed is the worst outcome available on this
 * surface"* — which is why the durable write happens BEFORE the send.
 *
 * ⛔ The same loss had a second door. The dispute box renders only inside
 * `plan.ordered.map`, gated on `disputingId === rec.id`. A rerun past a graph
 * edit mints new `block_id`s, the disputed finding leaves the plan, and the box
 * goes with it — carrying whatever had been typed. No error, no warning.
 *
 * ⭐ So it is SAVED, not discarded. `recordDissent` is purely local; keeping
 * what someone wrote is not a decision that needs their permission, and
 * throwing it away is.
 */
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StrengthenTheReasoning } from '../sections/StrengthenTheReasoning'
import type { Recommendation } from '../../strengthen/strengthenTypes'
import { readDissent, clearDurableDissent } from '../../../../canvas/stores/dissentStore'
import { useCanvasStore } from '../../../../canvas/store'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

const SCENARIO = 'scn-typed-words'

const rec = (id: string, title: string): Recommendation =>
  ({
    helpType: 'challenge',
    title,
    signal: 'One factor carries most of the influence.',
    whyNow: 'The conclusion rests almost entirely on it.',
    tryThis: 'Write down why it failed.',
    sourceLine: 'From the influence concentration check.',
    action: { kind: 'ai-dialogue', label: 'Work through it', prompt: 'p' },
    targetId: 'f_x',
    priority: 1,
    id,
  }) as Recommendation

const RUN_A = [rec('strengthen:phase3:a1', 'First finding')]
const RUN_B = [rec('strengthen:phase3:b1', 'A different finding')]
const WORDS = 'I disagree: churn is not the mechanism here, pricing is.'

beforeEach(() => {
  useCanvasStore.setState({ currentScenarioId: SCENARIO } as never)
  /**
   * ⛔⛔ THE DISSENT STORE IS DURABLE BY DESIGN, SO IT SURVIVES BETWEEN ARMS —
   * AND MY DISCRIMINATOR CAUGHT IT.
   *
   * `"nothing is saved when the finding is still there"` failed with the text
   * from an EARLIER arm still in the store. The arm was right; the isolation was
   * missing. Without this, the two negative arms can only ever pass when they
   * happen to run first — order-dependent, and green for the wrong reason on any
   * run where they do.
   *
   * ⚠ This is the point of a durable store: it outlives the tab. A spec about it
   * must clear it explicitly, exactly as it must not assume `localStorage` is
   * empty.
   */
  clearDurableDissent()
})

const openSection = () =>
  fireEvent.click(screen.getByTestId('analysis-new-strengthen-toggle'))

describe('typed words survive a rerun that removes their row', () => {
  it('CONTROL: the store really is empty at the start of each arm', () => {
    // ⭐ The isolation itself, pinned. Without it the two NEGATIVE arms below
    // can only pass when they happen to run first, and a later reordering turns
    // them green for the wrong reason — which is how this file first went red.
    expect(JSON.stringify(readDissent(SCENARIO))).not.toContain('pricing is')
  })

  it('PRECONDITION: the dispute box opens and accepts text', () => {
    render(<StrengthenTheReasoning interventions={RUN_A} analysisHash="hash-a" />)
    openSection()
    const dispute = screen.getByTestId('analysis-new-strengthen-disagree')
    fireEvent.click(dispute)
    const box = screen.getByTestId('analysis-new-strengthen-disagree-input')
    fireEvent.change(box, { target: { value: WORDS } })
    expect(box).toHaveValue(WORDS)
  })

  it('⛔ the words are kept when the finding leaves the plan', () => {
    const { rerender } = render(
      <StrengthenTheReasoning interventions={RUN_A} analysisHash="hash-a" />,
    )
    openSection()
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree'))
    fireEvent.change(screen.getByTestId('analysis-new-strengthen-disagree-input'), {
      target: { value: WORDS },
    })

    // The rerun the reader asked for: every id moves.
    rerender(<StrengthenTheReasoning interventions={RUN_B} analysisHash="hash-b" />)

    const kept = readDissent(SCENARIO)
    expect(
      JSON.stringify(kept),
      'their objection must be somewhere after the row carrying it disappeared',
    ).toContain('pricing is')
  })

  /**
   * ⚠ STAMPED WITH THE RUN THEY WERE READING, not the one that replaced it. A
   * dissent shown beside a later analysis would be a claim they never made —
   * the same reasoning the submit path already documents for its own stamp.
   */
  it('⛔ stamped with the analysis the words were composed against', () => {
    const { rerender } = render(
      <StrengthenTheReasoning interventions={RUN_A} analysisHash="hash-a" />,
    )
    openSection()
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree'))
    fireEvent.change(screen.getByTestId('analysis-new-strengthen-disagree-input'), {
      target: { value: WORDS },
    })
    rerender(<StrengthenTheReasoning interventions={RUN_B} analysisHash="hash-b" />)

    const kept = JSON.stringify(readDissent(SCENARIO))
    expect(kept, 'the run they were reading').toContain('hash-a')
    expect(kept, 'never the run that replaced it').not.toContain('hash-b')
  })

  /**
   * ⛔ THE DISCRIMINATOR. Without it, an implementation that saved on EVERY
   * interventions change would pass the cases above — and would persist a draft
   * the reader was still editing, on a rerun that kept their row.
   */
  it('⛔ nothing is saved when the finding is still there', () => {
    const { rerender } = render(
      <StrengthenTheReasoning interventions={RUN_A} analysisHash="hash-a" />,
    )
    openSection()
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree'))
    fireEvent.change(screen.getByTestId('analysis-new-strengthen-disagree-input'), {
      target: { value: WORDS },
    })
    rerender(<StrengthenTheReasoning interventions={RUN_A} analysisHash="hash-a2" />)

    expect(
      JSON.stringify(readDissent(SCENARIO)),
      'a draft still being edited must not be committed behind the reader',
    ).not.toContain('pricing is')
  })

  it('⛔ an EMPTY box saves nothing — an untouched dispute is not an objection', () => {
    const { rerender } = render(
      <StrengthenTheReasoning interventions={RUN_A} analysisHash="hash-a" />,
    )
    openSection()
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree'))
    rerender(<StrengthenTheReasoning interventions={RUN_B} analysisHash="hash-b" />)
    expect(JSON.stringify(readDissent(SCENARIO))).not.toContain('a1')
  })
})
