import { describe, it, expect } from 'vitest'
import { AnyNodeDataSchema, GoalNodeDataSchema, DecisionNodeDataSchema } from '../domain/nodes'
import { EdgeDataSchema, weightToStrokeWidth, styleToDashArray, clampCurvature, formatConfidence } from '../domain/edges'
import { migrateV1ToV2, detectVersion, importSnapshot, SCHEMA_VERSION_V2 } from '../domain/migrations'

describe('Node Schema Validation', () => {
  it('validates goal node data', () => {
    const valid = {
      label: 'Launch MVP',
      type: 'goal' as const,
    }
    
    const result = GoalNodeDataSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })
  
  it('validates decision node data', () => {
    const valid = {
      label: 'Choose pricing model',
      type: 'decision' as const,
      description: 'Free vs paid tiers',
    }
    
    const result = DecisionNodeDataSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })
  
  it('rejects invalid node type', () => {
    const invalid = {
      label: 'Test',
      type: 'invalid' as any,
    }
    
    const result = AnyNodeDataSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
  
  it('enforces label length limits', () => {
    const tooLong = {
      label: 'a'.repeat(101),
      type: 'goal' as const,
    }
    
    const result = GoalNodeDataSchema.safeParse(tooLong)
    expect(result.success).toBe(false)
  })
})

describe('Edge Schema Validation', () => {
  it('validates edge data with defaults', () => {
    const minimal = {}

    const result = EdgeDataSchema.parse(minimal)
    expect(result.weight).toBe(0.5)  // Updated default: 0-1 scale
    expect(result.style).toBe('solid')
    expect(result.curvature).toBe(0.15)
    expect(result.schemaVersion).toBe(3)  // Schema v3: weight scale 0-1
  })
  
  it('validates edge data with all properties', () => {
    const complete = {
      weight: 0.8,  // Updated: 0-1 scale
      style: 'dashed' as const,
      curvature: 0.3,
      label: 'High priority',
      confidence: 0.8,
    }

    const result = EdgeDataSchema.safeParse(complete)
    expect(result.success).toBe(true)
  })
  
  it('rejects out-of-range weight', () => {
    const invalid = {
      weight: 1.5, // Max is 1.0
    }

    const result = EdgeDataSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
  
  it('rejects invalid style', () => {
    const invalid = {
      style: 'wavy' as any,
    }
    
    const result = EdgeDataSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})

describe('Edge Visual Property Mapping', () => {
  it('maps weight to stroke width correctly', () => {
    expect(weightToStrokeWidth(0)).toBe(1)    // Min: 0 → 1px
    expect(weightToStrokeWidth(1)).toBe(6)    // Max: 1 → 6px
    expect(weightToStrokeWidth(0.5)).toBeCloseTo(3.5, 1) // Mid: 0.5 → 3.5px
  })
  
  it('maps style to dash array', () => {
    expect(styleToDashArray('solid')).toBe('0')
    expect(styleToDashArray('dashed')).toBe('6 4')
    expect(styleToDashArray('dotted')).toBe('2 3')
  })
  
  it('clamps curvature to valid range', () => {
    expect(clampCurvature(-0.1)).toBe(0)
    expect(clampCurvature(0.6)).toBe(0.5)
    expect(clampCurvature(0.25)).toBe(0.25)
  })
  
  it('formats confidence as percentage', () => {
    expect(formatConfidence(undefined)).toBe('Unknown')
    expect(formatConfidence(0)).toBe('0%')
    expect(formatConfidence(0.75)).toBe('75%')
    expect(formatConfidence(1)).toBe('100%')
  })
})

describe('Schema Migrations', () => {
  it('detects v1 snapshot', () => {
    const v1 = {
      version: 1,
      nodes: [{ id: '1', data: { label: 'Test' } }],
      edges: [],
    }
    
    expect(detectVersion(v1)).toBe(1)
  })
  
  it('detects v2 snapshot', () => {
    const v2 = {
      version: 2,
      nodes: [{ id: '1', data: { label: 'Test', type: 'goal' } }],
      edges: [],
    }
    
    expect(detectVersion(v2)).toBe(2)
  })
  
  it('migrates v1 to v2 with defaults', () => {
    const v1 = {
      version: 1,
      timestamp: 1234567890,
      nodes: [
        {
          id: '1',
          type: 'decision',
          position: { x: 0, y: 0 },
          data: { label: 'Goal: Launch' },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: '1',
          target: '2',
          label: 'Path A',
        },
      ],
    }
    
    const v2 = migrateV1ToV2(v1)
    
    expect(v2).not.toBeNull()
    expect(v2!.version).toBe(SCHEMA_VERSION_V2)
    expect(v2!.nodes[0].data.type).toBe('goal') // Inferred from label
    expect(v2!.edges[0].data.weight).toBe(0.5)  // Updated default: 0-1 scale
    expect(v2!.edges[0].data.style).toBe('solid')
    expect(v2!.edges[0].data.curvature).toBe(0.15)
  })
  
  it('preserves node labels during migration', () => {
    const v1 = {
      nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'Test Node' } }],
      edges: [],
    }
    
    const v2 = migrateV1ToV2(v1)
    
    expect(v2).not.toBeNull()
    expect(v2!.nodes[0].data.label).toBe('Test Node')
  })
  
  it('infers node types from labels', () => {
    const v1 = {
      nodes: [
        { id: '1', position: { x: 0, y: 0 }, data: { label: 'Risk: Security breach' } },
        { id: '2', position: { x: 0, y: 0 }, data: { label: 'Option: Cloud hosting' } },
        { id: '3', position: { x: 0, y: 0 }, data: { label: 'Outcome: Better performance' } },
      ],
      edges: [],
    }
    
    const v2 = migrateV1ToV2(v1)
    
    expect(v2).not.toBeNull()
    expect(v2!.nodes[0].data.type).toBe('risk')
    expect(v2!.nodes[1].data.type).toBe('option')
    expect(v2!.nodes[2].data.type).toBe('outcome')
  })
  
  it('imports v2 snapshot without migration', () => {
    const v2 = {
      version: 2,
      timestamp: Date.now(),
      nodes: [
        {
          id: '1',
          type: 'goal',
          position: { x: 0, y: 0 },
          data: { label: 'Test', type: 'goal' },
        },
      ],
      edges: [],
    }
    
    const imported = importSnapshot(v2)
    
    expect(imported).not.toBeNull()
    expect(imported!.version).toBe(2)
    expect(imported!.nodes[0].data.type).toBe('goal')
  })
  
  it('returns null for invalid snapshot', () => {
    const invalid = {
      notASnapshot: true,
    }
    
    const imported = importSnapshot(invalid)
    
    expect(imported).toBeNull()
  })
})
