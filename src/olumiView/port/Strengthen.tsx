/**
 * "Strengthen your model", restored (UI recovery row 17, DL 10 Nov 2026): the previous product's panel title and its focus rows
 * (`coaching-panel/focus-now`, the panel that held this slot), fed by core's View. Every word is core's, in core's order within each
 * source, never ranked here:
 * - each figure worth finding out (`run.science` worth lines): the figure's name; opened, core's line and its hover in full, with the
 *   figure's give words and ✎ in the caller's slot;
 * - each prompt about the model's shape (`model.sharpen`): its lead; opened, its emphasis and the method it rests on (`rationale`).
 * Core holds no steps, effort, status or priority, so the previous "Try this", "Not relevant" and "Mark addressed" are not drawn.
 */
import type { ReactNode } from 'react'
import { FocusNowPanel } from '../../canvas/components/coaching-panel/focus-now/FocusNowPanel'
import { FOCUS_TITLE } from '../../canvas/components/coaching-panel/focus-now/focusConstants'
import type { FocusRow } from '../../canvas/components/coaching-panel/focus-now/focusTypes'
import { SectionHeader } from '../../components/results/SectionHeader'
import type { ViewModel, ViewRun } from '../client'
import { worthLinesOf } from '../layout'
import { CORE_ROW } from './FocusNow'

export type WorthLine = NonNullable<ViewRun['science']>[number]
/** The previous rows' icons, by what a prompt is about. */
const SHARPEN_ICON = { risk_count: 'shield-alert', option_breadth: 'scale', shared_mechanism: 'lightbulb' } as const

export interface StrengthenProps {
  model: ViewModel
  /** Mounted in an opened worth row (its figure's give words and ✎, `science[].figure.give`). */
  giveAction?: (line: WorthLine, i: number) => ReactNode
}

export function Strengthen({ model, giveAction }: StrengthenProps) {
  const run = model.run ?? null
  const worth = run?.science == null ? [] : worthLinesOf(run.science)
  const sharpen = (model.sharpen ?? []).filter((s) => s.lead !== '' || s.emphasis !== '')
  if (worth.length + sharpen.length === 0) return null
  const rows: FocusRow[] = [
    ...worth.map(({ line: l }): FocusRow => ({
      ...CORE_ROW, id: `worth:${l.id}`, iconKey: 'target',
      primary: l.figure?.label ?? l.line,
      noticed: l.figure == null ? undefined : l.line,
      whyItMatters: l.hover !== '' && l.hover !== l.line ? l.hover : undefined,
    })),
    ...sharpen.map((s): FocusRow => ({
      ...CORE_ROW, id: `sharpen:${s.id}`, iconKey: SHARPEN_ICON[s.id],
      primary: s.lead !== '' ? s.lead : s.emphasis,
      noticed: s.lead !== '' && s.emphasis !== '' ? s.emphasis : undefined,
      whyItMatters: s.rationale !== '' ? s.rationale : undefined,
    })),
  ]
  const byRow = new Map(worth.map((w) => [`worth:${w.line.id}`, w]))
  return (
    <section className="space-y-2 rounded-lg border border-panel-border bg-panel p-3" data-testid="port-strengthen">
      <SectionHeader title={FOCUS_TITLE} testId="section-header-strengthen" className="mb-0" />
      <FocusNowPanel bare summary={null} rows={rows} banner={{ kind: 'none' }} showFreshnessBanner={false}
        rowExtra={giveAction === undefined ? undefined : (row) => { const w = byRow.get(row.id); return w === undefined ? null : giveAction(w.line, w.i) }} />
    </section>
  )
}

export default Strengthen
