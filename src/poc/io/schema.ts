// src/poc/io/schema.ts

export interface SamNode { id: string; x?: number; y?: number; label?: string }
export interface SamEdge { id?: string; from: string; to: string; label?: string }
export interface SamState { schemaVersion: 1; nodes: SamNode[]; edges: SamEdge[]; renames?: Record<string, string> }

export const samStateSchema = {
  $id: 'poc/samState.schema.v1',
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: { const: 1 },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
          label: { type: 'string' },
        },
        required: ['id'],
      },
      minItems: 0,
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          from: { type: 'string' },
          to: { type: 'string' },
          label: { type: 'string' },
        },
        required: ['from', 'to'],
      },
      minItems: 0,
    },
    renames: {
      type: 'object',
      additionalProperties: { type: 'string' },
      properties: {},
      required: [],
    },
  },
  required: ['schemaVersion', 'nodes', 'edges'],
} as const
