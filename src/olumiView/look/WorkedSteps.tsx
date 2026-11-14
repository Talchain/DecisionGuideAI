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

type CoreWorkedOf = NonNullable<ViewCard['worked']>
type CoreStep = CoreWorkedOf['steps'][number]

/**
 * HOW THE STEPS COMBINE (DL 09:00Z item 1, the lead's PL-1035.5): the joining word before each step, read only from what core serves on
 * `card.worked`: its `form` and each step's `role`, `sign` (a sum's part added or taken away) or `power` (a product's part multiplied or
 * divided by). An effect's term is its driver times its own coefficient (core's `coefficient` operand). Where the field the form needs is
 * not served, no word is drawn: nothing is inferred from labels. Null: the step opens the working (nothing joins it).
 */
export function joinOf(form: CoreWorkedOf['form'], step: CoreStep, first: boolean): string | null {
  switch (form) {
    case 'sum': return step.sign === -1 ? 'minus' : step.sign === 1 ? (first ? null : 'plus') : null
    case 'product': return step.power === -1 ? (first ? '1 divided by' : 'divided by') : step.power === 1 ? (first ? null : 'times') : null
    case 'stock': return step.role === 'in' ? 'plus' : step.role === 'out' ? 'minus' : null
    case 'effect': return step.role === 'term' ? 'plus' : null
  }
}

/**
 * CORE'S OWN WORKING (`card.worked`, core 4352bfa3 efa47179; DL j3, 14 Nov): where core projects how a figure is worked out, its steps are
 * drawn verbatim, one per step, in core's order: the step's label, its figure (this option's where one is selected and core gives a row for
 * it), whose it is, and its ✎ where core offers one. `form`, `role`, `sign` and `power` say how the steps combine: each step after the
 * first is joined by a plain word read from them (joinOf: plus, minus, times, divided by), never from a label; `power`/`sign` also stay as
 * data attributes. Where core sends no `worked`, the link derivation below stays in force.
 */
function CoreWorked({ card, worked, option, mine, open }: { card: ViewCard; worked: CoreWorkedOf; option?: string; mine?: ReadonlySet<string>; open?: boolean }): JSX.Element {
  const figureOf = (s: Omit<CoreStep, 'role'>) => (option === undefined ? null : s.figure.options.find((o) => o.option === option) ?? null) ?? s.figure
  return (
    <details className="ok-steps nodrag nowheel" data-view={`${card.id}.worked`} data-worked-form={worked.form} open={open}>
      <summary title={WORKED_OUT}><span className="line-clamp-1">{WORKED_OUT}</span></summary>
      <ol>
        {worked.steps.map((s, i) => {
          const row = option === undefined ? null : s.figure.options.find((o) => o.option === option) ?? null
          const fig = row ?? s.figure, author = row?.author ?? s.author, edit = row?.edit ?? s.edit, editId = row?.id ?? s.id
          const own = mine?.has(editId) ?? false
          const join = joinOf(worked.form, s, i === 0), coefficient = worked.form === 'effect' ? s.coefficient ?? null : null
          return (
            <li key={`${s.id}:${i}`} title={fig.title} data-view={`${card.id}.worked.steps.${i}`} data-step={s.role} data-step-from={editId}
              data-step-sign={s.sign} data-step-power={s.power} data-step-own={own ? '' : undefined} className={own ? 'ok-step-own' : undefined}>
              {join === null ? null : <><span className="ok-step-join" data-step-join={join}>{join}</span>{' '}</>}
              <span className="ok-step-name">{s.label}</span>{' '}<b>{fig.text}</b>
              {coefficient === null ? null : <>{' '}<span className="ok-step-join" data-step-join="times">times</span>{' '}<span className="ok-step-name" data-step-coefficient={coefficient.id}>{coefficient.label}</span>{' '}<b data-step-coefficient-figure="">{figureOf(coefficient).text}</b></>}
              {author == null || author.text === '' ? null : <span className={`ok-step-by ${author.by === 'olumi' ? 'ok-by-olumi' : ''}`} title={author.title}> · {author.text}</span>}
              {edit == null ? null : <>{' '}<span className="ok-edit" data-figure-edit-wrap=""><FigureEdit id={editId} edit={edit} place="view-step" glyph="✎" label="Change figure" words={false} /></span></>}
            </li>
          )
        })}
      </ol>
    </details>
  )
}

/** The cards an option moves through core's own working: a step whose figure, for this option, is a different record (the option sets it). */
export function movedByWorked(view: View, option: string): string[] {
  return (view.model?.cards ?? []).filter((c) => (c.worked?.steps ?? []).some((s) => s.figure.options.some((o) => o.option === option && o.id !== s.id))).map((c) => c.id)
}

/** `mine`: the cards whose terms are marked as this option's (SelectedExplain); none on a card's own face. `option`: the selected option. */
/** `open`: drawn open (a selected option's path, DL 08:58Z), where the steps are the path itself. */
export function WorkedSteps({ view, id, mine, option, open }: { view: View; id: string; mine?: ReadonlySet<string>; option?: string; open?: boolean }): JSX.Element | null {
  const card = view.model?.cards.find((c) => c.id === id) ?? null
  if (card?.worked != null) return <CoreWorked card={card} worked={card.worked} option={option} mine={mine} open={open} />
  const worked = workedStepsOf(view, id)
  if (worked.length === 0) return null
  return (
    <>
      {worked.map(({ relation, steps }) => (
        <details key={relation.id} className="ok-steps nodrag nowheel" data-view={`${id}.worked.${relation.id}`} open={open}>
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
