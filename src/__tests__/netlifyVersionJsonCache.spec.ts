/**
 * /version.json cache-posture pin (ROADMAP 2.1281).
 *
 * /version.json is the deployment-evidence endpoint. It served a 5.2-hour-old SHA
 * through twenty consecutive deploy polls, and uniformity was the only tell.
 *
 * The load-bearing header is the CDN-level one, NOT `cache-control`. Netlify's
 * precedence is Netlify-CDN-Cache-Control > CDN-Cache-Control > Cache-Control, static
 * assets default to `s-maxage=31536000`, and Netlify ignores attempts to shorten that
 * with a plain `Cache-Control` — measured: `ttl + age` summed to ~31,536,000 on
 * /version.json, /index.html and /assets/*.js alike, so one directive governed all
 * three and it was not the one any of them set.
 *
 * Without this pin the rule is a hand-maintained mirror with no drift alarm: someone
 * "tidying" the CDN lines away would restore a year-long edge cache on the one file
 * whose whole purpose is to be current, and every deploy verdict taken from it would
 * read an older SHA while looking perfectly healthy.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The `[headers.values]` table for a given `for = "<path>"` rule, as raw text.
 * Bounded by the next `[[headers]]`/`[` table header so a later rule's directives
 * can never satisfy an assertion about this one (bind by the rule, not by the file).
 */
function headerBlock(path: string): string {
  const toml = readFileSync(resolve(process.cwd(), 'netlify.toml'), 'utf8')
  const start = toml.indexOf(`for = "${path}"`)
  expect(start, `netlify.toml must declare a [[headers]] rule for ${path}`).toBeGreaterThan(-1)
  const rest = toml.slice(start)
  const end = rest.search(/\n\[\[headers\]\]|\n\[[a-z]/)
  return end === -1 ? rest : rest.slice(0, end)
}

describe('netlify.toml /version.json cache posture', () => {
  it('stops the CDN storing it, at the header level that actually governs', () => {
    const block = headerBlock('/version.json')
    // The CDN-level directive is the one that defeats the platform's s-maxage default.
    expect(block).toMatch(/netlify-cdn-cache-control\s*=\s*"[^"]*no-store/i)
  })

  it('still sets cache-control for browsers and intermediaries', () => {
    expect(headerBlock('/version.json')).toMatch(/\bcache-control\s*=\s*"[^"]*no-store/i)
  })

  it('never marks the deployment-evidence endpoint publicly cacheable', () => {
    // `public` + a storable response is how the year-long edge entry happened.
    expect(headerBlock('/version.json')).not.toMatch(/=\s*"[^"]*\bpublic\b/i)
  })

  it('does not hand the headers authority to a public/_headers file', () => {
    // Netlify processes public/_headers BEFORE netlify.toml, so a _headers file
    // appearing later would silently outrank every rule pinned here.
    expect(existsSync(resolve(process.cwd(), 'public/_headers'))).toBe(false)
  })

  it('leaves the long-lived asset caching alone (no glob widening)', () => {
    // Positive control for the extractor AND a collateral check: the immutable
    // asset rule must keep its year-long cache, so a no-store rule has not been
    // widened across the bundle.
    expect(headerBlock('/assets/*.js')).toMatch(/max-age=31536000/)
  })
})
