/** Supporting material stays out of the conversation: one quiet row, one bounded panel opened by a press. */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { VIEW_CHIP_CLASS } from '../../../v5/blocks/chipClass'
import { HoverButton } from '../../look/Hover'
import { OkIcon, type IconId } from '../../look/icons'
import { VIEW_NOTE_SLOT } from '../../note'
import { useEscapeLayer } from '../edit/escapeLayers'

interface Source {
  readonly id: string
  readonly label: string
  readonly icon: IconId
  readonly count: number
  readonly content: ReactNode
}

export function ChatFootRow({ sources }: { sources: readonly Source[] }): JSX.Element {
  const [open, setOpen] = useState<string | null>(null)
  const [present, setPresent] = useState<Readonly<Record<string, boolean>>>({})
  const box = useRef<HTMLDivElement>(null), row = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const close = useCallback(() => {
    setOpen(null)
    if (open !== null) row.current?.querySelector<HTMLButtonElement>(`[data-testid="view-chat-foot-${open}"]`)?.focus()
  }, [open])
  useEscapeLayer(open !== null, close)

  // The existing cards own their removal state; the note arrives through a portal. Observe their mounts so
  // an empty/removed source leaves no chip, without duplicating that state or changing those components.
  useLayoutEffect(() => {
    const el = box.current
    if (el === null) return
    const read = () => {
      const next = Object.fromEntries(Array.from(el.children, (child) => [child.getAttribute('data-foot-source')!, child.hasChildNodes()]))
      setPresent((old) => Object.keys(next).every((key) => next[key] === old[key]) ? old : next)
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(el, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (open !== null && !present[open]) close()
  }, [close, open, present])
  useEffect(() => {
    if (open === null) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !box.current?.contains(event.target) && !row.current?.contains(event.target)) close()
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [close, open])

  const entries: readonly Source[] = [...sources, { id: 'note', label: 'Olumi’s note', icon: 'olumi-mark', count: 1, content: null }]
  const available = entries.filter((source) => source.count > 0 && present[source.id])
  return <>
    {/* Keep every source mounted while folded: drafts survive switching chips, and the canvas always finds its note portal target. */}
    <div ref={box} id={panelId} hidden={open === null} className="ok-pinned min-h-0 overflow-y-auto" data-testid="view-chat-pinned">
      {entries.map((source) => (
        <div key={source.id} data-foot-source={source.id} hidden={open !== source.id}
          {...(source.id === 'note' ? { [VIEW_NOTE_SLOT]: '' } : {})}>
          {source.content}
        </div>
      ))}
    </div>
    {available.length === 0 ? null : <div ref={row} className="shrink-0 overflow-x-auto px-3 py-2" data-testid="view-chat-foot-row">
      <div className="flex items-center gap-1 whitespace-nowrap">
        {available.map((source) => {
          const label = source.id === 'proposal' && source.count === 1 ? source.label : `${source.label} · ${source.count}`
          return <HoverButton key={source.id} type="button" words={label}
            aria-expanded={open === source.id} aria-controls={open === source.id ? panelId : undefined}
            className={`${VIEW_CHIP_CLASS} shrink-0`} data-testid={`view-chat-foot-${source.id}`}
            onClick={() => { if (open === source.id) close(); else setOpen(source.id) }}>
            <OkIcon id={source.icon} size={14} decorative /><span>{label}</span>
          </HoverButton>
        })}
      </div>
    </div>}
  </>
}
