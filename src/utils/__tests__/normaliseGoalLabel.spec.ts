import { describe, it, expect } from 'vitest'
import { normaliseGoalLabel } from '../normaliseGoalLabel'

describe('normaliseGoalLabel', () => {
  describe('strips known leading verbs', () => {
    it('strips "Achieve"', () => {
      expect(normaliseGoalLabel('Achieve 200 Mid-Market Customers')).toBe('200 Mid-Market Customers')
    })

    it('strips "Reach"', () => {
      expect(normaliseGoalLabel('Reach 50% market share')).toBe('50% market share')
    })

    it('strips "Hit"', () => {
      expect(normaliseGoalLabel('Hit 1000 signups')).toBe('1000 signups')
    })

    it('strips "Get to"', () => {
      expect(normaliseGoalLabel('Get to 500 daily active users')).toBe('500 daily active users')
    })

    it('strips "Attain"', () => {
      expect(normaliseGoalLabel('Attain market leadership')).toBe('market leadership')
    })

    it('strips "Grow to"', () => {
      expect(normaliseGoalLabel('Grow to 10M ARR')).toBe('10M ARR')
    })

    it('strips "Deliver"', () => {
      expect(normaliseGoalLabel('Deliver 95% uptime')).toBe('95% uptime')
    })

    it('strips "To achieve" (prevents "To achieve To achieve X")', () => {
      expect(normaliseGoalLabel('To achieve 10M ARR')).toBe('10M ARR')
    })

    it('strips "Maximise"', () => {
      expect(normaliseGoalLabel('Maximise revenue growth')).toBe('revenue growth')
    })

    it('strips "Maximize"', () => {
      expect(normaliseGoalLabel('Maximize customer retention')).toBe('customer retention')
    })

    it('strips "Minimise"', () => {
      expect(normaliseGoalLabel('Minimise churn rate')).toBe('churn rate')
    })

    it('strips "Minimize"', () => {
      expect(normaliseGoalLabel('Minimize operational costs')).toBe('operational costs')
    })

    it('strips "Get"', () => {
      expect(normaliseGoalLabel('Get 200 new signups')).toBe('200 new signups')
    })
  })

  describe('case-insensitive matching', () => {
    it('strips lowercase "achieve"', () => {
      expect(normaliseGoalLabel('achieve 200 customers')).toBe('200 customers')
    })

    it('strips UPPERCASE "ACHIEVE"', () => {
      expect(normaliseGoalLabel('ACHIEVE 200 customers')).toBe('200 customers')
    })

    it('strips mixed-case "ReAcH"', () => {
      expect(normaliseGoalLabel('ReAcH 50% share')).toBe('50% share')
    })

    it('strips uppercase "GET TO"', () => {
      expect(normaliseGoalLabel('GET TO 500 users')).toBe('500 users')
    })
  })

  describe('no-match passthrough', () => {
    it('leaves unknown verb as-is', () => {
      expect(normaliseGoalLabel('Boost revenue growth')).toBe('Boost revenue growth')
    })

    it('leaves label starting with number as-is', () => {
      expect(normaliseGoalLabel('500 new users')).toBe('500 new users')
    })

    it('leaves label with no leading verb as-is', () => {
      expect(normaliseGoalLabel('increase revenue')).toBe('increase revenue')
    })
  })

  describe('edge cases', () => {
    it('returns empty string for null', () => {
      expect(normaliseGoalLabel(null)).toBe('')
    })

    it('returns empty string for undefined', () => {
      expect(normaliseGoalLabel(undefined)).toBe('')
    })

    it('returns empty string for empty string', () => {
      expect(normaliseGoalLabel('')).toBe('')
    })

    it('returns empty string for whitespace-only string', () => {
      expect(normaliseGoalLabel('   ')).toBe('')
    })

    it('does not strip verb that is the entire label (no trailing content)', () => {
      // "Achieve" alone has no space + trailing text, so startsWith("achieve ") is false
      expect(normaliseGoalLabel('Achieve')).toBe('Achieve')
    })

    it('does not strip "Achieve" when part of another word', () => {
      expect(normaliseGoalLabel('Achievement of excellence')).toBe('Achievement of excellence')
    })

    it('handles leading/trailing whitespace', () => {
      expect(normaliseGoalLabel('  Achieve 200 customers  ')).toBe('200 customers')
    })
  })
})
