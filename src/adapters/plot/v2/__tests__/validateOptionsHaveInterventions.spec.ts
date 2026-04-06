/**
 * validateOptionsHaveInterventions — pure validation function tests.
 */
import { describe, it, expect } from 'vitest'
import { validateOptionsHaveInterventions } from '../adapter'

describe('validateOptionsHaveInterventions', () => {
  it('returns [] when all options have interventions', () => {
    const options = [
      { id: 'opt-1', label: 'Option A', interventions: { 'fac-1': 10 } },
      { id: 'opt-2', label: 'Option B', interventions: { 'fac-1': 5, 'fac-2': 20 } },
    ]
    expect(validateOptionsHaveInterventions(options)).toEqual([])
  })

  it('returns labels when interventions is empty object', () => {
    const options = [
      { id: 'opt-1', label: 'Option A', interventions: {} },
      { id: 'opt-2', label: 'Option B', interventions: { 'fac-1': 10 } },
    ]
    expect(validateOptionsHaveInterventions(options)).toEqual(['Option A'])
  })

  it('returns labels when interventions is undefined', () => {
    const options = [
      { id: 'opt-1', label: 'Option A', interventions: undefined },
    ]
    expect(validateOptionsHaveInterventions(options)).toEqual(['Option A'])
  })

  it('returns labels when interventions is null', () => {
    const options = [
      { id: 'opt-1', label: 'Option A', interventions: null },
    ]
    expect(validateOptionsHaveInterventions(options)).toEqual(['Option A'])
  })

  it('handles mix of valid and invalid options', () => {
    const options = [
      { id: 'opt-1', label: 'Good Option', interventions: { 'fac-1': 10 } },
      { id: 'opt-2', label: 'Bad Option', interventions: {} },
      { id: 'opt-3', label: 'Also Bad', interventions: undefined },
      { id: 'opt-4', label: 'Another Good', interventions: { 'fac-2': -5 } },
    ]
    expect(validateOptionsHaveInterventions(options)).toEqual(['Bad Option', 'Also Bad'])
  })

  it('falls back to id when label is missing', () => {
    const options = [
      { id: 'opt-1', interventions: {} },
    ]
    expect(validateOptionsHaveInterventions(options)).toEqual(['opt-1'])
  })

  it('returns [] for empty options array', () => {
    expect(validateOptionsHaveInterventions([])).toEqual([])
  })

  it('works with CEE-style nested intervention values', () => {
    const options = [
      {
        id: 'opt-1',
        label: 'CEE Option',
        interventions: {
          'fac-1': { value: 10, source: 'cee_hypothesis', target_match: { node_id: 'fac-1' } },
        },
      },
    ]
    expect(validateOptionsHaveInterventions(options)).toEqual([])
  })

  it('catches interventions with only null values', () => {
    const options = [
      { id: 'opt-1', label: 'Null Values', interventions: { 'fac-1': null, 'fac-2': null } },
    ]
    expect(validateOptionsHaveInterventions(options)).toEqual(['Null Values'])
  })

  it('catches interventions with nested null value', () => {
    const options = [
      { id: 'opt-1', label: 'Nested Null', interventions: { 'fac-1': { value: null } } },
    ]
    expect(validateOptionsHaveInterventions(options)).toEqual(['Nested Null'])
  })

  it('accepts interventions with numeric zero value', () => {
    const options = [
      { id: 'opt-1', label: 'Zero', interventions: { 'fac-1': 0 } },
    ]
    expect(validateOptionsHaveInterventions(options)).toEqual([])
  })

  it('skips null entries in options array', () => {
    const options = [null, { id: 'opt-1', label: 'Good', interventions: { 'fac-1': 5 } }] as any
    expect(validateOptionsHaveInterventions(options)).toEqual([])
  })
})
