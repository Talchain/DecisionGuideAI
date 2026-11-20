/**
 * Results saved by an earlier engine carry a visible mark (DL and Codex, 17 Nov): core's `model.run.earlier` sentence, drawn once and verbatim on the
 * question card above the results at both levels, and under the run's lead in the Analysis panel; absent when the running engine made the results.
 * The numbers are not touched. Fixture: the bakery View from the wire, with an invented sentence spread onto its run.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual<object>('@xyflow/react')), Handle: () => null }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { hoverWords } from './hoverTip'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { View } from '../client'
import { ViewChances } from '../ViewChances'
import { CoreCard } from '../previous/CoreCard'
import { QUESTION } from '../layout'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { setDefaultLevel, useSimpleLevel, type Level } from '../v12/simpleStore'
import { earlierResultsOf } from '../v12/contract'

const served = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/bakery.view.json'), 'utf8')) as View
const SAID = { text: 'An invented sentence: these results were worked out earlier.', title: 'An invented sentence: these results were worked out earlier.' }
const marked: View = { ...served, model: { ...served.model!, run: { ...served.model!.run!, earlier: SAID } as never } }

const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
const drawQuestion = (view: View, level: Level): HTMLElement => {
  setDefaultLevel(level)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  return render(<ReactFlowProvider><Node {...({ id: QUESTION, type: 'viewQuestion', data: { question: view.model!.question }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider>).container
}
const marks = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('[data-view="run.earlier"]')]

afterEach(() => {
  cleanup(); setDefaultLevel('simple'); useSimpleLevel.setState({ levels: {} })
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' })
})

describe('results saved by an earlier engine say so, once, in core\'s words', () => {
  // CHANGED BY DESIGN (v10 review item 2): on Simple the sentence is the hover of a small "Saved results" pill (the sentence is the same on every board);
  // Detailed still draws core's sentence whole, once.
  it('ER1 the question card says core\'s sentence once, verbatim, on Detailed; on Simple it is the title of a "Saved results" pill; the hover is core\'s title', async () => {
    const w = marks(drawQuestion(marked, 'working'))
    expect([w.length, w[0]?.textContent, await hoverWords(w[0]!), w[0]?.hasAttribute('title')]).toEqual([1, 'Saved results', `${SAID.text}\n${SAID.title}`, false])
    cleanup()
    const s = marks(drawQuestion(marked, 'simple'))
    expect([s.length, s[0]?.textContent, await hoverWords(s[0]!), s[0]?.hasAttribute('title'), s[0]?.getAttribute('data-saved-results')]).toEqual([1, 'Saved results', SAID.title, false, QUESTION])
  })
  it('ER2 the Analysis lines say it once, right after the run\'s lead; the lead and every number are as before', () => {
    const plain = render(<ViewChances model={served.model!} />).container
    const before = plain.textContent
    cleanup()
    const el = render(<ViewChances model={marked.model!} />).container
    const m = marks(el)
    expect([m.length, m[0]?.textContent]).toEqual([1, SAID.text])
    const lead = el.querySelector('[data-view="run.lead"]')
    if (lead !== null) expect(lead.nextElementSibling).toBe(m[0])
    expect(el.textContent?.replace(SAID.text, '')).toBe(before)
  })
  it('ER3 CONTRAST: without the field (the running engine made the results) nothing is drawn; an empty sentence is no field', () => {
    expect(marks(drawQuestion(served, 'simple'))).toEqual([])
    cleanup()
    expect(marks(render(<ViewChances model={served.model!} />).container)).toEqual([])
    expect(earlierResultsOf({ run: { earlier: { text: '', title: '' } } })).toBeNull()
    expect(earlierResultsOf({ run: { earlier: { text: 'x', title: '' } } })).toEqual({ text: 'x', title: 'x' })
  })
})
