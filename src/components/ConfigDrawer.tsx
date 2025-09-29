import { useEffect, useRef, useState } from 'react'

export type ConfigDrawerProps = {
  open: boolean
  onClose: () => void
  restoreFocusRef?: React.RefObject<HTMLElement>
  onApply?: (vals: { gateway: string; seed: string; budget: string; model: string; sim: boolean }) => void
}

function readLS(key: string, fallback: string = ''): string {
  try { return window.localStorage.getItem(key) ?? fallback } catch { return fallback }
}
function writeLS(key: string, val: string | null) {
  try {
    if (val == null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, val)
  } catch {}
}

export default function ConfigDrawer({ open, onClose, restoreFocusRef, onApply }: ConfigDrawerProps) {
  const [gateway, setGateway] = useState<string>('')
  const [gwInvalid, setGwInvalid] = useState<boolean>(false)
  const [seed, setSeed] = useState<string>('')
  const [budget, setBudget] = useState<string>('')
  const [model, setModel] = useState<string>('')
  const [sim, setSim] = useState<boolean>(false)
  const [budgetWarn, setBudgetWarn] = useState<boolean>(false)
  const firstFieldRef = useRef<HTMLInputElement | null>(null)
  const drawerRef = useRef<HTMLDivElement | null>(null)

  // Hydrate from LS on open
  useEffect(() => {
    if (open) {
      const gw = readLS('cfg.gateway', '')
      setGateway(gw)
      setGwInvalid(() => gw.length > 0 && !/^https?:\/\//i.test(gw))
      setSeed(readLS('sandbox.seed', ''))
      setBudget(readLS('sandbox.budget', ''))
      setModel(readLS('sandbox.model', ''))
      setSim(() => {
        try { const raw = window.localStorage.getItem('feature.simMode'); return !!(raw && raw !== '0' && raw !== 'false') } catch { return false }
      })
      // Focus first field
      setTimeout(() => firstFieldRef.current?.focus(), 0)
    }
  }, [open])

  // Focus trap + Esc to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        // restore focus to trigger
        setTimeout(() => restoreFocusRef?.current?.focus?.(), 0)
        return
      }
      if (e.key === 'Tab') {
        const container = drawerRef.current
        if (!container) return
        const focusables = Array.from(container.querySelectorAll<HTMLElement>('a,button,input,select,textarea,[tabindex]')).filter(n => !n.hasAttribute('disabled') && n.tabIndex >= 0)
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus() }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus() }
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const onSave = () => {
    writeLS('cfg.gateway', gateway.trim() || '')
    writeLS('sandbox.seed', seed)
    writeLS('sandbox.budget', budget)
    const modelTrim = (model || '').trim()
    writeLS('sandbox.model', modelTrim)
    // Show a subtle warning if budget is invalid or <= 0 (non-blocking)
    const bnum = Number(budget)
    setBudgetWarn(!(Number.isFinite(bnum) && bnum > 0))
    if (sim) writeLS('feature.simMode', '1')
    else writeLS('feature.simMode', null)
    // Notify parent so it can apply immediately
    try { onApply?.({ gateway: gateway.trim(), seed, budget, model: modelTrim, sim }) } catch {}
    onClose()
    setTimeout(() => restoreFocusRef?.current?.focus?.(), 0)
  }

  const onReset = () => {
    writeLS('cfg.gateway', '')
    writeLS('sandbox.seed', '')
    writeLS('sandbox.budget', '')
    writeLS('sandbox.model', '')
    writeLS('feature.simMode', null)
    try { onApply?.({ gateway: '', seed: '', budget: '', model: '', sim: false }) } catch {}
    onClose()
    setTimeout(() => restoreFocusRef?.current?.focus?.(), 0)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/20 z-50 flex items-center justify-end"
      role="dialog"
      aria-modal="true"
      data-testid="config-drawer"
      onClick={() => { onClose(); setTimeout(() => restoreFocusRef?.current?.focus?.(), 0) }}
    >
      <div
        ref={drawerRef}
        className="w-[22rem] h-full bg-white shadow-xl p-4 border-l border-gray-200 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold text-base mb-2">Settings</h2>
        <label className="text-sm text-gray-700 flex flex-col gap-1">
          <span>Gateway Base URL</span>
          <input
            ref={firstFieldRef}
            data-testid="cfg-gateway"
            type="text"
            placeholder="http://localhost:8787"
            className="px-2 py-1 border rounded"
            value={gateway}
            onChange={(e) => {
              const v = e.target.value
              setGateway(v)
              setGwInvalid(v.length > 0 && !/^https?:\/\//i.test(v))
            }}
          />
          <span className="text-[11px] text-gray-500">Leave blank to use relative routes.</span>
          {gwInvalid && (
            <span className="text-[11px] text-amber-600" data-testid="gw-hint">Invalid URL: must start with http:// or https://</span>
          )}
        </label>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <label className="text-gray-700 flex flex-col gap-1">
            <span>Seed</span>
            <input data-testid="cfg-seed" type="text" className="px-2 py-1 border rounded" value={seed} onChange={(e) => setSeed(e.target.value)} />
          </label>
          <label className="text-gray-700 flex flex-col gap-1">
            <span>Budget</span>
            <input data-testid="cfg-budget" type="number" step="0.01" className="px-2 py-1 border rounded" value={budget} onChange={(e) => setBudget(e.target.value)} />
            {budgetWarn && (
              <span className="text-[11px] text-amber-600" data-testid="budget-hint">Budget looks invalid or ≤ 0 (saved anyway).</span>
            )}
          </label>
          <label className="text-gray-700 flex flex-col gap-1">
            <span>Model</span>
            <input data-testid="cfg-model" type="text" className="px-2 py-1 border rounded" value={model} onChange={(e) => setModel(e.target.value)} />
            <span className="text-[11px] text-gray-500">Examples: gpt-4o, gpt-4o-mini</span>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            data-testid="cfg-sim"
            type="checkbox"
            checked={sim}
            onChange={(e) => setSim(e.target.checked)}
          />
          <span>Sim mode (fixtures only)</span>
        </label>
        <div className="mt-auto flex items-center justify-end gap-2">
          <button
            type="button"
            data-testid="cfg-reset-btn"
            className="px-3 py-1 border rounded"
            onClick={onReset}
          >
            Reset
          </button>
          <button
            type="button"
            data-testid="cfg-save-btn"
            className="px-3 py-1 border rounded bg-blue-600 text-white"
            onClick={onSave}
          >
            Save
          </button>
          <button
            type="button"
            className="px-3 py-1 border rounded"
            onClick={() => { onClose(); setTimeout(() => restoreFocusRef?.current?.focus?.(), 0) }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
