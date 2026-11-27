import type { View, ViewModel } from '../client'
import { optionCards } from '../model/selectors'
import type { IconId } from '../look/icons'
import { cardOf, findOutOf } from '../port/pick'
import type { Question } from '../reasoning/answer'
import { examineOf, type Examine } from '../reasoning/examine'
import { CHECK_WORDS } from './words'

export { CHECK_WORDS } from './words'

type Words = { text: string; at: string }
type Edit = { prompt: string; ask: string }
type Action =
  | { kind: 'edit'; id: string; edit: Edit; label: string }
  | { kind: 'method'; id: string; words: Words }
  | { kind: 'answer'; question: Question }
  | { kind: 'fill'; text: string }
  | { kind: 'show'; id: string }
  | { kind: 'none' }

type NeedKind = 'blocks' | 'waits' | 'size' | 'worth'
export type CheckItem = {
  key: string
  kind: NeedKind | 'find' | Examine['kind']
  icon: IconId
  short: string
  at: string
  long: Words[]
  value?: Words
  cards: string[]
  action: Action
}

export type CheckBlock = { key: string; heading?: Words; line?: Words; items: CheckItem[] }
export type CheckGroup = {
  kind: 'needs' | 'find' | 'examine'
  heading: string
  at?: string
  blocks: CheckBlock[]
}

const ICON_OF: Record<NeedKind, IconId> = {
  blocks: 'state-no-chance', waits: 'state-waits', size: 'state-not-sized', worth: 'worth-checking',
}
const MARK: Record<Examine['kind'], IconId> = {
  challenge: 'challenged', method: 'olumi-mark', question: 'olumi-mark', widen: 'olumi-mark',
}
const NONE = { kind: 'none' } as const
const wordsAt = (text: string | null | undefined, at: string): Words[] => text ? [{ text, at }] : []

export function checkNeedsOf(model: ViewModel): CheckItem[] {
  const items: CheckItem[] = []
  const seen = new Set<string>()
  const push = (key: string, kind: NeedKind, short: string, at: string, id: string | null, edit: Edit | null, long: Words[] = []) => {
    if (short === '') return
    if (id !== null && (kind === 'waits' || kind === 'size')) {
      if (seen.has(id)) return
      seen.add(id)
    }
    const card = cardOf(model, id)
    const action: Action = edit !== null && card !== null
      ? { kind: 'edit', id: card.id, edit, label: card.heading }
      : NONE
    items.push({ key, kind, icon: ICON_OF[kind], short, at, long, cards: id === null ? [] : [id], action })
  }

  const run = model.run
  const blockers = run?.shared_blockers ?? []
  blockers.forEach((b, i) => push(`blocks:${i}`, 'blocks', b.text, `run.shared_blockers.${i}.text`, b.aim_id, cardOf(model, b.aim_id)?.figure?.edit ?? null))
  const options = optionCards(model)
  for (const card of options) card.rows.forEach((row, i) => {
    if (row.kind !== 'none' || row.aim_role === 'reference') return
    if (blockers.some((b) => b.aim_id === row.aim_id && (b.options ?? []).includes(card.id))) return
    const id = row.blocked_by?.[0]?.ref ?? row.aim_id ?? null
    const at = `${card.id}.rows.${i}`
    push(`none:${card.id}.${i}`, 'blocks', row.text, `${at}.text`, id, cardOf(model, id)?.figure?.edit ?? null, wordsAt(row.title, `${at}.title`))
  })
  for (const card of options) card.rows.forEach((row, i) => {
    if (row.kind !== 'chance' || Number.isFinite(row.chance)) return
    const at = `${card.id}.rows.${i}`
    push(`held:${card.id}.${i}`, 'blocks', row.value, `${at}.value`, card.id, null, wordsAt(row.title, `${at}.title`))
  })

  const waits = run?.waits_on?.items ?? []
  waits.forEach((row, i) => {
    const at = `run.waits_on.items.${i}`
    push(`waits:${row.id}`, 'waits', row.text, `${at}.text`, row.id, row.edit ?? null, wordsAt(row.title, `${at}.title`))
  })
  for (const card of model.cards) {
    const f = card.figure
    if (f?.edit != null && f.text === '' && card.status === null && card.kind !== 'result' && card.values == null) {
      push(`size:${card.id}`, 'size', card.heading, `${card.id}.heading`, card.id, f.edit, wordsAt(f.title, `${card.id}.figure.title`))
    }
  }
  for (const card of model.cards) (card.worth_checking ?? []).forEach((row, j) => {
    const at = `${card.id}.worth_checking.${j}`
    push(`worth:${card.id}.${j}`, 'worth', row.title, `${at}.title`, card.id, null, wordsAt(row.text, `${at}.text`))
  })
  return items
}

function examineItem(e: Examine): CheckItem {
  const item = { key: e.key, kind: e.kind, icon: MARK[e.kind], cards: [], long: [], action: NONE }
  switch (e.kind) {
    case 'challenge': {
      const { card } = e
      return { ...item, short: card.heading, at: `${card.id}.heading`, cards: [card.id],
        long: [...wordsAt(card.detail, `${card.id}.detail`), ...wordsAt(card.reason, `${card.id}.reason`)] }
    }
    case 'method': {
      const { s, method } = e
      const at = `sharpen.${e.i}`
      return {
        ...item, short: s.lead || s.emphasis, at: s.lead ? `${at}.lead` : `${at}.emphasis`,
        long: [...wordsAt(s.emphasis, `${at}.emphasis`), ...wordsAt(s.rationale, `${at}.rationale`)],
        action: method === null ? NONE : {
          kind: 'method', id: method.m.id, words: { text: method.m.text, at: `session.methods.${method.at}.text` },
        },
      }
    }
    case 'question':
      return { ...item, short: e.q, at: e.typed === null ? `coaching_questions.${e.i}` : `questions.${e.i}.text`,
        action: e.typed === null ? { kind: 'fill', text: e.q } : { kind: 'answer', question: e.typed } }
    case 'widen':
      return { ...item, short: e.w.label, at: `model_words.${e.w.k}`, action: { kind: 'fill', text: e.w.draft } }
  }
}

export function checkItemsOf(model: ViewModel, view: View | null): CheckGroup[] {
  const run = model.run ?? null
  const find: CheckBlock[] = findOutOf(run).aims.map(({ aim, a }) => {
    const card = cardOf(model, aim.aim)
    const at = `run.find_out.${a}`
    return {
      key: at,
      heading: card === null ? undefined : { text: card.heading, at: `${card.id}.heading` },
      line: aim.line === '' ? undefined : { text: aim.line, at: `${at}.line` },
      items: aim.figures.map((figure, j) => {
        const path = `${at}.figures.${j}`
        return {
          key: `f:${a}:${figure.id}`, kind: 'find', icon: 'worth-checking',
          short: figure.label, at: `${path}.label`, cards: [figure.id],
          long: wordsAt(figure.line, `${path}.line`),
          value: wordsAt(figure.estimate_text, `${path}.estimate_text`)[0],
          action: figure.give == null ? NONE : { kind: 'edit', id: figure.id, edit: figure.give.edit, label: figure.label },
        }
      }),
    }
  })
  const figures = new Set(find.flatMap((block) => block.items.flatMap((item) => item.cards)))
  const needs = checkNeedsOf(model).filter((item) => item.kind !== 'size' || !figures.has(item.cards[0]!))
  const dissent = new Set((view?.collab.dissent ?? []).map((d) => d.id))
  const examine = examineOf(model, view?.session?.methods ?? null, view?.model_words ?? null, dissent).map(examineItem)
  return [
    { kind: 'needs', heading: CHECK_WORDS.needs, blocks: [{ key: 'needs', items: needs }] },
    { kind: 'find', heading: run?.find_out_heading || CHECK_WORDS.find, at: run?.find_out_heading ? 'run.find_out_heading' : undefined, blocks: find },
    { kind: 'examine', heading: CHECK_WORDS.examine, blocks: [{ key: 'examine', items: examine }] },
  ]
}
