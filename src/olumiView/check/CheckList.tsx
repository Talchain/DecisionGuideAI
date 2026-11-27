import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { NodeShapeIndicator } from '../../canvas/nodes/NodeShapeIndicator'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import { transitions } from '../../styles/transitions'
import { typography } from '../../styles/typography'
import type { View, ViewCard, ViewModel } from '../client'
import { FigureEdit } from '../FigureEdit'
import { useStoredFocusSubject } from '../focus/state'
import { setFocusSubject, useFocusSubject } from '../focus/subject'
import { drawKindOf } from '../layout'
import { FoldChevron } from '../look/FoldChevron'
import { GlyphMark, Hover } from '../look/Hover'
import { OkIcon } from '../look/icons'
import { TYPE } from '../port/type'
import { AnswerBox } from '../reasoning/AnswerBox'
import { useReasoningFocus } from '../reasoning/focusRequest'
import { ringFrom } from '../reasoning/tabRing'
import { useViewStore } from '../store'
import { isDashedCardKind } from '../v12/cards/kind'
import { optionLetters } from '../v12/cards/letters'
import { LetterChip } from '../v12/cards/marks'
import { recordReach, showRecord } from '../v12/showInWorkspace/show'
import { FaceMark } from '../v12/SimpleFace'
import { prefillComposer, runMethod } from '../ViewChat'
import { checkItemsOf, type CheckGroup, type CheckItem } from './items'
import { CHECK_WORDS } from './words'

export const CHECK_FILL = 'Put this in the message box'
export const CHECK_SHOW = 'Show in the workspace'
const HOVER_RING = 'check-tab-hover'
const AT_REST = { needs: 4, find: 2, examine: 1 }
const QUIET = `${TYPE.meta} inline-flex min-h-7 items-center gap-1 rounded-sm border border-panel-border px-2 text-text-header hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`
const MORE = `${TYPE.meta} min-h-6 px-1 text-text-light underline underline-offset-2 hover:text-text-header`
const ITEM = `w-full min-w-0 rounded-sm text-left text-text-header hover:bg-panel-hover aria-expanded:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header ${transitions.colors} motion-reduce:transition-none`

function FillBox({ text }: { text: string }) {
  return <button type="button" className={QUIET} onClick={() => prefillComposer(text)}><OkIcon id="fill-box" size={14} decorative />{CHECK_FILL}</button>
}

function ItemAction({ action }: { action: CheckItem['action'] }) {
  switch (action.kind) {
    case 'none': return null
    case 'edit':
      return <FigureEdit id={action.id} edit={action.edit} place="check" glyph words={false} lead={action.lead} label={`Give a figure for ${action.label}`} />
    case 'method':
      return <button type="button" className={QUIET} onClick={() => runMethod(action.id)} data-testid="reasoning-method"><OkIcon id="method-mark" size={14} decorative /><span data-view-words={action.words.at}>{action.words.text}</span></button>
    case 'answer':
      return <AnswerBox key={action.question.id} q={action.question} />
    case 'fill':
      return <FillBox text={action.text} />
    case 'show':
      return <button type="button" className={QUIET} onClick={() => void showRecord(action.id)}><OkIcon id="show-in-workspace" size={14} decorative />{CHECK_SHOW}</button>
  }
}

function CheckRow({ item, tile, selected, tabIndex, select, onFocus }: {
  item: CheckItem
  tile?: { card: ViewCard; kind: ReturnType<typeof drawKindOf>; letter?: string }
  selected: boolean
  tabIndex: number
  select: () => void
  onFocus: () => void
}) {
  const details = useId()
  const hovered = useRef(false)
  const [openedAnswer, setOpenedAnswer] = useState(false)
  const canAnswer = useViewStore((s) => s.sid !== null && s.at === null)
  const action: CheckItem['action'] = item.action.kind === 'answer' && !canAnswer
    ? { kind: 'fill', text: item.action.question.text }
    : item.action
  const isAnswer = item.action.kind === 'answer'
  const hover = tile === undefined ? item.long[0] : { text: item.short, at: item.at }
  useLayoutEffect(() => {
    if (selected && isAnswer) setOpenedAnswer(true)
  }, [selected, isAnswer])
  useLayoutEffect(() => () => {
    if (hovered.current) ringFrom(HOVER_RING, [])
  }, [])
  const modelWords = item.kind === 'question' || item.kind === 'widen'
  return (
    <li className={tile === undefined ? undefined : 'contents'} role="listitem">
      <Hover as="button" type="button" words={selected ? undefined : hover?.text} wordsAt={hover?.at}
        tabIndex={tabIndex} aria-expanded={selected} aria-controls={details}
        data-check-item={item.key} data-selected={selected} data-check-tile={tile?.card.id}
        onClick={select} onFocus={onFocus}
        onPointerEnter={(event) => {
          if (event.pointerType === 'touch') return
          hovered.current = true
          ringFrom(HOVER_RING, item.cards)
        }}
        onPointerLeave={() => { hovered.current = false; ringFrom(HOVER_RING, []) }}
        className={tile !== undefined
          ? `${TYPE.meta} ${ITEM} flex flex-col justify-between gap-1 border border-panel-border p-2`
          : `${TYPE.body} ${ITEM} ${item.kind === 'find' ? 'grid grid-cols-2 items-baseline' : 'flex items-start'} gap-2 px-1 py-1.5`}>
        {item.kind === 'find' ? <>
          <span className="flex min-w-0 items-start gap-2">
            <OkIcon id={item.icon} size={14} className="mt-0.5 shrink-0" decorative />
            <span className={selected ? 'min-w-0' : 'min-w-0 line-clamp-2'} data-view={item.at}>{item.short}</span>
            {item.mark == null ? null : <GlyphMark mark={item.mark} tip={false} className="ok-check-figure-mark shrink-0" view={item.mark.at} />}
          </span>
          {item.value === undefined ? null : <span className={`${TYPE.meta} min-w-0 break-words text-right tabular-nums text-text-body`} data-view={item.value.at}>{item.value.text}</span>}
        </> : tile === undefined ? <>
          <OkIcon id={item.icon} size={14} className="mt-0.5 shrink-0" decorative />
          <span className={selected ? 'min-w-0' : 'min-w-0 line-clamp-2'} {...(modelWords ? { 'data-view-words': item.at } : { 'data-view': item.at })}>{item.short}</span>
        </> : <>
          <span className="flex items-start gap-1">
            <NodeShapeIndicator nodeKind={tile.kind} dashedOutline={isDashedCardKind(tile.card)} size={14} />
            {tile.letter === undefined ? null : <LetterChip letter={tile.letter} />}
            <span className="min-w-0 line-clamp-2" data-view={`${tile.card.id}.heading`}>{tile.card.heading}</span>
          </span>
          {item.kind === 'size' || item.kind === 'waits' ? <FaceMark kind="track" /> : <OkIcon id={item.icon} size={14} decorative />}
        </>}
      </Hover>
      <div id={details} hidden={!selected} className={tile === undefined ? undefined : 'col-span-2'}>
        {selected || (isAnswer && openedAnswer) ? <div className={tile === undefined ? 'space-y-1 pb-2 pl-6 pr-1' : 'space-y-1 px-2 pb-2'}>
          {tile === undefined ? null : <p className={`${TYPE.body} m-0 text-text-header`} data-view={item.at}>{item.short}</p>}
          {item.long.map(({ text, at }) => <p key={at} className={`${TYPE.meta} m-0 text-text-body`} data-view={at}>{text}</p>)}
          <ItemAction action={action} />
          {action.kind === 'fill' ? null : <div><button type="button" className={QUIET} onClick={() => prefillComposer(item.short)}>{CHECK_WORDS.ask}</button></div>}
        </div> : null}
      </div>
    </li>
  )
}

function CheckSection({ group, all, shown, tiles, restCount, toggle, renderRow }: {
  group: CheckGroup
  all: boolean
  shown: CheckItem[]
  tiles: CheckItem[]
  restCount: number
  toggle: () => void
  renderRow: (item: CheckItem, tiled?: boolean) => JSX.Element
}) {
  const region = useId()
  const count = group.blocks.reduce((n, block) => n + block.items.length, 0)
  const visible = new Set(shown.slice(tiles.length))
  const blocks = group.blocks.filter((b) => b.items.length > 0 || b.line !== undefined)
  const foldedItems = count - restCount
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
        {tiles.length === 0 ? null : <ul className="m-0 grid list-none grid-cols-2 gap-1 p-0" role="list">
          {tiles.map((item) => renderRow(item, true))}
        </ul>}
        {blocks.map((block) => {
          const rows = block.items.filter((item) => visible.has(item))
          const heading = all || blocks.length > 1 ? block.heading : undefined
          const line = all ? block.line : undefined
          if (rows.length === 0 && heading === undefined && line === undefined) return null
          return (
            <div key={block.key} className="space-y-1">
              {heading === undefined ? null : <p className={`${TYPE.meta} m-0 text-text-light`} data-view={heading.at} data-check-aim-heading>{heading.text}</p>}
              {line === undefined ? null : <p className="ok-an-scope" data-view={line.at} data-check-aim-line>{line.text}</p>}
              {rows.length === 0 ? null : <ul className="m-0 list-none divide-y divide-panel-border p-0">
                {rows.map((item) => renderRow(item))}
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

function panelSelection(key: string, sid: string | null) {
  const { subject } = useStoredFocusSubject.getState()
  return subject !== null && subject.sid === sid && sid === useViewStore.getState().sid
    && subject.kind === 'gap' && subject.source === 'panel' && subject.id === key ? subject : null
}

export function CheckList(props: CheckListProps) {
  return <ScenarioCheckList key={props.sid} {...props} />
}

function ScenarioCheckList({ model, view, sid }: CheckListProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Partial<Record<CheckGroup['kind'], boolean>>>({})
  const root = useRef<HTMLElement>(null)
  const navigation = useRef<{ key: string; card: string } | null>(null)
  useLayoutEffect(() => {
    const unsubscribe = useStoredFocusSubject.subscribe(({ subject }) => {
      const pending = navigation.current
      if (pending !== null && subject?.source === 'canvas' && subject.id !== pending.card) navigation.current = null
    })
    return () => {
      navigation.current = null
      unsubscribe()
    }
  }, [])
  const request = useReasoningFocus((s) => s.request)
  const subject = useFocusSubject()
  const canvasRevision = useStoredFocusSubject((s) => s.canvasRevision)
  const canvasSubject = subject?.source === 'canvas' && subject.sid === sid ? subject : null
  const canvasKind = canvasSubject?.kind
  const canvasId = canvasSubject?.id
  const cards = useMemo(() => new Map(model.cards.map((card) => [card.id, card])), [model])
  const letters = useMemo(() => optionLetters(model), [model])
  const sections = useMemo(() => checkItemsOf(model, view).map((group) => {
    const items = group.blocks.flatMap((block) => block.items)
    const tiles = group.kind === 'needs' ? items.filter((item) => cards.has(item.cards[0]!)) : []
    const atRest = group.kind === 'needs'
      ? [...tiles.filter((item) => item.kind !== 'worth').slice(0, AT_REST.needs), ...items.filter((item) => item.kind === 'worth')]
      : items.slice(0, AT_REST[group.kind])
    return { group, items, tiles, atRest }
  }), [cards, model, view])
  // A new canvas subject uses the latest rows. A refresh alone does not reopen a dismissed row.
  const currentSections = useRef(sections)
  useLayoutEffect(() => { currentSections.current = sections }, [sections])
  const groups = sections.map((section) => {
    const { group, items, tiles, atRest } = section
    const tiled = new Set(tiles)
    if (!expanded[group.kind]) {
      const restTiles = atRest.filter((item) => tiled.has(item))
      const restRows = atRest.filter((item) => !tiled.has(item))
      return { ...section, shown: [...restTiles, ...restRows], tiles: restTiles }
    }
    return { ...section, shown: [...tiles, ...items.filter((item) => !tiled.has(item))] }
  })
  const shown = groups.flatMap((section) => section.shown)
  const active = shown.find((item) => item.key === selected)
  const tabStop = shown.find((item) => item.key === focused) ?? shown[0]

  function rowButtons() {
    return [...(root.current?.querySelectorAll<HTMLButtonElement>('[data-check-item]') ?? [])]
  }

  function clearSelection() {
    navigation.current = null
    if (selected !== null && panelSelection(selected, sid) !== null) setFocusSubject(null)
    setSelected(null)
  }

  async function select(item: CheckItem) {
    const card = item.cards.length === 1 ? item.cards[0] : undefined
    const token = card === undefined ? null : { key: item.key, card }
    navigation.current = token
    setSelected(item.key)
    setFocusSubject({ kind: 'gap', id: item.key, cards: item.cards, source: 'panel' })
    if (token === null) return

    const isCurrent = () => {
      const { subject } = useStoredFocusSubject.getState()
      return navigation.current === token && subject !== null && subject.sid === sid && sid === useViewStore.getState().sid
        && (subject.source === 'canvas' ? subject.id === token.card : subject.kind === 'gap' && subject.id === token.key)
    }
    if (!isCurrent()) return
    let reach = recordReach(token.card)
    if (reach === 'show') {
      if (!isCurrent()) return
      // showRecord's unfold cannot be cancelled once it starts. The token guards the subsequent focus.
      await showRecord(token.card)
      if (!isCurrent()) return
      reach = recordReach(token.card)
    }
    if (reach === 'card' && isCurrent()) focusNodeById(token.card)
  }

  useLayoutEffect(() => () => {
    if (selected !== null && panelSelection(selected, sid) !== null) setFocusSubject(null)
  }, [selected, sid])

  useLayoutEffect(() => {
    if (selected === null) return
    const panel = panelSelection(selected, sid)
    if (active === undefined || (panel !== null && (active.cards.length !== panel.cards.length
      || active.cards.some((card, index) => card !== panel.cards[index])))) clearSelection()
  })

  useLayoutEffect(() => {
    if (canvasKind === undefined || canvasId === undefined) return
    for (const { group, items } of currentSections.current) {
      const item = items.find((candidate) => candidate.cards.includes(canvasId))
      if (item === undefined) continue
      if (navigation.current?.key !== item.key) navigation.current = null
      setSelected(item.key)
      setExpanded((current) => current[group.kind] ? current : { ...current, [group.kind]: true })
      return
    }
  }, [canvasKind, canvasId, canvasRevision])

  useLayoutEffect(() => {
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
    <section ref={root} className="space-y-5" aria-label={CHECK_WORDS.title} data-testid="check-list" onKeyDown={moveFocus}>
      {groups.map(({ group, atRest, shown, tiles }) => {
        const all = expanded[group.kind] ?? false
        return <CheckSection key={group.kind} group={group} all={all} shown={shown} tiles={tiles} restCount={atRest.length}
          toggle={() => {
            if (all && selected !== null && !atRest.some((item) => item.key === selected) && shown.some((item) => item.key === selected)) {
              clearSelection()
              root.current?.querySelector<HTMLButtonElement>(`[data-check-more="${group.kind}"]`)?.focus()
            }
            setExpanded((current) => ({ ...current, [group.kind]: !all }))
          }}
          renderRow={(item, tiled) => {
            const card = tiled ? cards.get(item.cards[0]!) : undefined
            const tile = card === undefined ? undefined : { card, kind: drawKindOf(card, model), letter: letters.get(card.id) }
            return <CheckRow key={item.key} item={item} selected={item.key === selected} tile={tile}
              tabIndex={item === tabStop ? 0 : -1} onFocus={() => setFocused(item.key)}
              select={() => item.key === selected ? clearSelection() : void select(item)} />
          }} />
      })}
    </section>
  )
}
