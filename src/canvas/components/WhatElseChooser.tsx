/**
 * ⭐ E4 — "WHAT ELSE…?" IS A CHOICE (Paul 29 Sep: "'What else…?' chips: Factor / Risk / Option / Outcome").
 *
 * A click on a ghost door ("What else drives this?", "What else could you do?", …) opens this small chooser at the
 * pointer: four chips and a free-text line. Each chip sends its kind’s registered question,
 * built from the current model and stage; the option chip includes the authored option labels.
 *
 * Choices send chip questions; free text sends the person’s own words.
 * The chooser closes only after a send. Proposed additions return through
 * Olumi’s approval route.
 */
import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { requestAsk } from '../ui/inspector-v2/askSemantic'
import { askAi } from '../conversation/askAi'
import type { AskIntent } from '../conversation/askAiQuestions'
import { typography } from '../../styles/typography'
import { measureDockInset } from './FloatingOlumiPanel'

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
  /** The door's kind highlights its chip; doorPrompt supplies legacy request text. */
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

/** Legacy request text. An explicit intent makes requestAsk build the sent question from the registry. */
export function whatElsePrompt(kind: WhatElseKind, open: Pick<WhatElseOpen, 'doorKind' | 'doorPrompt'>): string {
  if (open.doorKind === kind && open.doorPrompt) return open.doorPrompt
  return WHAT_ELSE_CHOICES.find((c) => c.kind === kind)!.prompt
}

export const WHAT_ELSE_CHOOSER_WIDTH = 248

/**
 * Where the chooser opens: beside the pointer, but always inside the canvas the person can see, never under the Outputs
 * dock. Served askAi witness, 7 Oct (staging d47c8d13): at a right-edge door the chooser opened beside the dock and its
 * Factor chip could not be clicked in 2 of 3 layouts. With no dock (`dockInset` 0) this is the previous window clamp.
 */
export function placeWhatElseChooser(
  anchor: { x: number; y: number },
  viewport: { width: number; height: number },
  dockInset: number,
): { left: number; top: number } {
  const rightEdge = viewport.width - Math.max(0, dockInset)
  return {
    left: Math.max(12, Math.min(anchor.x + 8, rightEdge - WHAT_ELSE_CHOOSER_WIDTH - 12)),
    top: Math.min(anchor.y + 8, viewport.height - 160),
  }
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

  const ask = (kind: WhatElseKind, prompt: string, label: string) => {
    const intent: AskIntent = kind === 'option' ? 'widen' : kind === 'risk' ? 'risks' : kind === 'factor' ? 'missing-factor' : 'missing-outcome'
    const result = requestAsk({ text: prompt, label, source: 'ghost-door', intent, includeOptions: kind === 'option', nodeIds: [], edgeIds: [] })
    if (result === 'sent') onClose()
  }

  const { left, top } = placeWhatElseChooser(
    open,
    { width: typeof window !== 'undefined' ? window.innerWidth : 1440, height: typeof window !== 'undefined' ? window.innerHeight : 900 },
    measureDockInset(),
  )

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
              open.doorKind === c.kind ? 'border-text-body text-text-body' : 'border-panel-border text-text-body'
            }`}
            onClick={() => ask(c.kind, whatElsePrompt(c.kind, open), `What else: ${c.label}`)}
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
          if (t && askAi({ userWords: text }) === 'sent') onClose()
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
