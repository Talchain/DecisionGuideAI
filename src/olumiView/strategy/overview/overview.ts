/**
 * The Strategy Overview's rows, read from the View and nothing else. No word is made here except the four fixed pill words the board
 * names ("From the brief", "Untested", "Olumi asks") and the group headings; no chance, score or order is computed. Sources:
 * the question and the cards (`model`), the people's marks (`strategy.marks`), evidence marks (`collab.marks`), assumptions and open
 * questions (`strategy.items`), the brief's author (`members[0]`), commitments (`collab.commitments`).
 */
import type { View } from '../../client'

type Card = NonNullable<View['model']>['cards'][number]
export type Family = 'question' | 'aim' | 'option' | 'factor' | 'risk' | 'item'
export type Row = { id: string; family: Family; title: string; pill: string; info: boolean; holders: string[] }
export type Group = { id: string; heading: string; count: number | null; rows: Row[]; empty: string }

/** The aim's own measured figures are cards of family quantity but are the aim, not factors. */
const AIM_FIGURES = new Set(['arr_target', 'arr_2027'])
export const FROM_BRIEF = 'From the brief'
export const NO_COMMITMENTS = 'No commitments recorded yet.'
export const MAX_HOLDERS = 3

export function overviewOf(view: View): Group[] {
  const cards = view.model?.cards ?? []
  const strategy = view.strategy
  const author = view.members[0]?.name ?? null
  const byAuthor = author === null ? [] : [author]
  const markOf = (id: string) => strategy?.marks.find((m) => m.card === id)
  const evidenceOf = (id: string) => view.collab.marks?.find((m) => m.card === id && m.kind === 'evidence')
  const card = (family: Family) => (c: Card): Row => ({ id: c.id, family, title: c.heading, pill: FROM_BRIEF, info: false, holders: byAuthor })
  const measured = (c: { id: string }) => {
    const mark = markOf(c.id), ev = evidenceOf(c.id)
    return { pill: mark?.text ?? ev?.text ?? FROM_BRIEF, holders: mark ? mark.people.map((p) => p.name) : byAuthor }
  }
  const item = (kind: 'assumption' | 'question') => (strategy?.items ?? []).filter((i) => i.kind === kind).map((i): Row => ({
    id: i.id, family: 'item', title: i.text, holders: [i.by], info: kind === 'question' && i.by === 'Olumi',
    pill: kind === 'assumption' ? 'Untested' : i.by === 'Olumi' ? 'Olumi asks' : i.kind_text,
  }))
  const fam = (f: string) => cards.filter((c) => c.family === f)
  const question: Row[] = view.model ? [{ id: 'question', family: 'question', title: view.model.question.text, pill: FROM_BRIEF, info: false, holders: byAuthor }] : []
  const factors = fam('quantity').filter((c) => !AIM_FIGURES.has(c.id)).map((c): Row => ({ ...card('factor')(c), ...measured(c) }))
  const risks = fam('risk').map((c): Row => ({ ...card('risk')(c), ...measured(c) }))
  const commitments = view.collab.commitments.map((c): Row => ({ id: `commitment-${c.id}`, family: 'item', title: c.action, pill: '', info: false, holders: [c.owner] }))
  const g = (id: string, heading: string, rows: Row[], empty: string, counted = false): Group => ({ id, heading, count: counted ? rows.length : null, rows, empty })
  return [
    g('question', 'Question', question, 'No question yet.'),
    g('aim', 'Aim', fam('goal').map(card('aim')), 'No aim recorded yet.'),
    g('routes', 'Routes', fam('option').map(card('option')), 'No routes yet.', true),
    g('assumptions', 'Assumptions', item('assumption'), 'No assumptions recorded yet.', true),
    g('factors', 'Factors', factors, 'No factors yet.', true),
    g('risks', 'Risks', risks, 'No risks recorded yet.', true),
    g('questions', 'Open questions', item('question'), 'No open questions recorded.', true),
    g('commitments', 'Commitments', commitments, NO_COMMITMENTS),
  ]
}
