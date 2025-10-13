import React, { useCallback, useEffect, useRef } from 'react'

export type HistoryEntry = { index: number; label: string; active?: boolean }

export default function PlcHistoryPanel({
  entries,
  onSelect,
  onClose,
}: {
  entries: HistoryEntry[]
  onSelect: (globalIndex: number) => void
  onClose: () => void
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      const first = rootRef.current?.querySelector('button[data-testid^="plc-history-entry-"]') as HTMLButtonElement | null
      if (first) {
        first.focus()
      } else {
        rootRef.current?.focus()
      }
      const active = rootRef.current?.querySelector('[aria-current="true"]') as HTMLElement | null
      active?.scrollIntoView({ block: 'nearest' })
    } catch {}
  }, [])

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const list = rootRef.current?.querySelectorAll<HTMLButtonElement>('[data-testid^="plc-history-entry-"')
    if (!list || list.length === 0) {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      return
    }
    const focusIdx = Array.from(list).findIndex(el => el === document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = list[Math.min(list.length - 1, Math.max(0, focusIdx + 1))]
      next?.focus(); try { next?.scrollIntoView({ block: 'nearest' }) } catch {}
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = list[Math.max(0, Math.min(list.length - 1, (focusIdx === -1 ? 0 : focusIdx - 1)))]
      prev?.focus(); try { prev?.scrollIntoView({ block: 'nearest' }) } catch {}
    } else if (e.key === 'Enter' && focusIdx >= 0) {
      e.preventDefault()
      const btn = list[focusIdx]
      const idxAttr = btn.getAttribute('data-index')
      if (idxAttr) onSelect(Number(idxAttr))
    } else if (e.key === 'Escape') {
      e.preventDefault(); onClose()
    }
  }, [onSelect, onClose])

  return (
    <aside
      id="plc-history-panel"
      data-testid="plc-history-panel"
      role="region"
      aria-label="History"
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      style={{ position: 'fixed', right: 12, top: 64, width: 300, maxHeight: '70vh', overflow: 'auto', background: '#111827', color: 'white', padding: 8, borderRadius: 8 }}
    >
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>History</div>
      <ul role="list" data-testid="plc-history-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {entries.map((e, i) => (
          <li key={e.index} style={{ marginBottom: 6 }}>
            <button
              type="button"
              data-testid={`plc-history-entry-${i}`}
              data-index={String(e.index)}
              aria-current={e.active ? 'true' : undefined}
              onClick={() => onSelect(e.index)}
              style={{
                display: 'flex', width: '100%', textAlign: 'left', gap: 8, alignItems: 'center',
                background: e.active ? '#374151' : '#1f2937', color: 'white', padding: '6px 8px', borderRadius: 6, border: '1px solid #374151'
              }}
            >
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>#{e.index}</span>
              <span>{e.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onClose} aria-label="Close history" style={{ background: '#374151', color: 'white', padding: '6px 8px', borderRadius: 6, border: '1px solid #4b5563' }}>Close</button>
      </div>
    </aside>
  )
}
