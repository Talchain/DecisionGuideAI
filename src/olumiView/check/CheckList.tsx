import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import { typography } from '../../styles/typography'
import type { View, ViewModel } from '../client'
import { FigureEdit } from '../FigureEdit'
import { FoldChevron } from '../look/FoldChevron'
import { Hover } from '../look/Hover'
import { OkIcon } from '../look/icons'
import { TYPE } from '../port/type'
import { AnswerBox } from '../reasoning/AnswerBox'
import { useReasoningFocus } from '../reasoning/focusRequest'
import { ringFrom } from '../reasoning/tabRing'
import { useViewStore } from '../store'
import { recordReach, showRecord } from '../v12/showInWorkspace/show'
import { prefillComposer, runMethod } from '../ViewChat'
import { CHECK_WORDS, checkItemsOf, type CheckGroup, type CheckItem } from './items'

export const CHECK_FILL = 'Put this in the message box'
export const CHECK_SHOW = 'Show in the workspace'
const SELECTED_RING = 'check-tab-selected'
const HOVER_RING = 'check-tab-hover'
const AT_REST = { needs: 2, find: 2, examine: 1 }
const QUIET = `${TYPE.meta} inline-flex min-h-7 items-center gap-1 rounded-sm border border-panel-border px-2 text-text-header hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`
const MORE = `${TYPE.meta} min-h-6 px-1 text-text-light underline underline-offset-2 hover:text-text-header`

function FillBox({ text }: { text: string }) {
  return <button type="button" className={QUIET} onClick={() => prefillComposer(text)}><OkIcon id="fill-box" size={14} decorative />{CHECK_FILL}</button>
}

function ItemAction({ action }: { action: CheckItem['action'] }) {
  const canAnswer = useViewStore((s) => s.sid !== null && s.at === null)
  switch (action.kind) {
    case 'none': return null
    case 'edit':
      return <FigureEdit id={action.id} edit={action.edit} place="check" glyph words={false} label={`Give a figure for ${action.label}`} />
    case 'method':
      return <button type="button" className={QUIET} onClick={() => runMethod(action.id)} data-testid="reasoning-method"><OkIcon id="method-mark" size={14} decorative /><span data-view-words={action.words.at}>{action.words.text}</span></button>
    case 'answer':
      return canAnswer ? <AnswerBox key={action.question.id} q={action.question} /> : <FillBox text={action.question.text} />
    case 'fill':
      return <FillBox text={action.text} />
    case 'show':
      return <button type="button" className={QUIET} onClick={() => void showRecord(action.id)}><OkIcon id="show-in-workspace" size={14} decorative />{CHECK_SHOW}</button>
  }
}

function CheckRow({ item, selected, tabIndex, select, onFocus }: {
  item: CheckItem
  selected: boolean
  tabIndex: number
  select: () => void
  onFocus: () => void
}) {
  const details = useId()
  const hovered = useRef(false)
  const [openedAnswer, setOpenedAnswer] = useState(false)
  const isAnswer = item.action.kind === 'answer'
  const hasDetails = item.long.length > 0 || item.action.kind !== 'none'
  useLayoutEffect(() => {
    if (selected && isAnswer) setOpenedAnswer(true)
  }, [selected, isAnswer])
  useLayoutEffect(() => () => {
    if (hovered.current) ringFrom(HOVER_RING, [])
  }, [])
  const modelWords = item.kind === 'question' || item.kind === 'widen'
  return (
    <li>
      <Hover as="button" type="button" words={selected ? undefined : item.long[0]?.text} wordsAt={item.long[0]?.at}
        tabIndex={tabIndex} {...(hasDetails ? { 'aria-expanded': selected, 'aria-controls': details } : { 'aria-pressed': selected })}
        data-check-item={item.key} data-selected={selected}
        onClick={select} onFocus={onFocus}
        onPointerEnter={(event) => {
          if (event.pointerType === 'touch') return
          hovered.current = true
          ringFrom(HOVER_RING, item.cards)
        }}
        onPointerLeave={() => { hovered.current = false; ringFrom(HOVER_RING, []) }}
        className={`${TYPE.body} flex w-full items-start gap-2 rounded-sm px-1 py-1.5 text-left text-text-header hover:bg-panel-hover aria-expanded:bg-panel-hover aria-pressed:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`}>
        <OkIcon id={item.icon} size={14} className="mt-0.5 shrink-0" decorative />
        <span className={selected ? 'min-w-0' : 'min-w-0 line-clamp-2'} {...(modelWords ? { 'data-view-words': item.at } : { 'data-view': item.at })}>{item.short}</span>
      </Hover>
      {hasDetails ? <div id={details} hidden={!selected}>
        {selected || (isAnswer && openedAnswer) ? <div className="space-y-1 pb-2 pl-6 pr-1">
          {item.long.map(({ text, at }) => <p key={at} className={`${TYPE.meta} m-0 text-text-body`} data-view={at}>{text}</p>)}
          <ItemAction action={item.action} />
        </div> : null}
      </div> : null}
    </li>
  )
}

function CheckSection({ group, all, shown, toggle, renderRow }: {
  group: CheckGroup
  all: boolean
  shown: CheckItem[]
  toggle: () => void
  renderRow: (item: CheckItem) => JSX.Element
}) {
  const region = useId()
  const count = group.blocks.reduce((n, block) => n + block.items.length, 0)
  const visible = new Set(shown)
  const blocks = group.blocks.filter((b) => b.items.length > 0 || b.line !== undefined)
  const foldedItems = Math.max(0, count - AT_REST[group.kind])
  const foldedLines = blocks.filter((block) => block.line !== undefined).length
  // If all figures already fit, the heading opens the scope without adding a row.
  const discloseFromHeading = foldedItems === 0 && foldedLines > 0
  if (blocks.length === 0) return null
  const heading = <>
    <span data-view={group.at}>{group.heading}</span>
    <span className={`${TYPE.meta} tabular-nums text-text-light`} data-count>{count}</span>
  </>
  return (
    <section className="space-y-1" data-check-group={group.kind}>
      <h3 className={`${typography.viewPanelHeading} m-0 flex items-center gap-2 text-text-header`} data-check-heading>
        {discloseFromHeading ? (
          <button type="button" aria-expanded={all} aria-controls={region} onClick={toggle} data-check-more={group.kind} data-check-heading-toggle
            className="flex w-full items-center gap-2 rounded-sm text-left hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header">
            {heading}
            <FoldChevron open={all} className="ml-auto text-text-light" />
          </button>
        ) : heading}
      </h3>
      <div id={region} className="space-y-1">
        {blocks.map((block) => {
          const rows = block.items.filter((item) => visible.has(item))
          return (
            <div key={block.key} className="space-y-1">
              {block.heading === undefined || (!all && blocks.length === 1) ? null : <p className={`${TYPE.meta} m-0 text-text-light`} data-view={block.heading.at} data-check-aim-heading>{block.heading.text}</p>}
              {!all || block.line === undefined ? null : <p className="ok-an-scope" data-view={block.line.at} data-check-aim-line>{block.line.text}</p>}
              {rows.length === 0 ? null : <ul className="m-0 list-none divide-y divide-panel-border p-0">
                {rows.map(renderRow)}
              </ul>}
            </div>
          )
        })}
      </div>
      {foldedItems === 0 ? null : (
        <button type="button" className={MORE} aria-expanded={all} aria-controls={region} onClick={toggle} data-check-more={group.kind}>
          {all ? CHECK_WORDS.fewer : CHECK_WORDS.more(foldedItems + foldedLines)}
        </button>
      )}
    </section>
  )
}

type CheckListProps = { model: ViewModel; view: View | null; sid: string | null }

export function CheckList(props: CheckListProps) {
  return <ScenarioCheckList key={props.sid} {...props} />
}

function ScenarioCheckList({ model, view, sid }: CheckListProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Partial<Record<CheckGroup['kind'], boolean>>>({})
  const root = useRef<HTMLElement>(null)
  const selectionVersion = useRef(0)
  useLayoutEffect(() => () => { selectionVersion.current += 1 }, [])
  const request = useReasoningFocus((s) => s.request)
  const checkGroups = useMemo(() => checkItemsOf(model, view), [model, view])
  const groups = checkGroups.map((group) => {
    const items = group.blocks.flatMap((block) => block.items)
    return { group, items, shown: expanded[group.kind] ? items : items.slice(0, AT_REST[group.kind]) }
  })
  const shown = groups.flatMap((section) => section.shown)
  const active = shown.find((item) => item.key === selected)
  const tabStop = shown.find((item) => item.key === focused) ?? shown[0]

  function rowButtons() {
    return [...(root.current?.querySelectorAll<HTMLButtonElement>('[data-check-item]') ?? [])]
  }

  function clearSelection() {
    selectionVersion.current += 1
    setSelected(null)
  }

  async function select(item: CheckItem) {
    const version = ++selectionVersion.current
    setSelected(item.key)
    if (item.cards.length !== 1) return
    const id = item.cards[0]!
    const reach = recordReach(id)
    if (reach === 'show') {
      await showRecord(id)
      if (version === selectionVersion.current && useViewStore.getState().sid === sid && recordReach(id) === 'card') focusNodeById(id)
    }
    if (reach === 'card') focusNodeById(id)
  }

  const selectedCards = active?.cards
  useLayoutEffect(() => {
    ringFrom(SELECTED_RING, selectedCards ?? [])
    return () => ringFrom(SELECTED_RING, [])
  }, [selectedCards])

  useLayoutEffect(() => {
    if (selected !== null && active === undefined) clearSelection()
    if (request === null || request.sid !== sid || request.key === 'commitment' || useReasoningFocus.getState().request !== request) return
    const section = groups.find(({ items }) => items.some((item) => item.key === request.key))
    const item = section?.items.find((item) => item.key === request.key)
    if (section === undefined || item === undefined) {
      useReasoningFocus.setState({ request: null })
      return
    }
    if (!section.shown.includes(item)) {
      setExpanded((current) => ({ ...current, [section.group.kind]: true }))
      return
    }
    const button = rowButtons().find((row) => row.dataset.checkItem === item.key)
    if (button === undefined) return
    useReasoningFocus.setState({ request: null })
    void select(item)
    button.focus({ preventScroll: true })
    button.scrollIntoView?.({ block: 'nearest' })
  })

  function moveFocus(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    const rows = rowButtons()
    const index = rows.indexOf(event.target as HTMLButtonElement)
    if (index === -1) return
    event.preventDefault()
    rows[index + (event.key === 'ArrowDown' ? 1 : -1)]?.focus()
  }

  if (groups.every(({ group, items }) => items.length === 0 && group.blocks.every((block) => block.line === undefined))) return null
  return (
    <section ref={root} className="space-y-2" aria-label={CHECK_WORDS.title} data-testid="check-list" onKeyDown={moveFocus}>
      {groups.map(({ group, items, shown }) => {
        const all = expanded[group.kind] ?? false
        return <CheckSection key={group.kind} group={group} all={all} shown={shown}
          toggle={() => {
            if (all && items.slice(AT_REST[group.kind]).some((item) => item.key === selected)) {
              clearSelection()
              root.current?.querySelector<HTMLButtonElement>(`[data-check-more="${group.kind}"]`)?.focus()
            }
            setExpanded((current) => ({ ...current, [group.kind]: !all }))
          }}
          renderRow={(item) => <CheckRow key={item.key} item={item} selected={item.key === selected}
            tabIndex={item === tabStop ? 0 : -1} onFocus={() => setFocused(item.key)}
            select={() => item.key === selected ? clearSelection() : void select(item)} />} />
      })}
    </section>
  )
}
