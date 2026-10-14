/**
 * THE CHANCE IS SAID ONCE IN THE BUBBLE (capacity row 4, served CEE 5b6e5eb7 turn 01; DL product call 14 Oct).
 *
 * The reply's own K-pinned chance line ("‘Add one specialist’: about 34% chance …") is CEE's canonical cell face, and the
 * in-chat Analysis result card rendered that same face again beneath it. The card now omits an option line byte-equal to
 * a line the reply above already says (or to the opening of a line it continues), per option, by exact identity.
 *
 * Mounted on `MessageBubble`, the bubble the deployed Olumi tab renders (ChatMessage → MessageBubble → InlineBlocks →
 * V5AnalysisResultBlock), fed the served turn's own response, copied (`fixtures/served-capacity-5b6e5eb7-turn01.json`,
 * `_source`): its reply, its blocks through the real `mapV5Blocks`, and its canonical view.
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
import SERVED from '../../../v5/blocks/__tests__/fixtures/served-capacity-5b6e5eb7-turn01.json'

type Option = { option_id: string; cell: { kind: string; face?: string; reasons?: { message: string }[] } }
const OPTIONS = SERVED.canonical_analysis_view.options as Option[]
const FACE = OPTIONS.find(o => o.option_id === 'add_one_specialist')!.cell.face!
const initialState = useCanvasStore.getState()

function mount(content: string) {
  useCanvasStore.setState({ nodes: SERVED.nodes.map(n => ({ id: n.id, position: { x: 0, y: 0 }, data: { label: n.label, kind: n.kind } })),
    currentScenarioId: SERVED.scenario_id } as never)
  useCanonicalAnalysisViewStore.getState().adopt(SERVED.scenario_id, parseCanonicalAnalysisView(SERVED.canonical_analysis_view))
  const blocks = mapV5Blocks(SERVED.blocks as never, SERVED.suggested_actions as never, turnCanonicalRunOf(SERVED))
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

describe('capacity row 4: the bubble says each option\'s chance once', () => {
  it('PRECONDITION: the served reply carries the canonical face as its own line, followed by what it rests on', () => {
    expect(SERVED.assistant_text.split('\n').some(l => l.startsWith(`${FACE} It rests most on`))).toBe(true)
  })

  it('RED (served turn 01): the face appears once in the bubble, said by the reply, not again by the card', () => {
    mount(SERVED.assistant_text)
    expect(timesIn(screen.getByTestId('v5-analysis-result').textContent, FACE)).toBe(0)
    expect(cardLine('add_one_specialist')).toBeNull()
    expect(timesIn(document.body.textContent, FACE)).toBe(1)
  })

  it('a different option\'s line is still shown on the card (the status quo, which the reply does not say)', () => {
    mount(SERVED.assistant_text)
    const why = OPTIONS.find(o => o.option_id === 'keep_current_staffing')!.cell.reasons![0]!.message
    expect(SERVED.assistant_text).not.toContain(why)
    expect(cardLine('keep_current_staffing')).toHaveTextContent(why)
  })

  it('CONTROL: a reply without the line → the card shows the face', () => {
    const without = SERVED.assistant_text.split('\n').filter(l => !l.startsWith(FACE)).join('\n')
    expect(without).not.toContain(FACE)
    mount(without)
    expect(cardLine('add_one_specialist')?.textContent).toBe(FACE)
  })
})
