/**
 * S7-FILEOPS: Documents State Management
 * Handles document rename, add, remove with undo/redo integration
 */

export interface DocumentItem {
  id: string           // Stable ID for provenance references
  name: string         // User-editable name
  type: 'pdf' | 'txt' | 'md' | 'csv'
  sizeBytes: number
  addedAt: number      // Epoch ms
  text: string         // Truncated to 5k chars
  truncated?: boolean
}

export interface DocumentsState {
  items: DocumentItem[]
  searchQuery: string
  sortField: 'name' | 'date' | 'size' | 'type'
  sortDirection: 'asc' | 'desc'
}

// Event emitter for document rename notifications
type DocumentRenamedListener = (id: string, oldName: string, newName: string) => void
const renameListeners = new Set<DocumentRenamedListener>()

export function onDocumentRenamed(listener: DocumentRenamedListener): () => void {
  renameListeners.add(listener)
  return () => renameListeners.delete(listener)
}

function emitDocumentRenamed(id: string, oldName: string, newName: string): void {
  renameListeners.forEach(listener => listener(id, oldName, newName))
}

// Validation
const MAX_NAME_LENGTH = 120

export interface ValidationError {
  field: 'name'
  message: string
}

export function validateDocumentName(
  name: string,
  existingNames: string[],
  excludeId?: string
): ValidationError | null {
  const trimmed = name.trim()

  if (!trimmed) {
    return { field: 'name', message: 'Document name cannot be empty' }
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    return { field: 'name', message: `Name must be ${MAX_NAME_LENGTH} characters or less` }
  }

  // Check for duplicates (case-insensitive)
  const normalised = trimmed.toLowerCase()
  const isDuplicate = existingNames.some(existing => existing.toLowerCase() === normalised)

  if (isDuplicate) {
    return { field: 'name', message: 'A document with this name already exists' }
  }

  return null
}

// Sort helpers (stable)
export function sortDocuments(
  documents: DocumentItem[],
  field: DocumentsState['sortField'],
  direction: DocumentsState['sortDirection']
): DocumentItem[] {
  const sorted = [...documents].sort((a, b) => {
    let comparison = 0

    switch (field) {
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'date':
        comparison = a.addedAt - b.addedAt
        break
      case 'size':
        comparison = a.sizeBytes - b.sizeBytes
        break
      case 'type':
        comparison = a.type.localeCompare(b.type)
        break
    }

    // Tie-breaker: use addedAt for stable sort
    if (comparison === 0 && field !== 'date') {
      comparison = a.addedAt - b.addedAt
    }

    return direction === 'asc' ? comparison : -comparison
  })

  return sorted
}

// Search helper (case-insensitive substring)
export function filterDocuments(
  documents: DocumentItem[],
  query: string
): DocumentItem[] {
  const trimmed = query.trim()
  if (!trimmed) return documents

  const normalised = trimmed.toLowerCase()
  return documents.filter(doc =>
    doc.name.toLowerCase().includes(normalised)
  )
}

// Session persistence keys
const STORAGE_KEYS = {
  SEARCH: 'documents.searchQuery',
  SORT_FIELD: 'documents.sortField',
  SORT_DIR: 'documents.sortDir',
} as const

export function loadSearchQuery(): string {
  if (typeof sessionStorage === 'undefined') return ''
  return sessionStorage.getItem(STORAGE_KEYS.SEARCH) || ''
}

export function saveSearchQuery(query: string): void {
  if (typeof sessionStorage === 'undefined') return
  if (query) {
    sessionStorage.setItem(STORAGE_KEYS.SEARCH, query)
  } else {
    sessionStorage.removeItem(STORAGE_KEYS.SEARCH)
  }
}

export function loadSortPreferences(): Pick<DocumentsState, 'sortField' | 'sortDirection'> {
  if (typeof sessionStorage === 'undefined') {
    return { sortField: 'date', sortDirection: 'desc' }
  }

  const field = sessionStorage.getItem(STORAGE_KEYS.SORT_FIELD) as DocumentsState['sortField'] | null
  const dir = sessionStorage.getItem(STORAGE_KEYS.SORT_DIR) as DocumentsState['sortDirection'] | null

  return {
    sortField: field || 'date',
    sortDirection: dir || 'desc',
  }
}

export function saveSortPreferences(
  field: DocumentsState['sortField'],
  direction: DocumentsState['sortDirection']
): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(STORAGE_KEYS.SORT_FIELD, field)
  sessionStorage.setItem(STORAGE_KEYS.SORT_DIR, direction)
}

// Export for testing
export const __test__ = {
  emitDocumentRenamed,
  renameListeners,
}
