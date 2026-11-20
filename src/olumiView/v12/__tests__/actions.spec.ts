/**
 * V12 one action system: the menu's order, the one pinned step (a proposal; every other next step is the newest reply's own, drawn at its end), filler
 * suppression, and the analysis prerequisite. Bound by identity to core's own Views (fixtures/session, golden).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../../client'
import { FILLER_MOVE, NEEDS_ANALYSIS_WORDS, isMethodReply, isRealMove, menuOf, nextStepFor, replyMoveFor } from '../actions'

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
    expect(byId(none)['rests']).toBe(NEEDS_ANALYSIS_WORDS)
    // 18 Nov: core does not ground "differ" in a calculation yet, so it never claims to need one.
    expect(byId(none)['differ'] ?? null).toBeNull()
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
  it('the panel pins only a proposal awaiting approval', () => {
    const p = golden('proposal')
    expect(nextStepFor(p)?.kind).toBe('approve')
  })
  it('system spec P2: nothing else is chosen here: not the reply\'s move, a method, a figure or an invitation', () => {
    // the newest reply's real move is drawn at that reply's end (ViewChat Turn), never as a step the UI picks
    expect(nextStepFor(withMove(base, 'pre_mortem'))).toBeNull()
    // contrast: the filler move, a goal with a first question, and a person alone with a view begun all gave a step before
    expect(nextStepFor(withMove(base, FILLER_MOVE))).toBeNull()
    expect(nextStepFor(withMove(noMoveGoal(base, 'better_option'), FILLER_MOVE))).toBeNull()
    const alone: View = { ...base, collab: { ...base.collab, alone: true, mine: [{} as never] } }
    expect(nextStepFor(alone)).toBeNull()
  })
  it('a filler move is never a real move', () => {
    expect(isRealMove(FILLER_MOVE)).toBe(false)
    expect(isRealMove('')).toBe(false)
    expect(isRealMove(null)).toBe(false)
    expect(isRealMove('pre_mortem')).toBe(true)
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

describe('the newest reply\'s move (the one predicate the chat tap and Journey share)', () => {
  const v = session('goal-understand')
  const withNext = (patch: Record<string, unknown>): View => ({ ...v, chat: v.chat.map((t, i) => (i === v.chat.length - 1 && t.answer !== null ? { ...t, answer: { ...t.answer, next: { ...t.answer.next, ...patch } } } : t)) }) as View
  const last = v.chat.at(-1)!
  it('a newest real move is the reply move, with its turn', () => {
    const m = replyMoveFor(withNext({ newest: true, move: 'pre_mortem' }))
    expect(m).toMatchObject({ turn: last.id, next: { move: 'pre_mortem' } })
  })
  it('the filler, a reply that is not the newest, and a move the chat refused as stale are none', () => {
    expect(replyMoveFor(withNext({ newest: true, move: FILLER_MOVE }))).toBeNull()
    expect(replyMoveFor(withNext({ newest: false, move: 'pre_mortem' }))).toBeNull()
    expect(replyMoveFor(withNext({ newest: true, move: 'pre_mortem' }), (turn, move) => turn === last.id && move === 'pre_mortem')).toBeNull()
    expect(replyMoveFor(withNext({ newest: true, move: 'pre_mortem' }), (turn) => turn !== last.id)).not.toBeNull() // contrast: another turn's refusal leaves it
  })
})
