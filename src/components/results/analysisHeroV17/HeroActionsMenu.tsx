/**
 * HeroActionsMenu — top-right "Actions ▾" dropdown.
 *
 * Static set of glossary-aligned chat-prefill prompts. All items map to
 * `start_guided_chat` per V5 contract v1.3 §3.
 *
 * (Fix 8) Two items dropped because they map to `Needs handler` intents:
 *   - "Run a pre-mortem" → run_pre_mortem (Needs handler) — removed
 *   - "Use the outside view" → run_outside_view (Needs handler) — removed
 * One item renamed to avoid implying a formal devil's advocacy handler:
 *   - "Challenge the current result" → "Test the result" (start_guided_chat)
 *
 * (Fix 6) Trigger button is HIDDEN when chat-prefill is unavailable. The
 * earlier disabled-button treatment showed a dead button in the common
 * case of chat being minimised. Every menu item depends on prefill, so
 * the trigger is only useful when chat is open.
 */

import { useState } from 'react'
import { Sparkles, ChevronDown } from 'lucide-react'
import { typography } from '@/styles/typography'

interface Props {
  onPrefillChat: (text: string) => void
  /** When false, the entire trigger + menu is hidden — every menu item is prefill. */
  chatPrefillAvailable: boolean
}

const MENU_ITEMS: Array<{ label: string; prompt: string }> = [
  { label: 'Review key inputs with AI', prompt: 'Walk me through the highest-priority inputs one at a time. Ask what I know before suggesting changes.' },
  { label: 'Show evidence gaps', prompt: 'Show only the factors, risks and assumptions where my input would most improve the analysis.' },
  // Per-factor provenance is not available in v1 — the "what Olumi inferred"
  // framing would overclaim until that backend lands. The reworded prompt
  // asks the user to walk through their inputs and makes no implicit claim
  // about origin.
  { label: 'Review my inputs', prompt: 'Walk me through the inputs I have provided. Ask me about anything that might need a closer look before relying on the result.' },
  // Renamed from "Challenge the current result" (Fix 8) to avoid reading
  // like a formal devil's advocacy exercise (`run_devils_advocacy` is
  // Needs handler in V5 contract v1.3).
  { label: 'Test the result', prompt: 'Challenge the current leading option. Make the strongest case for the next closest option.' },
]

export function HeroActionsMenu({ onPrefillChat, chatPrefillAvailable }: Props) {
  const [open, setOpen] = useState(false)
  // Fix 6: hide the entire trigger when prefill is unavailable.
  if (!chatPrefillAvailable) return null
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
