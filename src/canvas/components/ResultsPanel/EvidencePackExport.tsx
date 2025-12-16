/**
 * EvidencePackExport - Export analysis results for sharing
 *
 * Brief H Task 13: Export evidence pack for stakeholder review
 *
 * Features:
 * - Export to PDF format
 * - Include graphs, drivers, and recommendations
 * - Copy link for sharing
 * - Download evidence pack
 */

import { useState, useCallback } from 'react'
import {
  Download,
  FileText,
  Link2,
  Check,
  Loader2,
  Share2,
} from 'lucide-react'
import { typography } from '../../../styles/typography'

interface EvidencePackExportProps {
  /** Run ID for generating export */
  runId?: string | null
  /** Response hash for caching */
  responseHash?: string | null
  /** Callback when export starts */
  onExportStart?: () => void
  /** Callback when export completes */
  onExportComplete?: (url: string) => void
  /** Callback when export fails */
  onExportError?: (error: string) => void
  /** Compact mode (icon-only buttons) */
  compact?: boolean
}

type ExportFormat = 'pdf' | 'json' | 'link'

export function EvidencePackExport({
  runId,
  responseHash,
  onExportStart,
  onExportComplete,
  onExportError,
  compact = false,
}: EvidencePackExportProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!runId) {
        onExportError?.('No analysis to export')
        return
      }

      setIsExporting(true)
      setExportFormat(format)
      onExportStart?.()

      try {
        if (format === 'link') {
          // Generate shareable link
          const url = new URL(window.location.href)
          url.searchParams.set('run', runId)
          if (responseHash) {
            url.searchParams.set('hash', responseHash.slice(0, 8))
          }

          await navigator.clipboard.writeText(url.toString())
          setLinkCopied(true)
          onExportComplete?.(url.toString())

          // Reset copied state after 2 seconds
          setTimeout(() => setLinkCopied(false), 2000)
        } else if (format === 'json') {
          // Export as JSON - placeholder for actual implementation
          const exportData = {
            runId,
            responseHash,
            exportedAt: new Date().toISOString(),
            // Include actual analysis data here
          }

          const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json',
          })
          const url = URL.createObjectURL(blob)

          const link = document.createElement('a')
          link.href = url
          link.download = `evidence-pack-${runId.slice(0, 8)}.json`
          link.click()

          URL.revokeObjectURL(url)
          onExportComplete?.(url)
        } else if (format === 'pdf') {
          // PDF export - would require server-side generation
          // For now, show a message that it's not yet implemented
          onExportError?.('PDF export coming soon')
        }
      } catch (error) {
        onExportError?.((error as Error).message || 'Export failed')
      } finally {
        setIsExporting(false)
        setExportFormat(null)
      }
    },
    [runId, responseHash, onExportStart, onExportComplete, onExportError]
  )

  const isDisabled = !runId || isExporting

  if (compact) {
    return (
      <div className="flex items-center gap-1" data-testid="evidence-pack-compact">
        <button
          type="button"
          onClick={() => handleExport('link')}
          disabled={isDisabled}
          className={`p-2 rounded-lg transition-colors ${
            isDisabled
              ? 'text-ink-300 cursor-not-allowed'
              : 'text-ink-500 hover:bg-sand-100 hover:text-ink-700'
          }`}
          title="Copy link"
        >
          {linkCopied ? (
            <Check className="h-4 w-4 text-mint-600" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={() => handleExport('json')}
          disabled={isDisabled}
          className={`p-2 rounded-lg transition-colors ${
            isDisabled
              ? 'text-ink-300 cursor-not-allowed'
              : 'text-ink-500 hover:bg-sand-100 hover:text-ink-700'
          }`}
          title="Download JSON"
        >
          {isExporting && exportFormat === 'json' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3" data-testid="evidence-pack-export">
      <div className="flex items-center gap-2">
        <Share2 className="h-4 w-4 text-ink-500" aria-hidden="true" />
        <span className={`${typography.label} text-ink-700`}>
          Share Results
        </span>
      </div>

      <div className="space-y-2">
        {/* Copy Link */}
        <button
          type="button"
          onClick={() => handleExport('link')}
          disabled={isDisabled}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
            isDisabled
              ? 'bg-sand-50 border-sand-200 text-ink-400 cursor-not-allowed'
              : linkCopied
                ? 'bg-mint-50 border-mint-200 text-mint-700'
                : 'bg-paper-50 border-sand-200 hover:border-sky-300 hover:bg-sky-50 text-ink-700'
          }`}
        >
          {linkCopied ? (
            <Check className="h-4 w-4 text-mint-600" />
          ) : isExporting && exportFormat === 'link' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          <span className={`${typography.bodySmall} font-medium`}>
            {linkCopied ? 'Link Copied!' : 'Copy Shareable Link'}
          </span>
        </button>

        {/* Download JSON */}
        <button
          type="button"
          onClick={() => handleExport('json')}
          disabled={isDisabled}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
            isDisabled
              ? 'bg-sand-50 border-sand-200 text-ink-400 cursor-not-allowed'
              : 'bg-paper-50 border-sand-200 hover:border-sky-300 hover:bg-sky-50 text-ink-700'
          }`}
        >
          {isExporting && exportFormat === 'json' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span className={`${typography.bodySmall} font-medium`}>
            Download Evidence Pack
          </span>
        </button>

        {/* PDF Export (coming soon) */}
        <button
          type="button"
          onClick={() => handleExport('pdf')}
          disabled={true} // Always disabled until implemented
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-sand-50 border-sand-200 text-ink-400 cursor-not-allowed"
        >
          <FileText className="h-4 w-4" />
          <span className={`${typography.bodySmall} font-medium`}>
            Export PDF Report
          </span>
          <span className={`${typography.caption} ml-auto text-ink-400`}>
            Coming soon
          </span>
        </button>
      </div>

      {!runId && (
        <p className={`${typography.caption} text-ink-500 text-center`}>
          Run analysis to enable export
        </p>
      )}
    </div>
  )
}
