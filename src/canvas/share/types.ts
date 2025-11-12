/**
 * M5: Grounding & Provenance Types
 * Document management and citation tracking
 */

export interface Document {
  id: string
  name: string
  type: 'pdf' | 'txt' | 'md' | 'csv' | 'url'
  content?: string // Text only, truncated to 5k chars max
  url?: string // For URL references
  uploadedAt: Date
  size?: number // Original file size in bytes
  displayBytes?: number // Stored content size (post-truncation)
  truncated?: boolean // True if content was truncated
  checksum?: string // FNV-1a hash of original content for integrity checks
  metadata?: {
    author?: string
    date?: string
    tags?: string[]
  }
}

export interface Citation {
  id: string
  nodeId: string
  edgeId?: string
  documentId: string
  snippet: string
  charOffset?: number
  confidence?: number // 0-1
  createdAt: Date
}

export interface ProvenanceHub {
  documents: Document[]
  citations: Citation[]
  redactionEnabled: boolean
}
