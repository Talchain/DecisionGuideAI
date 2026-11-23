/** Supporting material stays out of the conversation: one quiet row, one bounded panel opened by a press. */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { VIEW_CHIP_CLASS } from '../../../v5/blocks/chipClass'
import { HoverButton } from '../../look/Hover'
import { OkIcon, type IconId } from '../../look/icons'
import { typography } from '../../../styles/typography'
import { useUIStore } from '../../../stores/uiStore'
import { useChatFloat } from '../../port/ChatFloat'
import { useViewStore } from '../../store'
import { VIEW_NOTE_SLOT } from '../../note'
import { useEscapeLayer } from '../edit/escapeLayers'
import type { ExplanationRecord } from '../explanations'
import { ModelExplanations } from './ModelExplanations'

interface Source {
  readonly id: string
  readonly label: string
  readonly icon: IconId
  readonly count: number
  readonly content: ReactNode
}

type Explanations = {
  scope: string
  selected: string | null
  records: readonly ExplanationRecord[]
}

export function ChatFootRow({ sources, explanations }: { sources: readonly Source[]; explanations?: Explanations }): JSX.Element {
  const [open, setOpen] = useState<string | null>(null)
  const [present, setPresent] = useState<Readonly<Record<string, boolean>>>({})
  const box = useRef<HTMLDivElement>(null), row = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const target = useViewStore((s) => s.explanationTarget)
  const link = target && target.scope === explanations?.scope
    && explanations.records.some((record) => record.id === target.record && record.passages.some((p) => p.id === target.passage))
    ? target : null
  const active = link ? 'explanations' : open
  const selectedId = link?.record ?? explanations?.selected
  const selected = explanations?.records.some((r) => r.id === selectedId) ? selectedId ?? null : null
  const close = useCallback(() => {
    setOpen(null)
    if (active !== null) row.current?.querySelector<HTMLButtonElement>(`[data-testid="view-chat-foot-${active}"]`)?.focus()
  }, [active])
  const dismissExplanation = () => {
    if (link === null) { close(); return }
    useViewStore.setState({ explanationTarget: null, explanationReturn: link.trigger })
    setOpen(null)
    if (useUIStore.getState().activeOutputTab !== link.origin) useUIStore.getState().forceActivateOutputTab(link.origin)
  }
  const escapeRef = useRef<(() => void) | null>(null)
  escapeRef.current = active === 'explanations' ? dismissExplanation : null
  useLayoutEffect(() => {
    // The floating host catches Escape in capture to dock the window. Give an
    // explanation in that window first use of the same key while it has focus.
    // The floating host handles Escape in window capture before escapeLayers can run.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing || !useChatFloat.getState().floating || !escapeRef.current) return
      if (!(event.target instanceof Element) || !box.current?.contains(event.target) || !event.target.closest('[data-testid="model-explanations"]')) return
      event.preventDefault()
      event.stopImmediatePropagation()
      escapeRef.current()
    }
    window.addEventListener('keydown', escape, true)
    return () => window.removeEventListener('keydown', escape, true)
  }, [])
  useEscapeLayer(open !== null && active !== 'explanations', close)
  useEffect(() => {
    if (explanations && target && !link) useViewStore.setState({ explanationTarget: null })
  }, [explanations, target, link])

  // The existing cards own their removal state; the note arrives through a portal. Observe their mounts so
  // an empty/removed source leaves no chip, without duplicating that state or changing those components.
  useLayoutEffect(() => {
    const el = box.current
    if (el === null) return
    const read = () => {
      const next = Object.fromEntries(Array.from(el.querySelectorAll(':scope > [data-foot-source]'), (child) => [child.getAttribute('data-foot-source')!, child.hasChildNodes()]))
      setPresent((old) => Object.keys(next).every((key) => next[key] === old[key]) ? old : next)
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(el, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (open === 'explanations' && !explanations?.records.length) close()
    else if (open !== null && open !== 'explanations' && !present[open]) close()
  }, [close, open, present, explanations?.records.length])
  useEffect(() => {
    if (active === null) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !box.current?.contains(event.target) && !row.current?.contains(event.target)) {
        if (link) useViewStore.setState({ explanationTarget: null })
        close()
      }
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [active, close, link])

  const entries: readonly Source[] = [...sources, { id: 'note', label: 'Olumi’s note', icon: 'olumi-mark', count: 1, content: null }]
  const available = entries.filter((source) => source.count > 0 && present[source.id])
  if (explanations && explanations.records.length > 0) available.push({
    id: 'explanations', label: 'Model explanations', icon: 'notes-count', count: 1, content: null,
  })
  return <>
    {/* Keep every source mounted while folded: drafts survive switching chips, and the canvas always finds its note portal target. */}
    <div ref={box} id={panelId} hidden={active === null} className="ok-pinned min-h-0 overflow-y-auto" data-testid="view-chat-pinned">
      {entries.map((source) => (
        <div key={source.id} data-foot-source={source.id} hidden={active !== source.id}
          {...(source.id === 'note' ? { [VIEW_NOTE_SLOT]: '' } : {})}>
          {source.content}
        </div>
      ))}
      {active === 'explanations' && explanations && explanations.records.length > 0 && (
        <ModelExplanations key={JSON.stringify([explanations.scope, selected, link?.passage])} records={explanations.records}
          selected={selected} passage={link?.passage ?? null} onEscape={dismissExplanation} />
      )}
    </div>
    {available.length === 0 ? null : <div ref={row} className="shrink-0 overflow-x-auto px-3 py-2" data-testid="view-chat-foot-row">
      <div className="flex items-center gap-1 whitespace-nowrap">
        {available.map((source) => {
          const label = (source.id === 'proposal' && source.count === 1) || source.id === 'explanations' ? source.label : `${source.label} · ${source.count}`
          return <HoverButton key={source.id} type="button" words={label}
            aria-expanded={active === source.id} aria-controls={active === source.id ? panelId : undefined}
            className={`${VIEW_CHIP_CLASS} shrink-0`} data-testid={`view-chat-foot-${source.id}`}
            onClick={() => {
              if (active === source.id && link) { dismissExplanation(); return }
              if (link) useViewStore.setState({ explanationTarget: null })
              if (active === source.id) close(); else setOpen(source.id)
            }}>
            <OkIcon id={source.icon} size={14} decorative /><span>{label}</span>
          </HoverButton>
        })}
      </div>
    </div>}
  </>
}
