import { useEffect, useId } from 'react'
import { NodeShapeIndicator } from '../../../canvas/nodes/NodeShapeIndicator'
import { useCanvasStore } from '../../../canvas/store'
import { focusNodeById } from '../../../canvas/utils/focusHelpers'
import { differencesKey, readDifferences, useDifferences, type Difference } from '../../../olumiCore/team/differences'
import { typography } from '../../../styles/typography'
import type { View } from '../../client'
import { drawKindOf } from '../../layout'
import { FoldChevron, FOLD_SUMMARY } from '../../look/FoldChevron'
import { HoverButton } from '../../look/Hover'
import { OkIcon } from '../../look/icons'
import { ringFrom } from '../../reasoning/tabRing'
import { useViewStore } from '../../store'
import { isDashedCardKind } from '../cards/kind'
import { cardOfRecord } from '../lenses/layers'
import { DifferAxis } from '../scale/DifferAxis'
import { revealedForYou } from '../views/differGroups'
import { useDifferSelection } from './differSelection'

export const DIFFER_TOOL_WORDS = { more: 'More on this difference' } as const

const RING_SOURCE = 'tool-differ'
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header'
const differenceId = (d: Difference): string => JSON.stringify([d.record, d.goal])

function cardsFor(model: View['model'], d: Difference): readonly string[] {
  if (d.cards !== undefined) return d.cards
  const card = model == null ? undefined : cardOfRecord(model, d.record)
  return card === undefined ? [] : [card.id]
}

function DifferenceMark({ model, difference }: { model: View['model']; difference: Difference }): JSX.Element | null {
  if (difference.kind === 'link') {
    // Core identifies a link difference as link:<record>[:<part>], from the same reference as its stance.
    const links = model?.links.filter((link) => {
      const ref = link.holds ?? link.remove
      return ref == null
        ? link.records.some((record) => difference.record === `link:${record}`)
        : difference.record === `link:${ref.record}${ref.part ? `:${ref.part}` : ''}`
    })
    const sign = links?.length === 1 ? links[0]!.causal?.sign : undefined
    const tone = sign === 'increases' ? 'text-[color:var(--edge-positive)]'
      : sign === 'decreases' ? 'text-[color:var(--edge-negative)]' : 'text-[color:var(--edge-neutral)]'
    return <OkIcon id="model-relationship" size={14} decorative inherit className={tone} />
  }
  const [id] = cardsFor(model, difference)
  const card = model?.cards.find((c) => c.id === id)
  return card === undefined ? null : <NodeShapeIndicator nodeKind={drawKindOf(card, model ?? null)} dashedOutline={isDashedCardKind(card)} />
}

export function DifferTool({ sid, view }: { sid: string; view: View }): JSX.Element | null {
  const current = useViewStore((s) => s.at) === null
  const key = current && revealedForYou(view) ? differencesKey(sid, view) : null
  const lastAttempt = useDifferences((s) => s.key)
  const data = useDifferences((s) => key !== null && s.read === key ? s.data : null)
  useEffect(() => {
    if (key !== null && key !== lastAttempt) void readDifferences(sid, key)
  }, [sid, key, lastAttempt])

  if (data === null || data.gated || data.version !== (view.version?.n ?? null) || data.differences.length === 0) return null
  return <RevealedTool sid={sid} view={view} heading={data.heading} differences={data.differences} />
}

function RevealedTool({ sid, view, heading, differences }: { sid: string; view: View; heading: string; differences: readonly Difference[] }): JSX.Element {
  const choice = useDifferSelection((s) => s.bySid[sid])
  const pickerId = useId()
  const chosen = differences.find((d) => differenceId(d) === choice) ?? differences[0]!
  const chosenId = differenceId(chosen)
  const cards = cardsFor(view.model, chosen)
  const firstCard = cards[0]
  const pathCard = cards.length === 1 ? firstCard : undefined

  useEffect(() => {
    ringFrom(RING_SOURCE, cards)
    return () => ringFrom(RING_SOURCE, [])
  }, [cards])

  useEffect(() => {
    if (pathCard === undefined) return
    const canvas = useCanvasStore.getState()
    const { nodeIds, edgeIds } = canvas.selection
    if (nodeIds.size === 1 && nodeIds.has(pathCard) && edgeIds.size === 0) return
    // Mark the path in Simple without moving the camera.
    canvas.selectNodes([pathCard])
    const ours = useCanvasStore.getState().selection.nodeIds
    return () => {
      const latest = useCanvasStore.getState()
      if (latest.selection.nodeIds === ours && ours.size === 1 && ours.has(pathCard) && latest.selection.edgeIds.size === 0) {
        latest.clearSelection()
      }
    }
  }, [sid, chosenId, pathCard])

  return (
    <section data-form="TT-differ" data-testid="tool-differ" aria-label={heading} className="grid gap-3">
      <h2 className={`${typography.viewPanelHeading} text-text-header`}>{heading}</h2>
      <ul className="m-0 grid list-none gap-1 p-0">
        {differences.map((d, i) => {
          const id = differenceId(d)
          const showHolders = !d.goal_label
          const holdersId = showHolders ? `${pickerId}-holders-${i}` : undefined
          return (
            <li key={id}>
              <HoverButton type="button" aria-pressed={id === chosenId} aria-describedby={holdersId} words={d.status_text}
                onClick={() => useDifferSelection.getState().choose(sid, id)}
                className={`${typography.viewPanelBody} ${FOCUS} flex w-full items-start gap-1.5 rounded-sm border border-transparent px-2 py-1 text-left text-text-header hover:bg-panel-hover aria-pressed:border-panel-border aria-pressed:bg-panel-hover`}>
                <DifferenceMark model={view.model} difference={d} />
                <span className="grid min-w-0 gap-0.5 break-words">
                  <span>{d.label}</span>
                  {d.goal_label && <span className={`${typography.viewPanelMeta} text-text-light`}>{d.goal_label}</span>}
                  {showHolders && <span id={holdersId} className={`${typography.viewPanelMeta} flex flex-wrap gap-1 text-text-light`}>
                    {d.sides.map((side) => (
                      <span key={side.holder_id} className="inline-flex min-w-0 items-center gap-1 rounded-sm border border-panel-border px-1">
                        <OkIcon id="person-mark" size={14} decorative inherit />
                        <span className="min-w-0">{side.holder}</span>
                      </span>
                    ))}
                  </span>}
                </span>
              </HoverButton>
            </li>
          )
        })}
      </ul>
      <DifferAxis view={view} d={chosen} at={RING_SOURCE} showWords
        onFocusCard={firstCard === undefined ? undefined : () => focusNodeById(firstCard)} />
      <details>
        <summary className={`${FOLD_SUMMARY} ${typography.viewPanelMeta} ${FOCUS} cursor-pointer rounded-sm text-text-body`}>
          <FoldChevron />{DIFFER_TOOL_WORDS.more}
        </summary>
        <ul className={`${typography.viewPanelMeta} m-0 mt-2 grid list-none gap-1 break-words p-0 text-text-body`}>
          <li>{chosen.status_text}</li>
          {chosen.sides.map((s) => <li key={s.holder_id}>{s.title}</li>)}
          {chosen.settle.map((s, i) => <li key={i}>{s.text}</li>)}
        </ul>
      </details>
    </section>
  )
}
