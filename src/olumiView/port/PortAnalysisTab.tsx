/** The Results tab draws the selected aim and keeps the longer reading behind one fold. */
import { useId, useState } from 'react'
import type { ViewModel } from '../client'
import { FigureEdit } from '../FigureEdit'
import { shownModel, useViewStore } from '../store'
import { WhatIfShown } from '../ViewChances'
import { StateStrip, useTabState } from '../reasoning/StateStrip'
import { comparedGroupsOf, notesBesideTiming } from '../layout'
import { ChanceChart, tailNoteOf } from './ChanceChart'
import { LikelyOutcome } from './LikelyOutcome'
import { cardOf, chartGroupsOf, limitGroupsOf, rangeOf, tabStateOf, type ChartGroup } from './pick'
import { TYPE } from './type'
import { AimReading, aimReadingOf, FailureAfterYours, optionTippingOf, TippingPerOption, useFailureReading, WorthReading, worthReadingOf } from './AnalysisReaders'
import { leadReadingOf, MovesHeading, WhatMovesIt } from './WhatMovesIt'
import { FoldChevron } from '../look/FoldChevron'
import { CHECK_WORDS, checkItemsOf } from '../check/items'
import { prefillComposer } from '../ViewChat'
import { OptionRow } from './OptionRow'
import { COMMITMENT_WORDS, displayedDissent } from '../reasoning/TowardsCommitment'
import { useReasoningFocus } from '../reasoning/focusRequest'
import { useUIStore } from '../../stores/uiStore'
import { typography } from '../../styles/typography'
import { useAnchoredTip } from '../look/Tip'
import { GlyphMark, Hover } from '../look/Hover'

/** The tab's own chrome: the fold that holds core's long reading. */
export const ANALYSIS_WORDS = { why: 'Why this reading' } as const

/** One of core's notes, verbatim; its longer words (`title`), when core sends them, through the one Tip on pointer and on keyboard focus. */
function NoteLine({ n, i }: { n: NonNullable<ViewModel['run']>['notes'][number]; i: number }) {
  const longer = n.title !== '' && n.title !== n.text ? n.title : undefined
  const { handlers, tip, describedBy } = useAnchoredTip(longer, undefined, undefined, `run.notes.${i}.title`)
  return (
    <>
      <li tabIndex={longer === undefined ? undefined : 0} aria-describedby={describedBy} data-view={`run.notes.${i}.text`} {...handlers}>{n.text}</li>
      {tip}
    </>
  )
}

/** One of core's timing assumptions (`run.timing`), its whole sentence verbatim ("Olumi's timing assumption, not your figure: 'X' is 1 to 4 months."); core sends no title or mark for it. */
function TimingLine({ t, i }: { t: NonNullable<ViewModel['run']>['timing'][number]; i: number }) {
  return <li data-timing={t.quantity} data-view={`run.timing.${i}.text`}>{t.text}</li>
}

function visibleReadingItems(model: ViewModel) {
  const run = model.run ?? null
  const timing = (run?.timing ?? []).map((t, i) => ({ t, i })).filter(({ t }) => t.text !== '')
  // Only a timing line that is drawn may suppress a note.
  const kept = new Set(run === null ? [] : notesBesideTiming({ ...run, timing: timing.map(({ t }) => t) }))
  const notes = (run?.notes ?? []).map((n, i) => ({ n, i })).filter(({ n }) => n.text !== '' && kept.has(n))
  return { notes, timing }
}

function LeavesOut({ notes, timing }: ReturnType<typeof visibleReadingItems>) {
  if (notes.length === 0 && timing.length === 0) return null
  return (
    <section data-testid="analysis-leaves-out">
      <ul className="ok-an-notes">
        {timing.map(({ t, i }) => <TimingLine key={t.quantity} t={t} i={i} />)}
        {notes.map(({ n, i }) => <NoteLine key={i} n={n} i={i} />)}
      </ul>
    </section>
  )
}

/** Each limit, then each option's state against it (core's `state_text`), with its reading and any condition on hover;
 *  a press goes to the option's card. */
function Limits({ model }: { model: ViewModel }) {
  const groups = limitGroupsOf(model)
  if (groups.length === 0) return null
  return (
    <section className="space-y-3" data-testid="analysis-limits">
      {groups.map((g) => (
        <div key={g.aimId} className="space-y-1" data-limit-aim={g.aimId}>
          <h3 className={`${typography.viewPanelHeading} m-0 text-text-header`} data-view={g.aim.at}>{g.aim.text}</h3>
          <ul className="m-0 list-none p-0">
            {g.rows.map(({ card, row, i }) => (
              <li key={card.id}>
                <OptionRow id={card.id} ring="analysis-limits" data-limit-option={card.id}
                  words={[
                    { text: row.title, at: `${card.id}.rows.${i}.title` },
                    { text: row.value, at: `${card.id}.rows.${i}.value` },
                    { text: row.olumi?.title ?? '', at: `${card.id}.rows.${i}.olumi.title` },
                  ]}
                  className={`${TYPE.body} flex min-h-7 w-full items-baseline gap-2 px-1 py-0.5`}>
                  <span className="min-w-0 flex-1 text-text-header" data-view={`${card.id}.heading`}>{card.heading}</span>
                  {row.state_text == null || row.state_text === '' ? null : <span className={`${TYPE.meta} shrink-0 text-text-body`} data-view={`${card.id}.rows.${i}.state_text`}>{row.state_text}</span>}
                  {row.olumi == null ? null : <GlyphMark mark={row.olumi} tip={false} className={`${TYPE.meta} shrink-0 text-info`} view={`${card.id}.rows.${i}.olumi.glyph`} />}
                </OptionRow>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

/**
 * Core's comparisons, each group under core's own heading for it (`compared_headings`), each line verbatim with Olumi's mark where core gives one,
 * the Run's text on hover; a kind this page does not know, or a group core gives no heading for, draws nothing. Drawn on the panel's scale
 * (the shared `Compared` uses the larger legacy header token).
 */
function ComparedLines({ groups }: { groups: ReturnType<typeof comparedGroupsOf> }) {
  return groups.length === 0 ? null : (
    <div data-testid="view-run-compared" className="space-y-3">
      {groups.map(({ group, heading, lines }) => (
        <div key={group} className="space-y-1" data-testid={`view-run-compared-${group}`} aria-label={heading}>
          <p className={`${typography.viewPanelHeading} m-0 text-text-header`} data-view={`run.compared_headings.${group}`}>{heading}</p>
          {lines.map(({ line: l, i }) => (
            <div key={l.id} data-view-fact={l.id}>
              {l.olumi === null ? null : <><GlyphMark mark={l.olumi} className="text-info" view={`run.compared.${i}.olumi.glyph`} /> </>}
              <Hover words={l.hover} wordsAt={`run.compared.${i}.hover`} data-view={`run.compared.${i}.line`}>{l.line}</Hover>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function chanceReadingOf(model: ViewModel, group: ChartGroup | undefined) {
  const run = model.run
  const tails = group?.rows.flatMap(({ card, row, i }) => row.tail?.text
    ? [{ card, text: row.tail.text, at: `${card.id}.rows.${i}.tail.text` }]
    : []) ?? []
  const tailNote = tailNoteOf(run)
  const note = tails.length > 0 && group !== undefined && tailNote?.aims.includes(group.aimId) ? tailNote.text : null
  const sensitivity = group?.rows.some(({ row }) => rangeOf(row) !== null) && run?.sensitivity?.text ? run.sensitivity : null
  return { tails, note, sensitivity }
}

function ChanceReading({ tails, note, sensitivity }: ReturnType<typeof chanceReadingOf>) {
  if (tails.length === 0 && sensitivity === null) return null
  return (
    <section className="space-y-1" data-testid="analysis-chance-reading">
      {sensitivity === null ? null : (
        <Hover as="p" className="m-0" data-testid="analysis-chart-ends" words={sensitivity.title} wordsAt="run.sensitivity.title" data-view="run.sensitivity.text">{sensitivity.text}</Hover>
      )}
      {note === null ? null : <p className="m-0" data-view="run.tail_note.text">{note}</p>}
      {tails.map(({ card, text, at }) => (
        <div key={at} data-tail-option={card.id}>
          <p className="m-0 text-text-header" data-view={`${card.id}.heading`}>{card.heading}</p>
          <p className="m-0" data-view={at}>{text}</p>
        </div>
      ))}
    </section>
  )
}

/** Core's longer reading, closed at rest. */
function WhyThisReading({ model, lead, group }: { model: ViewModel; lead: ReturnType<typeof leadReadingOf>; group: ChartGroup | undefined }) {
  const [open, setOpen] = useState(false)
  const regionId = useId()
  const run = model.run ?? null
  const failure = useFailureReading(run)
  if (run === null) return null
  const tipping = optionTippingOf(run, lead?.at)
  const worth = worthReadingOf(run)
  const silents = aimReadingOf(run, lead)
  const hasAimReading = (lead !== null && (lead.tipping === null || lead.hover !== '')) || silents.length > 0
  const ml = run.most_likely ?? null
  const mlCard = ml?.estimate == null ? null : cardOf(model, ml.estimate)
  const { notes, timing } = visibleReadingItems(model)
  const chance = chanceReadingOf(model, group)
  const compared = comparedGroupsOf(run)
    .map((group) => ({ ...group, lines: group.lines.filter(({ line }) => line.line !== '') }))
    .filter(({ lines }) => lines.length > 0)
  if (ml === null && notes.length === 0 && timing.length === 0 && tipping === null && worth.length === 0 &&
      !hasAimReading && failure === null && chance.tails.length === 0 && chance.sensitivity === null && compared.length === 0) return null
  return (
    <section data-testid="analysis-why" data-disclosure={open ? 'open' : 'closed'}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={open ? regionId : undefined} className={`${TYPE.meta} inline-flex min-h-7 items-center gap-1 px-1 text-text-body hover:text-text-header`} data-testid="analysis-why-toggle">
        <FoldChevron open={open} />{ANALYSIS_WORDS.why}
      </button>
      {!open ? null : (
        <div id={regionId} className={`${TYPE.meta} mt-2 space-y-2 text-text-body`} data-testid="analysis-why-region">
          <LeavesOut notes={notes} timing={timing} />
          <ChanceReading {...chance} />
          {ml == null ? null : (
            <p className="m-0" data-testid="analysis-why-most-likely">
              <Hover words={ml.title} wordsAt="run.most_likely.title" data-view="run.most_likely.text">{ml.text}</Hover>
              {mlCard?.figure?.edit == null ? null : <> <FigureEdit id={mlCard.id} edit={mlCard.figure.edit} place="analysis-likely" glyph words={false} label={`Give your figure for ${mlCard.heading}`} /></>}
            </p>
          )}
          {ml?.rests_on_text == null || ml.rests_on_text === '' ? null : <p className="m-0 text-text-light" data-view="run.most_likely.rests_on_text">{ml.rests_on_text}</p>}
          <TippingPerOption model={model} reading={tipping} />
          {worth.length > 0 && lead?.tipping == null && !hasAimReading ? <MovesHeading /> : null}
          <WorthReading lines={worth} />
          <AimReading lead={lead} silents={silents} />
          <FailureAfterYours reading={failure} />
          <ComparedLines groups={compared} />
        </div>
      )}
    </section>
  )
}

function ToReasoning({ model }: { model: ViewModel }) {
  const view = useViewStore((s) => s.view)
  const dissent = view?.collab.dissent ?? []
  const items = checkItemsOf(model, view).flatMap((group) => group.blocks.flatMap((block) => block.items))
  const first = items[0]
  const key = first?.key ?? (dissent.some(displayedDissent) ? 'commitment' : null)
  return (
    <button type="button" data-testid="analysis-to-reasoning" onClick={() => {
      const { sid } = useViewStore.getState()
      useReasoningFocus.setState({ request: sid === null || key === null ? null : { sid, key } })
      useUIStore.getState().forceActivateOutputTab('analysisNew')
    }}
      className={`${TYPE.body} flex min-h-7 w-full items-center gap-2 rounded-sm px-1 text-left text-text-body hover:bg-panel-hover`}>
      <span className="min-w-0 flex-1">{key === 'commitment' ? COMMITMENT_WORDS.heading : CHECK_WORDS.title}</span>
      {key === 'commitment' ? null : <span className={`${TYPE.meta} tabular-nums text-text-light`} data-count>{items.length}</span>}
    </button>
  )
}

function ChanceResults({ model, groups, group, setAim, leadReading }: {
  model: ViewModel
  groups: ChartGroup[]
  group: ChartGroup
  setAim: (aim: string) => void
  leadReading: ReturnType<typeof leadReadingOf>
}) {
  const run = model.run
  if (run == null) return null
  // The shared chart reads both marks and prose. Pass its picture fields here; the fold reads the original selected rows.
  const pictureGroup = { ...group, rows: group.rows.map((r) => ({ ...r, row: { ...r.row, tail: undefined } })) }
  const pictureModel = { ...model, run: { ...run, sensitivity: run.sensitivity == null ? run.sensitivity : { ...run.sensitivity, text: '' } } }
  const lead = run.lead
  const lens = run.lenses?.findIndex((l) => l.id === 'goal') ?? -1
  return (
    <>
      {lead == null || lead === '' ? null : (
        <Hover as="h3" words={run.lenses?.[lens]?.title} wordsAt={lens < 0 ? undefined : `run.lenses.${lens}.title`}
          className={`${typography.viewPanelHeading} m-0 text-text-header`} data-view="run.lead">{lead}</Hover>
      )}
      {groups.length <= 1 ? null : (
        <div role="group" aria-label="Aim" className="flex flex-wrap gap-1">
          {groups.map((g) => (
            <button key={g.aimId} type="button" aria-pressed={g.aimId === group.aimId} data-view={g.aim.at}
              className={`${TYPE.meta} min-h-7 rounded-sm border border-panel-border px-2 text-text-header hover:bg-panel-hover aria-pressed:bg-panel-hover transition-colors duration-fast motion-reduce:transition-none`}
              onClick={() => setAim(g.aimId)}>{g.aim.text}</button>
          ))}
        </div>
      )}
      <ChanceChart model={pictureModel} group={pictureGroup} />
      <LikelyOutcome model={model} group={group} />
      <WhatMovesIt lead={leadReading} />
    </>
  )
}

/** The tab's body for one model. */
export function PortAnalysis({ model, stated = false }: { model: ViewModel; stated?: boolean }) {
  const sid = useViewStore((s) => s.sid)
  return <ResultsBody key={sid} model={model} stated={stated} />
}

function ResultsBody({ model, stated }: { model: ViewModel; stated: boolean }) {
  const state = tabStateOf(model)
  const [aim, setAim] = useState<string | null>(null)
  const groups = state === 'chance' ? chartGroupsOf(model) : []
  const group = groups.find((g) => g.aimId === aim) ?? groups[0]
  const lead = group === undefined ? null : model.run?.lead
  const leadReading = group === undefined ? null : leadReadingOf(model)
  // The dock's wrapper keeps a 16px gutter; the tab takes the panel's 12px.
  return (
    <div className={`${TYPE.body} -mx-1 space-y-5`} data-testid="port-analysis-tab" data-analysis-state={state}>
      <WhatIfShown model={model} labelled={!stated} />
      {group === undefined ? null : <ChanceResults model={model} groups={groups} group={group} setAim={setAim} leadReading={leadReading} />}
      <Limits model={model} />
      <ToReasoning model={model} />
      <WhyThisReading model={model} lead={leadReading} group={group} />
      {lead == null || lead === '' ? null : (
        <button type="button" className={`${TYPE.meta} min-h-7 rounded-sm border border-panel-border px-2 text-text-header hover:bg-panel-hover`}
          onClick={() => prefillComposer(lead)}>{CHECK_WORDS.ask}</button>
      )}
    </div>
  )
}

/** The tab on the lane: the View's model as shown (`shownModel`: the approved one, or a held proposal's under core's heading). */
export function PortAnalysisTab() {
  const model = useViewStore(shownModel), state = useTabState(model)
  // The model's state is said once, above the tab, in the same strip the Reasoning tab draws (a held proposal, or a what-if with its way
  // back), on the tab's own 12px gutter with a gap under it; nothing at rest.
  return model === null ? null : <><div className="-mx-1 mb-3 empty:hidden"><StateStrip state={state} /></div><PortAnalysis model={model} stated={state === 'whatif'} /></>
}

export default PortAnalysisTab
