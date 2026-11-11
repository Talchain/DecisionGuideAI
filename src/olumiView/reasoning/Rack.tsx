/**
 * Each option's reasoning (Paul, 11 Nov, PL-252: a credible Reasoning tab is required; Codex's narrow design: rows from core's View only,
 * no invented cells). It replaces the redesign's Z3 rack of marks, whose source (`cards[].rests_on`) the rebuilt path left empty on
 * real boards until core SCI-10 (PL-274, fd672840) filled it. The chances stay in Analysis (DL ruling 9 Nov): one link there, and no chance is drawn here. Per option, in core's order:
 *   - its heading (press: the canvas selects and centres its card; hover rings it) and whose idea it is (`author.text`);
 *   - What it works through: first the option's own settings (`cards[].sets`, core SCI-10: core's label, its figure and whose, by core's
 *     words `author`; pressable only where a card draws it); then every link core draws to or from the option except a reason link (a dissent: its home is the challenge
 *     zone; Codex PL-273), in core's order (`model.links`), each row the other card's
 *     heading, its figure (`figure.text`; where core has none, core's own words for the gap, `figure.title`; for an outcome the option works
 *     through to that core has worked out per option, only this option's own value, `values[k].text`), whose it is (`author.text`)
 *     and core's words for the link (`links[].title`, with `effect.text` where core sizes it); then each card core says the option rests on
 *     (`cards[].rests_on`, by id; where no card draws one, core's `label` and `author`, not pressable), then each its chance rows name
 *     (`rows[].rests_on`), not already listed. Every row with a card presses it;
 *   - Assumptions and evidence: the option's own premises (`cards[].premises`, core's glyph, words and Olumi mark; not pressable, being on
 *     the option's card, which its heading presses); they are said here and not again in the tab's "Assumptions and evidence" door; one in
 *     the same words as a challenged card's reason is that challenge, said in the tab's challenge zone, so not here;
 *   - What matters next: only where core ties it to this option by id: the coach's next step whose `about` names the option, a card listed
 *     above or one of its premises (`chat[].answer.next`); a figure the chances wait on that is listed above (`run.waits_on.items`); and core's
 *     line on how much of this option's chance rests on Olumi's guesses (`run.rests[]` for this option).
 * A cell with nothing from core is left out, never filled. The section labels are the tab's own; every other word is core's, verbatim.
 */
import { useEffect, useState } from 'react'
import type { ViewCard, ViewModel, View } from '../client'
import { challengedReasons, newestNextOf, optionCards } from '../layout'
import { useUIStore } from '../../stores/uiStore'
import { pressCard, ringFrom } from './tabRing'
import { useCanvasStore } from '../../canvas/store'
import { typography } from '../../styles/typography'
import { TYPE } from '../port/type'
import { ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import { Words } from '../ViewChat'

export const RACK_LABEL = 'Each option\'s reasoning'
export const SEE_CHANCES = 'See chances in Analysis'
export const RACK_LABELS = { through: 'Works through', premises: 'Assumptions and evidence', next: 'What matters next' } as const

type Link = ViewModel['links'][number]
type Setting = NonNullable<ViewCard['sets']>[number]
type Rest = ViewCard['rests_on'][number]
/** One row of what an option works through: a card (by a link, by what core says it rests on, or by its chance rows); one of the option's
 *  own settings (`cards[].sets`, a card where it has one, else drawn from core's words for it); or what it rests on with no card, by core's
 *  `label` and `author`. */
export type OptionThrough =
  | { readonly kind: 'card'; readonly card: ViewCard; readonly link: { readonly l: Link; readonly i: number } | null }
  | { readonly kind: 'set'; readonly set: Setting; readonly k: number; readonly card: ViewCard | undefined }
  | { readonly kind: 'rest'; readonly rest: Rest; readonly k: number }
export const throughId = (t: OptionThrough): string => (t.kind === 'card' ? t.card.id : t.kind === 'set' ? t.set.id : t.rest.id)

/**
 * What an option works through, in core's order: its own settings (`cards[].sets`), then each link to or from it (the other card, by id),
 * then what core says it rests on (`cards[].rests_on`: a card, or core's label and whose where no card draws it), then each card its chance
 * rows name. Each id once.
 */
export function throughOf(model: ViewModel, option: ViewCard): OptionThrough[] {
  const byId = new Map(model.cards.map((c) => [c.id, c]))
  const out: OptionThrough[] = [], seen = new Set<string>()
  ;(option.sets ?? []).forEach((set, k) => { if (!seen.has(set.id)) { seen.add(set.id); out.push({ kind: 'set', set, k, card: byId.get(set.id) }) } })
  model.links.forEach((l, i) => {
    // A reason link (a dissent, a claim against the option) is a reasoning edge, not a cause it works through: it has its own home in the
    // challenge zone (Codex PL-273).
    if (l.kind === 'reason') return
    const other = l.from === option.id ? l.to : l.to === option.id ? l.from : null
    const card = other === null ? undefined : byId.get(other)
    if (card !== undefined && !seen.has(card.id)) { seen.add(card.id); out.push({ kind: 'card', card, link: { l, i } }) }
  })
  // What core says the option rests on (`cards[].rests_on`, by id: a person's own range among them), then what its chance rows name.
  ;(option.rests_on ?? []).forEach((rest, k) => {
    if (seen.has(rest.id)) return
    const card = byId.get(rest.id)
    if (card !== undefined) { seen.add(rest.id); out.push({ kind: 'card', card, link: null }) }
    else if (rest.label != null && rest.label !== '') { seen.add(rest.id); out.push({ kind: 'rest', rest, k }) }
  })
  for (const r of option.rows ?? []) {
    if (r.kind !== 'chance' || r.rests_on === undefined) continue
    for (const id of [...r.rests_on.what_ifs, ...r.rests_on.estimates, ...r.rests_on.approx]) {
      const card = byId.get(id)
      if (card !== undefined && !seen.has(id)) { seen.add(id); out.push({ kind: 'card', card, link: null }) }
    }
  }
  return out
}

/** What matters next for an option, only where core ties it by id: the coach's step, the waits-on items among its inputs, its rests line. */
export function nextOf(view: View, model: ViewModel, option: ViewCard, through: readonly OptionThrough[]) {
  // Tied by id: the option, what it works through, its premises, and the other end of a reason link to it (a dissent is not a cause it
  // works through, but a step about that dissent is about this option).
  const reasons = model.links.flatMap((l) => (l.kind !== 'reason' ? [] : l.to === option.id ? [l.from] : l.from === option.id ? [l.to] : []))
  const ids = new Set<string>([option.id, ...through.map(throughId), ...reasons, ...(option.premises ?? []).flatMap((p) => (p.id == null ? [] : [p.id]))])
  const next = newestNextOf(view.chat)
  const step = next !== null && (next.next.about ?? []).some((a) => ids.has(a)) ? next : null
  const waits = (model.run?.waits_on?.items ?? []).flatMap((it, i) => (ids.has(it.id) && it.text !== '' ? [{ it, i }] : []))
  const rests = (model.run?.rests ?? []).flatMap((r, i) => (r.option === option.id && r.line !== '' ? [{ r, i }] : []))
  return { step, waits, rests }
}

/** A row that presses its card (the canvas selects and centres it; hover rings it). Its name is its own words: core's heading, figure, whose
 *  and link words, so a screen reader hears what a sighted person reads. */
function Press({ id, children, ring }: { id: string; children: React.ReactNode; ring: (id: string | null) => void }) {
  const selected = useCanvasStore((s) => s.selection.nodeIds.has(id))
  return (
    <button type="button" data-rack-press={id} aria-pressed={selected} onClick={() => pressCard(id)}
      onMouseEnter={() => ring(id)} onMouseLeave={() => ring(null)} onFocus={() => ring(id)} onBlur={() => ring(null)}
      className={`-mx-1 block w-[calc(100%+0.5rem)] min-h-[24px] rounded px-1 py-0.5 text-left hover:bg-panel-hover ${ACTION_FOCUS} ${selected ? 'ring-2 ring-text-header' : ''}`}>
      {children}
    </button>
  )
}

function Whose({ by, at, text }: { by: string; at: string; text: string }) {
  return <span className={`${TYPE.meta} block ${by === 'olumi' ? 'text-info' : 'text-text-light'}`} data-rack-whose={by} data-view={at}>{text}</span>
}
const WHOSE_BY = { olumi: 'olumi', mixed: 'mixed', theirs: 'person' } as const

function Through({ t, ring, option }: { t: OptionThrough; ring: (id: string | null) => void; option: string }) {
  if (t.kind === 'set') {
    // One of the option's own settings, in core's words (`sets[k]`): its name, its figure (where it has none, core's words for the gap,
    // drawn as a card's are), whose.
    const s = t.set, at = `${option}.sets.${t.k}`
    const body = (
      <>
        <span className={`${TYPE.body} block text-text-header`} title={s.figure.title}>
          <span data-view={`${at}.label`}>{s.label}</span>{' '}
          {s.figure.text === ''
            ? <span className="text-text-light" data-rack-gap="" data-view={`${at}.figure.title`}>{s.figure.title}</span>
            : <span className="font-medium" data-view={`${at}.figure.text`}>{s.figure.text}</span>}
        </span>
        {s.author == null || s.author === '' ? null : <Whose by={WHOSE_BY[s.whose]} at={`${at}.author`} text={s.author} />}
      </>
    )
    return <li data-rack-through={s.id} data-rack-set={t.k}>{t.card === undefined ? <div className="px-0 py-0.5">{body}</div> : <Press id={s.id} ring={ring}>{body}</Press>}</li>
  }
  if (t.kind === 'rest') {
    // What the option rests on that no card draws: core's name for it and whose it is; nothing to press.
    const r = t.rest, at = `${option}.rests_on.${t.k}`
    return (
      <li data-rack-through={r.id} data-rack-rest-only="">
        <div className="px-0 py-0.5">
          <span className={`${TYPE.body} block text-text-header`} data-view={`${at}.label`}>{r.label}</span>
          {r.author == null || r.author === '' ? null : <Whose by={WHOSE_BY[r.whose]} at={`${at}.author`} text={r.author} />}
        </div>
      </li>
    )
  }
  // An outcome the option works through to (a `through` link from it): its figure is every option's worked-out value, Analysis's to show
  // (ruling 9 Nov); here its name, whose it is and core's words for how the option reaches it.
  // Where core has worked it out per option (`values`), only this option's own value is drawn (`values[k].text`); where it has not, core's
  // words for why (`figure.text`, e.g. "waits on: …").
  const outcome = t.link !== null && t.link.l.kind === 'through' && t.link.l.from === option
  const c = t.card, mine = outcome && Array.isArray(c.values) ? c.values.findIndex((v) => v.option === option) : -1
  const f = outcome && Array.isArray(c.values) ? null : c.figure
  const gap = f != null && f.text === ''
  return (
    <li data-rack-through={c.id}>
      <Press id={c.id} ring={ring}>
        <span className={`${TYPE.body} block text-text-header`}>
          <span data-view={`${c.id}.heading`}>{c.heading}</span>
          {f == null ? null : gap
            ? <> <span className="text-text-light" data-rack-gap="" data-view={`${c.id}.figure.title`}>{f.title}</span></>
            : <> <span className="font-medium" data-view={`${c.id}.figure.text`}>{f.text}</span></>}
          {mine < 0 ? null : <> <span className="font-medium" data-rack-own-value="" data-view={`${c.id}.values.${mine}.text`}>{c.values![mine]!.text}</span></>}
        </span>
        {c.author == null ? null : <Whose by={c.author.by} at={`${c.id}.author.text`} text={c.author.text} />}
        {t.link === null || t.link.l.title === '' ? null : (
          // Set a hair below whose it is, so the two grey lines (whose; how the option reaches it) read as two.
          <span className={`${TYPE.meta} mt-0.5 block text-text-light`} data-rack-link={t.link.i}>
            <span data-view={`links.${t.link.i}.title`}>{t.link.l.title}</span>
            {t.link.l.effect == null ? null : <> · <span data-view={`links.${t.link.i}.effect.text`}>{t.link.l.effect.text}</span></>}
          </span>
        )}
      </Press>
    </li>
  )
}

const Head = ({ children }: { children: string }) => <p className={`${TYPE.meta} m-0 font-medium text-text-light`}>{children}</p>

export function Rack({ model, view }: { model: ViewModel; view: View | null }) {
  const options = optionCards(model)
  const [hover, setHover] = useState<string | null>(null)
  const present = new Set(model.cards.map((c) => c.id))
  useEffect(() => { ringFrom('rack', hover !== null && present.has(hover) ? [hover] : []) }, [hover]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => ringFrom('rack', []), [])
  if (options.length === 0) return null
  // A premise in the same words as a challenged card's reason is that challenge, drawn in the tab's challenge zone (SC-02): not again here.
  const challenged = challengedReasons(model)
  return (
    <section data-testid="view-reasoning-rack" aria-label={RACK_LABEL} className="space-y-2">
      <button type="button" data-testid="view-reasoning-see-chances" onClick={() => useUIStore.getState().forceActivateOutputTab('results')}
        className={`${TYPE.meta} inline-flex min-h-[24px] cursor-pointer items-center text-text-body underline underline-offset-2 hover:text-text-header ${ACTION_FOCUS}`}>{SEE_CHANCES}</button>
      {options.map((o) => {
        const through = throughOf(model, o), premises = (o.premises ?? []).flatMap((p, j) => (challenged.has(p.text) ? [] : [{ p, j }]))
        const nx = view === null ? { step: null, waits: [], rests: [] } : nextOf(view, model, o, through)
        const hasNext = nx.step !== null || nx.waits.length + nx.rests.length > 0
        return (
          <div key={o.id} className="space-y-2 rounded-xl border border-panel-border p-2" data-rack-option={o.id}>
            <Press id={o.id} ring={setHover}>
              <span className={`${typography.panelHeader} block text-text-header`} data-view={`${o.id}.heading`}>{o.heading}</span>
              {o.author == null ? null : <span className={`${TYPE.meta} block ${o.author.by === 'olumi' ? 'text-info' : 'text-text-light'}`} data-view={`${o.id}.author.text`}>{o.author.text}</span>}
            </Press>
            {/* SCI-12b (JOIN-10, DL 11 Nov): where this option's chance is worked out beside a recorded dissent, core's sentence for it, verbatim
                (whose version the number uses, what is disputed, whose view, and that it is not in the number). Core sends it only where the
                chance has a number; nothing is computed here. */}
            {(o.disputed ?? []).every((d) => d.line === '') ? null : (
              <div data-rack-section="disputed" className="space-y-1">
                {(o.disputed ?? []).map((d, k) => (d.line === '' ? null : <p key={d.id} className={`${TYPE.body} m-0 text-text-body`} data-rack-disputed={d.id} data-view={`${o.id}.disputed.${k}.line`}>{d.line}</p>))}
              </div>
            )}
            {through.length === 0 ? null : (
              <div data-rack-section="through"><Head>{RACK_LABELS.through}</Head>
                <ul className="m-0 list-none space-y-1 p-0">{through.map((t) => <Through key={throughId(t)} t={t} ring={setHover} option={o.id} />)}</ul></div>
            )}
            {premises.length === 0 ? null : (
              <div data-rack-section="premises"><Head>{RACK_LABELS.premises}</Head>
                {/* Keyed by its place (core may send a premise with no id). Not a press of its own: it is on the option's card, which the
                    heading above presses; Olumi's mark follows its words, as in the tab's door. */}
                <ul className="m-0 list-none space-y-1 p-0">{premises.map(({ p, j }) => (
                  <li key={j} data-rack-premise={p.id ?? undefined} className={`${TYPE.body} flex gap-1.5 py-0.5 text-text-body`} title={p.title}>
                    <span aria-hidden="true" className="text-text-light" data-view={`${o.id}.premises.${j}.glyph`}>{p.glyph}</span>
                    <span>
                      <span data-view={`${o.id}.premises.${j}.text`}>{p.text}</span>
                      {p.olumi == null ? null : <>{' '}<span className="text-info" title={p.olumi.title} aria-label={p.olumi.title} data-view={`${o.id}.premises.${j}.olumi.glyph`}>{p.olumi.glyph}</span></>}
                    </span>
                  </li>
                ))}</ul></div>
            )}
            {!hasNext ? null : (
              <div data-rack-section="next" className="space-y-1"><Head>{RACK_LABELS.next}</Head>
                {nx.step === null ? null : (
                  <p className={`${TYPE.body} m-0`} data-rack-next="step"><span className="font-medium text-text-header" data-view={`chat.${nx.step.k}.answer.next.label`}>{nx.step.next.label}</span>{' '}
                    <Words parts={nx.step.next.text} at={`chat.${nx.step.k}.answer.next.text`} first={nx.step.first} /></p>
                )}
                {nx.waits.map(({ it, i }) => (
                  <p key={it.id} className={`${TYPE.body} m-0`} title={it.title} data-rack-next="waits">
                    <span className="text-text-light" data-view="run.waits_on.label">{model.run!.waits_on!.label}</span>{' '}<span data-view={`run.waits_on.items.${i}.text`}>{it.text}</span>
                  </p>
                ))}
                {nx.rests.map(({ r, i }) => <p key={r.id} className={`${TYPE.body} m-0 text-text-body`} title={r.hover} data-rack-next="rests" data-view={`run.rests.${i}.line`}>{r.line}</p>)}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
