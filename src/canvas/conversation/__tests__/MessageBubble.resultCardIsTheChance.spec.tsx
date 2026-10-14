/**
 * THE RESULT CARD IS THE CHANCE (capacity post3017 row 4, served CEE 5b6e5eb7 turn 01; DL ruling, PL #94 07:24Z).
 *
 * The bubble showed "‘Add one specialist’: about 34% chance …" twice: in the reply (CEE's S4c append) and on the Analysis
 * result card beneath it. CEE now leaves the append out when the reply carries the Run's bound, current card, so the card
 * says it once. This row composes the two halves: CEE's real route output on the served turn-01 read
 * (`fixtures/composed-capacity-5b6e5eb7-turn01-card-is-the-chance.json`, `_source`) mounted in `MessageBubble`, the bubble
 * the deployed Olumi tab renders (ChatMessage → MessageBubble → InlineBlocks → V5AnalysisResultBlock), unchanged. What the
 * chance rests on stays in the reply (DL ruling on #3027): only the duplicated face goes.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MessageBubble } from '../MessageBubble'
import type { ConversationMessage } from '../types'
import { useCanvasStore } from '../../store'
import { useCanonicalAnalysisViewStore } from '../../stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView } from '../../runView/canonicalAnalysisView'
import { mapV5Blocks } from '../../../v5/blocks/mapV5Blocks'
import { turnCanonicalRunOf } from '../../../v5/applyV5State'
import COMPOSED from '../../../v5/blocks/__tests__/fixtures/composed-capacity-5b6e5eb7-turn01-card-is-the-chance.json'

type Option = { option_id: string; cell: { kind: string; face?: string } }
const FACE = (COMPOSED.canonical_analysis_view.options as Option[]).find(o => o.option_id === 'add_one_specialist')!.cell.face!
/** What the chance rests on (S4c's depends sentence): kept in the reply when the card shows (DL ruling on #3027). */
const DEPENDS = 'It rests most on Olumi’s own estimate of how strongly ‘Additional specialist capacity’ affects ‘Weekly support capacity’: if that effect is weaker than Olumi assumed, the chance falls. Is that estimate right?'
const initialState = useCanvasStore.getState()

function mount(content: string) {
  useCanvasStore.setState({ nodes: COMPOSED.nodes.map(n => ({ id: n.id, position: { x: 0, y: 0 }, data: { label: n.label, kind: n.kind } })),
    currentScenarioId: COMPOSED.scenario_id } as never)
  useCanonicalAnalysisViewStore.getState().adopt(COMPOSED.scenario_id, parseCanonicalAnalysisView(COMPOSED.canonical_analysis_view))
  const blocks = mapV5Blocks(COMPOSED.blocks as never, COMPOSED.suggested_actions as never, turnCanonicalRunOf(COMPOSED))
  const message = { id: 'turn-01', role: 'assistant', content, timestamp: new Date(), blocks } as ConversationMessage
  render(<MessageBubble message={message} onChipClick={async () => {}} />)
}
const timesIn = (text: string | null, line: string) => (text ?? '').split(line).length - 1
const cardLine = (optionId: string) => screen.getByTestId('v5-analysis-result').querySelector(`li[data-option-id="${optionId}"]`)

afterEach(() => {
  cleanup()
  useCanvasStore.setState(initialState, true)
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
})

describe('capacity row 4: the bound result card is the chance, said once in the bubble', () => {
  it('composed (CEE claude/card-is-the-chance on the served turn-01 read): the face is on screen once, on the card', () => {
    mount(COMPOSED.assistant_text)
    expect(cardLine('add_one_specialist')?.textContent).toBe(FACE)
    expect(timesIn(document.body.textContent, FACE)).toBe(1)
    // The coaching question on the consequential assumption, and what would change it, stay in the reply, once each.
    expect(timesIn(screen.getByTestId('v5-analysis-result').textContent, DEPENDS)).toBe(0)
    expect(timesIn(document.body.textContent, DEPENDS)).toBe(1)
    expect(timesIn(document.body.textContent, 'What would change it: ')).toBe(1)
  })

  it('CONTRAST (the same route before the change): the reply said the face and the card said it again', () => {
    mount(COMPOSED.assistant_text_before)
    expect(cardLine('add_one_specialist')?.textContent).toBe(FACE)
    expect(timesIn(document.body.textContent, FACE)).toBe(2)
  })
})
