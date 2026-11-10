/**
 * The crafted evidence disclosure (`components/results/analysis-hero/HeroEvidenceDisclosure.tsx`), ported onto olumi.view/3: the same
 * full-width toggle with its rotating chevron, the same chip row between views, the same magnitude track. Each view is core's, drawn only
 * when core sends it, every line verbatim at its View path with core's hover:
 * - Drivers: what moves each option's chance most (`cards[].driver`), with v10's low→high marker and core's line on what the two chances
 *   are (`run.sensitivity`), once;
 * - What would have to be true (`run.tipping`, under core's `tipping_heading`, and an aim's silent line);
 * - How much rests on Olumi's guesses (D8 `run.rests`, under core's `rests_heading`; core sends lines only where Olumi's ranges hold the
 *   largest share; the shares place nothing here and are never drawn as numbers);
 * - What could go wrong (D5 `run.failure`, under core's `failure_heading`; core fills it only for an option someone committed to, so
 *   before that there is no chip and no heading);
 * - Compared (`run.compared`, each group under core's `compared_headings`);
 * - Worth checking first (`run.science` worth lines), with a slot for each figure's give control.
 * Core keeps no ranked factor list and no trade-offs beyond `run.compared` (core-port-fields, 7 Nov), so the crafted "Ranked by effect"
 * note and the trade-offs view are not drawn. Nothing at all when core sends none of these.
 */
import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ViewModel, ViewRun } from '../client'
import { comparedGroupsOf, failureOf, restsOf, tippingOf, worthLinesOf } from '../layout'
import { driverRange, figureCard, Sensitivity, sensitivityShown } from '../ViewChances'
import { driverCardsOf, drawnByRows } from './pick'
import { TYPE } from './type'

export type EvidenceViewKey = 'drivers' | 'tipping' | 'rests' | 'failure' | 'compared' | 'worth'
type ViewKey = EvidenceViewKey
type Science = NonNullable<ViewRun['science']>[number]

/** The crafted 6px track (prototype .evidence-bar) carrying v10's low→high marker: positions only, never drawn as numbers. */
function DriverTrack({ id, lowPct, highPct }: { id: string; lowPct: number; highPct: number }) {
  const left = Math.min(lowPct, highPct), width = Math.max(2, Math.abs(highPct - lowPct))
  return (
    <span aria-hidden="true" data-testid={`port-evidence-driver-track-${id}`} className="relative block h-1.5 w-full rounded-full bg-panel-border">
      <span className="absolute top-0 h-full rounded-full bg-info" style={{ left: `${left}%`, width: `${width}%` }} />
      <span className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-info bg-panel" style={{ left: `${lowPct}%` }} />
      <span className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-info" style={{ left: `${highPct}%` }} />
    </span>
  )
}

export interface HeroEvidenceDisclosureProps {
  model: ViewModel
  /** Open at first (the crafted disclosure starts closed). */
  defaultOpen?: boolean
  /** Mounted under one worth line (e.g. its figure's give words and ✎, `science[].figure.give`). */
  giveAction?: (line: Science, i: number) => ReactNode
  /** Views another section of the tab already draws (UI recovery, 10 Nov: the previous product's own sections are back), left out here so
   *  each thing is still said once (SC-02). */
  omit?: readonly EvidenceViewKey[]
}

export function HeroEvidenceDisclosure({ model, defaultOpen = false, giveAction, omit = [] }: HeroEvidenceDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [picked, setView] = useState<ViewKey | null>(null)
  const run = model.run ?? null
  // Say each thing once (SC-02): each option's driver sentence and its own tipping lines are drawn under its row (HeroOptionRow, at rest);
  // here only what no row says: core's sensitivity line, a driver no row draws, a tipping line no row draws, and each aim's silent line.
  const said = drawnByRows(model)
  const drivers = driverCardsOf(model).filter((c) => !said.drivers.has(c.id))
  const tippingAll = tippingOf(run)
  const tipping = tippingAll === null ? null : { ...tippingAll, lines: tippingAll.lines.filter(({ i }) => !said.tipping.has(i)) }
  const tippingLeft = tipping !== null && tipping.lines.length + tipping.silent.length > 0
  const compared = comparedGroupsOf(run)
  const rests = restsOf(run)
  const failure = failureOf(run)
  const worth = run?.science == null ? [] : worthLinesOf(run.science)
  const views = ([
    { key: 'drivers', label: 'Drivers', view: undefined, present: drivers.length > 0 || sensitivityShown(model) },
    { key: 'tipping', label: tipping?.heading ?? '', view: 'run.tipping_heading', present: tippingLeft },
    { key: 'rests', label: rests?.heading ?? '', view: 'run.rests_heading', present: rests !== null },
    { key: 'failure', label: failure?.heading ?? '', view: 'run.failure_heading', present: failure !== null },
    { key: 'compared', label: 'Trade-offs', view: undefined, present: compared.length > 0 },
    { key: 'worth', label: 'Worth checking first', view: undefined, present: worth.length > 0 },
  ] as const).flatMap((v) => (v.present && !omit.includes(v.key) ? [v] : []))
  if (views.length === 0) return null
  const active: ViewKey = views.some((v) => v.key === picked) ? picked! : views[0]!.key

  return (
    <div className="pt-1" data-testid="port-evidence-disclosure">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="port-evidence-toggle"
        className="flex w-full items-center gap-2 rounded px-1 py-1.5 text-left transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info">
        {/* One view left (the tab's own sections draw the rest): the toggle says that view's own name, never a wider promise. */}
        <span className={`${TYPE.body} min-w-0 flex-1 font-medium text-text-header`} data-view={views.length === 1 ? views[0]!.view : undefined}>{views.length === 1 ? views[0]!.label : 'Why and what could change it'}</span>
        <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 flex-none text-text-light transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </button>

      {!open ? null : (
        <div className={`${TYPE.body} mt-2 space-y-2`}>
          {views.length < 2 ? null : (
            <div className="flex flex-wrap gap-1">
              {views.map((v) => (
                <button key={v.key} type="button" aria-pressed={active === v.key} onClick={() => setView(v.key)} data-testid={`port-evidence-tab-${v.key}`} data-view={v.view}
                  className={`rounded-full px-2 py-0.5 ${TYPE.meta} ${active === v.key ? 'bg-primary text-text-on-color' : 'border border-panel-border bg-transparent text-text-light hover:text-text-body'}`}>
                  {v.label}
                </button>
              ))}
            </div>
          )}

          {active !== 'drivers' ? null : (
            <div className="space-y-2" data-testid="port-evidence-drivers">
              <Sensitivity model={model} />
              {drivers.map((card) => {
                const d = card.driver!, range = driverRange(d), figure = figureCard(model, d)
                return (
                  <div key={card.id} className="space-y-1" data-testid="port-evidence-driver" data-option-id={card.id} title={d.title}>
                    <p className="font-medium text-text-header" data-view={`${card.id}.heading`}>{card.heading}</p>
                    <p className="text-text-body" data-view={`${card.id}.driver.text`}>{d.text}</p>
                    {range === null ? null : <DriverTrack id={card.id} lowPct={range.lowPct} highPct={range.highPct} />}
                    {figure === null ? null : <p className={`${TYPE.meta} text-text-light`} data-view={`${figure.id}.heading`}>{figure.heading}</p>}
                  </div>
                )
              })}
            </div>
          )}

          {active !== 'tipping' || tipping === null ? null : (
            <div className="space-y-1.5" data-testid="port-evidence-tipping">
              {views.length < 2 ? <p className="font-medium text-text-header" data-view="run.tipping_heading">{tipping.heading}</p> : null}
              {tipping.lines.map(({ line: l, i }) => (
                <p key={l.id} title={l.hover} data-view-fact={l.id}>
                  {l.olumi == null ? null : <><span title={l.olumi.title} aria-label={l.olumi.title}>{l.olumi.glyph}</span> </>}
                  <span data-view={`run.tipping.${i}.line`}>{l.line}</span>
                </p>
              ))}
              {tipping.silent.map((s) => <p key={s.aim} className="text-text-light" data-view-silent={s.aim}>{s.line}</p>)}
            </div>
          )}

          {([['rests', rests, 'run.rests'], ['failure', failure, 'run.failure']] as const).map(([key, facts, path]) => (active !== key || facts === null ? null : (
            <div key={key} className="space-y-1.5" data-testid={`port-evidence-${key}`}>
              {views.length < 2 ? <p className="font-medium text-text-header" data-view={`${path}_heading`}>{facts.heading}</p> : null}
              {facts.lines.map(({ line: l, i }) => <p key={l.id} title={l.hover} data-view-fact={l.id}><span data-view={`${path}.${i}.line`}>{l.line}</span></p>)}
            </div>
          )))}

          {active !== 'compared' ? null : (
            <div className="space-y-3" data-testid="port-evidence-compared">
              {compared.map(({ group, heading, lines }) => (
                <div key={group} className="space-y-1" data-testid={`port-evidence-compared-${group}`}>
                  <p className="font-medium text-text-header" data-view={`run.compared_headings.${group}`}>{heading}</p>
                  {lines.map(({ line: l, i }) => (
                    <p key={l.id} title={l.hover} data-view-fact={l.id}>
                      {l.olumi === null ? null : <><span title={l.olumi.title} aria-label={l.olumi.title} data-view={`run.compared.${i}.olumi.glyph`}>{l.olumi.glyph}</span> </>}
                      <span data-view={`run.compared.${i}.line`}>{l.line}</span>
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}

          {active !== 'worth' ? null : (
            <div className="space-y-1.5" data-testid="port-evidence-worth">
              {worth.map(({ line: l, i }) => (
                <div key={l.id} title={l.hover} data-view-fact={l.id}>
                  <p>
                    {l.olumi === null ? null : <><span title={l.olumi.title} aria-label={l.olumi.title} data-view={`run.science.${i}.olumi.glyph`}>{l.olumi.glyph}</span> </>}
                    <span data-view={`run.science.${i}.line`}>{l.line}</span>
                    {l.figure?.mark == null ? null : <> <span title={l.figure.mark.title} aria-label={l.figure.mark.title} data-view={`run.science.${i}.figure.mark.glyph`}>{l.figure.mark.glyph}</span></>}
                  </p>
                  {giveAction === undefined ? null : <div className={TYPE.meta}>{giveAction(l, i)}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default HeroEvidenceDisclosure
