/**
 * Each option's reasoning (Paul, 11 Nov, PL-252: a credible Reasoning tab is required; Codex's narrow design: rows from core's View only,
 * no invented cells). It replaces the redesign's Z3 rack of marks, whose source (`cards[].rests_on`) the rebuilt path leaves empty on
 * real boards. The chances stay in Analysis (DL ruling 9 Nov): one link there, and no chance is drawn here. Per option, in core's order:
 *   - its heading (press: the canvas selects and centres its card; hover rings it) and whose idea it is (`author.text`);
 *   - What it works through: every link core draws to or from the option except a reason link (a dissent: its home is the challenge
 *     zone; Codex PL-273), in core's order (`model.links`), each row the other card's
 *     heading, its figure (`figure.text`; where core has none, core's own words for the gap, `figure.title`; for an outcome the option works
 *     through to that core has worked out per option, only this option's own value, `values[k].text`), whose it is (`author.text`)
 *     and core's words for the link (`links[].title`, with `effect.text` where core sizes it); then each card core says the option rests on
 *     (`cards[].rests_on`, by id), then each its chance rows name (`rows[].rests_on`), not already listed. Every row presses its card;
 *   - Assumptions and evidence: the option's own premises (`cards[].premises`, core's glyph, words and Olumi mark); they are said here and
 *     not again in the tab's "Assumptions and evidence" door; one in the same words as a challenged card's reason is that challenge, said in
 *     the tab's challenge zone, so not here;
 *   - What matters next: only where core ties it to this option by id: the coach's next step whose `about` names the option, a card listed
 *     above or one of its premises (`chat[].answer.next`); a figure the chances wait on that is listed above (`run.waits_on.items`); and core's
 *     line on how much of this option's chance rests on Olumi's guesses (`run.rests[]` for this option).
 * A cell with nothing from core is left out, never filled. The section labels are the tab's own; every other word is core's, verbatim.
 */
import { useEffect, useState } from 'react'
import type { ViewCard, ViewModel, View } from '../client'
import { newestNextOf, optionCards } from '../layout'
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
export type OptionThrough = { readonly card: ViewCard; readonly link: { readonly l: Link; readonly i: number } | null }

/** What an option works through, in core's order: each link to or from it (the other card, by id), then each card its chance rows rest on. */
export function throughOf(model: ViewModel, option: ViewCard): OptionThrough[] {
  const byId = new Map(model.cards.map((c) => [c.id, c]))
  const out: OptionThrough[] = [], seen = new Set<string>()
  model.links.forEach((l, i) => {
    // A reason link (a dissent, a claim against the option) is a reasoning edge, not a cause it works through: it has its own home in the
    // challenge zone (Codex PL-273).
    if (l.kind === 'reason') return
    const other = l.from === option.id ? l.to : l.to === option.id ? l.from : null
    const card = other === null ? undefined : byId.get(other)
    if (card !== undefined && !seen.has(card.id)) { seen.add(card.id); out.push({ card, link: { l, i } }) }
  })
  // What core says the option rests on (`cards[].rests_on`, by id: a person's own range among them), then what its chance rows name.
  for (const r of option.rests_on ?? []) {
    const card = byId.get(r.id)
    if (card !== undefined && !seen.has(r.id)) { seen.add(r.id); out.push({ card, link: null }) }
  }
  for (const r of option.rows ?? []) {
    const ro = (r as { rests_on?: { what_ifs?: string[]; estimates?: string[]; approx?: string[] } | null }).rests_on
    for (const id of [...(ro?.what_ifs ?? []), ...(ro?.estimates ?? []), ...(ro?.approx ?? [])]) {
      const card = byId.get(id)
      if (card !== undefined && !seen.has(id)) { seen.add(id); out.push({ card, link: null }) }
    }
  }
  return out
}

/** What matters next for an option, only where core ties it by id: the coach's step, the waits-on items among its inputs, its rests line. */
export function nextOf(view: View, model: ViewModel, option: ViewCard, through: readonly OptionThrough[]) {
  // Tied by id: the option, what it works through, its premises, and the other end of a reason link to it (a dissent is not a cause it
  // works through, but a step about that dissent is about this option).
  const reasons = model.links.flatMap((l) => (l.kind !== 'reason' ? [] : l.to === option.id ? [l.from] : l.from === option.id ? [l.to] : []))
  const ids = new Set<string>([option.id, ...through.map((t) => t.card.id), ...reasons, ...(option.premises ?? []).flatMap((p) => (p.id == null ? [] : [p.id]))])
  const next = newestNextOf(view.chat)
  const step = next !== null && (next.next.about ?? []).some((a) => ids.has(a)) ? next : null
  const waits = (model.run?.waits_on?.items ?? []).flatMap((it, i) => (ids.has(it.id) && it.text !== '' ? [{ it, i }] : []))
  const rests = (model.run?.rests ?? []).flatMap((r, i) => (r.option === option.id && r.line !== '' ? [{ r, i }] : []))
  return { step, waits, rests }
}

function Press({ id, children, label, ring }: { id: string; children: React.ReactNode; label: string; ring: (id: string | null) => void }) {
  const selected = useCanvasStore((s) => s.selection.nodeIds.has(id))
  return (
    <button type="button" data-rack-press={id} aria-pressed={selected} aria-label={label} onClick={() => pressCard(id)}
      onMouseEnter={() => ring(id)} onMouseLeave={() => ring(null)} onFocus={() => ring(id)} onBlur={() => ring(null)}
      className={`-mx-1 block w-[calc(100%+0.5rem)] min-h-[24px] rounded px-1 py-0.5 text-left hover:bg-panel-hover ${ACTION_FOCUS} ${selected ? 'ring-2 ring-text-header' : ''}`}>
      {children}
    </button>
  )
}

function Through({ t, ring, option }: { t: OptionThrough; ring: (id: string | null) => void; option: string }) {
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
      <Press id={c.id} label={c.heading} ring={ring}>
        <span className={`${TYPE.body} block text-text-header`}>
          <span data-view={`${c.id}.heading`}>{c.heading}</span>
          {f == null ? null : gap
            ? <> <span className="text-text-light" data-rack-gap="" data-view={`${c.id}.figure.title`}>{f.title}</span></>
            : <> <span className="font-medium" data-view={`${c.id}.figure.text`}>{f.text}</span></>}
          {mine < 0 ? null : <> <span className="font-medium" data-rack-own-value="" data-view={`${c.id}.values.${mine}.text`}>{c.values![mine]!.text}</span></>}
        </span>
        {c.author == null ? null : <span className={`${TYPE.meta} block ${c.author.by === 'olumi' ? 'text-info' : 'text-text-light'}`} data-rack-whose={c.author.by} data-view={`${c.id}.author.text`}>{c.author.text}</span>}
        {t.link === null || t.link.l.title === '' ? null : (
          <span className={`${TYPE.meta} block text-text-light`} data-rack-link={t.link.i}>
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
  return (
    <section data-testid="view-reasoning-rack" aria-label={RACK_LABEL} className="space-y-2">
      <button type="button" data-testid="view-reasoning-see-chances" onClick={() => useUIStore.getState().forceActivateOutputTab('results')}
        className={`${TYPE.meta} inline-flex min-h-[24px] cursor-pointer items-center text-text-body underline underline-offset-2 hover:text-text-header ${ACTION_FOCUS}`}>{SEE_CHANCES}</button>
      {options.map((o) => {
        // A premise in the same words as a challenged card's reason is that challenge, drawn in the tab's challenge zone (SC-02): not again here.
        const challenged = new Set(model.cards.flatMap((c) => (c.challenged === true && c.reason !== null ? [c.reason] : [])))
        const through = throughOf(model, o), premises = (o.premises ?? []).flatMap((p, j) => (challenged.has(p.text) ? [] : [{ p, j }]))
        const nx = view === null ? { step: null, waits: [], rests: [] } : nextOf(view, model, o, through)
        const hasNext = nx.step !== null || nx.waits.length + nx.rests.length > 0
        return (
          <div key={o.id} className="space-y-2 rounded-xl border border-panel-border p-2" data-rack-option={o.id}>
            <Press id={o.id} label={o.heading} ring={setHover}>
              <span className={`${typography.panelHeader} block text-text-header`} data-view={`${o.id}.heading`}>{o.heading}</span>
              {o.author == null ? null : <span className={`${TYPE.meta} block ${o.author.by === 'olumi' ? 'text-info' : 'text-text-light'}`} data-view={`${o.id}.author.text`}>{o.author.text}</span>}
            </Press>
            {through.length === 0 ? null : (
              <div data-rack-section="through"><Head>{RACK_LABELS.through}</Head>
                <ul className="m-0 list-none space-y-1 p-0">{through.map((t) => <Through key={t.card.id} t={t} ring={setHover} option={o.id} />)}</ul></div>
            )}
            {premises.length === 0 ? null : (
              <div data-rack-section="premises"><Head>{RACK_LABELS.premises}</Head>
                <ul className="m-0 list-none space-y-1 p-0">{premises.map(({ p, j }) => (
                  <li key={p.id} data-rack-premise={p.id}>
                    <Press id={o.id} label={p.text} ring={setHover}>
                      <span className={`${TYPE.body} flex gap-1.5 text-text-body`} title={p.title}>
                        <span aria-hidden="true" className="text-text-light" data-view={`${o.id}.premises.${j}.glyph`}>{p.glyph}</span>
                        <span data-view={`${o.id}.premises.${j}.text`}>{p.text}</span>
                        {p.olumi == null ? null : <span className="text-info" title={p.olumi.title} aria-label={p.olumi.title} data-view={`${o.id}.premises.${j}.olumi.glyph`}>{p.olumi.glyph}</span>}
                      </span>
                    </Press>
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
                {nx.rests.map(({ r, i }) => <p key={r.id} className={`${TYPE.meta} m-0 text-text-body`} title={r.hover} data-rack-next="rests" data-view={`run.rests.${i}.line`}>{r.line}</p>)}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
