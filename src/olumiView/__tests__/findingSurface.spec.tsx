/**
 * ONE function decides where core's `run.finding` is drawn (findingSurfaceOf). Each state of the screen below puts the finding in exactly one surface that
 * is on screen, or in none: the Olumi panel, the Frame page and the question card are all mounted together, as they are on the canvas, and the finding is
 * counted by where it is drawn (`data-finding`: its sentence, its figure or its needs row). Fixture: the bakery View with an invented finding, and a session whose newest reply is given an invented lead.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual<object>('@xyflow/react')), Handle: () => null }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { View } from '../client'
import { CoreCard } from '../previous/CoreCard'
import { ViewChat } from '../ViewChat'
import { FrameStage } from '../v12/frame/FrameStage'
import { useFrameStage } from '../v12/frame/useFrameStage'
import { QUESTION } from '../layout'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { useMe } from '../../olumiCore/me'
import { setDefaultLevel } from '../v12/simpleStore'
import { findingSurfaceOf, useDockFrontsOlumi, type FindingSurface } from '../findingSurface'

const DIR = path.resolve('src/olumiView')
const read = (rel: string): View => structuredClone(JSON.parse(readFileSync(path.join(DIR, rel), 'utf8'))) as View
const FINDING = { text: 'An invented finding: on this model the first option is likely to meet the aim.', title: 'An invented long form.', figure: null, needs: 'An invented need: a figure for the sales target.' }
const withFinding = (v: View, finding: unknown = FINDING): View => { (v.model!.run as { finding?: unknown }).finding = finding; return v }
const withChat = (v: View): View => ({ ...v, chat: read('fixtures/session/after-find-first.view3.json').chat }) as View
const withLead = (v: View): View => {
  const t = [...v.chat].reverse().find((x) => x.answer !== null)!;
  (t.answer as unknown as { lead: unknown }).lead = { opening: 'An invented short opening that is not the whole answer.', points: [] }
  return v
}
const noResult = (v: View): View => { for (const c of v.model!.cards) if (c.family === 'option' && c.headline != null) (c.headline as { state: string }).state = 'none'; return v }
const base = (): View => withFinding(withChat(read('golden/bakery.view.json')))

type Screen = { fronted: boolean; frame: boolean }
/** The three surfaces mounted together; the surfaces that draw any of the finding, by their own `data-finding`. */
const drawnAt = (view: View, s: Screen): string[] => {
  setDefaultLevel('simple')
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  useDockFrontsOlumi.getState().set(s.fronted)
  useFrameStage.setState({ open: s.frame, armedFor: view.id })
  const { container } = render(<ReactFlowProvider>
    <CoreCard {...({ id: QUESTION, type: 'viewQuestion', data: { question: view.model!.question }, selected: false, dragging: false, zIndex: 0, isConnectable: false, positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} />
    <FrameStage /><ViewChat /></ReactFlowProvider>)
  return [...container.querySelectorAll('[data-finding]')].map((e) => e.getAttribute('data-finding')!)
}
const ON = { fronted: true, frame: false }

beforeEach(() => { useUIStore.setState({ activeOutputTab: 'olumi' } as never) })
afterEach(() => {
  cleanup(); useDockFrontsOlumi.getState().set(false); useFrameStage.setState({ open: false, armedFor: null }); setDefaultLevel('simple')
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' })
})

describe('the finding is drawn in exactly one surface that is on screen', () => {
  it('P1 the Olumi tab fronted, no lead on the newest reply: the panel and nothing else, whether or not the Frame is open', () => {
    expect(drawnAt(base(), ON)).toEqual(['panel'])
    cleanup()
    expect(drawnAt(base(), { fronted: true, frame: true })).toEqual(['panel'])
  })
  it('P2 the Olumi tab fronted and the newest reply draws a lead (its headline is the same fact): no surface repeats it, Frame open or not', () => {
    expect(drawnAt(withLead(base()), ON)).toEqual([])
    cleanup()
    expect(drawnAt(withLead(base()), { fronted: true, frame: true })).toEqual([])
  })
  it('P3 the Team (or any other) tab fronted, or the dock collapsed: the panel is not on screen, so the question card says it, or the Frame when it is open', () => {
    expect(drawnAt(base(), { fronted: false, frame: false })).toEqual(['question'])
    cleanup()
    expect(drawnAt(base(), { fronted: false, frame: true })).toEqual(['frame'])
  })
  it('P4 no calculated result on any option: never the panel (the reply and the aim card already say it); the question card keeps its figure and needs rows, the Frame its sentence', () => {
    expect(drawnAt(noResult(base()), ON)).toEqual(['question'])
    cleanup()
    expect(drawnAt(noResult(base()), { fronted: true, frame: true })).toEqual(['frame'])
  })
  it('P5 CONTRAST: core sends no finding: no surface', () => {
    expect(drawnAt(withFinding(base(), null), ON)).toEqual([])
    cleanup()
    expect(drawnAt(withFinding(base(), null), { fronted: false, frame: true })).toEqual([])
  })
  it('P6 the function itself, for every cell of the state it reads', () => {
    const cell = (v: View | null, s: Screen): FindingSurface | null => findingSurfaceOf(v, { olumiFronted: s.fronted, frameShown: s.frame })
    expect([cell(base(), ON), cell(withLead(base()), ON), cell(withLead(base()), { fronted: true, frame: true }), cell(base(), { fronted: false, frame: false }), cell(base(), { fronted: false, frame: true }),
      cell(noResult(base()), ON), cell(withFinding(base(), null), ON), cell(null, ON)]).toEqual(['panel', null, null, 'question', 'frame', 'question', null, null])
  })
})
