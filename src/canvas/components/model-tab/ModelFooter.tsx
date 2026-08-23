/**
 * ModelFooter — copy-as-text/JSON buttons.
 *
 * Renders as a sticky-bottom bar docked to the model tab scroll container.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The former search box is removed. It never filtered anything and duplicated
 * the connected Model-v2 filter immediately above this footer.
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
 * The old search props remain absent; a future search belongs in the connected
 * outline filter rather than growing a second state path here.
 */

import { useState } from 'react'
import { Copy, ClipboardCopy } from 'lucide-react'
import { typography } from '../../../styles/typography'

interface ModelFooterProps {
  onCopyText: () => void
  onCopyJson: () => void
}

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
      className="border-t border-panel-border pt-3 flex items-center justify-end gap-2"
      data-testid="model-footer"
    >
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
