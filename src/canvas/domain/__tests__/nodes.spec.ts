/**
 * Node domain schemas and registry tests
 * Tests for NodeTypeEnum, node data schemas, and NODE_REGISTRY
 */
import { describe, it, expect } from 'vitest'
import {
  NodeTypeEnum,
  NodeDataSchema,
  ActionNodeDataSchema,
  FactorNodeDataSchema,
  AnyNodeDataSchema,
  NODE_REGISTRY,
} from '../nodes'
import type { NodeType } from '../nodes'

describe('NodeTypeEnum', () => {
  it('includes all 7 node types', () => {
    const expected: NodeType[] = ['goal', 'decision', 'option', 'factor', 'risk', 'outcome', 'action']
    expected.forEach(type => {
      expect(NodeTypeEnum.safeParse(type).success).toBe(true)
    })
  })

  it('includes action type', () => {
    const result = NodeTypeEnum.safeParse('action')
    expect(result.success).toBe(true)
    expect(result.data).toBe('action')
  })

  it('rejects invalid node types', () => {
    const result = NodeTypeEnum.safeParse('invalid')
    expect(result.success).toBe(false)
  })
})

describe('ActionNodeDataSchema', () => {
  it('validates action node with required fields', () => {
    const data = {
      label: 'Send email notification',
      type: 'action',
    }
    const result = ActionNodeDataSchema.safeParse(data)
    expect(result.success).toBe(true)
    expect(result.data?.type).toBe('action')
  })

  it('validates action node with optional fields', () => {
    const data = {
      label: 'Deploy to production',
      type: 'action',
      description: 'Push changes to production server',
      body: 'Detailed deployment instructions...',
    }
    const result = ActionNodeDataSchema.safeParse(data)
    expect(result.success).toBe(true)
    expect(result.data?.description).toBe('Push changes to production server')
  })

  it('rejects action node without label', () => {
    const data = { type: 'action' }
    const result = ActionNodeDataSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects wrong type literal', () => {
    const data = { label: 'Test', type: 'goal' }
    const result = ActionNodeDataSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('FactorNodeDataSchema', () => {
  it('validates factor node with required fields', () => {
    const data = {
      label: 'Market conditions',
      type: 'factor',
    }
    const result = FactorNodeDataSchema.safeParse(data)
    expect(result.success).toBe(true)
    expect(result.data?.type).toBe('factor')
  })

  it('validates factor with v1.2 API fields', () => {
    const data = {
      label: 'Economic indicator',
      type: 'factor',
      kind: 'factor' as const,
      prior: 0.7,
      utility: 0.5,
    }
    const result = FactorNodeDataSchema.safeParse(data)
    expect(result.success).toBe(true)
    expect(result.data?.prior).toBe(0.7)
  })
})

describe('AnyNodeDataSchema', () => {
  it('discriminates action type correctly', () => {
    const actionData = { label: 'Execute task', type: 'action' }
    const result = AnyNodeDataSchema.safeParse(actionData)
    expect(result.success).toBe(true)
    expect(result.data?.type).toBe('action')
  })

  it('discriminates factor type correctly', () => {
    const factorData = { label: 'Cost driver', type: 'factor' }
    const result = AnyNodeDataSchema.safeParse(factorData)
    expect(result.success).toBe(true)
    expect(result.data?.type).toBe('factor')
  })

  it('accepts all 7 node types', () => {
    const types: NodeType[] = ['goal', 'decision', 'option', 'factor', 'risk', 'outcome', 'action']
    types.forEach(type => {
      const data = { label: `Test ${type}`, type }
      const result = AnyNodeDataSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })
})

describe('NODE_REGISTRY', () => {
  it('has entry for action node', () => {
    expect(NODE_REGISTRY.action).toBeDefined()
    expect(NODE_REGISTRY.action.label).toBe('Action')
    expect(NODE_REGISTRY.action.icon).toBeDefined()
    expect(NODE_REGISTRY.action.ariaRole).toBe('group')
  })

  it('has entry for factor node', () => {
    expect(NODE_REGISTRY.factor).toBeDefined()
    expect(NODE_REGISTRY.factor.label).toBe('Factor')
    expect(NODE_REGISTRY.factor.icon).toBeDefined()
  })

  it('has entries for all 7 node types', () => {
    const types: NodeType[] = ['goal', 'decision', 'option', 'factor', 'risk', 'outcome', 'action']
    types.forEach(type => {
      expect(NODE_REGISTRY[type]).toBeDefined()
      expect(NODE_REGISTRY[type].label).toBeTruthy()
      expect(NODE_REGISTRY[type].icon).toBeDefined()
      expect(NODE_REGISTRY[type].defaultSize).toBeDefined()
    })
  })

  it('action node has correct default size', () => {
    expect(NODE_REGISTRY.action.defaultSize).toEqual({ width: 180, height: 70 })
  })
})
