import { describe, it, expect } from 'vitest'
import { redact } from '../redact'

describe('redact()', () => {
  it('strips URL query strings', () => {
    expect(redact('https://example.com/path?q=1&x=2')).toBe('https://example.com/path')
    expect(redact('http://example.com/a?b=c#hash')).toBe('http://example.com/a#hash')
    expect(redact('not a url?keep=space rest')).toBe('not a url rest')
  })

  it('redacts sensitive keys (case-insensitive) deep in objects', () => {
    const input = {
      Authorization: 'Bearer abc',
      nested: {
        token: 'xyz',
        apikey: 'k',
        COOKIE: 'session=abc',
        url: 'https://api.test.dev/v1/items?secret=abc',
        list: [
          { Api_Key: 'v1', sub: [{ secret: 's', url: 'https://a/b?x=y' }] },
          'https://example.dev/p?q=z'
        ]
      }
    }
    const out: any = redact(input)
    expect(out.Authorization).toBe('[REDACTED]')
    expect(out.nested.token).toBe('[REDACTED]')
    expect(out.nested.apikey).toBe('[REDACTED]')
    expect(out.nested.COOKIE).toBe('[REDACTED]')
    expect(out.nested.url).toBe('https://api.test.dev/v1/items')
    expect(out.nested.list[0].Api_Key).toBe('[REDACTED]')
    expect(out.nested.list[0].sub[0].secret).toBe('[REDACTED]')
    expect(out.nested.list[0].sub[0].url).toBe('https://a/b')
    expect(out.nested.list[1]).toBe('https://example.dev/p')
  })
})
