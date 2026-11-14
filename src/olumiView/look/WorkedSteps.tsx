/**
 * HOW A WORKED-OUT FIGURE IS WORKED OUT, STEP BY STEP (DL-529 slice 2). Read from the View's own structure, never from its prose: the links
 * into this card that carry a relation record (core `links[].records`, the relation `collab.records[]` names), one step per link:
 *  - `kind: 'plain'` is the relation's base: the card it comes from, its figure, whose it is, and its ✎ where core offers one;
 *  - `kind: 'through'` is an option's term: the option, and core's words for the effect it is sized by (`effect.text`), with that effect
 *    figure's own card (`effect.figure`) for whose it is and its ✎ where that card is drawn.
 * Core's words throughout (the relation's label as the heading, each step's line, its hover the link's own title). What the View does NOT
 * project, and this display therefore does not draw: the relation's form (sum, product, stock: how the steps combine) and each term's input
 * figure per option. Named in the channel with this card (DL-529 slice 2); nothing is inferred from the link titles' words.
 */
import type { View, ViewCard, ViewLink } from '../client'
import { FigureEdit } from '../FigureEdit'

/** The product's own words for the steps' heading where core sends the relation no label (a pending first model). */
export const WORKED_OUT = 'How it is worked out'

type Step = { link: ViewLink; from: ViewCard | null; effectCard: ViewCard | null }

/** The relation records that work this card out, and their steps, in the View's own link order. Empty where none. */
export function workedStepsOf(view: View, id: string): { relation: { id: string; label: string }; steps: Step[] }[] {
  const model = view.model
  if (model == null) return []
  const relations = new Map((view.collab?.records ?? []).filter((r) => r.family === 'relation').map((r) => [r.id, r.label ?? r.id]))
  const cardOf = (cid: string | null | undefined) => (cid == null ? null : model.cards.find((c) => c.id === cid) ?? null)
  const by = new Map<string, Step[]>()
  for (const link of model.links) {
    if (link.to !== id || link.kind === 'reason') continue
    // A pending first model has no approved records yet (collab.records is empty), so the relation is known by the id the link carries.
    for (const rid of link.records ?? []) {
      const effect = (link as { effect?: { figure?: string | null } | null }).effect ?? null
      by.set(rid, [...(by.get(rid) ?? []), { link, from: cardOf(link.from), effectCard: cardOf(effect?.figure ?? null) }])
    }
  }
  // A relation worked out in figures carries at least one sized term (`effect`); a relation in words (a claim drawn as a link) has none and
  // is not a calculation, so it is not shown as steps.
  return [...by.entries()].filter(([, steps]) => steps.some((s) => (s.link as { effect?: unknown }).effect != null))
    .map(([rid, steps]) => ({ relation: { id: rid, label: relations.get(rid) ?? WORKED_OUT }, steps }))
}

/** Whether this card's figure is worked out from others, by the View's structure (a relation with a sized term into it), never its words. */
export function isWorkedOut(view: View, id: string): boolean {
  return workedStepsOf(view, id).length > 0
}

const whose = (c: ViewCard | null) => (c?.author == null || c.author.text === '' ? null : { text: c.author.text, olumi: c.author.by === 'olumi' })

/** `mine`: the cards whose terms are marked as this option's (SelectedExplain); none on a card's own face. */
export function WorkedSteps({ view, id, mine }: { view: View; id: string; mine?: ReadonlySet<string> }): JSX.Element | null {
  const worked = workedStepsOf(view, id)
  if (worked.length === 0) return null
  return (
    <>
      {worked.map(({ relation, steps }) => (
        <details key={relation.id} className="ok-steps nodrag nowheel" data-view={`${id}.worked.${relation.id}`}>
          <summary title={relation.label}><span className="line-clamp-1">{relation.label}</span></summary>
          <ol>
            {steps.map(({ link, from, effectCard }, i) => {
              const effect = (link as { effect?: { text: string; title: string } | null }).effect ?? null
              const base = link.kind === 'plain'
              const own = base ? from : effectCard
              const mark = whose(own)
              const edit = own?.figure?.edit ?? null
              return (
                <li key={`${link.from}:${i}`} title={link.title} data-step={base ? 'base' : 'term'} data-step-from={link.from} data-step-own={mine?.has(link.from) ? '' : undefined} className={mine?.has(link.from) ? 'ok-step-own' : undefined}>
                  <span className="ok-step-name">{from?.heading ?? link.from}</span>{' '}
                  <b>{base ? from?.figure?.text ?? '' : effect?.text ?? ''}</b>
                  {mark === null ? null : <span className={`ok-step-by ${mark.olumi ? 'ok-by-olumi' : ''}`}> · {mark.text}</span>}
                  {own !== null && edit != null ? <>{' '}<span className="ok-edit" data-figure-edit-wrap=""><FigureEdit id={own.id} edit={edit} place="view-step" glyph="✎" label="Change figure" words={false} /></span></> : null}
                </li>
              )
            })}
          </ol>
        </details>
      ))}
    </>
  )
}
