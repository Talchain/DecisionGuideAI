/**
 * M5: Documents Manager
 * Upload, view, and manage source documents
 */

import { useState } from 'react'
import { FileText, Upload, Trash2, ExternalLink, Download } from 'lucide-react'
import type { Document } from '../share/types'

interface DocumentsManagerProps {
  documents: Document[]
  onUpload: (files: File[]) => void
  onDelete: (documentId: string) => void
  onDownload?: (documentId: string) => void
}

export function DocumentsManager({
  documents,
  onUpload,
  onDelete,
  onDownload,
}: DocumentsManagerProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onUpload(Array.from(e.target.files))
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) {
      onUpload(Array.from(e.dataTransfer.files))
    }
  }

  const formatSize = (bytes: number | undefined): string => {
    if (!bytes) return '—'
    const kb = bytes / 1024
    if (kb < 1024) return `${kb.toFixed(1)} KB`
    return `${(kb / 1024).toFixed(1)} MB`
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Source Documents</h3>
        <p className="text-xs text-gray-600 mt-1">
          {documents.length} document{documents.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Upload area */}
      <div
        className={`m-4 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-700 mb-2">
          Drag & drop files here, or click to browse
        </p>
        <label className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700 text-sm font-medium">
          Browse Files
          <input
            type="file"
            multiple
            accept=".pdf,.txt,.md,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
        <p className="text-xs text-gray-500 mt-2">
          Supports: PDF, TXT, MD, CSV (max 1MB each, 25K chars total)
        </p>
      </div>

      {/* Documents list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {documents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No documents yet</p>
            <p className="text-xs mt-1">Upload files to get started</p>
          </div>
        ) : (
          documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onDelete={onDelete}
              onDownload={onDownload}
              formatSize={formatSize}
            />
          ))
        )}
      </div>
    </div>
  )
}

function DocumentCard({
  document,
  onDelete,
  onDownload,
  formatSize,
}: {
  document: Document
  onDelete: (id: string) => void
  onDownload?: (id: string) => void
  formatSize: (bytes: number | undefined) => string
}) {
  const typeIcons: Record<Document['type'], string> = {
    pdf: '📄',
    txt: '📝',
    md: '📋',
    csv: '📊',
    url: '🔗',
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="text-2xl">{typeIcons[document.type]}</div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-900 truncate">
            {document.name}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
            <span className="uppercase">{document.type}</span>
            <span>•</span>
            <span>{formatSize(document.size)}</span>
            {document.truncated && (
              <>
                <span>•</span>
                <span className="text-amber-600 font-medium" title="Content truncated to 5K chars">
                  Truncated
                </span>
              </>
            )}
            <span>•</span>
            <span>
              {new Date(document.uploadedAt).toLocaleDateString()}
            </span>
          </div>
          {document.metadata?.tags && (
            <div className="flex gap-1 mt-2">
              {document.metadata.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1">
          {document.url && (
            <a
              href={document.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:bg-gray-200 rounded"
              title="Open external link"
            >
              <ExternalLink className="w-4 h-4 text-gray-600" />
            </a>
          )}
          {onDownload && (
            <button
              onClick={() => onDownload(document.id)}
              className="p-1 hover:bg-gray-200 rounded"
              title="Download"
            >
              <Download className="w-4 h-4 text-gray-600" />
            </button>
          )}
          <button
            onClick={() => onDelete(document.id)}
            className="p-1 hover:bg-red-100 rounded"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        </div>
      </div>
    </div>
  )
}
