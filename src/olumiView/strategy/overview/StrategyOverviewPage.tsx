/**
 * The Strategy Overview (board: overview-1232): the strategy read from the model as two columns of rows, in place of the canvas stage.
 * Each row is the item's shape, its title, one state pill and its holders. Every word comes from the View (see ./overview.ts).
 */
import { X } from 'lucide-react'
import type { View } from '../../client'
import { typography } from '../../../styles/typography'
import { META, BODY, H } from '../../../olumiCore/team/ui'
import { OlumiAiIcon } from '../../../components/results/analysisNew/OlumiAiIcon'
import { MAX_HOLDERS, overviewOf, type Family, type Group, type Holder, type Row } from './overview'

const SHAPE: Record<Family, string> = {
  question: 'bg-text-light [clip-path:polygon(50%_0,93%_25%,93%_75%,50%_100%,7%_75%,7%_25%)]',
  aim: 'bg-goal [clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)]',
  option: 'bg-option rounded-sm scale-[0.86]',
  factor: 'bg-factor rounded-full',
  risk: 'bg-danger [clip-path:polygon(4%_10%,96%_10%,50%_95%)]',
  item: 'border border-panel-border bg-canvas rounded-full',
}
const AVATAR = `inline-grid h-[22px] w-[22px] flex-none place-items-center rounded-full border border-panel-border bg-canvas ${typography.viewPanelMeta} font-semibold leading-none text-text-body`

/** Each holder as a disc with their initial; Olumi as a disc with Olumi's mark (the board's `who ol`), never a letter. */
function Holders({ holders }: { holders: Holder[] }): JSX.Element {
  return (
    <span className="flex justify-end">
      {holders.slice(0, MAX_HOLDERS).map((h, i) => (
        <span key={`${h.id}-${i}`} data-testid="holder" data-holder={h.id} title={h.name} aria-label={h.name} className={`${AVATAR} ${i > 0 ? '-ml-[7px] shadow-[0_0_0_2px_rgb(var(--bg-panel-rgb))]' : ''}`}>
          {h.id === 'olumi' ? <OlumiAiIcon size={14} aria-hidden="true" /> : (Array.from(h.name)[0] ?? '').toUpperCase()}
        </span>
      ))}
    </span>
  )
}

function Line({ row }: { row: Row }): JSX.Element {
  return (
    <li data-row={row.id} className="grid min-h-[36px] grid-cols-[14px_minmax(0,1fr)_auto_64px] items-center gap-2.5 rounded-md px-0 py-1.5">
      <span aria-hidden="true" data-shape={row.family} className={`h-[14px] w-[14px] ${SHAPE[row.family]}`} />
      <span className={`${BODY} text-text-header`}>{row.title}</span>
      {row.pill === '' ? <span /> : <span data-testid="pill" className={`whitespace-nowrap rounded-full border px-2 py-0.5 ${typography.viewPanelMeta} font-medium text-text-body ${row.info ? 'border-info/30' : 'border-panel-border'}`}>{row.pill}</span>}
      <Holders holders={row.holders} />
    </li>
  )
}

function Section({ group }: { group: Group }): JSX.Element {
  return (
    <section aria-label={group.heading} className="grid">
      <div className={`${META} mb-1 flex items-center gap-2 font-medium`}>
        {group.heading}
        {group.count !== null && <span data-testid="count" className="inline-grid h-5 min-w-[20px] place-items-center rounded-full border border-panel-border px-1.5 tabular-nums text-text-body">{group.count}</span>}
      </div>
      {group.rows.length === 0 ? <div className={`${BODY} py-1.5 text-text-light`}>{group.empty}</div> : <ul className="m-0 grid list-none gap-0 p-0">{group.rows.map((r) => <Line key={r.id} row={r} />)}</ul>}
    </section>
  )
}

export function StrategyOverviewPage({ view, onClose }: { view: View; onClose: () => void }): JSX.Element {
  const groups = overviewOf(view)
  const col = (ids: string[]) => groups.filter((g) => ids.includes(g.id))
  return (
    <div className="relative h-full w-full overflow-auto bg-panel" data-testid="strategy-overview-page">
      <div className="relative flex h-14 items-center justify-between pl-[106px] pr-4">
        <h2 className={`${H} ${typography.viewPanelMeta} font-medium text-text-light`}>{view.strategy?.overview.heading}</h2>
        <button type="button" aria-label={view.evidence_words.close} onClick={onClose} className="inline-grid h-9 w-9 place-items-center rounded-md text-text-body transition-colors duration-fast hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/50">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-[484px_484px] gap-x-[52px] pb-8 pl-[106px] pt-2">
        <div className="grid content-start gap-[22px]">{col(['question', 'aim', 'routes', 'assumptions']).map((g) => <Section key={g.id} group={g} />)}</div>
        <div className="grid content-start gap-[22px]">{col(['factors', 'risks', 'questions', 'commitments']).map((g) => <Section key={g.id} group={g} />)}</div>
      </div>
    </div>
  )
}
