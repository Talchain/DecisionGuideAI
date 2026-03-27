/**
 * stripDiagnostics — unit tests
 *
 * Ensures diagnostics content is removed from assistant_text before rendering.
 */

import { describe, it, expect } from 'vitest'
import { stripDiagnostics } from '../useConversation'

describe('stripDiagnostics', () => {
  it('removes <diagnostics>…</diagnostics> XML blocks', () => {
    const input =
      '<diagnostics>Mode: INTERPRET. Stage: IDEATE. User asks about broadening.</diagnostics>\nHere is my response.'
    expect(stripDiagnostics(input)).toBe('Here is my response.')
  })

  it('removes multiline <diagnostics> blocks', () => {
    const input = [
      '<diagnostics>',
      'Mode: INTERPRET.',
      'Stage: IDEATE.',
      'User asks about broadening options.',
      '</diagnostics>',
      '',
      'Here is my response.',
    ].join('\n')
    expect(stripDiagnostics(input)).toBe('Here is my response.')
  })

  it('is case-insensitive for XML tags', () => {
    const input = '<DIAGNOSTICS>internal notes</DIAGNOSTICS>\nVisible text.'
    expect(stripDiagnostics(input)).toBe('Visible text.')
  })

  it('removes bare diagnostics preamble lines', () => {
    const input =
      'Mode: INTERPRET. Stage: IDEATE. User asks about broadening options.\nHere is my response.'
    expect(stripDiagnostics(input)).toBe('Here is my response.')
  })

  it('removes bare preamble with extra trailing text on the same line', () => {
    const input =
      'Mode: CLARIFY. Stage: FRAME. Need more context on constraints.\nLet me ask a follow-up.'
    expect(stripDiagnostics(input)).toBe('Let me ask a follow-up.')
  })

  it('leaves normal text untouched', () => {
    const input = 'Here is a perfectly normal response about decision modeling.'
    expect(stripDiagnostics(input)).toBe(input)
  })

  it('handles empty string', () => {
    expect(stripDiagnostics('')).toBe('')
  })

  it('collapses excessive blank lines after removal', () => {
    const input = [
      '<diagnostics>internal</diagnostics>',
      '',
      '',
      '',
      'Visible text.',
    ].join('\n')
    expect(stripDiagnostics(input)).toBe('Visible text.')
  })

  it('handles both XML and bare preamble in same text', () => {
    const input = [
      '<diagnostics>Block one</diagnostics>',
      'Mode: INTERPRET. Stage: IDEATE. Extra context.',
      'Actual response here.',
    ].join('\n')
    expect(stripDiagnostics(input)).toBe('Actual response here.')
  })

  it('does not strip text that mentions "mode" in normal prose', () => {
    const input = 'You can switch the mode to advanced for more options.'
    expect(stripDiagnostics(input)).toBe(input)
  })

  it('preserves surrounding text when diagnostics block is mid-text', () => {
    const input = [
      'First paragraph.',
      '<diagnostics>internal reasoning</diagnostics>',
      'Second paragraph.',
    ].join('\n')
    expect(stripDiagnostics(input)).toBe('First paragraph.\nSecond paragraph.')
  })

  it('returns empty string when input is only diagnostics', () => {
    const input = '<diagnostics>Mode: INTERPRET. Stage: IDEATE.</diagnostics>'
    expect(stripDiagnostics(input)).toBe('')
  })

  it('returns empty string when remainder is whitespace-only', () => {
    const input = '<diagnostics>internal</diagnostics>\n  \n  '
    expect(stripDiagnostics(input)).toBe('')
  })

  // Regex hardening: variant formats
  it('strips preamble with leading whitespace', () => {
    const input = '  Mode: INTERPRET. Stage: IDEATE. User intent.\nVisible.'
    expect(stripDiagnostics(input)).toBe('Visible.')
  })

  it('strips preamble with colon separators instead of periods', () => {
    const input = 'Mode: INTERPRET: Stage: IDEATE: Broadening query.\nVisible.'
    expect(stripDiagnostics(input)).toBe('Visible.')
  })

  it('strips preamble with tab indentation', () => {
    const input = '\tMode: CLARIFY. Stage: FRAME. Context needed.\nVisible.'
    expect(stripDiagnostics(input)).toBe('Visible.')
  })

  // T3 XML envelope: complete envelope
  it('extracts assistant_text from complete T3 envelope', () => {
    const input = '<response><assistant_text>Hello world</assistant_text><blocks></blocks></response>'
    expect(stripDiagnostics(input)).toBe('Hello world')
  })

  // T3 XML envelope: partial streaming — only opening tags arrived
  it('extracts content from partial T3 envelope during streaming', () => {
    const input = '<response><assistant_text>Here are four techniques'
    expect(stripDiagnostics(input)).toBe('Here are four techniques')
  })

  it('extracts content from partial envelope with closing assistant_text but no response close', () => {
    const input = '<response><assistant_text>Content here</assistant_text><blocks><block>'
    expect(stripDiagnostics(input)).toBe('Content here')
  })

  it('handles partial envelope with whitespace before tags', () => {
    const input = '  <response>  <assistant_text>Some text'
    expect(stripDiagnostics(input)).toBe('Some text')
  })

  it('does not treat mid-text angle brackets as partial envelope', () => {
    const input = 'Use <response> tags for XML formatting.'
    expect(stripDiagnostics(input)).toBe('Use <response> tags for XML formatting.')
  })
})
