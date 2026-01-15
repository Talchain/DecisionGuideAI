/**
 * JsonViewer Component
 *
 * Syntax-highlighted JSON display with copy and download functionality.
 * Used across Debug Panel V2 tabs for payload inspection.
 */

import { useState, useCallback, useMemo, CSSProperties } from 'react'
import { copyTextToClipboard } from '../../../utils/clipboard'

export interface JsonViewerProps {
  /** JSON data to display */
  data: unknown
  /** Maximum height before scrolling */
  maxHeight?: number
  /** Show copy button */
  showCopy?: boolean
  /** Show download button */
  showDownload?: boolean
  /** Download filename (without extension) */
  downloadFilename?: string
  /** Label for accessibility */
  label?: string
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/**
 * Download JSON data as a file
 */
function downloadJson(data: unknown, filename: string): void {
  const json = formatJson(data)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function JsonViewer({
  data,
  maxHeight = 400,
  showCopy = true,
  showDownload = false,
  downloadFilename = 'data',
  label = 'JSON data',
}: JsonViewerProps) {
  const [copied, setCopied] = useState(false)

  const formattedJson = useMemo(() => formatJson(data), [data])

  const handleCopy = useCallback(async () => {
    const success = await copyTextToClipboard(formattedJson)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }, [formattedJson])

  const handleDownload = useCallback(() => {
    downloadJson(data, downloadFilename)
  }, [data, downloadFilename])

  if (data === undefined || data === null) {
    return (
      <div
        style={{
          padding: 16,
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: 12,
          background: '#f8fafc',
          borderRadius: 8,
        }}
      >
        No data available
      </div>
    )
  }

  const containerStyle: CSSProperties = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
  }

  const toolbarStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '8px 12px',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  }

  const buttonStyle: CSSProperties = {
    padding: '4px 12px',
    fontSize: 11,
    cursor: 'pointer',
    border: '1px solid #e2e8f0',
    borderRadius: 4,
    background: '#fff',
    color: '#334155',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  }

  const preStyle: CSSProperties = {
    margin: 0,
    padding: 12,
    fontSize: 11,
    lineHeight: 1.5,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight,
    overflow: 'auto',
    background: '#fafafa',
  }

  return (
    <div style={containerStyle}>
      {(showCopy || showDownload) && (
        <div style={toolbarStyle}>
          {showCopy && (
            <button
              onClick={handleCopy}
              style={{
                ...buttonStyle,
                color: copied ? '#22c55e' : '#334155',
              }}
              aria-label={`Copy ${label}`}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
          {showDownload && (
            <button onClick={handleDownload} style={buttonStyle} aria-label={`Download ${label}`}>
              Download
            </button>
          )}
        </div>
      )}
      <pre style={preStyle} role="region" aria-label={label}>
        {formattedJson}
      </pre>
    </div>
  )
}

export default JsonViewer
