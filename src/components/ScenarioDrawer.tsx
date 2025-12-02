import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { listScenarios, saveScenario, deleteScenario, encodeScenarioToUrlParam, getRemember, setRemember, getLastId, setLastId, type ScenarioV1 } from '../lib/scenarios'

export type ScenarioDrawerProps = {
  open: boolean
  onClose: () => void
  restoreFocusRef?: RefObject<HTMLElement>
  seed: string
  budget: string
  model: string
  onLoad: (s: ScenarioV1) => void
}

export default function ScenarioDrawer({ open, onClose, restoreFocusRef, seed, budget, model, onLoad }: ScenarioDrawerProps) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [items, setItems] = useState<ScenarioV1[]>([])
  const [toast, setToast] = useState('')
  const [remember, setRememberState] = useState<boolean>(false)
  const firstRef = useRef<HTMLInputElement | null>(null)
  const drawerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    setItems(listScenarios())
    try { setRememberState(getRemember()) } catch {}
    setTimeout(() => firstRef.current?.focus(), 0)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault(); onClose(); setTimeout(() => restoreFocusRef?.current?.focus?.(), 0)
        return
      }
      if (e.key === 'Tab') {
        const c = drawerRef.current; if (!c) return
        const f = Array.from(c.querySelectorAll<HTMLElement>('a,button,input,select,textarea,[tabindex]')).filter(n => !n.hasAttribute('disabled') && n.tabIndex >= 0)
        if (f.length === 0) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus() } }
        else { if (document.activeElement === last) { e.preventDefault(); first.focus() } }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 1200) }

  const onSave = () => {
    const nm = name.trim(); if (!nm) return
    const slug = nm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'scenario'
    let rid = 'xxxxx'
    try { rid = Math.random().toString(36).slice(2, 7) } catch {}
    const rec: ScenarioV1 = { v: 1, id: `${slug}-${rid}`, name: nm, desc: desc.trim() || undefined, seed, budget, model }
    saveScenario(rec)
    if (remember) { try { setLastId(rec.id) } catch {} }
    setItems(listScenarios()); setName(''); setDesc(''); showToast('Saved')
  }

  const onCopyLink = (s: ScenarioV1) => {
    try {
      const param = encodeScenarioToUrlParam({ v: 1, name: s.name, desc: s.desc, seed: s.seed, budget: s.budget, model: s.model })
      const origin = (globalThis as any)?.location?.origin || ''
      const href = `${origin}/?e2e=1#/sandbox&scenario=${param}`
      ;(globalThis as any)?.navigator?.clipboard?.writeText?.(href)
      showToast('Link copied')
    } catch {}
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/20 z-50 flex items-center justify-end"
      role="dialog"
      aria-modal="true"
      data-testid="scenarios-drawer"
      onClick={() => { onClose(); setTimeout(() => restoreFocusRef?.current?.focus?.(), 0) }}
    >
      <div
        ref={drawerRef}
        className="w-[24rem] h-full bg-paper-50 shadow-panel p-4 border-l border-sand-200 flex flex-col gap-3 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold text-base mb-2 text-ink-900">Scenarios</h2>

        <div className="space-y-2">
          <label className="text-sm text-ink-900/80 flex flex-col gap-1">
            <span>Name</span>
            <input ref={firstRef} data-testid="scenario-name" type="text" className="px-2 py-1 border rounded" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="text-sm text-ink-900/80 flex flex-col gap-1">
            <span>Description (optional)</span>
            <textarea data-testid="scenario-desc" className="px-2 py-1 border rounded" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-900/80">
            <input type="checkbox" data-testid="scenario-remember" checked={remember} onChange={(e) => { setRememberState(e.target.checked); try { setRemember(e.target.checked) } catch {} }} />
            <span>Remember last template</span>
          </label>
          <div className="flex items-center gap-2">
            <button type="button" data-testid="scenario-save-btn" className="text-xs px-2 py-1 rounded border border-sand-200" onClick={onSave} disabled={!name.trim()}>Save</button>
          </div>
          {toast && (
            <div data-testid="scenarios-toast" aria-hidden="true" className="text-xs text-emerald-700">{toast}</div>
          )}
        </div>

        <div>
          <div className="text-xs font-medium mb-1">Saved</div>
          <ul role="list" data-testid="scenarios-list" className="space-y-2">
            {items.map((s) => {
              const last = (() => { try { return getLastId() === s.id } catch { return false } })()
              return (
                <li key={s.id} className="flex items-center justify-between gap-2 border rounded p-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" title={s.name}>{s.name}{last && <span className="ml-1 text-[10px] text-emerald-700" aria-hidden="true">• last</span>}</div>
                    {s.desc && <div className="text-xs text-gray-500 truncate">{s.desc}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" data-testid="scenario-load-btn" className="text-xs px-2 py-1 rounded border" onClick={() => onLoad(s)}>Load</button>
                    <button type="button" data-testid="scenario-share-btn" className="text-xs px-2 py-1 rounded border" onClick={() => onCopyLink(s)}>Copy Link</button>
                    <button type="button" data-testid="scenario-delete-btn" className="text-xs px-2 py-1 rounded border" onClick={() => { deleteScenario(s.id); setItems(listScenarios()); showToast('Deleted') }}>Delete</button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
