/**
 * "Focus now", restored (UI recovery row 17, DL 10 Nov 2026): what to do next, in the previous product's focus rows
 * (`coaching-panel/focus-now/FocusNowPanel`), fed by core's View. Every word is core's:
 * - the coach's newest next step (`chat[].answer.next`), whole and at rest, with its move in the caller's slot;
 * - each figure the chances wait on (`run.waits_on.items`) as a row under core's own label: its name, and opened, core's question about
 *   it and why it stays in words, with the figure's edit in the caller's slot.
 * Core's order, nothing ranked. Nothing here when core sends neither.
 */
import type { ReactNode } from 'react'
import { FocusNowPanel } from '../../canvas/components/coaching-panel/focus-now/FocusNowPanel'
import type { FocusRow } from '../../canvas/components/coaching-panel/focus-now/focusTypes'
import { SectionHeader } from '../../components/results/SectionHeader'
import type { ViewModel, ViewRun, ViewTurn } from '../client'
import { newestNextOf } from '../layout'
import { Words } from '../ViewChat'
import { TYPE } from './type'

export type WaitItem = NonNullable<ViewRun['waits_on']>['items'][number]
/** Core's own source name on a row the previous panel draws (its `source` is free text; the lane has one source). */
export const CORE_ROW = { ownership: 'server_sourced', source: 'olumi_core' } as const
const waitKey = (id: string): string => `wait:${id}`

export interface FocusNowProps {
  model: ViewModel
  chat?: readonly ViewTurn[] | null
  /** Mounted after the next step's words (the conversation's move tap). */
  nextAction?: ReactNode
  /** Mounted in an opened waits-on row (the figure's ✎). */
  waitAction?: (item: WaitItem) => ReactNode
}

export function FocusNow({ model, chat = null, nextAction, waitAction }: FocusNowProps) {
  const next = newestNextOf(chat)
  const waits = model.run?.waits_on ?? null
  const items = (waits?.items ?? []).filter((it) => it.text !== '')
  if (next === null && items.length === 0) return null
  const rows: FocusRow[] = items.map((it) => ({
    ...CORE_ROW, id: waitKey(it.id), primary: it.text, iconKey: 'clock',
    noticed: it.title !== '' && it.title !== it.text ? it.title : undefined,
    whyItMatters: it.stays_in_words,
  }))
  const byRow = new Map(items.map((it) => [waitKey(it.id), it]))
  return (
    <section className="space-y-2 rounded-lg border border-panel-border bg-panel p-3" data-testid="port-focus-now">
      <SectionHeader title="Focus now" testId="section-header-focus-now" className="mb-0" />
      {next === null ? null : (
        <div className={`${TYPE.body} flex items-start gap-2`} data-testid="port-focus-next">
          <p className="min-w-0 flex-1"><span className="font-medium text-text-header" data-view={`chat.${next.k}.answer.next.label`}>{next.next.label}</span> <Words parts={next.next.text} at={`chat.${next.k}.answer.next.text`} first={next.first} /></p>
          {nextAction}
        </div>
      )}
      {rows.length === 0 ? null : (
        <div data-testid="port-focus-waits">
          <p className={`${TYPE.meta} text-text-light`} data-view="run.waits_on.label">{waits!.label}</p>
          <FocusNowPanel bare whole summary={null} rows={rows} banner={{ kind: 'none' }} showFreshnessBanner={false}
            rowExtra={waitAction === undefined ? undefined : (row) => { const it = byRow.get(row.id); return it === undefined ? null : waitAction(it) }} />
        </div>
      )}
    </section>
  )
}

export default FocusNow
