/**
 * S5-STORAGE: Versioned Storage Types
 *
 * Defines versioned payload schema for canvas persistence with:
 * - Schema versioning for backward compatibility
 * - Migration support
 * - Quota checking
 */

import type { Node, Edge } from '@xyflow/react'

/**
 * Base versioned payload structure
 * All stored data must include these fields for migration support
 */
export interface VersionedPayload<T = unknown> {
  schema: string // e.g., "canvas.v1"
  version: string // e.g., "1.0.0"
  timestamp: number // Unix timestamp in ms
  data: T
}

/**
 * Canvas V1 data structure
 */
export interface CanvasDataV1 {
  scenarios: Array<{
    id: string
    name: string
    createdAt: number
    updatedAt: number
    source_template_id?: string
    source_template_version?: string
    graph: {
      nodes: Node[]
      edges: Edge[]
    }
    last_result_hash?: string
  }>
  currentScenarioId?: string
  autosave?: {
    timestamp: number
    graph: {
      nodes: Node[]
      edges: Edge[]
    }
  }
}

/**
 * Versioned canvas payload
 */
export type CanvasPayloadV1 = VersionedPayload<CanvasDataV1>

/**
 * Migration function signature
 * Takes old version payload and returns new version payload
 */
export type MigrationFn<TFrom = unknown, TTo = unknown> = (
  from: VersionedPayload<TFrom>
) => VersionedPayload<TTo>

/**
 * Migration descriptor
 */
export interface Migration {
  fromVersion: string
  toVersion: string
  migrate: MigrationFn
  description: string
}

/**
 * Storage quota information
 */
export interface StorageQuota {
  available: boolean
  used: number // bytes
  total: number // bytes
  percentage: number // 0-100
  canStore: (size: number) => boolean
}

/**
 * Storage operation result
 */
export type StorageResult<T> =
  | { success: true; data: T }
  | { success: false; error: StorageError }

/**
 * Storage error types
 */
export enum StorageErrorType {
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  PARSE_ERROR = 'PARSE_ERROR',
  MIGRATION_ERROR = 'MIGRATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAVAILABLE = 'UNAVAILABLE',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Storage error
 */
export interface StorageError {
  type: StorageErrorType
  message: string
  original?: Error
}
