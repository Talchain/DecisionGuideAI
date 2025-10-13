import { useEffect, useRef, useState } from 'react'
import { validatePlcImportText } from '../io/validate'
import type { PlcState, ImportApplyOp } from '../state/history'
import { normalizeImport, diffImport, summarize, type PlcImportDiff } from '../io/diff'

export default function PlcImportExport({ onClose, current, onApply }: { onClose: () => void; current: PlcState; onApply: (op: ImportApplyOp) => void }) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [text, setText] = useState(() => (
    '{\n  "nodes": [ { "id": "a", "x": 0, "y": 0 } ],\n  "edges": [ { "from": "a", "to": "a" } ]\n}'
  ))
  const [validating, setValidating] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [diff, setDiff] = useState<PlcImportDiff | null>(null)
  const [diffLabel, setDiffLabel] = useState<string>('')
  const [_, setValidateSeq] = useState(0)
  const validateSeqRef = useRef(0)

  // Focus management: focus textarea on open
  useEffect(() => {
    try { textareaRef.current?.focus() } catch {}
  }, [])

  // Esc to close (listen on window so it works even if focus moved outside panel)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        try { e.preventDefault() } catch {}
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusables = Array.from(el.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      )).filter(x => !x.hasAttribute('disabled'))
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first || !el.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (active === last || !el.contains(active)) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    el.addEventListener('keydown', handler)
    return () => el.removeEventListener('keydown', handler)
  }, [])

  const onValidate = async () => {
    const mySeq = validateSeqRef.current + 1
    validateSeqRef.current = mySeq
    setValidateSeq(mySeq)
    setValidating(true)
    setStatus('Validating…')
    setErrors([])
    try {
      // simulate async boundary for UI responsiveness
      await Promise.resolve()
      const res = validatePlcImportText(text)
      // If a newer validate started, ignore this result
      if (mySeq !== validateSeqRef.current) return
      if (res.ok) {
        const inc = normalizeImport(res.data)
        const cur = {
          nodes: current.nodes.map(n => ({ id: n.id, x: n.x ?? 0, y: n.y ?? 0, label: n.label })),
          edges: current.edges.map(e => ({ from: e.from, to: e.to, label: e.label }))
        }
        const d = diffImport(cur, inc)
        const { label, addCount, removeCount, moveCount } = summarize(d)
        const noChanges = addCount === 0 && removeCount === 0 && moveCount === 0
        setErrors([])
        if (noChanges) {
          setStatus('No changes')
          setDiff(null)
          setDiffLabel('')
        } else {
          setStatus('Valid ✓')
          setDiff(d)
          setDiffLabel(label)
        }
      } else {
        setStatus('Invalid ✕')
        setErrors(res.errors)
        setDiff(null)
        setDiffLabel('')
      }
    } finally {
      setValidating(false)
    }
  }

  const onClickApply = () => {
    if (!diff) return
    // Build full payload for history with snapshots for undo
    const curNodes = new Map(current.nodes.map(n => [n.id, n]))
    const removeNodesFull = diff.removeNodes
      .map(id => curNodes.get(id))
      .filter((n): n is NonNullable<typeof n> => !!n)
      .map(n => ({ id: n.id, label: n.label, x: n.x, y: n.y }))
    const moveFull = diff.moves.map(m => {
      const cn = curNodes.get(m.id)
      return { id: m.id, from: { x: cn?.x ?? 0, y: cn?.y ?? 0 }, to: { x: m.to.x, y: m.to.y } }
    })
    const removeEdgePairs = new Set(diff.removeEdges.map(re => `${re.from}|${re.to}`))
    const removeEdgesFull = current.edges
      .filter(e => removeEdgePairs.has(`${e.from}|${e.to}`) || diff.removeNodes.includes(e.from) || diff.removeNodes.includes(e.to))
      .map(e => ({ from: e.from, to: e.to, label: e.label }))
    const addNodesFull = diff.addNodes.map(n => ({ id: n.id, label: n.label ?? '', x: n.x, y: n.y }))
    const addEdgesFull = diff.addEdges.map(e => ({ from: e.from, to: e.to, label: e.label }))
    onApply({
      type: 'importApply',
      payload: { addNodes: addNodesFull, removeNodes: removeNodesFull as any, moves: moveFull as any, addEdges: addEdgesFull as any, removeEdges: removeEdgesFull as any },
      meta: { kind: 'import-apply', label: diffLabel }
    })
    setStatus('Applied ✓')
    // Disable Apply until next validation
    setDiff(null)
    setDiffLabel('')
  }

  return (
    <aside
      id="plc-io-panel"
      role="region"
      aria-label="Import/Export"
      data-testid="plc-io-panel"
      ref={panelRef}
      tabIndex={-1}
      style={{ position: 'fixed', right: 12, top: 64, width: 360, maxHeight: '70vh', overflow: 'auto', background: '#111827', color: 'white', padding: 12, borderRadius: 8 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 600 }}>Import/Export</div>
        <button data-testid="plc-io-close" onClick={onClose} aria-label="Close import/export" style={{ background: '#374151', color: 'white', padding: '6px 8px', borderRadius: 6, border: '1px solid #4b5563' }}>Close</button>
      </div>
      <div aria-live="polite" data-testid="plc-io-status" style={{ marginBottom: 8 }}>{status}</div>
      {errors.length > 0 && (
        <div role="alert" data-testid="plc-io-error" style={{ background: '#7f1d1d', color: 'white', padding: 8, borderRadius: 6, border: '1px solid #991b1b', marginBottom: 8 }}>
          {errors.length} error(s):
          <ul style={{ margin: '6px 0 0 16px' }}>
            {errors.slice(0, 20).map((e, i) => (<li key={i} style={{ listStyle: 'disc' }}>{e}</li>))}
            {errors.length > 20 ? (<li key="more" style={{ listStyle: 'disc' }}>+{errors.length - 20} more…</li>) : null}
          </ul>
        </div>
      )}
      {diff && (
        <div data-testid="plc-io-diff" style={{ background: '#1f2937', color: 'white', padding: 8, borderRadius: 6, border: '1px solid #374151', marginBottom: 8 }}>
          Changes: +{diff.addNodes.length + diff.addEdges.length} / −{diff.removeNodes.length + diff.removeEdges.length} / Δ{diff.moves.length}
        </div>
      )}
      <label htmlFor="plc-io-textarea" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>JSON input</label>
      <textarea
        data-testid="plc-io-textarea"
        ref={textareaRef}
        id="plc-io-textarea"
        value={text}
        onChange={e => setText(e.target.value)}
        spellCheck={false}
        rows={10}
        style={{ width: '100%', background: '#111827', color: 'white', border: '1px solid #374151', borderRadius: 6, padding: 8, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <button
          data-testid="plc-io-validate"
          onClick={onValidate}
          disabled={validating}
          aria-busy={validating ? 'true' : undefined}
          style={{ background: '#2563eb', color: 'white', padding: '6px 10px', borderRadius: 6, border: '1px solid #1d4ed8' }}
        >{validating ? 'Validating…' : 'Validate'}</button>
        <button
          data-testid="plc-io-apply"
          disabled={!diff}
          onClick={onClickApply}
          title={diff ? '' : 'Validate must pass to enable apply (Phase 2)'}
          style={{ background: diff ? '#10b981' : '#374151', color: diff ? 'black' : '#9ca3af', padding: '6px 10px', borderRadius: 6, border: '1px solid #4b5563' }}
        >Apply</button>
        <button
          data-testid="plc-io-export"
          onClick={async () => {
            const normalize = (state: PlcState) => ({
              nodes: [...state.nodes]
                .map(n => ({ id: n.id, x: +(n.x ?? 0), y: +(n.y ?? 0), label: (n.label ?? '').trim() }))
                .sort((a, b) => a.id.localeCompare(b.id)),
              edges: [...state.edges]
                .map(e => ({ from: e.from, to: e.to, label: (e.label ?? '').trim() }))
                .sort((a, b) => (a.from + a.to).localeCompare(b.from + b.to)),
            })
            const sortDeep = (v: any): any => {
              if (Array.isArray(v)) return v.map(sortDeep)
              if (v && typeof v === 'object') {
                const out: any = {}
                for (const k of Object.keys(v).sort()) out[k] = sortDeep(v[k])
                return out
              }
              return v
            }
            const payload = JSON.stringify(sortDeep({ schemaVersion: 1, ...normalize(current) }), null, 2)
            try {
              await navigator.clipboard.writeText(payload)
              setStatus('Exported ✓')
            } catch {
              try {
                const ta = document.createElement('textarea')
                ta.value = payload
                ta.setAttribute('readonly', 'true')
                ta.style.position = 'absolute'
                ta.style.left = '-9999px'
                document.body.appendChild(ta)
                ta.select()
                const ok = document.execCommand('copy')
                document.body.removeChild(ta)
                setStatus(ok ? 'Exported ✓' : 'Export failed ✕')
              } catch {
                setStatus('Export failed ✕')
              }
            }
          }}
          style={{ background: '#6b7280', color: 'white', padding: '6px 10px', borderRadius: 6, border: '1px solid #4b5563' }}
        >Export</button>
      </div>
    </aside>
  )
}
