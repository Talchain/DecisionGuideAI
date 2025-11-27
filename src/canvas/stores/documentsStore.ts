/**
 * Documents Store - Manages documents and citations state
 *
 * Extracted from src/canvas/store.ts for better modularity.
 * See docs/STORE_MODULARIZATION_PLAN.md for migration details.
 */
import { create } from 'zustand'
import type { Document, Citation } from '../share/types'
import { loadSearchQuery, loadSortPreferences, saveSearchQuery, saveSortPreferences } from '../store/documents'

export interface DocumentsState {
  // M5: Grounding & Provenance
  documents: Document[]
  citations: Citation[]
  provenanceRedactionEnabled: boolean
  // S7-FILEOPS: Document management state
  documentSearchQuery: string
  documentSortField: 'name' | 'date' | 'size' | 'type'
  documentSortDirection: 'asc' | 'desc'
}

export interface DocumentsActions {
  // Document actions
  addDocument: (document: Omit<Document, 'id' | 'uploadedAt'>) => string
  removeDocument: (id: string) => void
  renameDocument: (id: string, newName: string) => void
  setDocumentSearchQuery: (query: string) => void
  setDocumentSort: (field: 'name' | 'date' | 'size' | 'type', direction: 'asc' | 'desc') => void
  // Citation actions
  addCitation: (citation: Omit<Citation, 'id' | 'createdAt'>) => void
  removeCitation: (id: string) => void
  // Provenance actions
  toggleProvenanceRedaction: () => void
  // Internal actions
  resetDocuments: () => void
  loadDocumentPreferences: () => void
}

const initialDocumentsState: DocumentsState = {
  documents: [],
  citations: [],
  provenanceRedactionEnabled: false,
  documentSearchQuery: '',
  documentSortField: 'date',
  documentSortDirection: 'desc',
}

export const useDocumentsStore = create<DocumentsState & DocumentsActions>((set, get) => ({
  ...initialDocumentsState,

  addDocument: (document) => {
    const id = crypto.randomUUID()
    const newDoc: Document = {
      ...document,
      id,
      uploadedAt: new Date().toISOString(),
    }
    set(s => ({
      documents: [...s.documents, newDoc]
    }))
    return id
  },

  removeDocument: (id) => {
    set(s => ({
      documents: s.documents.filter(d => d.id !== id),
      // Also remove citations referencing this document
      citations: s.citations.filter(c => c.documentId !== id)
    }))
  },

  renameDocument: (id, newName) => {
    set(s => ({
      documents: s.documents.map(d =>
        d.id === id ? { ...d, name: newName } : d
      )
    }))
  },

  setDocumentSearchQuery: (query) => {
    set({ documentSearchQuery: query })
    saveSearchQuery(query)
  },

  setDocumentSort: (field, direction) => {
    set({
      documentSortField: field,
      documentSortDirection: direction
    })
    saveSortPreferences(field, direction)
  },

  addCitation: (citation) => {
    const id = crypto.randomUUID()
    const newCitation: Citation = {
      ...citation,
      id,
      createdAt: new Date().toISOString(),
    }
    set(s => ({
      citations: [...s.citations, newCitation]
    }))
  },

  removeCitation: (id) => {
    set(s => ({
      citations: s.citations.filter(c => c.id !== id)
    }))
  },

  toggleProvenanceRedaction: () => {
    set(s => ({
      provenanceRedactionEnabled: !s.provenanceRedactionEnabled
    }))
  },

  resetDocuments: () => {
    set(initialDocumentsState)
  },

  loadDocumentPreferences: () => {
    const searchQuery = loadSearchQuery()
    const sortPrefs = loadSortPreferences()
    set({
      documentSearchQuery: searchQuery,
      documentSortField: sortPrefs.field,
      documentSortDirection: sortPrefs.direction
    })
  },
}))

// Selectors
export const selectDocuments = (state: DocumentsState) => state.documents
export const selectCitations = (state: DocumentsState) => state.citations
export const selectDocumentSearchQuery = (state: DocumentsState) => state.documentSearchQuery
export const selectDocumentSort = (state: DocumentsState) => ({
  field: state.documentSortField,
  direction: state.documentSortDirection
})
