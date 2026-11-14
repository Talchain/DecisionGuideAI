/**
 * ONE OPTION'S PATH, FROM ITS OWN SETTING TO THE MEASURE THE AIM READS (DL 08:58Z, sharpened item 1). Read only from what core serves:
 *  - the option's settings: `card.sets[]` (each lever's figure with this option, whose it is);
 *  - what reads each setting: a step of core's own working (`card.worked.steps[].figure.options[]`) that takes the setting's record for
 *    this option, or a link from the setting; where nothing served reads it, the path BREAKS there, and core's own words for the break are
 *    drawn (`run.coverage[]` for this option and aim, else the option's row for that aim);
 *  - the option's own links (`links[]` from the option), core's title and size words;
 *  - the measure the aim reads: `model.aim.quantity`, its link into the goal (core's title), core's working for it (WorkedSteps, this
 *    option's figures), and each event that feeds it (`through` links from a risk card), with when its money arrives (`run.timing[].risks`).
 * Nothing is inferred from labels. What core does not serve is named per row in `data-path-missing` (for the lead), never guessed:
 *  - a setting nothing reads: `sets[].read_by` (no served record or link reads the lever);
 *  - an event: its chance, amount and the count it reads (`occurrence`, `severity`, `reads`) and the step of the measure it feeds (`via`).
 */
import type { View, ViewCard, ViewLink } from '../client'
import { WorkedSteps } from './WorkedSteps'

type Reader = { kind: 'step'; card: ViewCard; index: number; label: string } | { kind: 'link'; link: ViewLink; to: ViewCard | null }
type Timing = { label: string; value_text: string; risks?: string[] }
export type OptionPath = {
  view: View
  option: ViewCard
  sets: { set: NonNullable<ViewCard['sets']>[number]; index: number; readers: Reader[] }[]
  links: { link: ViewLink; to: ViewCard | null }[]
  measure: ViewCard | null
  goal: { card: ViewCard; link: ViewLink } | null
  aimText: string | null
  events: { card: ViewCard; link: ViewLink; timing: Timing[] }[]
  /** Core's words for where this option's path to the aim breaks (`run.coverage`, else its row for the aim); null where core says none. */
  breaks: string | null
}

export function optionPathOf(view: View, id: string): OptionPath | null {
  const model = view.model
  const option = model?.cards.find((c) => c.id === id) ?? null
  if (model == null || option === null || option.family !== 'option') return null
  const cardOf = (cid: string) => model.cards.find((c) => c.id === cid) ?? null
  const sets = (option.sets ?? []).map((set, index) => {
    const steps: Reader[] = model.cards.flatMap((c) => (c.worked?.steps ?? []).flatMap((s, i) =>
      s.figure.options.some((o) => o.option === id && o.id === set.id) ? [{ kind: 'step' as const, card: c, index: i, label: s.label }] : []))
    const links: Reader[] = model.links.filter((l) => l.kind !== 'reason' && (l.from === set.id || l.from === set.lever)).map((l) => ({ kind: 'link' as const, link: l, to: cardOf(l.to) }))
    return { set, index, readers: [...steps, ...links] }
  })
  const links = model.links.filter((l) => l.from === id && l.kind !== 'reason').map((l) => ({ link: l, to: cardOf(l.to) }))
  const aim = (model as { aim?: { quantity?: string | null; text?: string | null } | null }).aim ?? null
  const measure = aim?.quantity == null ? null : cardOf(aim.quantity)
  const goalLink = measure === null ? null : model.links.find((l) => l.from === measure.id && cardOf(l.to)?.family === 'goal') ?? null
  const goal = goalLink === null ? null : { card: cardOf(goalLink.to)!, link: goalLink }
  const run = (model as { run?: { coverage?: { aim_id: string; option: string; text: string }[]; timing?: Timing[] } | null }).run ?? null
  const events = measure === null ? [] : model.links.filter((l) => l.kind === 'through' && l.to === measure.id && cardOf(l.from)?.family === 'risk')
    .map((l) => ({ card: cardOf(l.from)!, link: l, timing: (run?.timing ?? []).filter((t) => (t.risks ?? []).includes(l.from)) }))
  const aimId = goal?.card.id ?? null
  const covered = (run?.coverage ?? []).find((c) => c.option === id && c.aim_id === aimId)?.text ?? null
  const row = (option.rows ?? []).find((r) => (r as { aim_id?: string }).aim_id === aimId && (r as { kind?: string }).kind === 'none') as { text?: string } | undefined
  return { view, option, sets, links, measure, goal, aimText: aim?.text ?? null, events, breaks: covered ?? row?.text ?? null }
}

/** What reads one of the option's settings, under that setting in "What it changes": core's step or link, or ✕ and core's words for the break. */
export function SetReads({ path, index }: { path: OptionPath; index: number }): JSX.Element | null {
  const row = path.sets.find((x) => x.index === index)
  if (row === undefined) return null
  // Core's words for the break are drawn once, under the first setting nothing reads; a later one carries the mark, its words on hover.
  const first = path.sets.find((x) => x.readers.length === 0)?.index === index
  return (
    <ul className="ok-path" data-path="set" data-path-from={row.set.id}>
      {row.readers.length === 0
        ? <li data-path="break" data-path-missing="sets[].read_by" className="ok-path-break" title={first ? undefined : path.breaks ?? undefined}><span aria-hidden="true">✕</span>{first && path.breaks !== null ? ` ${path.breaks}` : null}</li>
        : row.readers.map((r, i) => r.kind === 'step'
          ? <li key={`s${i}`} data-path="reads" data-path-to={`${r.card.id}.worked.steps.${r.index}`}><span aria-hidden="true">→ </span>{r.card.heading} · {r.label}</li>
          : <li key={`l${i}`} data-path="reads" data-path-to={r.link.to} title={r.link.title}><span aria-hidden="true">→ </span>{r.to?.heading ?? r.link.to}</li>)}
    </ul>
  )
}

/** The rest of the path: the option's own links, the measure the aim reads (core's working, the events that feed it, when), and the aim. */
export function OptionPathView({ path, head, drawn = [] }: { path: OptionPath; head: string; drawn?: readonly string[] }): JSX.Element | null {
  const { option, sets, links, measure, goal, aimText, events } = path
  if ((sets.length === 0 && links.length === 0) || (measure === null && links.length === 0)) return null
  return (
    <section data-testid="selected-explain-path" data-path-option={option.id} data-path-broken={sets.some((x) => x.readers.length === 0) ? '' : undefined}>
      <p className="ok-explain-head">{head}</p>
      <ol className="ok-path">
        {links.map(({ link, to }, i) => {
          const size = (link as { size?: { text?: string } | null }).size?.text ?? null
          return (
            <li key={`o${i}`} data-path="link" data-path-to={link.to} data-path-kind={link.kind} title={link.title}>
              <span aria-hidden="true">→ </span>{to?.heading ?? link.to}{size === null ? null : <span className="ok-by"> · {size}</span>}
            </li>
          )
        })}
        {measure === null ? null : (
          <li data-path="measure" data-path-from={measure.id}>
            <span>{measure.heading}</span>
            {drawn.includes(measure.id) ? null : <WorkedSteps view={path.view} id={measure.id} option={option.id} open />}
            {events.length === 0 ? null : (
              <ul>{events.map((e) => (
                <li key={e.card.id} data-path="event" data-path-from={e.card.id} data-path-missing="occurrence severity reads via" title={e.link.title}>
                  <span>{e.card.heading}</span>
                  {e.timing.map((t) => <span key={t.label} className="ok-by" data-path-timing=""> · {t.label} {t.value_text}</span>)}
                </li>
              ))}</ul>
            )}
          </li>
        )}
        {goal === null ? null : (
          <li data-path="aim" data-path-to={goal.card.id}>
            <span aria-hidden="true">→ </span>{goal.card.heading}{aimText === null ? null : <> <b>{aimText}</b></>}
            {goal.link.title === '' ? null : <span className="ok-by"> · {goal.link.title} {measure?.heading}</span>}
          </li>
        )}
      </ol>
    </section>
  )
}
