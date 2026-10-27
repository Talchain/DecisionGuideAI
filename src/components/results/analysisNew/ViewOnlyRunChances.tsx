/**
 * DL ruling A (23 Oct): a board read that carries only CEE's `canonical_analysis_view` (no `analysis_result`) says the
 * bound, current Run's served cells and goal-chance sentence in the pre-run slot, in CEE's own words. Display only: the
 * binding and currentness are `runViewOf`'s (run id AND graph hash, `stale === false`); no licence, chance or value logic.
 * A withheld cell says CEE's face and its `why`; options withheld with the same words are said once, since those words
 * name no option. Under the "waits on N things" headline (Paul 27 Oct: "If all of them are the same, then it should just
 * say it once"), an option's `why` that only says what the chance waits on is not said again: the headline lists every
 * item once, with CEE's own words on why an unknown cannot be sized yet.
 * Row 19 (DL, 24 Oct): on a PROGRAM board a Run that is no longer current says CEE's own not-current line once
 * (`face_when_stale`), with one "Run again" that sends the existing Run press. Paul, 27 Oct (spec: "A historical Run's
 * chances are never hidden"): each option's stored words from that Run follow the line.
 * Under each option's chance line, CEE's own words on what that chance rests on most (`main_driver.detail`, through
 * `mainDriverDetailOf`), or CEE's reason none is shown (`none_licensed`); nothing when not recorded, or for a stale Run.
 * W6 (CEE #3792; Paul 6 and 14 Oct): under the chances, once, CEE's own sentence (`leader.words`) on which option is most
 * likely to achieve the goal in this model, or that the options are too close to call; nothing for a stale Run or without it.
 */
import { useMemo } from 'react'
import { useCanvasStore } from '../../../canvas/store'
import { useSavedModelIsProgram } from '../../../canvas/nodes/shared/savedModelProgram'
import { useCanonicalAnalysisViewStore } from '../../../canvas/stores/canonicalAnalysisViewStore'
import { optionChanceCell, runViewGoalChanceSentence, runViewOf } from '../../../canvas/runView/runView'
import type { CanonicalAnalysisCell, CanonicalWaitsOn } from '../../../canvas/runView/canonicalAnalysisView'
import { focusModelTarget } from '../../../canvas/utils/focusHelpers'
import { useValuePrefillStore } from '../../../canvas/graphChanges/valuePrefill'
import { useGuidanceStore } from '../../../canvas/stores/guidanceStore'
import { typography } from '../../../styles/typography'
import { action } from './panelSurfaces'

export interface ViewOnlyRunChanceLine {
  readonly optionIds: readonly string[]
  readonly text: string
  readonly why: string | null
  /** CEE's `main_driver` words for this line's option, verbatim: its `detail`, or its `none_licensed` reason; else null. */
  readonly driver: string | null
  /** CEE withheld this line's chance (its `text` is CEE's withheld face). */
  readonly withheld: boolean
  /** Its `why` only says what the chance waits on, every item of which CEE lists in `goal_chance.waits_on`. */
  readonly whyIsWaitsOn: boolean
  /** An option's words from a Run that is no longer current, said after CEE's not-current line. */
  readonly earlier?: boolean
}

export interface ViewOnlyRunChances {
  readonly sentence: string | null
  readonly lines: readonly ViewOnlyRunChanceLine[]
  /** CEE's `goal_chance.waits_on`, in its order and words (S1 #3716): what the result waits on. */
  readonly waitsOn: readonly CanonicalWaitsOn[]
  /** The bound Run is not current: `lines` is CEE's not-current line alone, and the block offers "Run again". */
  readonly stale: boolean
  /** CEE withheld EVERY option's chance (each option's cell, shown or not). */
  readonly allWithheld: boolean
  /**
   * W6: CEE's `leader.words`, verbatim, for a current Run only: which option is most likely to achieve the goal in this
   * model, or that the options are too close to call. Null otherwise; the UI composes and decides none of it.
   */
  readonly mostLikely: string | null
}

/** The block's one act on a Run that is not current (DL, row 19). */
export const RUN_AGAIN = 'Run again'

const CTX = { goalChanceHeroSays: false, labelOf: () => null }

/**
 * A withheld cell whose `why` is CEE's waits-on words (CEE `waitsOnWords`, evaluate.ts and present.ts) and every item it
 * names after "waits on" is already in the headline's list (Paul, 27 Oct: "when the list already names an option's items,
 * don't repeat them under the option"). Never the compiler's own reason for a goal with no blocker, or another code's reason.
 */
const WAITS_ON_REASONS = new Set(['goal_asks', 'goal_withheld'])
const inline = (s: string): string => s.trim().replace(/\s+/g, ' ')
function whyIsWaitsOn(cell: CanonicalAnalysisCell | undefined, why: string | null, listed: ReadonlySet<string>): boolean {
  if (why === null || cell?.kind !== 'withheld' || !cell.reasons.every(r => WAITS_ON_REASONS.has(r.code))) return false
  const list = /\bwaits? on (‘.*)$/.exec(why)?.[1]
  if (list === undefined || why.includes('is not in the chance yet')) return false
  const named = [...list.matchAll(/‘([^’]+)’/g)].map(m => inline(m[1]))
  return named.length > 0 && named.every(label => listed.has(label))
}

/**
 * The bound, current view-only Run's served words; on a program board, a Run that is not current says CEE's not-current
 * line instead. Null where a report is held, or the view is unbound, or not current with no line of CEE's to say.
 */
export function useViewOnlyRunChances(): ViewOnlyRunChances | null {
  const report = useCanvasStore(s => s.results?.report ?? null)
  const scenarioId = useCanvasStore(s => s.currentScenarioId)
  const canonical = useCanonicalAnalysisViewStore(s => (s.scenarioId === scenarioId ? s.view : null))
  const program = useSavedModelIsProgram()
  return useMemo(() => {
    if (report != null || canonical === null) return null
    const view = runViewOf(null, canonical)
    if (!view.boundToCurrentCanonical()) {
      // CEE's own line, said once for every option, then each option's stored words from that Run (Paul, 27 Oct; spec: "A
      // historical Run's chances are never hidden"). They follow the line that says the Run is not current, are never
      // counted as a shown result, and carry no driver or "most likely" (CEE names no leader for a Run that is not current).
      const line = program ? view.notCurrentLine() : null
      if (line === null) return null
      const earlier = canonical.options.flatMap(({ option_id: optionId, cell }) => {
        const words = cell.kind === 'figure' || cell.kind === 'range' ? cell.face ?? cell.display : cell.kind === 'withheld' ? cell.face ?? null : null
        return words === null ? [] : [{ optionIds: [optionId], text: words, why: null, driver: null, withheld: false, whyIsWaitsOn: false, earlier: true }]
      })
      return { sentence: null, lines: [{ optionIds: canonical.options.map(o => o.option_id), text: line, why: null, driver: null, withheld: false, whyIsWaitsOn: false }, ...earlier],
        waitsOn: [], stale: true, allWithheld: false, mostLikely: null }
    }
    const lines: { optionIds: string[]; text: string; why: string | null; driver: string | null; withheld: boolean; whyIsWaitsOn: boolean }[] = []
    let allWithheld = canonical.options.length > 0
    const waitsOn = view.goalChanceDetail()?.waits_on ?? []
    const listed = new Set(waitsOn.map(w => inline(w.label)))
    for (const { option_id: optionId, main_driver: mainDriver, cell: served } of canonical.options) {
      const cell = optionChanceCell(view, optionId, CTX)
      if (cell.kind !== 'withheld') allWithheld = false
      if (cell.text === null) continue
      const withheld = cell.kind === 'withheld'
      const why = withheld ? cell.why ?? null : null
      const driver = view.mainDriverDetailOf(optionId)
        ?? (mainDriver.kind === 'none_licensed' && mainDriver.reason.trim() !== '' ? mainDriver.reason : null)
      const same = withheld ? lines.find(l => l.withheld && l.text === cell.text && l.why === why && l.driver === driver) : undefined
      if (same) same.optionIds.push(optionId)
      else lines.push({ optionIds: [optionId], text: cell.text, why, driver, withheld, whyIsWaitsOn: whyIsWaitsOn(served, why, listed) })
    }
    const sentence = runViewGoalChanceSentence(view)
    // Past the current-Run gate above, as the chances are: CEE's words alone, never one the UI composes from the cells.
    const mostLikely = canonical.leader?.words ?? null
    return lines.length === 0 && sentence === null ? null : { sentence, lines, waitsOn, stale: false, allWithheld, mostLikely }
  }, [report, canonical, program])
}

/**
 * CEE's `goal_chance.waits_on` for the bound, current Run, in its order and words; empty with none, or with no current Run.
 * Olumi's note beside the goal lists it under the target (Paul, 24 Oct: "In Olumi's note").
 */
export function useCurrentGoalWaitsOn(): readonly CanonicalWaitsOn[] {
  const scenarioId = useCanvasStore(s => s.currentScenarioId)
  const canonical = useCanonicalAnalysisViewStore(s => (s.scenarioId === scenarioId ? s.view : null))
  return useMemo(() => {
    if (canonical === null) return NO_WAITS
    const view = runViewOf(null, canonical)
    return view.boundToCurrentCanonical() ? view.goalChanceDetail()?.waits_on ?? NO_WAITS : NO_WAITS
  }, [canonical])
}
const NO_WAITS: readonly CanonicalWaitsOn[] = []
const WAITS_ON_TESTID = 'analysis-view-only-waits-on'

/**
 * Paul's headline for a goal chance that waits (24 Oct, "Waits on N figures"), in place of each option's withheld face:
 * the count of what CEE says the result waits on, then its labels. "figure" only where CEE says every item is answered
 * with a figure; otherwise "thing".
 */
export const WAITS_ON_HEADLINE = 'Chance of meeting the goal'
export function waitsOnCountWords(items: readonly CanonicalWaitsOn[]): string {
  const figures = items.every(w => w.answer?.quantity_id != null)
  const n = items.length
  return `waits on ${n} ${figures ? (n === 1 ? 'figure' : 'figures') : (n === 1 ? 'thing' : 'things')}`
}

/** An unknown's own reason, as CEE says it after the label in an option's `why` (present.ts `waitsOnWords`); else nothing. */
function unknownBasisWords(item: CanonicalWaitsOn): string | null {
  if (item.code !== 'unknown') return null
  const basis = typeof item.basis === 'string' ? item.basis.trim().replace(/\s+/g, ' ').replace(/[.!]+$/, '') : ''
  return `, which no one can size yet${basis === '' ? '' : ` (${basis})`}`
}

/** The labels CEE says the result waits on, each opening its card's answer box where it has one. */
export function WaitsOnList({ items, testIdPrefix = WAITS_ON_TESTID, withBasis = false }: { items: readonly CanonicalWaitsOn[]; testIdPrefix?: string; withBasis?: boolean }) {
  return (
    <>
      {items.map((w, i) => (
        <span key={w.id}>{i > 0 ? ', ' : null}<WaitsOnItem item={w} testIdPrefix={testIdPrefix} />{withBasis ? unknownBasisWords(w) : null}</span>
      ))}
    </>
  )
}

/**
 * Whether a PROGRAM board shows a bound, current Run's served result (DL, 23 Oct: on a program board the tabs never deny a
 * result the board shows). A program's analysis is run by the host on every change, so no tab offers to run it first.
 * Any other board answers false and keeps its lines.
 */
export function useProgramBoardShowsResult(): boolean {
  const program = useSavedModelIsProgram()
  const chances = useViewOnlyRunChances()
  // A Run that is not current shows no result, only CEE's line and "Run again": it is never counted as one.
  return program && chances !== null && !chances.stale
}

export function ViewOnlyRunChancesBlock({ chances }: { chances: ViewOnlyRunChances }) {
  // Every option withheld while CEE lists what the result waits on: one headline says the count and the list, not each
  // option's withheld face (Paul, 24 Oct). An option's reason that only repeats that list is not said again (Paul, 27 Oct);
  // any other reason still follows.
  const waits = chances.allWithheld && chances.waitsOn.length > 0
  return (
    <div className="space-y-1" data-testid="analysis-view-only-chances">
      {chances.sentence === null ? null : (
        <p className={`${typography.panelBody} text-text-body`} data-testid="analysis-view-only-chances-sentence">
          {chances.sentence}
        </p>
      )}
      {waits ? (
        <div data-testid="analysis-view-only-waits-headline">
          <p className={`${typography.panelMeta} text-text-light`}>{WAITS_ON_HEADLINE}</p>
          <p className={`${typography.panelBody} text-text-body`} data-testid="analysis-view-only-waits-on">
            {`${waitsOnCountWords(chances.waitsOn)}: `}
            <WaitsOnList items={chances.waitsOn} withBasis />
          </p>
        </div>
      ) : null}
      {chances.lines.map(line => (
        <div key={`${line.earlier ? 'earlier-' : ''}${line.optionIds.join('+')}`}
          data-testid={`analysis-view-only-${line.earlier ? 'earlier-' : ''}chance-${line.optionIds.join('+')}`}>
          {waits ? null : <p className={`${typography.panelBody} text-text-body`}>{line.text}</p>}
          {line.why === null || (waits && line.whyIsWaitsOn) ? null : <p className={`${typography.panelMeta} text-text-light`}>{line.why}</p>}
          {line.driver === null ? null : (
            <p className={`${typography.panelMeta} text-text-light`} data-testid={`analysis-view-only-driver-${line.optionIds.join('+')}`}>{line.driver}</p>
          )}
        </div>
      ))}
      {chances.mostLikely === null ? null : (
        <p className={`${typography.panelBody} text-text-body`} data-testid="analysis-view-only-most-likely">{chances.mostLikely}</p>
      )}
      {waits || chances.waitsOn.length === 0 ? null : (
        <p className={`${typography.panelBody} text-text-body`} data-testid="analysis-view-only-waits-on">
          {'Waits on: '}
          <WaitsOnList items={chances.waitsOn} />
        </p>
      )}
      {chances.stale ? <RunAgain /> : null}
    </div>
  )
}

/**
 * The existing Run press (the conversation's gated runner, `_runAnalysis`: `run_analysis`, which CEE serves for a program
 * with the stored Run when current, else a new Run, and no AI call). Absent with no runner: never a control that does nothing.
 */
function RunAgain() {
  const run = useGuidanceStore(s => s._runAnalysis)
  if (run === null) return null
  return (
    <button type="button" className={`${typography.panelMeta} ${action('primary')} mt-1`} data-testid="analysis-view-only-run-again" onClick={() => run()}>
      {RUN_AGAIN}
    </button>
  )
}

/**
 * One thing the result waits on, by CEE's label. Where CEE says the person can answer it with a figure and that figure's
 * card is on the canvas, the label opens the card's own answer box (the existing in-card field and writer) and brings the
 * card into view; otherwise it is the label alone.
 */
function WaitsOnItem({ item, testIdPrefix }: { item: CanonicalWaitsOn; testIdPrefix: string }) {
  const quantityId = item.answer?.quantity_id ?? null
  const onCanvas = useCanvasStore(s => quantityId !== null && s.nodes.some(n => n.id === quantityId && n.type === 'factor'))
  const requestPrefill = useValuePrefillStore(s => s.requestPrefill)
  if (quantityId === null || !onCanvas) return <span data-testid={`${testIdPrefix}-${item.id}`}>{`‘${item.label}’`}</span>
  return (
    <button type="button" className={action('inline')} data-testid={`${testIdPrefix}-answer-${quantityId}`}
      onClick={() => { focusModelTarget(quantityId); requestPrefill({ nodeId: quantityId, text: '' }) }}>
      {`‘${item.label}’`}
    </button>
  )
}
