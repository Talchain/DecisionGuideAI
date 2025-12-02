/**
 * N3: Documents Drawer with Preview
 * Cmd/Ctrl+D to toggle
 */

import { X, FileText } from 'lucide-react'
import type { Document } from '../share/types'
import { typography } from '../../styles/typography'

interface DocumentsDrawerProps {
  documents: Document[]
  isOpen: boolean
  onClose: () => void
}

const MAX_FILE_SIZE = 1024 * 1024 // 1 MB
const MAX_CHARS_PER_FILE = 5000

export function DocumentsDrawer({ documents, isOpen, onClose }: DocumentsDrawerProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-200 shadow-panel z-50 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h2 className={`${typography.h4} text-gray-900`}>Documents</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded"
          aria-label="Close documents drawer"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {documents.length === 0 ? (
          <div className={`text-center py-8 ${typography.body} text-gray-500`}>
            No documents uploaded
          </div>
        ) : (
          documents.map((doc, idx) => (
            <DocumentPreview key={idx} document={doc} />
          ))
        )}
      </div>
    </div>
  )
}

function DocumentPreview({ document }: { document: Document }) {
  const anyDoc = document as any
  const displayName = anyDoc.name || anyDoc.filename || 'Untitled'
  const content: string =
    typeof anyDoc.content === 'string'
      ? anyDoc.content
      : typeof document.content === 'string'
        ? document.content
        : ''
  const truncated = content.slice(0, MAX_CHARS_PER_FILE)
  const lines = truncated.split('\n')
  const isTruncated = content.length > MAX_CHARS_PER_FILE
  const size = (anyDoc.size as number | undefined) ?? document.size ?? document.displayBytes
  const isOversized = typeof size === 'number' && size > MAX_FILE_SIZE

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-start gap-2 mb-2">
        <FileText className="w-4 h-4 text-gray-600 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className={`${typography.label} text-gray-900 truncate`}>
            {displayName}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded ${typography.caption} font-medium bg-gray-100 text-gray-800`}>
              {getFileType(displayName)}
            </span>
            {typeof anyDoc.size === 'number' && (
              <span className={`${typography.caption} text-gray-600`}>
                {formatFileSize(anyDoc.size)}
              </span>
            )}
          </div>
        </div>
      </div>

      {isOversized && (
        <div className={`mb-2 px-2 py-1.5 bg-danger-50 border border-danger-200 rounded ${typography.caption} text-danger-700`}>
          File exceeds 1 MB limit
        </div>
      )}

      {isTruncated && (
        <div className={`mb-2 px-2 py-1.5 bg-warning-50 border border-warning-200 rounded ${typography.caption} text-warning-700`}>
          Content truncated at {MAX_CHARS_PER_FILE.toLocaleString()} characters
        </div>
      )}

      <div className="bg-gray-50 rounded border border-gray-200 p-2 max-h-48 overflow-y-auto">
        <pre className={`${typography.code} text-gray-800 whitespace-pre-wrap`}>
          {lines.map((line: string, idx: number) => (
            <div key={idx} className="flex gap-2">
              <span className="text-gray-400 select-none text-right" style={{ minWidth: '2em' }}>
                {idx + 1}
              </span>
              <span>{line}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  )
}

function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toUpperCase()
  return ext || 'FILE'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
