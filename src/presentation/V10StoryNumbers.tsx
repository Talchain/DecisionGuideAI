/**
 * v10 (#/canvas2), "If it failed": Olumi's failure stories are NUMBERED, and each number stands beside the cards the
 * story rests on, so the person can see where on the model a story bites. The same number leads the story in the key
 * card. Mounted only when `usePresentation() === 'v10'`, so `#/canvas` is unchanged.
 *
 * Nothing is computed afresh: the stories are the served worksheet's rows (`useCurrentPremortemWorksheet`), their
 * order is the order the key card already draws them in (option by option, in the model's order), and "rests on" is
 * the row's own `grounding.ids`, resolved by identity (`resolveModelTarget`, the lens's own resolver). A story that
 * rests on a link or on nothing in the model puts no number on a card; the link keeps the lens's existing glow.
 *
 * The disc is ink (the person's colour): blue is reserved for Olumi's own figures, and the stories are already marked
 * as Olumi's hypotheses in the key card. Nothing dims.
 */
import { useMemo } from 'react'
import { useCanvasStore } from '../canvas/store'
import { useCurrentPremortemWorksheet } from '../canvas/artefacts/lenses'
import { resolveModelTarget } from '../canvas/utils/focusHelpers'
import type { PremortemWorksheetV1 } from '../v5/readPremortemWorksheet'
import { typography } from '../styles/typography'

type Row = PremortemWorksheetV1['rows'][number]
interface NodeLike { id: string; type?: string }
interface EdgeLike { id: string; source: string; target: string; data?: unknown }

/** Story numbers by row, 1 upwards, in the order the key card draws the stories: each option's rows, options in model order. */
export function premortemStoryNumbers(worksheet: PremortemWorksheetV1, nodes: ReadonlyArray<NodeLike>): Map<string, number> {
  const numbers = new Map<string, number>()
  let n = 0
  for (const option of nodes.filter((node) => node.type === 'option')) {
    for (const row of worksheet.rows) {
      if (row.option_id === option.id) numbers.set(row.row_id, ++n)
    }
  }
  return numbers
}

/** The story numbers that stand on each card: a row's number goes on every CARD its grounding names (links name no card). */
export function premortemNumbersOnCards(
  worksheet: PremortemWorksheetV1,
  nodes: ReadonlyArray<NodeLike>,
  edges: ReadonlyArray<EdgeLike>,
): Map<string, number[]> {
  const byRow = premortemStoryNumbers(worksheet, nodes)
  const onCards = new Map<string, number[]>()
  for (const row of worksheet.rows as ReadonlyArray<Row>) {
    const n = byRow.get(row.row_id)
    if (n === undefined || row.grounding.kind === 'not_in_model') continue
    for (const id of row.grounding.ids) {
      const hit = resolveModelTarget(id, nodes, edges, { endpointFallback: false })
      if (hit?.kind !== 'node') continue
      const held = onCards.get(hit.id) ?? []
      if (!held.includes(n)) onCards.set(hit.id, [...held, n].sort((a, b) => a - b))
    }
  }
  return onCards
}

const DISC_CLASS = `${typography.edgeLabel} inline-grid flex-none place-items-center rounded-full font-bold tabular-nums`
const DISC_STYLE = { background: 'var(--text-header, #262626)', color: 'var(--text-on-color, #FFFFFF)' } as const

/** The number that leads a story in the key card. */
export function V10StoryNo({ n }: { n: number }) {
  return (
    <span data-testid="v10-story-no" data-n={n} aria-hidden="true" className={DISC_CLASS} style={{ ...DISC_STYLE, width: 18, height: 18 }}>
      {n}
    </span>
  )
}

function Discs({ nodeId }: { nodeId: string }) {
  const worksheet = useCurrentPremortemWorksheet()
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const numbers = useMemo(
    () => (worksheet ? premortemNumbersOnCards(worksheet, nodes, edges).get(nodeId) ?? [] : []),
    [worksheet, nodes, edges, nodeId],
  )
  if (numbers.length === 0) return null
  return (
    <span
      data-testid="v10-story-discs"
      role="img"
      aria-label={numbers.length === 1 ? `Failure story ${numbers[0]} rests on this card` : `Failure stories ${numbers.join(' and ')} rest on this card`}
      className="pointer-events-none absolute z-10 flex gap-1"
      style={{ left: -10, top: -10 }}
    >
      {numbers.map((n) => (
        <span key={n} className={DISC_CLASS} style={{ ...DISC_STYLE, width: 20, height: 20 }}>{n}</span>
      ))}
    </span>
  )
}

/** On a card: the numbers of the failure stories that rest on it, while "If it failed" is the lens on screen. */
export function V10StoryDiscs({ nodeId }: { nodeId: string }) {
  const active = useCanvasStore((s) => s.lens.active === 'premortem')
  return active ? <Discs nodeId={nodeId} /> : null
}
