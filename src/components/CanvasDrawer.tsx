import React, { useEffect, useMemo, useRef, useState } from 'react'
import { formatDownloadName } from '../lib/filename'
import { isTldrawEnabled } from '../flags'

export type CanvasAPI = {
  addNote: (text: string) => void
  clear: () => void
  exportSnapshot: () => string
  importSnapshot: (json: string) => void
}

type Props = {
  open: boolean
  onClose: () => void
  onReady?: (api: CanvasAPI) => void
  pauseProbes?: boolean
  inline?: boolean
  seed?: string | number
  model?: string
}

// Keys
const SNAP_KEY = 'canvas.snapshot'
const AUTOSAVE_KEY = 'canvas.autosave'

function readLS(key: string): string | null {
  try { return window.localStorage.getItem(key) } catch { return null }
}
function writeLS(key: string, val: string | null) {
  try { if (val == null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, val) } catch {}
}

export default function CanvasDrawer({ open, onClose, onReady, inline, seed, model }: Props) {
  const isOpen = inline ? true : open
  const [autosave, setAutosave] = useState<boolean>(() => {
    const raw = readLS(AUTOSAVE_KEY)
    return raw == null ? true : !(raw === '0' || raw === 'false')
  })
  const [notes, setNotes] = useState<string[]>([])
  const [justSaved, setJustSaved] = useState(false)
  const lastActiveRef = useRef<HTMLElement | null>(null)
  const firstFieldRef = useRef<HTMLInputElement | null>(null)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const [extApi, setExtApi] = useState<CanvasAPI | null>(null)
  const exportTextFlag: boolean = useMemo(() => {
    try {
      const env = (import.meta as any)?.env?.VITE_FEATURE_CANVAS_EXPORT_TEXT
      if (env === '1' || env === 1 || env === true) return true
    } catch {}
    try {
      const raw = (globalThis as any)?.localStorage?.getItem?.('feature.canvasExportText')
      if (raw && raw !== '0' && raw !== 'false') return true
    } catch {}
    return false
  }, [])
  const [exported, setExported] = useState(false)

  // Canvas API (shim)
  const shimApi = useMemo<CanvasAPI>(() => ({
    addNote: (text: string) => {
      setNotes((list) => {
        const next = [...list, text]
        if (autosave) writeLS(SNAP_KEY, JSON.stringify({ notes: next }))
        return next
      })
    },
    clear: () => {
      setNotes([])
      if (autosave) writeLS(SNAP_KEY, JSON.stringify({ notes: [] }))
    },
    exportSnapshot: () => JSON.stringify({ notes }),
    importSnapshot: (json: string) => {
      try {
        const data = JSON.parse(json)
        if (Array.isArray(data?.notes)) {
          setNotes(data.notes.map(String))
          if (autosave) writeLS(SNAP_KEY, JSON.stringify({ notes: data.notes }))
        }
      } catch {}
    },
  }), [notes, autosave])

  const activeApi: CanvasAPI = extApi || shimApi

  // Try mounting TLdraw adapter when enabled
  useEffect(() => {
    let cancelled = false
    const doMount = async () => {
      try {
        if (!open || !isTldrawEnabled()) { setExtApi(null); return }
        const mod = await import('../lib/tldrawAdapter')
        const api = await mod.createTldrawCanvas(surfaceRef.current as HTMLDivElement, autosave)
        if (!cancelled) setExtApi(api)
      } catch {
        if (!cancelled) setExtApi(null)
      }
    }
    void doMount()
    return () => { cancelled = true }
  }, [open, autosave])

  // Expose API when surface is ready or adapter changes
  useEffect(() => {
    if (open) onReady?.(activeApi)
  }, [open, activeApi, onReady])

  // Hydrate from LS snapshot on open
  useEffect(() => {
    if (!isOpen) return
    try {
      const snap = readLS(SNAP_KEY)
      if (snap && autosave) {
        const data = JSON.parse(snap)
        if (Array.isArray(data?.notes)) setNotes(data.notes.map(String))
      }
    } catch {}
    setTimeout(() => firstFieldRef.current?.focus(), 0)
  }, [isOpen])

  // Save autosave preference
  useEffect(() => {
    writeLS(AUTOSAVE_KEY, autosave ? '1' : '0')
  }, [autosave])

  const handleKey = (e: KeyboardEvent) => {
    if (!open) return
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      setTimeout(() => lastActiveRef.current?.focus?.(), 0)
    }
  }

  useEffect(() => {
    if (isOpen && !inline) {
      lastActiveRef.current = (document.activeElement as HTMLElement | null) || null
      document.addEventListener('keydown', handleKey)
    }
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, inline])

  const onOverlayClick = () => {
    onClose()
    setTimeout(() => lastActiveRef.current?.focus?.(), 0)
  }

  const onExport = () => {
    try {
      const json = activeApi.exportSnapshot()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = formatDownloadName('canvas.snapshot', { seed, model, ext: 'json' })
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 1200)
    } catch {}
  }

  const fileRef = useRef<HTMLInputElement | null>(null)
  const onImport = () => fileRef.current?.click()
  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const txt = String(reader.result || '')
      activeApi.importSnapshot(txt)
    }
    reader.readAsText(f)
    e.target.value = ''
  }

  const onClear = () => {
    if (window.confirm('Clear canvas?')) {
      activeApi.clear()
      writeLS(SNAP_KEY, JSON.stringify({ notes: [] }))
    }
  }

  const onExportText = () => {
    try {
      const snap = activeApi.exportSnapshot()
      let txt = ''
      try {
        const data = JSON.parse(snap)
        if (Array.isArray(data?.notes)) txt = data.notes.map(String).join('\n\n')
      } catch {}
      const blob = new Blob([txt], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = formatDownloadName('canvas', { seed, model, ext: 'txt' })
      document.body.appendChild(a)
      a.click()
      a.remove()
      setExported(true)
      setTimeout(() => setExported(false), 1200)
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch {}
  }

  if (!isOpen) return null

  const panel = (
      <div data-testid="canvas-root" className="w-full h-full bg-white shadow-sm p-4 border-l border-gray-200 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">Canvas</h2>
          <div className="text-[11px] text-gray-500" aria-hidden="true">
            {justSaved ? 'Saved • just now' : ''}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input ref={firstFieldRef} type="checkbox" checked={autosave} onChange={(e) => setAutosave(e.target.checked)} data-testid="canvas-autosave" />
          <span>Autosave</span>
        </label>
        <div ref={surfaceRef} data-testid="canvas-surface" className="flex-1 border rounded bg-[repeating-linear-gradient(45deg,#fafafa,#fafafa_10px,#f5f5f5_10px,#f5f5f5_20px)] p-2 overflow-auto">
          {!extApi && notes.length === 0 ? (
            <div className="text-xs text-gray-500 select-none">
              <div>Canvas (dev)</div>
              <div>Use "Send to Canvas" after a run finishes. Autosave keeps your notes locally.</div>
            </div>
          ) : !extApi ? (
            <ul className="text-xs space-y-2">
              {notes.map((n, i) => (
                <li key={i} data-testid="canvas-note" className="p-2 border rounded bg-white shadow-sm whitespace-pre-wrap">{n}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="text-xs px-2 py-1 rounded border border-gray-300" data-testid="canvas-import-btn" onClick={onImport}>Import .json</button>
          <button type="button" className="text-xs px-2 py-1 rounded border border-gray-300" data-testid="canvas-export-btn" onClick={onExport}>Export .json</button>
          {exportTextFlag && (
            <button type="button" className="text-xs px-2 py-1 rounded border border-gray-300" data-testid="canvas-export-text-btn" onClick={onExportText}>Export text</button>
          )}
          <button type="button" className="text-xs px-2 py-1 rounded border border-gray-300" data-testid="canvas-clear-btn" onClick={onClear}>Clear</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onImportFile} />
          {exportTextFlag && exported && (
            <div data-testid="canvas-export-text-toast" aria-hidden="true" className="text-xs text-emerald-700">Downloaded</div>
          )}
        </div>
      </div>
  )

  if (inline) {
    return (
      <div className="min-h-[12rem]">
        {panel}
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black/20 z-50 flex items-center justify-end"
      role="dialog"
      aria-modal="true"
      data-testid="canvas-drawer"
      onClick={onOverlayClick}
    >
      <div className="w-[28rem] h-full" onClick={(e) => e.stopPropagation()}>
        {panel}
      </div>
    </div>
  )
}
