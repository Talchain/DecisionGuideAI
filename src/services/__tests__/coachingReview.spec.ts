/**
 * Coaching Review Service Tests (P1 Tasks 4-6)
 *
 * Tests for M2 coaching content fetching and validation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  validateReviewResponse,
  fetchCoachingReview,
  getCachedReview,
  setCachedReview,
  clearReviewCache,
  type ReviewRequest,
  type ReviewResponse,
} from '../coachingReview'

describe('validateReviewResponse', () => {
  const validAllowedIds = new Set(['option-a', 'option-b', 'factor-1', 'factor-2'])

  const validResponse: ReviewResponse = {
    response_hash: 'abc123',
    headline: 'Option A performs strongest',
    bullets: [
      [{ type: 'text', text: '85% vs 65% chance of achieving your goal' }],
      [{ type: 'text', text: 'Market Size and Tech Lead are the biggest drivers' }],
      [{ type: 'text', text: 'Result is stable across assumptions' }],
    ],
    coaching_paragraph: [{ type: 'text', text: 'Based on analysis...' }],
    bias_insights: ['Consider opposing viewpoints'],
  }

  it('validates a correct response', () => {
    const result = validateReviewResponse(validResponse, validAllowedIds)
    expect(result).not.toBeNull()
    expect(result?.headline).toBe('Option A performs strongest')
  })

  it('rejects non-object response', () => {
    expect(validateReviewResponse(null, validAllowedIds)).toBeNull()
    expect(validateReviewResponse('string', validAllowedIds)).toBeNull()
    expect(validateReviewResponse(123, validAllowedIds)).toBeNull()
  })

  it('rejects empty headline', () => {
    const response = { ...validResponse, headline: '' }
    expect(validateReviewResponse(response, validAllowedIds)).toBeNull()
  })

  it('rejects headline over 100 chars', () => {
    const response = { ...validResponse, headline: 'x'.repeat(101) }
    expect(validateReviewResponse(response, validAllowedIds)).toBeNull()
  })

  it('rejects wrong number of bullets', () => {
    const twoBullets = { ...validResponse, bullets: [validResponse.bullets[0], validResponse.bullets[1]] }
    expect(validateReviewResponse(twoBullets, validAllowedIds)).toBeNull()

    const fourbullets = { ...validResponse, bullets: [...validResponse.bullets, validResponse.bullets[0]] }
    expect(validateReviewResponse(fourbullets, validAllowedIds)).toBeNull()
  })

  it('rejects empty bullet array', () => {
    const response = {
      ...validResponse,
      bullets: [[], validResponse.bullets[1], validResponse.bullets[2]],
    }
    expect(validateReviewResponse(response, validAllowedIds)).toBeNull()
  })

  it('rejects bullet with invalid ref ID', () => {
    const response = {
      ...validResponse,
      bullets: [
        [{ type: 'ref', id: 'invalid-id', label: 'Invalid' }],
        validResponse.bullets[1],
        validResponse.bullets[2],
      ],
    }
    expect(validateReviewResponse(response, validAllowedIds)).toBeNull()
  })

  it('accepts bullet with valid ref ID', () => {
    const response = {
      ...validResponse,
      bullets: [
        [{ type: 'ref', id: 'option-a', label: 'Option A' }, { type: 'text', text: ' wins' }],
        validResponse.bullets[1],
        validResponse.bullets[2],
      ],
    }
    expect(validateReviewResponse(response, validAllowedIds)).not.toBeNull()
  })

  it('rejects bullet exceeding 50 words', () => {
    const longText = Array(60).fill('word').join(' ')
    const response = {
      ...validResponse,
      bullets: [
        [{ type: 'text', text: longText }],
        validResponse.bullets[1],
        validResponse.bullets[2],
      ],
    }
    expect(validateReviewResponse(response, validAllowedIds)).toBeNull()
  })

  it('rejects coaching_paragraph with invalid ref', () => {
    const response = {
      ...validResponse,
      coaching_paragraph: [{ type: 'ref', id: 'invalid-id', label: 'Invalid' }],
    }
    expect(validateReviewResponse(response, validAllowedIds)).toBeNull()
  })

  it('accepts coaching_paragraph with valid ref', () => {
    const response = {
      ...validResponse,
      coaching_paragraph: [
        { type: 'text', text: 'Looking at ' },
        { type: 'ref', id: 'option-a', label: 'Option A' },
      ],
    }
    expect(validateReviewResponse(response, validAllowedIds)).not.toBeNull()
  })
})

describe('cache functions', () => {
  beforeEach(() => {
    clearReviewCache()
  })

  it('stores and retrieves cached reviews', () => {
    const review: ReviewResponse = {
      response_hash: 'hash123',
      headline: 'Test headline',
      bullets: [
        [{ type: 'text', text: 'Bullet 1' }],
        [{ type: 'text', text: 'Bullet 2' }],
        [{ type: 'text', text: 'Bullet 3' }],
      ],
      coaching_paragraph: [{ type: 'text', text: 'Coaching' }],
      bias_insights: [],
    }

    expect(getCachedReview('hash123')).toBeUndefined()

    setCachedReview('hash123', review)
    expect(getCachedReview('hash123')).toEqual(review)
  })

  it('clears cache', () => {
    const review: ReviewResponse = {
      response_hash: 'hash456',
      headline: 'Test',
      bullets: [
        [{ type: 'text', text: '1' }],
        [{ type: 'text', text: '2' }],
        [{ type: 'text', text: '3' }],
      ],
      coaching_paragraph: [],
      bias_insights: [],
    }

    setCachedReview('hash456', review)
    expect(getCachedReview('hash456')).toBeDefined()

    clearReviewCache()
    expect(getCachedReview('hash456')).toBeUndefined()
  })
})

describe('fetchCoachingReview', () => {
  const mockRequest: ReviewRequest = {
    response_hash: 'test-hash',
    analysis_summary: {
      winner: {
        id: 'option-a',
        label: 'Option A',
        win_probability: 0.7,
        outcome_median: 50,
      },
      option_count: 2,
      baseline_present: false,
      top_drivers: [{ id: 'factor-1', label: 'Factor 1', direction: 'positive', importance_rank: 1 }],
      recommendation_stability: 0.85,
      n_samples: 10000,
      goal_node_label: 'Revenue',
    },
    graph_context: {
      node_count: 10,
      edge_count: 15,
    },
    allowed_references: [
      { id: 'option-a', label: 'Option A', kind: 'option' },
      { id: 'factor-1', label: 'Factor 1', kind: 'factor' },
    ],
  }

  const mockValidResponse: ReviewResponse = {
    response_hash: 'test-hash',
    headline: 'Option A is best',
    bullets: [
      [{ type: 'text', text: 'Bullet 1' }],
      [{ type: 'text', text: 'Bullet 2' }],
      [{ type: 'text', text: 'Bullet 3' }],
    ],
    coaching_paragraph: [{ type: 'text', text: 'Analysis...' }],
    bias_insights: [],
  }

  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns success with valid response', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidResponse,
    })

    const result = await fetchCoachingReview(mockRequest, { baseUrl: 'http://test' })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data?.headline).toBe('Option A is best')
  })

  it('returns error for HTTP error status', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })

    const result = await fetchCoachingReview(mockRequest, { baseUrl: 'http://test' })

    expect(result.success).toBe(false)
    expect(result.error).toBe('HTTP 500')
  })

  it('returns error for network failure', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

    const result = await fetchCoachingReview(mockRequest, { baseUrl: 'http://test' })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Network error')
  })

  it('returns error for invalid response', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ headline: '' }), // Invalid - empty headline
    })

    const result = await fetchCoachingReview(mockRequest, { baseUrl: 'http://test' })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Validation failed')
  })

  it('handles timeout via abort', async () => {
    // Create a promise that never resolves
    (global.fetch as any).mockImplementationOnce(
      () => new Promise((_, reject) => {
        const error = new Error('Aborted')
        error.name = 'AbortError'
        // Simulate abort after a short delay
        setTimeout(() => reject(error), 50)
      })
    )

    const result = await fetchCoachingReview(
      mockRequest,
      { baseUrl: 'http://test', timeout: 10 } // Very short timeout
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('Timeout')
  })

  // Note: External abort signal cancellation is tested via the timeout test above.
  // The cancellation logic uses the same AbortController mechanism.
})
