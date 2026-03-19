/**
 * ModelFooter — search box + copy-as-text/JSON buttons.
 *
 * Accepts a search query string + setter, plus copy handlers for text and JSON.
 * Renders as a sticky-bottom bar docked to the model tab scroll container.
 */

import { useState, type ChangeEvent } from 'react'
import { Copy, ClipboardCopy } from 'lucide-react'
import { typography } from '../../../styles/typography'

interface ModelFooterProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  onCopyText: () => void
  onCopyJson: () => void
}

export function ModelFooter({ searchQuery, onSearchChange, onCopyText, onCopyJson }: ModelFooterProps) {
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
        value={searchQuery}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
        placeholder="Search factors and edges…"
        className={`flex-1 ${typography.panelBody} text-text-header px-2 py-1 rounded-sm border border-panel-border bg-panel focus:outline-none focus:ring-1 focus:ring-info/50 placeholder:text-text-light`}
        data-testid="model-search"
      />
      <button
        type="button"
        onClick={handleCopyText}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded border border-panel-border ${typography.panelMeta} text-text-body hover:bg-panel-hover transition-colors shrink-0`}
        data-testid="model-copy"
      >
        <Copy className="w-3 h-3 shrink-0" aria-hidden="true" />
        {copied === 'text' ? 'Copied!' : 'Text'}
      </button>
      <button
        type="button"
        onClick={handleCopyJson}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded border border-panel-border ${typography.panelMeta} text-text-body hover:bg-panel-hover transition-colors shrink-0`}
        data-testid="model-copy-json"
      >
        <ClipboardCopy className="w-3 h-3 shrink-0" aria-hidden="true" />
        {copied === 'json' ? 'Copied!' : 'JSON'}
      </button>
    </div>
  )
}
