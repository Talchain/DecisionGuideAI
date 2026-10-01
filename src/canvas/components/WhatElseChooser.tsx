/**
 * ⭐ E4 — "WHAT ELSE…?" IS A CHOICE (Paul 29 Sep: "'What else…?' chips: Factor / Risk / Option / Outcome").
 *
 * A click on a ghost door ("What else drives this?", "What else could you do?", …) opens this small chooser at the
 * pointer: four chips and a free-text line. The door's own kind keeps the door's own contextual question; the
 * other chips ask the plain question for their kind.
 *
 * ⚠ IT NEVER SENDS AND NEVER WRITES THE GRAPH. Every choice goes through `requestAsk`, which prefills the composer
 * (or the Ask drawer) — the same seam the doors used directly before — and the person presses Send. Anything
 * added arrives through Olumi's validated patch route, never from here.
 */
import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { requestAsk } from '../ui/inspector-v2/askSemantic'
import { typography } from '../../styles/typography'

export type WhatElseKind = 'factor' | 'risk' | 'option' | 'outcome'

export const WHAT_ELSE_CHOICES: ReadonlyArray<{ kind: WhatElseKind; label: string; prompt: string }> = [
  { kind: 'factor', label: 'Factor', prompt: 'What else drives this decision that the model does not have yet?' },
  { kind: 'risk', label: 'Risk', prompt: 'What else could go wrong that the model does not have yet?' },
  { kind: 'option', label: 'Option', prompt: 'What else could I do that the model does not have yet?' },
  { kind: 'outcome', label: 'Outcome', prompt: 'Where else could this lead that the model does not have yet?' },
]

interface WhatElseOpen {
  x: number
  y: number
  /** The door's kind and its own contextual question, used for that kind's chip. */
  doorKind?: string
  doorPrompt?: string
}

export const useWhatElseStore = create<{
  open: WhatElseOpen | null
  show: (open: WhatElseOpen) => void
  close: () => void
}>((set) => ({
  open: null,
  show: (open) => set({ open }),
  close: () => set({ open: null }),
}))

/** The ask a chip makes: the door's own question for the door's kind, else the plain question for that kind. */
export function whatElsePrompt(kind: WhatElseKind, open: Pick<WhatElseOpen, 'doorKind' | 'doorPrompt'>): string {
  if (open.doorKind === kind && open.doorPrompt) return open.doorPrompt
  return WHAT_ELSE_CHOICES.find((c) => c.kind === kind)!.prompt
}

export function WhatElseChooser({ open, onClose }: { open: WhatElseOpen; onClose: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [text, setText] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown, true)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown, true) }
  }, [onClose])

  const ask = (prompt: string, label: string) => {
    requestAsk({ text: prompt, label, source: 'ghost-door' })
    onClose()
  }

  const left = Math.min(open.x + 8, (typeof window !== 'undefined' ? window.innerWidth : 1440) - 260)
  const top = Math.min(open.y + 8, (typeof window !== 'undefined' ? window.innerHeight : 900) - 160)

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="What else…?"
      data-testid="what-else-chooser"
      className="fixed z-50 w-[248px] rounded-lg border border-panel-border bg-panel p-3 shadow-lg nodrag nopan"
      style={{ left, top }}
    >
      <p className={`${typography.panelMeta} text-text-light m-0 mb-2`}>What else…?</p>
      <div className="flex flex-wrap gap-1.5">
        {WHAT_ELSE_CHOICES.map((c) => (
          <button
            key={c.kind}
            type="button"
            data-testid={`what-else-${c.kind}`}
            className={`${typography.panelMeta} rounded-full border px-2.5 py-1 hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info ${
              open.doorKind === c.kind ? 'border-info text-text-body' : 'border-panel-border text-text-body'
            }`}
            onClick={() => ask(whatElsePrompt(c.kind, open), `What else: ${c.label}`)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <form
        className="mt-2"
        onSubmit={(e) => {
          e.preventDefault()
          const t = text.trim()
          if (t) ask(t, 'What else')
        }}
      >
        <input
          data-testid="what-else-free"
          aria-label="Or say what to add"
          placeholder="Or say what to add…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={`${typography.panelBody} w-full rounded border border-panel-border bg-panel px-2 py-1 focus:outline-none`}
        />
      </form>
    </div>
  )
}

/** Mounted once by the canvas; renders the chooser while a door has opened it. */
export function WhatElseChooserHost() {
  const open = useWhatElseStore((s) => s.open)
  const close = useWhatElseStore((s) => s.close)
  if (!open) return null
  return <WhatElseChooser key={`${open.x},${open.y}`} open={open} onClose={close} />
}

/** A door's click or key: open the chooser at the pointer, or under the door for the keyboard. */
export function openWhatElseFromDoor(
  e: { clientX?: number; clientY?: number; currentTarget: EventTarget | null },
  doorKind: string | undefined,
  doorPrompt: string | undefined,
): void {
  let x = e.clientX ?? 0
  let y = e.clientY ?? 0
  if (!x && !y && e.currentTarget instanceof Element) {
    const r = e.currentTarget.getBoundingClientRect()
    x = r.left
    y = r.bottom
  }
  useWhatElseStore.getState().show({ x, y, doorKind, doorPrompt })
}
