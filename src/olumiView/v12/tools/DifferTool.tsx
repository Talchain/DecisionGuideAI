import { useEffect, useId, useRef, useState } from 'react'
import { NodeShapeIndicator } from '../../../canvas/nodes/NodeShapeIndicator'
import { differencesKey, useDifferences, type Difference } from '../../../olumiCore/team/differences'
import { typography } from '../../../styles/typography'
import type { View } from '../../client'
import { drawKindOf } from '../../layout'
import { FoldChevron, FOLD_SUMMARY } from '../../look/FoldChevron'
import { HoverButton } from '../../look/Hover'
import { OkIcon } from '../../look/icons'
import { pressCard, ringFrom } from '../../reasoning/tabRing'
import { useViewStore } from '../../store'
import { isDashedCardKind } from '../cards/kind'
import { cardOfRecord } from '../lenses/layers'
import { DifferAxis } from '../scale/DifferAxis'
import { useRevealedDifferences } from '../views/SimpleSummary'
import { COMPARE_WORDS } from '../views/WhereWeDiffer'
import { useDifferSelection } from './differSelection'

export const DIFFER_TOOL_WORDS = { all: 'All differences', more: 'More on this difference' } as const

const RING_SOURCE = 'tool-differ'
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header'
const ROW = `${typography.viewPanelBody} flex w-full items-start gap-1 rounded-sm border px-2 py-1 text-left text-text-header`
const differenceId = (d: Difference): string => JSON.stringify([d.record, d.goal])

function cardsFor(model: View['model'], d: Difference): readonly string[] {
  if (d.cards !== undefined) return d.cards
  const card = model == null ? undefined : cardOfRecord(model, d.record)
  return card === undefined ? [] : [card.id]
}

function DifferenceMark({ model, difference }: { model: View['model']; difference: Difference }): JSX.Element | null {
  // Direction colour waits on a typed sign on the difference (Core ask).
  if (difference.kind === 'link') return <OkIcon id="model-relationship" size={14} decorative />
  const [id] = cardsFor(model, difference)
  const card = model?.cards.find((c) => c.id === id)
  return card === undefined ? null : <NodeShapeIndicator nodeKind={drawKindOf(card, model ?? null)} dashedOutline={isDashedCardKind(card)} />
}

function DifferenceRow({ model, difference, holdersId }: { model: View['model']; difference: Difference; holdersId?: string }): JSX.Element {
  return (
    <>
      <DifferenceMark model={model} difference={difference} />
      <span className="grid min-w-0 gap-1 break-words">
        <span>{difference.label}</span>
        {difference.goal_label ? (
          <span className={`${typography.viewPanelMeta} text-text-light`}>{difference.goal_label}</span>
        ) : (
          <span id={holdersId} className={`${typography.viewPanelMeta} flex flex-wrap gap-1 text-text-light`}>
            {difference.sides.map((side) => (
              <span key={side.holder_id} className="inline-flex min-w-0 items-center gap-1 rounded-sm border border-panel-border px-1">
                <OkIcon id="person-mark" size={14} decorative inherit />
                <span className="min-w-0">{side.holder}</span>
              </span>
            ))}
          </span>
        )}
      </span>
    </>
  )
}

type DifferToolProps = { sid: string; view: View }

export function DifferTool(props: DifferToolProps): JSX.Element | null {
  const past = useViewStore((s) => s.at)
  return past === null ? <CurrentDifferTool {...props} /> : null
}

function CurrentDifferTool({ sid, view }: DifferToolProps): JSX.Element | null {
  const data = useRevealedDifferences(sid, view)
  const key = differencesKey(sid, view)
  const currentRead = useDifferences((s) => s.read === key)
  if (!currentRead || data === null || data.gated || data.version !== (view.version?.n ?? null) || data.differences.length === 0) return null
  return <RevealedTool key={sid} sid={sid} view={view} heading={data.heading} differences={data.differences} />
}

function RevealedTool({ sid, view, heading, differences }: { sid: string; view: View; heading: string; differences: readonly Difference[] }): JSX.Element {
  const choice = useDifferSelection((s) => s.bySid[sid])
  const [expanded, setExpanded] = useState(false)
  const pickerId = useId()
  const picker = useRef<HTMLButtonElement>(null)
  const chosen = differences.find((d) => differenceId(d) === choice) ?? differences[0]!
  const chosenId = differenceId(chosen)
  const cards = cardsFor(view.model, chosen)
  const firstCard = cards[0]
  const focusDescriptionId = firstCard === undefined ? undefined : `${pickerId}-canvas`

  useEffect(() => {
    ringFrom(RING_SOURCE, cards)
    return () => ringFrom(RING_SOURCE, [])
  }, [cards])

  return (
    <section data-form="TT-differ" data-testid="tool-differ" aria-label={heading} className="grid gap-3">
      <h2 className={`${typography.viewPanelHeading} text-text-header`}>{heading}</h2>
      <div className="grid gap-1">
        <button ref={picker} type="button" aria-expanded={expanded} aria-controls={pickerId}
          onClick={() => setExpanded(!expanded)}
          className={`${typography.viewPanelMeta} ${FOCUS} flex items-center gap-1 justify-self-start rounded-sm px-2 py-1 text-text-body hover:bg-panel-hover`}>
          <FoldChevron open={expanded} />{DIFFER_TOOL_WORDS.all} ({differences.length})
        </button>
        <div id={pickerId} hidden={!expanded}>
          {expanded && (
            <ul className="m-0 grid list-none gap-1 p-0">
              {differences.map((d, i) => {
                const id = differenceId(d)
                const holdersId = d.goal_label ? undefined : `${pickerId}-holders-${i}`
                return (
                  <li key={id}>
                    <HoverButton type="button" aria-pressed={id === chosenId} aria-describedby={holdersId} words={d.status_text}
                      onClick={() => {
                        useDifferSelection.getState().choose(sid, id)
                        setExpanded(false)
                        picker.current?.focus()
                      }}
                      className={`${ROW} ${FOCUS} border-transparent hover:bg-panel-hover aria-pressed:border-panel-border aria-pressed:bg-panel-hover`}>
                      <DifferenceRow model={view.model} difference={d} holdersId={holdersId} />
                    </HoverButton>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
      {focusDescriptionId && <span id={focusDescriptionId} hidden>{COMPARE_WORDS.toCanvas}</span>}
      <div className={`${ROW} border-panel-border bg-panel-hover`}>
        <DifferenceRow model={view.model} difference={chosen} />
      </div>
      <DifferAxis view={view} d={chosen} at={RING_SOURCE} showWords focusDescriptionId={focusDescriptionId}
        onFocusCard={firstCard === undefined ? undefined : () => pressCard(firstCard)} />
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
