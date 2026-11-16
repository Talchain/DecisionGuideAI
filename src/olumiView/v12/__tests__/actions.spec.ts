/**
 * V12 one action system: the menu's order, the next step chosen from purpose (proposal, the reply's real move, the goal's first question,
 * invite), filler suppression, and the analysis prerequisite. Bound by identity to core's own Views (fixtures/session, golden).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../../client'
import { FILLER_MOVE, NEEDS_ANALYSIS_WORDS, isMethodReply, isRealMove, menuOf, nextStepFor } from '../actions'

const session = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/session', `${n}.view3.json`), 'utf8'))
const golden = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8'))
const withMove = (v: View, move: string, newest = true): View => {
  const chat = v.chat.map((t, i) => (i === v.chat.length - 1 && t.answer !== null ? { ...t, answer: { ...t.answer, next: { ...t.answer.next, move, newest } } } : t))
  return { ...v, chat }
}
const noMoveGoal = (v: View, goal: string | null): View => ({ ...v, session: { ...v.session, goal: goal === null ? null : v.session.goals.find((g) => g.id === goal)!, methods: v.session.methods.map((m) => ({ ...m, first: goal === null ? false : m.first })) } })

describe('the menu', () => {
  it('is core\'s questions in core\'s order, none dropped, the goal\'s first; the two tools follow', () => {
    const v = session('goal-understand'), m = menuOf(v)!
    expect(m.methods.map((x) => x.id)).toEqual(v.session.methods.map((x) => x.id))
    expect(m.methods.map((x) => x.text)).toEqual(v.session.methods.map((x) => x.text))
    expect(m.methods.map((x) => x.first)).toEqual([true, true, true, true, true, false, false, false, false, false, false])
    expect(m.tools).toEqual(['edit_brief', 'review_inputs'])
    expect(m.goal).toBe('understand')
  })
  it('a different goal reorders it (the order is core\'s, never the UI\'s)', () => {
    const a = session('goal-understand'), b = { ...a, session: { ...a.session, methods: [...a.session.methods].reverse() } }
    expect(menuOf(b)!.methods.map((x) => x.id)).toEqual([...a.session.methods].reverse().map((x) => x.id))
  })
  it('keeps "Let us give our figure first" where core puts it, and only when core sends it', () => {
    const a = session('goal-understand'), ff = { id: 'figure_first', text: 'Let us give our figure first', first: false }
    const at = a.session.methods.findIndex((x) => x.id === 'go_wrong') + 1
    const v = { ...a, session: { ...a.session, methods: [...a.session.methods.slice(0, at), ff, ...a.session.methods.slice(at)] } }
    expect(menuOf(v)!.methods[at]!.id).toBe('figure_first')
    expect(menuOf(a)!.methods.some((x) => x.id === 'figure_first')).toBe(false)
  })
  it('an analysis-gated question says what it needs while there is no analysis, and a plain one never does; with an analysis none does', () => {
    const a = session('goal-understand')
    const none: View = { ...a, model: { ...a.model!, run: { ...a.model!.run!, aim: null } } }
    const byId = (v: View) => Object.fromEntries(menuOf(v)!.methods.map((m) => [m.id, m.prerequisite]))
    expect(byId(none)['differ']).toBe(NEEDS_ANALYSIS_WORDS)
    expect(byId(none)['rests']).toBe(NEEDS_ANALYSIS_WORDS)
    expect(byId(none)['else_do']).toBeNull() // contrast: a qualitative question has no prerequisite
    expect(byId(none)['right_question']).toBeNull()
    expect(Object.values(byId(a)).every((x) => x === null)).toBe(true)
  })
  it('no tools before there is a model; no menu at all without core\'s session block', () => {
    const a = session('goal-understand')
    expect(menuOf({ ...a, model: null })!.tools).toEqual([])
    expect(menuOf({ ...a, session: undefined } as unknown as View)).toBeNull()
  })
})

describe('the next step', () => {
  const base = session('goal-understand')
  it('a proposal awaiting approval comes first, over a real move and a goal', () => {
    const p = golden('proposal')
    expect(nextStepFor(p)?.kind).toBe('approve')
  })
  it('else the newest reply\'s own real move', () => {
    const s = nextStepFor(withMove(base, 'pre_mortem'))
    expect(s).toMatchObject({ kind: 'move', next: { move: 'pre_mortem' } })
    expect(s?.kind === 'move' && s.turn).toBe(base.chat.at(-1)!.id)
  })
  it('the filler move is suppressed: the goal\'s first question is the step instead', () => {
    const s = nextStepFor(withMove(base, FILLER_MOVE))
    expect(s).toMatchObject({ kind: 'method', method: { id: 'right_question', first: true } })
    expect(isRealMove(FILLER_MOVE)).toBe(false)
    expect(isRealMove('')).toBe(false)
    expect(isRealMove(null)).toBe(false)
  })
  it('a move that is not the newest reply\'s, or that core has refused as stale, is not the step', () => {
    expect(nextStepFor(withMove(base, 'pre_mortem', false))?.kind).toBe('method')
    expect(nextStepFor(withMove(base, 'pre_mortem'), (turn, move) => turn === base.chat.at(-1)!.id && move === 'pre_mortem')?.kind).toBe('method')
  })
  it('the first question follows the person\'s goal: another goal, another first question', () => {
    const better = nextStepFor(withMove(noMoveGoal(base, 'better_option'), FILLER_MOVE))
    expect(better?.kind).toBe('method')
    // core's own order for the goal is the View's session.methods: the first `first` one
    expect(better?.kind === 'method' && better.method.id).toBe(base.session.methods.find((m) => m.first)!.id)
  })
  it('with no goal nothing leads, so no question is chosen for them (and no invite while they are not alone with a view begun)', () => {
    expect(nextStepFor(withMove(noMoveGoal(base, null), FILLER_MOVE))).toBeNull()
  })
  it('invite only when the View shows a team activity begun alone', () => {
    const q0 = withMove(noMoveGoal(base, null), FILLER_MOVE)
    // the reply asks nothing of its own (an invitation never stacks under a reply's own question: replyHasNext)
    const quiet: View = { ...q0, chat: q0.chat.map((t, i) => (i === q0.chat.length - 1 && t.answer !== null ? { ...t, answer: { ...t.answer, next: { ...t.answer.next, text: [] } } } : t)) }
    const alone: View = { ...quiet, collab: { ...quiet.collab, alone: true, mine: [] } }
    expect(nextStepFor(alone)).toBeNull()
    const begun: View = { ...alone, collab: { ...alone.collab, mine: [{} as never] } }
    expect(nextStepFor(begun)?.kind).toBe('invite')
    // contrast: with a goal's question available it is the question, never an invite
    expect(nextStepFor({ ...begun, session: base.session })?.kind).toBe('method')
    // and not once others are in
    expect(nextStepFor({ ...begun, collab: { ...begun.collab, alone: false } })).toBeNull()
  })
})

describe('method replies', () => {
  it('a reply is a method reply when the turn\'s words are one of core\'s menu questions, word for word', () => {
    const v = session('after-find-first'), t = v.chat.at(-1)!
    expect(t.said).toBe(v.session.methods.find((m) => m.id === 'find_first')!.text)
    expect(isMethodReply(v, t)).toBe(true)
    expect(isMethodReply(v, { ...t, said: 'Something I typed' })).toBe(false)
    expect(isMethodReply(v, { ...t, answer: null })).toBe(false)
  })
})
