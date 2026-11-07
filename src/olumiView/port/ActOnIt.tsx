/**
 * The crafted "What to act on next" section (`components/results/analysis-hero/actOnIt/ActOnItSection.tsx` and `ActOnItActionRow.tsx`),
 * ported onto olumi.view/3: the same tinted rows with a category dot, title, reason and a right-hand action cluster, the first few shown and
 * the rest behind "+N more". Its rows are core's, in core's order within each source, never ranked here:
 * - each figure the chances wait on (`run.waits_on.items`): its name as the title, core's question about it as the reason;
 * - each prompt about the model's shape (`model.sharpen`): its lead and emphasis as the title, the method it rests on (`rationale`) as the reason.
 * The action cluster is the caller's (`action`: the item's ✎, or the prompt's coach move), because those controls read the store.
 * Core holds no steps, effort or priority (core-port-fields, 7 Nov), so the crafted "Try this" steps and minutes are not drawn.
 */
import type { ReactNode } from 'react'
import type { ViewModel } from '../client'
import { firstFew } from '../layout'
import { actRowsOf, type ActRow } from './pick'
import { TYPE } from './type'

/** The crafted row tints and dots (actOnIt/tokens.ts), by what the row is about. */
const TINT = { evidence: 'bg-warning/[0.07]', risk: 'bg-danger/[0.07]', coverage: 'bg-info/[0.07]', causal: 'bg-factor/[0.07]' } as const
const DOT = { evidence: 'bg-warning', risk: 'bg-danger', coverage: 'bg-info', causal: 'bg-factor' } as const
type Category = keyof typeof TINT
const categoryOf = (r: ActRow): Category => (r.kind === 'wait' ? 'evidence' : r.item.id === 'risk_count' ? 'risk' : r.item.id === 'option_breadth' ? 'coverage' : 'causal')

/** The crafted section shows three rows before "+N more". */
export const ACT_SHOWN = 3

export interface ActOnItProps {
  model: ViewModel
  /** The row's action cluster (e.g. `<FigureEdit>` for a waits-on item with `edit`, the coach move for a prompt's `move`). */
  action?: (row: ActRow) => ReactNode
}

function Row({ row, action }: { row: ActRow; action?: (row: ActRow) => ReactNode }) {
  const c = categoryOf(row)
  const at = row.kind === 'wait' ? `run.waits_on.items.${row.i}` : `sharpen.${row.i}`
  const act = action?.(row)
  return (
    <article className={`px-2.5 py-2 ${TINT[c]}`} data-testid={`port-act-row-${c}`} data-act={row.key}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-start gap-1.5">
            <span aria-hidden="true" className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${DOT[c]}`} />
            <p className={`${TYPE.body} min-w-0 flex-1 break-words font-medium text-text-header`} data-testid="port-act-row-title">
              {row.kind === 'wait'
                ? <span data-view={`${at}.text`}>{row.item.text}</span>
                : <><span data-view={`${at}.lead`}>{row.item.lead}</span> <span data-view={`${at}.emphasis`}>{row.item.emphasis}</span></>}
            </p>
          </div>
          {row.kind === 'wait'
            ? (row.item.title === '' || row.item.title === row.item.text ? null : <p className={`${TYPE.body} break-words text-text-body`} data-testid="port-act-row-reason" data-view={`${at}.title`}>{row.item.title}</p>)
            : (row.item.rationale === '' ? null : <p className={`${TYPE.body} break-words text-text-body`} data-testid="port-act-row-reason" data-view={`${at}.rationale`}>{row.item.rationale}</p>)}
        </div>
        {act == null ? null : <div className="flex flex-shrink-0 items-center gap-1" role="group" data-testid="port-act-row-actions">{act}</div>}
      </div>
    </article>
  )
}

export function ActOnIt({ model, action }: ActOnItProps) {
  const rows = actRowsOf(model)
  if (rows.length === 0) return null
  const split = firstFew(rows, ACT_SHOWN)
  return (
    <section aria-label="What to act on next" data-testid="port-act-on-it" className="space-y-1.5">
      <h3 className={`${TYPE.body} font-medium text-text-header`}>What to act on next</h3>
      <div className="space-y-1 overflow-hidden rounded-lg border border-panel-border">
        {split.shown.map((r) => <Row key={r.key} row={r} action={action} />)}
      </div>
      {split.more.length === 0 ? null : (
        <details data-testid="port-act-on-it-more" className="space-y-1">
          <summary className={`${TYPE.meta} cursor-pointer text-info`}>{`+${split.more.length} more`}</summary>
          <div className="space-y-1 overflow-hidden rounded-lg border border-panel-border">
            {split.more.map((r) => <Row key={r.key} row={r} action={action} />)}
          </div>
        </details>
      )}
    </section>
  )
}

export default ActOnIt
