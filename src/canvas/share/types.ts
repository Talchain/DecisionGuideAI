/**
 * M5: Grounding & Provenance Types
 * Document management and citation tracking
 */

export interface Document {
  id: string
  name: string
  type: 'pdf' | 'txt' | 'md' | 'csv' | 'url'
  content?: string // Full text for txt/md
  url?: string // For URL references
  uploadedAt: Date
  size?: number // bytes
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
