/**
 * HeroActionsMenu — top-right "Actions ▾" dropdown.
 *
 * Static set of glossary-aligned chat-prefill prompts. No provenance
 * overclaim copy ("what Olumi inferred" was reworded per the P1.2 review).
 */

import { useState } from 'react'
import { Sparkles, ChevronDown } from 'lucide-react'
import { typography } from '@/styles/typography'

interface Props {
  onPrefillChat: (text: string) => void
}

const MENU_ITEMS: Array<{ label: string; prompt: string }> = [
  { label: 'Review key inputs with AI', prompt: 'Walk me through the highest-priority inputs one at a time. Ask what I know before suggesting changes.' },
  { label: 'Show evidence gaps', prompt: 'Show only the factors, risks and assumptions where my input would most improve the analysis.' },
  // Per-factor provenance is not available in v1 — the "what Olumi inferred"
  // framing would overclaim until that backend lands. The reworded prompt
  // asks the user to walk through their inputs and makes no implicit claim
  // about origin.
  { label: 'Review my inputs', prompt: 'Walk me through the inputs I have provided. Ask me about anything that might need a closer look before relying on the result.' },
  { label: 'Challenge the current result', prompt: 'Challenge the current result. Make the strongest case for the next closest option.' },
  { label: 'Run a pre-mortem', prompt: 'If the leading option underperformed, what most likely went wrong?' },
  { label: 'Use the outside view', prompt: 'Ask what comparable decisions I know, then help me reason from base rates.' },
]

export function HeroActionsMenu({ onPrefillChat }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-panel-border bg-panel hover:bg-panel-hover ${typography.panelMeta} text-text-body cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info`}
        data-testid="hero-v17-actions-toggle"
      >
        Actions
        <ChevronDown size={11} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-9 right-0 w-56 p-1.5 rounded-md border border-panel-border bg-panel shadow-panel z-20"
          data-testid="hero-v17-actions-menu"
        >
          {MENU_ITEMS.map(item => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => { onPrefillChat(item.prompt); setOpen(false) }}
              className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-left ${typography.panelBody} hover:bg-panel-hover focus-visible:outline-none focus-visible:bg-panel-hover`}
            >
              <Sparkles size={11} className="text-info flex-shrink-0" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
