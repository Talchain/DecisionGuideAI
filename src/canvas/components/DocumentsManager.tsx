/**
 * M5 + S7-FILEOPS: Documents Manager
 * Upload, view, and manage source documents
 * S7-FILEOPS: Adds rename (inline), search/filter, and sort operations
 */

import { useState, useMemo, useCallback } from 'react'
import { FileText, Upload, Trash2, ExternalLink, Download, Edit2, Check, X, Search, ArrowUpDown } from 'lucide-react'
import type { Document } from '../share/types'
import { useCanvasStore } from '../store'
import { validateDocumentName, type ValidationError } from '../store/documents'
import { typography } from '../../styles/typography'

interface DocumentsManagerProps {
  onUpload: (files: File[]) => void
  onDownload?: (documentId: string) => void
  onDelete?: (documentId: string, document?: Document) => void
}

export function DocumentsManager({ onUpload, onDownload, onDelete }: DocumentsManagerProps) {
  const [isDragging, setIsDragging] = useState(false)

  // S7-FILEOPS: Get state from store
  // React #185 FIX: Use shallow comparison for array selector
  const documents = useCanvasStore(s => s.documents)
  const searchQuery = useCanvasStore(s => s.documentSearchQuery)
  const sortField = useCanvasStore(s => s.documentSortField)
  const sortDirection = useCanvasStore(s => s.documentSortDirection)
  const setSearchQuery = useCanvasStore(s => s.setDocumentSearchQuery)
  const setSort = useCanvasStore(s => s.setDocumentSort)
  const removeDocumentFromStore = useCanvasStore(s => s.removeDocument)
  const renameDocument = useCanvasStore(s => s.renameDocument)

  const handleDelete = useCallback((id: string) => {
    const doc = documents.find(d => d.id === id)
    onDelete?.(id, doc)
    removeDocumentFromStore(id)
  }, [documents, removeDocumentFromStore, onDelete])

  const normalisedQuery = searchQuery.trim().toLowerCase()

  // S7-FILEOPS: Filter and sort (memoised for performance)
  const filteredAndSorted = useMemo(() => {
    const sorted = [...documents].sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'date':
          comparison = a.uploadedAt.getTime() - b.uploadedAt.getTime()
          break
        case 'size': {
          const aSize = a.displayBytes ?? a.size ?? 0
          const bSize = b.displayBytes ?? b.size ?? 0
          comparison = aSize - bSize
          break
        }
        case 'type':
          comparison = a.type.localeCompare(b.type)
          break
        default:
          comparison = 0
      }
      if (comparison === 0 && sortField !== 'date') {
        comparison = a.uploadedAt.getTime() - b.uploadedAt.getTime()
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })

    if (!normalisedQuery) {
      return sorted
    }

    return sorted.filter(doc => doc.name.toLowerCase().includes(normalisedQuery))
  }, [documents, sortField, sortDirection, normalisedQuery])

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

  const toggleSort = useCallback((field: typeof sortField) => {
    if (sortField === field) {
      setSort(field, sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(field, 'asc')
    }
  }, [sortField, sortDirection, setSort])

  const formatSize = (bytes: number | undefined): string => {
    if (!bytes) return '—'
    const kb = bytes / 1024
    if (kb < 1024) return `${kb.toFixed(1)} KB`
    return `${(kb / 1024).toFixed(1)} MB`
  }

  return (
    <div className="h-full flex flex-col bg-paper-50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-sand-200 bg-paper-50">
        <h3 className={`${typography.body} font-semibold text-ink-900`}>Documents</h3>
        <p className={`${typography.caption} text-ink-900/70 mt-1`}>
          {documents.length} document{documents.length !== 1 ? 's' : ''}
          {searchQuery && filteredAndSorted.length !== documents.length && (
            <span> ({filteredAndSorted.length} filtered)</span>
          )}
        </p>
      </div>

      {/* S7-FILEOPS: Search and Sort Controls */}
      {documents.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-200 space-y-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-8 py-1.5 ${typography.body} border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              aria-label="Search documents"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                aria-label="Clear search"
              >
                <X className="w-3 h-3 text-gray-500" />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className={`flex items-center gap-2 ${typography.caption}`}>
            <ArrowUpDown className="w-3 h-3 text-gray-500" aria-hidden="true" />
            <span className="text-gray-600">Sort by:</span>
            {(['name', 'date', 'size', 'type'] as const).map((field) => (
              <button
                key={field}
                onClick={() => toggleSort(field)}
                className={`px-2 py-1 rounded capitalize ${
                  sortField === field
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                aria-label={`Sort by ${field}${sortField === field ? `, currently ${sortDirection === 'asc' ? 'ascending' : 'descending'}` : ''}`}
              >
                {field}
                {sortField === field && (
                  <span className="ml-1" aria-hidden="true">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Upload area */}
      <div
        className={`m-4 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging
            ? 'border-sky-500 bg-sky-50'
            : 'border-sand-200 bg-paper-50 hover:border-sand-300'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-ink-900/50" aria-hidden="true" />
        <p className={`${typography.body} text-ink-900/80 mb-2`}>
          Drag and drop files here, or click to browse
        </p>
        <label className={`inline-block px-4 py-2 bg-info-500 text-white rounded-md cursor-pointer hover:bg-info-600 ${typography.button}`}>
          Browse Files
          <input
            type="file"
            multiple
            accept=".pdf,.txt,.md,.csv"
            onChange={handleFileChange}
            className="hidden"
            data-testid="documents-file-input"
          />
        </label>
        <p className={`${typography.caption} text-ink-900/60 mt-2`}>
          Supports: PDF, TXT, MD, CSV (max 1MB each, 25K chars total)
        </p>
      </div>

      {/* Documents list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-ink-900/70">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50">
              <FileText className="w-6 h-6 text-sky-600" aria-hidden="true" />
            </div>
            <p className={`${typography.body} font-medium`}>No documents yet</p>
            <p className={`mt-1 ${typography.caption} text-ink-900/60`}>
              Attach research, specs, or data Olumi should consider.
            </p>
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-ink-900/70">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sand-50">
              <Search className="w-6 h-6 text-ink-900/50" aria-hidden="true" />
            </div>
            <p className={`${typography.body} font-medium`}>No documents match '{searchQuery}'</p>
            <p className={`mt-1 ${typography.caption} text-ink-900/60`}>Try a different search term</p>
          </div>
        ) : (
          filteredAndSorted.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              allDocumentNames={documents.filter(d => d.id !== doc.id).map(d => d.name)}
              onDelete={handleDelete}
              onDownload={onDownload}
              onRename={renameDocument}
              formatSize={formatSize}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface DocumentCardProps {
  document: Document
  allDocumentNames: string[]
  onDelete: (id: string) => void
  onDownload?: (id: string) => void
  onRename: (id: string, newName: string) => void
  formatSize: (bytes: number | undefined) => string
}

function DocumentCard({
  document,
  allDocumentNames,
  onDelete,
  onDownload,
  onRename,
  formatSize,
}: DocumentCardProps) {
  // S7-FILEOPS: Rename state
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(document.name)
  const [validationError, setValidationError] = useState<ValidationError | null>(null)

  const typeIcons: Record<Document['type'], string> = {
    pdf: '📄',
    txt: '📝',
    md: '📋',
    csv: '📊',
    url: '🔗',
  }

  const handleRename = () => {
    const error = validateDocumentName(newName, allDocumentNames, document.id)

    if (error) {
      setValidationError(error)
      return
    }

    if (newName.trim() === document.name) {
      // No change, just cancel
      setIsRenaming(false)
      setValidationError(null)
      return
    }

    onRename(document.id, newName.trim())
    setIsRenaming(false)
    setValidationError(null)
  }

  const handleCancel = () => {
    setIsRenaming(false)
    setNewName(document.name)
    setValidationError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleRename()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    } else if (e.key === 'F2' && !isRenaming) {
      e.preventDefault()
      setIsRenaming(true)
    }
  }

  return (
    <div
      className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
      onKeyDown={handleKeyDown}
      tabIndex={isRenaming ? -1 : 0}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="text-2xl" aria-hidden="true">{typeIcons[document.type]}</div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* S7-FILEOPS: Editable name */}
          {isRenaming ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value)
                    setValidationError(null) // Clear error on change
                  }}
                  onKeyDown={handleKeyDown}
                  onBlur={handleRename}
                  autoFocus
                  maxLength={120}
                  className={`flex-1 px-2 py-1 ${typography.body} border border-blue-500 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                  aria-label={`Rename document ${document.name}`}
                  aria-invalid={!!validationError}
                  aria-describedby={validationError ? `error-${document.id}` : undefined}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRename()
                  }}
                  className="p-1 hover:bg-green-100 rounded"
                  title="Save (Enter)"
                  aria-label="Save rename"
                >
                  <Check className="w-3 h-3 text-green-600" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCancel()
                  }}
                  className="p-1 hover:bg-red-100 rounded"
                  title="Cancel (Escape)"
                  aria-label="Cancel rename"
                >
                  <X className="w-3 h-3 text-red-600" />
                </button>
              </div>
              {validationError && (
                <div
                  id={`error-${document.id}`}
                  className={`${typography.caption} text-red-600`}
                  role="alert"
                >
                  {validationError.message}
                </div>
              )}
            </div>
          ) : (
            <div className={`font-medium ${typography.body} text-gray-900 truncate`}>
              {document.name}
            </div>
          )}
          <div className={`flex items-center gap-2 mt-1 ${typography.caption} text-gray-600`}>
            <span className="uppercase">{document.type}</span>
            <span aria-hidden="true">•</span>
            <span>{formatSize(document.size)}</span>
            {document.truncated && (
              <>
                <span aria-hidden="true">•</span>
                <span className="text-amber-600 font-medium" title="Content truncated to 5K chars">
                  Truncated
                </span>
              </>
            )}
            <span aria-hidden="true">•</span>
            <span>
              {document.uploadedAt.toLocaleDateString()}
            </span>
          </div>
          {document.metadata?.tags && (
            <div className="flex gap-1 mt-2">
              {document.metadata.tags.map((tag) => (
                <span
                  key={tag}
                  className={`px-2 py-0.5 bg-gray-100 text-gray-700 rounded ${typography.caption}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1">
          {/* S7-FILEOPS: Rename button */}
          {!isRenaming && (
            <button
              onClick={() => setIsRenaming(true)}
              className="p-1 hover:bg-gray-200 rounded"
              title="Rename (F2)"
              aria-label="Rename document"
            >
              <Edit2 className="w-4 h-4 text-gray-600" />
            </button>
          )}
          {document.url && (
            <a
              href={document.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:bg-gray-200 rounded"
              title="Open external link"
              aria-label="Open external link"
            >
              <ExternalLink className="w-4 h-4 text-gray-600" />
            </a>
          )}
          {onDownload && (
            <button
              onClick={() => onDownload(document.id)}
              className="p-1 hover:bg-gray-200 rounded"
              title="Download"
              aria-label="Download document"
            >
              <Download className="w-4 h-4 text-gray-600" />
            </button>
          )}
          <button
            onClick={() => onDelete(document.id)}
            className="p-1 hover:bg-red-100 rounded"
            title="Delete"
            aria-label="Delete document"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        </div>
      </div>
    </div>
  )
}
