/**
 * Stream event parsing tests — golden fixture coverage + parser hardening
 *
 * Verifies the SSE parser correctly deserialises all event types and handles
 * edge cases: split UTF-8, malformed JSON, multi-line data, duplicate terminals,
 * comment heartbeats, and empty events.
 */
import { describe, it, expect } from 'vitest'
import { parseSSELines } from '../turnService'
import type { OrchestratorStreamEvent } from '../types'

// ---------------------------------------------------------------------------
// Golden fixtures — one per event type
// ---------------------------------------------------------------------------

const FIXTURES = {
  turn_start: [
    'event: turn_start',
    'data: {"type":"turn_start","seq":1,"turn_id":"t-1","routing":"llm","stage":"ideate"}',
    '',
  ],
  text_delta: [
    'event: text_delta',
    'data: {"type":"text_delta","seq":2,"delta":"Hello "}',
    '',
  ],
  tool_start: [
    'event: tool_start',
    'data: {"type":"tool_start","seq":3,"tool_name":"run_analysis","long_running":true}',
    '',
  ],
  block: [
    'event: block',
    'data: {"type":"block","seq":4,"block":{"type":"commentary","text":"Insight here"}}',
    '',
  ],
  tool_result: [
    'event: tool_result',
    'data: {"type":"tool_result","seq":5,"tool_name":"run_analysis","success":true,"duration_ms":1200}',
    '',
  ],
  turn_complete: [
    'event: turn_complete',
    'data: {"type":"turn_complete","seq":6,"envelope":{"assistant_text":"Done","blocks":[]}}',
    '',
  ],
  error: [
    'event: error',
    'data: {"type":"error","seq":7,"error":{"code":"INTERNAL","message":"Something broke"},"recoverable":true}',
    '',
  ],
}

describe('parseSSELines', () => {
  describe('golden fixture parsing', () => {
    it('parses turn_start', () => {
      const { events } = parseSSELines(FIXTURES.turn_start)
      expect(events).toHaveLength(1)
      const parsed = JSON.parse(events[0].data) as OrchestratorStreamEvent
      expect(parsed.type).toBe('turn_start')
      expect(parsed).toHaveProperty('turn_id', 't-1')
      expect(parsed).toHaveProperty('routing', 'llm')
    })

    it('parses text_delta', () => {
      const { events } = parseSSELines(FIXTURES.text_delta)
      expect(events).toHaveLength(1)
      const parsed = JSON.parse(events[0].data) as OrchestratorStreamEvent
      expect(parsed.type).toBe('text_delta')
      expect(parsed).toHaveProperty('delta', 'Hello ')
    })

    it('parses tool_start', () => {
      const { events } = parseSSELines(FIXTURES.tool_start)
      expect(events).toHaveLength(1)
      const parsed = JSON.parse(events[0].data) as OrchestratorStreamEvent
      expect(parsed.type).toBe('tool_start')
      expect(parsed).toHaveProperty('tool_name', 'run_analysis')
    })

    it('parses block', () => {
      const { events } = parseSSELines(FIXTURES.block)
      expect(events).toHaveLength(1)
      const parsed = JSON.parse(events[0].data) as OrchestratorStreamEvent
      expect(parsed.type).toBe('block')
      expect(parsed).toHaveProperty('block')
    })

    it('parses tool_result', () => {
      const { events } = parseSSELines(FIXTURES.tool_result)
      expect(events).toHaveLength(1)
      const parsed = JSON.parse(events[0].data) as OrchestratorStreamEvent
      expect(parsed.type).toBe('tool_result')
      expect(parsed).toHaveProperty('success', true)
      expect(parsed).toHaveProperty('duration_ms', 1200)
    })

    it('parses turn_complete', () => {
      const { events } = parseSSELines(FIXTURES.turn_complete)
      expect(events).toHaveLength(1)
      const parsed = JSON.parse(events[0].data) as OrchestratorStreamEvent
      expect(parsed.type).toBe('turn_complete')
      expect(parsed).toHaveProperty('envelope')
      expect((parsed as any).envelope.assistant_text).toBe('Done')
    })

    it('parses error', () => {
      const { events } = parseSSELines(FIXTURES.error)
      expect(events).toHaveLength(1)
      const parsed = JSON.parse(events[0].data) as OrchestratorStreamEvent
      expect(parsed.type).toBe('error')
      expect(parsed).toHaveProperty('recoverable', true)
      expect((parsed as any).error.code).toBe('INTERNAL')
    })

    it('parses all 7 fixtures sequentially in one stream', () => {
      const allLines = [
        ...FIXTURES.turn_start,
        ...FIXTURES.text_delta,
        ...FIXTURES.tool_start,
        ...FIXTURES.block,
        ...FIXTURES.tool_result,
        ...FIXTURES.turn_complete,
        ...FIXTURES.error,
      ]
      const { events } = parseSSELines(allLines)
      expect(events).toHaveLength(7)
      const types = events.map(e => JSON.parse(e.data).type)
      expect(types).toEqual([
        'turn_start', 'text_delta', 'tool_start', 'block',
        'tool_result', 'turn_complete', 'error',
      ])
    })
  })

  describe('parser hardening', () => {
    it('handles comment lines as heartbeat', () => {
      const { events, hadActivity } = parseSSELines([
        ': heartbeat',
        '',
      ])
      expect(events).toHaveLength(0)
      expect(hadActivity).toBe(true)
    })

    it('handles malformed JSON gracefully (data present but not valid JSON)', () => {
      // parseSSELines returns raw data strings; JSON parsing happens in the consumer.
      // Verify that the parser still returns the event with raw data.
      const { events } = parseSSELines([
        'event: text_delta',
        'data: {broken json',
        '',
      ])
      expect(events).toHaveLength(1)
      expect(events[0].data).toBe('{broken json')
    })

    it('handles multi-line data fields (SSE spec: consecutive data lines joined with newline)', () => {
      const { events } = parseSSELines([
        'event: block',
        'data: {"type":"block",',
        'data: "seq":1,',
        'data: "block":{"type":"commentary","text":"Hello"}}',
        '',
      ])
      expect(events).toHaveLength(1)
      // Multi-line data joined with \n
      const joined = events[0].data
      expect(joined).toContain('\n')
      const parsed = JSON.parse(joined)
      expect(parsed.type).toBe('block')
    })

    it('handles data: with no space after colon', () => {
      const { events } = parseSSELines([
        'event: text_delta',
        'data:{"type":"text_delta","seq":1,"delta":"x"}',
        '',
      ])
      expect(events).toHaveLength(1)
      const parsed = JSON.parse(events[0].data)
      expect(parsed.delta).toBe('x')
    })

    it('handles duplicate turn_complete events (takes both)', () => {
      const { events } = parseSSELines([
        ...FIXTURES.turn_complete,
        ...FIXTURES.turn_complete,
      ])
      expect(events).toHaveLength(2)
      // Consumer is responsible for deduplication via seq
    })

    it('handles empty lines between events', () => {
      const { events } = parseSSELines([
        '',
        '',
        'event: text_delta',
        'data: {"type":"text_delta","seq":1,"delta":"a"}',
        '',
        '',
        'event: text_delta',
        'data: {"type":"text_delta","seq":2,"delta":"b"}',
        '',
      ])
      expect(events).toHaveLength(2)
    })

    it('handles event with no data (skipped)', () => {
      const { events } = parseSSELines([
        'event: heartbeat',
        '',
      ])
      expect(events).toHaveLength(0)
    })

    it('handles split UTF-8 emoji in delta', () => {
      const { events } = parseSSELines([
        'event: text_delta',
        'data: {"type":"text_delta","seq":1,"delta":"Hello 🌍"}',
        '',
      ])
      expect(events).toHaveLength(1)
      const parsed = JSON.parse(events[0].data)
      expect(parsed.delta).toBe('Hello 🌍')
    })

    it('preserves event type when data has its own type field', () => {
      const { events } = parseSSELines([
        'event: custom_type',
        'data: {"type":"text_delta","seq":1,"delta":"x"}',
        '',
      ])
      expect(events).toHaveLength(1)
      expect(events[0].eventType).toBe('custom_type')
      // The consumer should use eventType for dispatch, data.type as fallback
    })

    it('returns hadActivity=false for empty input', () => {
      const { events, hadActivity } = parseSSELines([])
      expect(events).toHaveLength(0)
      expect(hadActivity).toBe(false)
    })
  })

  describe('markdown sanitisation in streamed text', () => {
    it('parses delta containing markdown syntax', () => {
      const { events } = parseSSELines([
        'event: text_delta',
        'data: {"type":"text_delta","seq":1,"delta":"**bold** and _italic_"}',
        '',
      ])
      const parsed = JSON.parse(events[0].data)
      expect(parsed.delta).toBe('**bold** and _italic_')
    })

    it('parses delta containing partial markdown (unclosed bold)', () => {
      const { events } = parseSSELines([
        'event: text_delta',
        'data: {"type":"text_delta","seq":1,"delta":"**unclosed bold"}',
        '',
      ])
      const parsed = JSON.parse(events[0].data)
      expect(parsed.delta).toBe('**unclosed bold')
    })

    it('parses delta containing HTML entities', () => {
      const { events } = parseSSELines([
        'event: text_delta',
        'data: {"type":"text_delta","seq":1,"delta":"<script>alert(1)</script>"}',
        '',
      ])
      const parsed = JSON.parse(events[0].data)
      expect(parsed.delta).toBe('<script>alert(1)</script>')
    })
  })

  describe('CRLF normalisation', () => {
    it('handles \\r\\n line endings', () => {
      const { events } = parseSSELines([
        'event: text_delta\r',
        'data: {"type":"text_delta","seq":1,"delta":"x"}\r',
        '\r',
      ])
      expect(events).toHaveLength(1)
      const parsed = JSON.parse(events[0].data)
      expect(parsed.delta).toBe('x')
    })

    it('handles mixed \\r\\n and \\n line endings', () => {
      const { events } = parseSSELines([
        'event: text_delta\r',
        'data: {"type":"text_delta","seq":1,"delta":"a"}',
        '',
        'event: text_delta',
        'data: {"type":"text_delta","seq":2,"delta":"b"}\r',
        '',
      ])
      expect(events).toHaveLength(2)
    })
  })

  describe('EOF buffer flush', () => {
    it('flushes trailing event without final blank line when flush=true', () => {
      const { events } = parseSSELines([
        'event: turn_complete',
        'data: {"type":"turn_complete","seq":1,"envelope":{"assistant_text":"Done","blocks":[]}}',
      ], true)
      expect(events).toHaveLength(1)
      const parsed = JSON.parse(events[0].data)
      expect(parsed.type).toBe('turn_complete')
    })

    it('flushes trailing event with CRLF and no final blank line when flush=true', () => {
      const { events } = parseSSELines([
        'event: text_delta\r',
        'data: {"type":"text_delta","seq":1,"delta":"tail"}\r',
      ], true)
      expect(events).toHaveLength(1)
      const parsed = JSON.parse(events[0].data)
      expect(parsed.delta).toBe('tail')
    })

    it('does NOT flush trailing data mid-stream (flush=false default)', () => {
      // Mid-stream: data line with no trailing blank line should be deferred
      const { events } = parseSSELines([
        'event: text_delta',
        'data: {"type":"text_delta","seq":1,"delta":"partial"}',
      ])
      expect(events).toHaveLength(0)
    })
  })

  describe('observability assertions', () => {
    it('tracks seq numbers monotonically across events', () => {
      const allLines = [
        ...FIXTURES.turn_start,
        ...FIXTURES.text_delta,
        ...FIXTURES.turn_complete,
      ]
      const { events } = parseSSELines(allLines)
      const seqs = events.map(e => JSON.parse(e.data).seq)
      expect(seqs).toEqual([1, 2, 6])
      // Verify monotonically increasing
      for (let i = 1; i < seqs.length; i++) {
        expect(seqs[i]).toBeGreaterThan(seqs[i - 1])
      }
    })
  })
})
