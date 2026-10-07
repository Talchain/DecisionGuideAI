/**
 * The Compare tab's input changes, as rows (Compare v3 handoff, 4 Oct 2026, §1 and §3): a section heading with the
 * number of recorded changes, then for each row a kind icon, the input's name and context, a "Show on the canvas"
 * crosshair, and its recorded before → after (values, a strength band position, or the estimate's origin). Two rows
 * first; the rest expand in place; incomplete coverage stays visible beside them.
 *
 * ⛔ SAME FACTS, SAME WORDS AS `InputChanges`. The rows are `buildRunDeltaView`'s; each row's own sentence
 * (`inputRowText` / `linkRowText`) is rendered for assistive technology, and the drawn parts (`inputChangeRowParts`)
 * are read from the same row by identity. The Reasoning receipt and saved versions keep `InputChanges` unchanged.
 * Canvas lighting and focus use the caller's `InputRowLight` / `InputRowFocus`, by the row's ids, never its text.
 */
import { useState } from 'react'
import { ArrowRight, Check, ChevronDown, ChevronRight, Crosshair, Info, Lightbulb, Link2, Settings, Shield, Target } from 'lucide-react'
import type { ComponentType } from 'react'
import { typography } from '../../../../styles/typography'
import { PanelIconButton } from '../PanelIconButton'
import { action, icon } from '../panelSurfaces'
import { INPUT_ROWS_SHOWN_FIRST, type RunDeltaFrame, type RunDeltaInputRow, type RunDeltaInputsView } from '../runDeltaView'
import {
  ACCEPTED_ESTIMATE_NOTE,
  STRENGTH_BAND_ORDER,
  inputRowContext,
  inputRowName,
  inputRowSentenceSupplement,
  inputRowValues,
  type InputRowValues,
} from './inputChangeRowParts'
import {
  INPUTS_PARTIAL_TEXT,
  WHATS_CHANGED_TESTID,
  emptyInputsText,
  inputRowSentence,
  type InputRowFocus,
  type InputRowLight,
} from './WhatsChanged'

type Glyph = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>

/**
 * The canvas's own entity glyphs (`NODE_REGISTRY`: option Lightbulb, factor Settings, goal Target, limit Shield), so a
 * row wears the icon of the thing it changed. A link is Link2. The handoff's Sliders for a limit is a proposed addition
 * to the shared map, not an entry in it, so the registry's Shield stays.
 */
const KIND_ICON: Record<RunDeltaInputRow['kind'], Glyph> = {
  option_setting: Lightbulb,
  option: Lightbulb,
  factor_value: Settings,
  goal: Target,
  constraint: Shield,
  link: Link2,
}

export const INPUT_CHANGE_ROWS_HEADING = 'What changed in the model'

/** "3 changes", or "3 recorded changes" where coverage is partial: it counts the rows shown, never all edits ever made. */
export function inputChangeCount(n: number, partial: boolean): string {
  return `${n}${partial ? ' recorded' : ''} ${n === 1 ? 'change' : 'changes'}`
}

function CoverageNote({ text, testId, wireFields }: { text: string; testId?: string; wireFields?: string }): JSX.Element {
  return (
    <p className={`${typography.panelMeta} text-text-light flex items-start gap-2 m-0`} data-testid={testId} data-wire-fields={wireFields}>
      <Info className={`${icon('inline')} flex-shrink-0 mt-0.5`} aria-hidden="true" />
      <span>{text}</span>
    </p>
  )
}

/** Four ordered bands; the earlier band hollow, the latest filled. Category order only: no interval, no number. */
function BandSteps({ beforeBand, afterBand }: { beforeBand: number | null; afterBand: number | null }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1 flex-shrink-0" aria-hidden="true" title="Ordered strength bands, not a numerical scale" data-testid="compare-input-strength-steps">
      {STRENGTH_BAND_ORDER.map((band, i) => {
        const at = i === beforeBand && i === afterBand ? 'both' : i === afterBand ? 'after' : i === beforeBand ? 'before' : null
        const look = at === 'both' ? 'h-[9px] bg-info border-2 border-panel ring-1 ring-info'
          : at === 'after' ? 'h-[9px] bg-info border border-info'
          : at === 'before' ? 'h-[9px] bg-panel border border-field'
          : 'h-[5px] bg-transparent border border-factor'
        return <i key={band} className={`inline-block w-[13px] rounded-sm ${look}`} data-band={band} data-at={at ?? undefined} />
      })}
    </span>
  )
}

function ValuePair({ before, after, beforeMuted = true }: { before: string | null; after: string | null; beforeMuted?: boolean }): JSX.Element {
  return (
    <span className={`${typography.panelTabular} text-text-body flex flex-wrap items-baseline gap-x-2 min-w-0`}>
      <span className={beforeMuted ? 'text-text-light' : undefined}>{before ?? 'Not recorded'}</span>
      <ArrowRight className={`${icon('inline')} self-center flex-shrink-0 text-text-light`} aria-hidden="true" />
      <span>{after ?? 'Not recorded'}</span>
    </span>
  )
}

function RowValues({ values }: { values: InputRowValues }): JSX.Element {
  switch (values.kind) {
    case 'status':
      return <p className={`${typography.panelTabular} text-text-body m-0`}>{values.text}</p>
    case 'pair':
      return <p className="m-0"><ValuePair before={values.before} after={values.after} /></p>
    case 'strength':
      return (
        <div className="flex items-center gap-x-4">
          <ValuePair before={values.before} after={values.after} />
          <BandSteps beforeBand={values.beforeBand} afterBand={values.afterBand} />
        </div>
      )
    case 'sizing':
      return (
        <div className="space-y-2">
          <div className={`${typography.panelMeta} flex flex-wrap items-center gap-2`} data-testid="compare-input-origin">
            <span className="inline-flex items-center min-h-6 px-2 rounded-full border border-panel-border text-text-body">{values.before ?? 'Not recorded'}</span>
            <ArrowRight className={`${icon('inline')} flex-shrink-0 text-text-light`} aria-hidden="true" />
            <span className={`inline-flex items-center gap-1 min-h-6 px-2 rounded-full border text-text-header ${values.accepted ? 'border-factor' : 'border-panel-border'}`} data-accepted={values.accepted ? 'true' : undefined}>
              {values.accepted ? <Check className={icon('inline')} aria-hidden="true" /> : null}
              {values.after ?? 'Not recorded'}
            </span>
          </div>
          {values.strength ? (
            <div className="flex items-center gap-x-4">
              <ValuePair before={values.strength.before} after={values.strength.after} />
              <BandSteps beforeBand={values.strength.beforeBand} afterBand={values.strength.afterBand} />
            </div>
          ) : null}
          {values.accepted ? <p className={`${typography.panelMeta} text-text-light m-0`}>{ACCEPTED_ESTIMATE_NOTE}</p> : null}
        </div>
      )
  }
}

function InputChangeRow({ row, frame, rowFocus, rowLight, selected, onSelect }: {
  row: RunDeltaInputRow
  frame: RunDeltaFrame
  rowFocus?: InputRowFocus
  rowLight?: InputRowLight
  selected: boolean
  onSelect: () => void
}): JSX.Element {
  const focus = rowFocus?.(row)
  const light = focus ? rowLight?.(row) ?? null : null
  const sentence = inputRowSentence(row, frame)
  const supplement = inputRowSentenceSupplement(row, sentence)
  const name = inputRowName(row)
  const context = inputRowContext(row)
  const Icon = KIND_ICON[row.kind] ?? Settings
  return (
    <li
      className={`-mx-2 px-2 py-3 rounded-md border-t border-panel-border first:border-t-0 ${light ? 'hover:bg-panel-hover focus-within:bg-panel-hover' : ''} ${selected ? 'ring-1 ring-inset ring-info bg-panel-hover' : ''}`}
      data-testid={`${WHATS_CHANGED_TESTID}-input-row`}
      data-kind={row.kind}
      data-change={row.change}
      data-on-canvas={focus === undefined ? undefined : focus === null ? 'false' : 'true'}
      data-selected={selected ? 'true' : undefined}
      onMouseEnter={light?.on}
      onMouseLeave={light?.off}
      onFocus={light?.on}
      onBlur={light?.off}
    >
      {/* The row's sentence is what it MEANS, word for word as everywhere else; the drawn parts below repeat it for the eye. */}
      <span className="sr-only">{sentence}{supplement ? ` ${supplement}` : ''}</span>
      <div className="flex items-start gap-2">
        <Icon className={`${icon('row')} text-text-light flex-shrink-0 mt-0.5`} aria-hidden="true" />
        <div className="flex-1 min-w-0" aria-hidden="true">
          <p className={`${typography.panelBody} text-text-header m-0 break-words`} data-testid="compare-input-row-name">{name}</p>
          {context ? <p className={`${typography.panelMeta} text-text-light m-0 break-words`} data-testid="compare-input-row-context">{context}</p> : null}
        </div>
        {focus ? (
          <PanelIconButton
            Icon={Crosshair}
            // The whole change, so two rows with one name (a factor set in two options) never share a control name.
            label={`Show on the canvas: ${sentence}`}
            onClick={() => { onSelect(); focus() }}
            pressed={selected}
            testId={`${WHATS_CHANGED_TESTID}-input-row-focus`}
          />
        ) : null}
      </div>
      <div className="pl-6 mt-2" aria-hidden="true" data-testid="compare-input-row-values">
        <RowValues values={inputRowValues(row)} />
      </div>
      {/* A removed input already says it went; a current one with nothing drawn says why there is no crosshair. */}
      {focus === null && row.change !== 'removed' ? (
        <p className={`${typography.panelMeta} text-text-light pl-6 mt-1 mb-0`} data-testid={`${WHATS_CHANGED_TESTID}-input-row-off-canvas`}>Not on the canvas now.</p>
      ) : null}
    </li>
  )
}

export function InputChangeRows({ inputs, rowFocus, rowLight, frame = 'rerun' }: {
  inputs: RunDeltaInputsView | null
  rowFocus?: InputRowFocus
  rowLight?: InputRowLight
  frame?: RunDeltaFrame
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const rows = inputs?.rows ?? []
  const partial = inputs?.coverage === 'partial'
  const empty = inputs === null ? null : emptyInputsText(inputs, frame)
  const shown = expanded ? rows : rows.slice(0, INPUT_ROWS_SHOWN_FIRST)
  const hidden = rows.length - INPUT_ROWS_SHOWN_FIRST
  return (
    <div data-testid={inputs ? `${WHATS_CHANGED_TESTID}-inputs` : undefined} data-coverage={inputs?.coverage} data-layout="rows">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h3 id="compare-input-changes-heading" className={`${typography.panelHeader} text-text-header m-0`} data-testid={`${WHATS_CHANGED_TESTID}-inputs-heading`}>
          {INPUT_CHANGE_ROWS_HEADING}
        </h3>
        {rows.length > 0 ? (
          <span className={`${typography.panelMeta} text-text-light whitespace-nowrap`} data-testid="compare-input-count">{inputChangeCount(rows.length, partial)}</span>
        ) : null}
      </div>
      {inputs === null ? (
        // Inputs are half of what Compare is for, so a pair without an input record says so rather than going quiet.
        <CoverageNote text="Input changes were not recorded for this pair." wireFields="run_delta.input_coverage" />
      ) : empty !== null ? (
        <CoverageNote
          text={empty}
          testId={`${WHATS_CHANGED_TESTID}-${inputs.coverage === 'not_recorded' ? 'inputs-not-recorded' : inputs.coverage === 'complete' ? 'inputs-unchanged' : 'inputs-partial'}`}
        />
      ) : (
        <>
          <ul className="list-none p-0 m-0" aria-labelledby="compare-input-changes-heading">
            {shown.map((row) => (
              <InputChangeRow
                key={row.key}
                row={row}
                frame={frame}
                rowFocus={rowFocus}
                rowLight={rowLight}
                selected={selectedKey === row.key}
                onSelect={() => setSelectedKey(row.key)}
              />
            ))}
          </ul>
          {hidden > 0 ? (
            <button
              type="button"
              className={`${typography.panelMeta} ${action('inline')} inline-flex items-center gap-1 mt-1`}
              data-testid={`${WHATS_CHANGED_TESTID}-inputs-toggle`}
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronDown className={icon('inline')} aria-hidden="true" /> : <ChevronRight className={icon('inline')} aria-hidden="true" />}
              {expanded ? 'Show fewer changes' : `See all ${rows.length} recorded changes`}
            </button>
          ) : null}
          {partial ? <div className="mt-2"><CoverageNote text={INPUTS_PARTIAL_TEXT} testId={`${WHATS_CHANGED_TESTID}-inputs-partial`} /></div> : null}
        </>
      )}
    </div>
  )
}
