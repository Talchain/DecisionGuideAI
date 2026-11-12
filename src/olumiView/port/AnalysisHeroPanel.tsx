/**
 * The crafted analysis hero (`components/results/analysis-hero/AnalysisHeroPanel.tsx`), ported onto olumi.view/3: the same answer-first
 * order (headline and subline, lens tabs, option rows with their disclosure, then the lower sections and the next step) and the same marks.
 * Props only: it reads the View slice it is given and nothing else, so the caller mounts it anywhere (the UI session wires it into the tabs).
 *
 * Every word is core's, at its View path (`data-view`):
 * - the headline is the Run's lead (`run.lead`), the panel's one 18px line;
 * - the subline is the most likely line (`run.most_likely`), core's hover on it;
 * - when every option waits, core's waits-on headline; a reason every option shares, once (`run.shared_blockers`);
 * - each aim's rows under that aim's own words (`row.aim`), core's reading of it (`run.readings`) and, when every option's chance for it
 *   rests on one line, that line once (`run.shared_rests`), each option in card order;
 * - Olumi's timing assumptions, what the chances wait on, and the coach's newest next step.
 *
 * The crafted panel's composed sentences ("has the highest expected outcome"), status chip, quick pills, rank badges and trust line are
 * not ported: core sends none of them. No win share is in the View, so none is drawn; the chance is the headline (DL #87).
 * An absent field draws nothing, never a placeholder sentence.
 */
import { useId, useState, type ReactNode } from 'react'
import type { ViewCard, ViewModel, ViewRun, ViewTurn } from '../client'
import { newestNextOf, optionCards } from '../layout'
import { figureCard, mostLikelyHover, SharedBlockers, TimingAssumptions } from '../ViewChances'
import { Words } from '../ViewChat'
import { mostLikelyBasisOf } from '../standin'
import { HeroHeadlineAlone, HeroOptionRow, type HeroLensId } from './HeroOptionRow'
import { LensTabs, lensTabId } from './LensTabs'
import { aimGroupsOf, headlinesAloneOf, lensAimOf, lensesOf, outcomeDomainOf, tippingFor, type AimRow } from './pick'
import { TYPE } from './type'

/** The crafted panel's surface: the panel colour and a full border, never a single side. */
export const PORT_BOX = 'space-y-3 rounded-lg border border-panel-border bg-panel p-3'
const NBSP = ' '

type WaitsOn = NonNullable<ViewRun['waits_on']>

/** What the chances wait on, each item core's words with its hover; a figure no one can size yet says so in the headline only. */
function WaitsOnItems({ w, unknown }: { w: WaitsOn; unknown: boolean }) {
  return (
    <>
      {w.items.map((it, i) => (
        <span key={it.id} title={it.title}>
          <span data-view={`run.waits_on.items.${i}.text`}>{it.text}</span>
          {unknown && it.unknown !== null ? <span data-view={`run.waits_on.items.${i}.unknown`}>{it.unknown}</span> : null}
          {i < w.items.length - 1 ? ', ' : null}
        </span>
      ))}
    </>
  )
}

export interface AnalysisHeroPanelProps {
  /** The model as shown (the approved one, or a held proposal's): the caller picks which. */
  model: ViewModel
  /** The conversation, for the coach's newest next step. */
  chat?: readonly ViewTurn[] | null
  /** Mounted after the most likely line (e.g. the ✎ for the figure it rests on). */
  mostLikelyAction?: ReactNode
  /** Mounted after the next step's words (e.g. the conversation's move tap). */
  nextAction?: ReactNode
  /** Mounted at the end of one row's detail (e.g. its figure's ✎). */
  rowAction?: (entry: AimRow) => ReactNode
  /** The lower sections, under the rows (the evidence disclosure, act on it). */
  children?: ReactNode
  /** The caller draws each figure the chances wait on as its own row below (Focus now), so the head names none of them (SC-02, once). */
  waitsBelow?: boolean
  /** The caller draws the coach's next step in its own section below (Focus now), so the panel does not say it again. */
  nextBelow?: boolean
  /** The caller draws every "what would have to be true" line in its own section below (Stress test), so no row's detail repeats one. */
  tippingBelow?: boolean
}

export function AnalysisHeroPanel({ model, chat = null, mostLikelyAction, nextAction, rowAction, children, waitsBelow = false, nextBelow = false, tippingBelow = false }: AnalysisHeroPanelProps) {
  const panelId = useId()
  const run = model.run ?? null
  const lenses = lensesOf(run)
  const [picked, setLens] = useState<HeroLensId | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  if (run === null) return null

  const groups = aimGroupsOf(model)
  // AN-01: an option whose headline has no row is drawn in its aim's group, in its place in core's card order among the other options'
  // rows (not after them); with no group for that aim, in one of its own.
  const alone = headlinesAloneOf(model)
  const lone = [...new Set(alone.map((c) => c.headline!.aim_id))].filter((a) => !groups.some((g) => g.aimId === a))
  // Core's lenses are about one aim, the one its lens titles and most likely line name (`run.most_likely.aim_id`): the strip and the
  // outcome lens apply to that aim's group only; every other group stays on the chance. No such aim drawn here, no strip (checker, 7 Nov).
  const lensAim = lensAimOf(run)
  // The aim core's lead speaks of (its most-likely line's aim): the lead names it, so its group does not say it again.
  const leadNamesIt = (aimId: string | null) => run.lead != null && lensAim !== null && aimId === lensAim
  const scoped = lenses.length > 0 && lensAim !== null && groups.some((g) => g.aimId === lensAim)
  const lens: HeroLensId = !scoped ? 'goal' : picked !== null && lenses.some((l) => l.id === picked) ? picked : lenses[0]!.id
  const allWait = run.all_withheld && run.waits_on !== null
  const ml = run.most_likely
  const next = newestNextOf(chat)
  const figureOf = (card: ViewCard) => (card.driver == null ? null : figureCard(model, card.driver))
  // A run with nothing for the hero to say (a pending first model: no lead, no aim, no option row) draws no empty box (Paul's A11 board,
  // 12 Nov); what the caller mounts below the hero still draws, unboxed.
  const says = run.lead != null || allWait || (run.shared_blockers?.length ?? 0) > 0 || groups.length > 0 || lone.length > 0 || ml != null || (run.timing?.length ?? 0) > 0
    || (run.waits_on !== null && !waitsBelow) || (next !== null && !nextBelow)
  if (!says) return <>{children}</>

  return (
    <section className={`${TYPE.body} ${PORT_BOX}`} data-testid="port-analysis-hero">
      <div className="space-y-1.5" data-testid="port-hero-head">
        {run.lead == null ? null : <h3 className={`${TYPE.headline} text-text-header`} data-view="run.lead">{run.lead}</h3>}
        {!allWait ? null : (
          <div data-testid="port-hero-waits-headline">
            <p className={`${TYPE.meta} text-text-light`} data-view="run.waits_on.head">{run.waits_on!.head}</p>
            <p><span data-view="run.waits_on.text">{run.waits_on!.text}</span>{waitsBelow ? null : <>{': '}<WaitsOnItems w={run.waits_on!} unknown /></>}</p>
          </div>
        )}
        <SharedBlockers run={run} />
      </div>

      <div className="space-y-3" data-testid="port-hero-chart">
          {groups.map((g) => {
            const domain = outcomeDomainOf(g.rows)
            const withTabs = scoped && g.aimId === lensAim && lenses.length > 1
            const gLens: HeroLensId = scoped && g.aimId === lensAim ? lens : 'goal'
            return (
              <div key={g.aimId ?? ''} className="space-y-0.5" data-testid="port-aim-group" data-aim={g.aimId ?? ''} data-lens={gLens}
                aria-label={g.aim !== null && leadNamesIt(g.aimId) ? g.aim.text : undefined}>
                {/* The aim core's lead already names is said once, there (craft pass, 8 Nov: the grade found it said twice); its group keeps
                    the aim as its accessible name. Any other aim keeps its heading. */}
                {g.aim === null || leadNamesIt(g.aimId) ? null : <p className={`${TYPE.meta} px-2 text-text-light`} data-testid="port-aim-heading" data-view={g.aim.at}>{g.aim.text}</p>}
                {/* P1 (DL 10 Nov): core's reading of an aim (`run.readings`) is said once, on that aim's own card (ViewCardNode readingOf); the
                    panel no longer repeats it. */}
                {/* SC-02 (core run.shared_rests): what every option's chance for this aim rests on, when it is one line for all of them, said once
                    here; core takes it off each row. */}
                {(run.shared_rests ?? []).map((r, i) => (r.aim_id !== g.aimId ? null : <p key={`rests${i}`} className={`${TYPE.meta} px-2 text-text-light`} data-testid="port-aim-rests" data-view={`run.shared_rests.${i}.text`}>{r.text}</p>))}
                {withTabs ? <div className="px-2 py-1"><LensTabs lenses={lenses} active={lens} onSelect={setLens} panelId={panelId} /></div> : null}
                <div role={withTabs ? 'tabpanel' : undefined} id={withTabs ? panelId : undefined} aria-labelledby={withTabs ? lensTabId(panelId, lens) : undefined}>
                {/* Each option in core's card order: its rows for this aim, or (AN-01) its headline on its own where it has none. */}
                {optionCards(model).flatMap((c) => [...g.rows.filter((e) => e.card === c).map((entry) => {
                  const key = `${entry.card.id}.rows.${entry.i}`
                  return (
                    <HeroOptionRow
                      key={key}
                      entry={entry}
                      lens={gLens}
                      isOpen={open === key}
                      onToggle={() => setOpen((o) => (o === key ? null : key))}
                      domain={domain}
                      tipping={tippingBelow ? [] : tippingFor(run, entry.card.id, g.aimId)}
                      figure={figureOf(entry.card)}
                    >
                      {rowAction?.(entry)}
                    </HeroOptionRow>
                  )
                }), ...(alone.includes(c) && c.headline!.aim_id === g.aimId ? [<HeroHeadlineAlone key={`${c.id}.headline`} card={c} named={g.aim !== null} />] : [])])}
                </div>
              </div>
            )
          })}
          {lone.map((a) => (
            <div key={`alone:${a ?? ''}`} className="space-y-0.5" data-testid="port-aim-group" data-aim={a ?? ''} data-lens="goal">
              {alone.filter((c) => c.headline!.aim_id === a).map((c) => <HeroHeadlineAlone key={`${c.id}.headline`} card={c} named={false} />)}
            </div>
          ))}
      </div>

      {/* Core's which-option-leads line, after the options it speaks of (craft pass, 8 Nov: the grade found it pushing the options below
          the fold). Core's lead ends with a colon and introduces the options; its words are unchanged. */}
      {ml == null ? null : (
          <p className="text-text-body" data-testid="port-hero-most-likely" title={mostLikelyHover(ml)} data-view-hover={mostLikelyBasisOf(ml).rests_on_text === null ? undefined : 'run.most_likely.rests_on_text'}>
            <span data-view="run.most_likely.text">{ml.text}</span>
            {ml.if_approved == null ? null : <>{NBSP}<span data-view="run.most_likely.if_approved.glyph" title={ml.if_approved.title} aria-label={ml.if_approved.title}>{ml.if_approved.glyph}</span></>}
            {mostLikelyAction == null ? null : <> {mostLikelyAction}</>}
          </p>
        )}
      <TimingAssumptions run={run} />
      {run.waits_on === null || allWait || waitsBelow ? null : (
        <p data-testid="port-hero-waits-on"><span data-view="run.waits_on.label">{run.waits_on.label}</span>{' '}<WaitsOnItems w={run.waits_on} unknown={false} /></p>
      )}
      {children}
      {next === null || nextBelow ? null : (
        <div className="flex items-start gap-2" data-testid="port-hero-next">
          <p className="min-w-0 flex-1"><span className="font-medium text-text-header" data-view={`chat.${next.k}.answer.next.label`}>{next.next.label}</span> <Words parts={next.next.text} at={`chat.${next.k}.answer.next.text`} first={next.first} /></p>
          {nextAction}
        </div>
      )}
    </section>
  )
}

export default AnalysisHeroPanel
