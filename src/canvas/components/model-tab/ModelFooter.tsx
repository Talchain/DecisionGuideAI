/**
 * ModelFooter — search box + copy-as-text/JSON buttons.
 *
 * Renders as a sticky-bottom bar docked to the model tab scroll container.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠⚠ THE SEARCH BOX IS DISABLED, AND THAT IS THE FIX — IT WAS NEVER WIRED
 * ─────────────────────────────────────────────────────────────────────────────
 * It accepted a `searchQuery` + setter, `ModelTabBody` held the state, and
 * NOTHING FILTERED ON IT: the value was declared, threaded down here, echoed
 * back up, and read by no consumer anywhere in `src/`. A user typed into it and
 * the list did not change — and there was no way to tell that from a search that
 * simply matched everything. The estate's other five search boxes
 * (`GraphTextView`, `ProvenanceHub`, `ProvenanceHubTab`, `TemplatesPanel`,
 * `DocumentsManager`) each have a real `filter`/`includes` consumer; this one
 * had two references, both structural.
 *
 * ⚠ THE PROPS ARE GONE, NOT KEPT-AND-IGNORED. Leaving `searchQuery` threaded
 * through a disabled control preserves the appearance of a wired feature and
 * invites the next reader to assume the filter exists somewhere. Whoever wires
 * search adds the props back IN THE SAME CHANGE as the predicate that consumes
 * them.
 *
 * ⚠ DISABLED-WITH-A-REASON, NOT DELETED: the affordance is wanted (design §7.4)
 * and this is the pattern the Model tab already uses honestly for an unbuilt
 * capability — `ModelRowView`'s "Editing is not connected yet". A control that
 * says why it cannot act is a fact; a control that silently does nothing is a
 * lie the user cannot detect.
 */

import { useState } from 'react'
import { Copy, ClipboardCopy } from 'lucide-react'
import { typography } from '../../../styles/typography'

interface ModelFooterProps {
  onCopyText: () => void
  onCopyJson: () => void
}

/** Why the search box is inert. Shown on the disabled control, in words. */
const SEARCH_NOT_CONNECTED_REASON =
  'Search is not connected yet — the list cannot be filtered from here.'

export function ModelFooter({ onCopyText, onCopyJson }: ModelFooterProps) {
  const [copied, setCopied] = useState<'text' | 'json' | false>(false)

  const handleCopyText = () => {
    onCopyText()
    setCopied('text')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyJson = () => {
    onCopyJson()
    setCopied('json')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="border-t border-panel-border pt-3 flex items-center gap-2"
      data-testid="model-footer"
    >
      <input
        type="search"
        value=""
        readOnly
        disabled
        // The reason travels with the control on hover AND to a screen reader —
        // a `title` alone is invisible to anyone not using a mouse.
        title={SEARCH_NOT_CONNECTED_REASON}
        aria-label={SEARCH_NOT_CONNECTED_REASON}
        placeholder="Search is not connected yet"
        className={`flex-1 ${typography.panelBody} text-text-header px-2 py-1 rounded-sm border border-panel-border bg-panel placeholder:text-text-light opacity-60 cursor-not-allowed`}
        data-testid="model-search"
      />
      <button
        type="button"
        onClick={handleCopyText}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded border border-panel-border ${typography.panelMeta} text-text-body hover:bg-panel-hover transition-colors shrink-0`}
        data-testid="model-copy"
      >
        <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        {copied === 'text' ? 'Copied!' : 'Text'}
      </button>
      <button
        type="button"
        onClick={handleCopyJson}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded border border-panel-border ${typography.panelMeta} text-text-body hover:bg-panel-hover transition-colors shrink-0`}
        data-testid="model-copy-json"
      >
        <ClipboardCopy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        {copied === 'json' ? 'Copied!' : 'JSON'}
      </button>
    </div>
  )
}
