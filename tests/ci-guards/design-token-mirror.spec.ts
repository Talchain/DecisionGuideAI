import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'postcss'
import { expect, it } from 'vitest'
import { tripleToHex } from '../../src/styles/channelTriple.mjs'

const read = (file: string) => readFileSync(join(__dirname, '../../', file), 'utf8')

/** Read the unconditional light-theme declarations in cascade order. */
function tokensOf(css: string): Map<string, string> {
  const tokens = new Map<string, string>()
  parse(css).each((rule) => {
    if (rule.type !== 'rule' || !rule.selectors.includes(':root')) return
    rule.walkDecls(/^--/, ({ prop, value }) => {
      tokens.set(prop, value.trim())
    })
  })
  return tokens
}

function resolve(tokens: Map<string, string>, name: string, seen = new Set<string>()): string | undefined {
  const value = tokens.get(name)
  if (value === undefined || seen.has(name)) return undefined
  return resolveValue(value, tokens, new Set([...seen, name]))
}

function resolveValue(value: string, tokens: Map<string, string>, seen: Set<string>): string | undefined {
  const ref = /var\(\s*(--[\w-]+)\s*(,)?/.exec(value)
  if (!ref) return value

  // The fallback can itself contain functions, including further var() calls.
  const start = ref.index + ref[0].length
  let end = start
  let depth = 1
  while (end < value.length && depth > 0) {
    if (value[end] === '(') depth++
    if (value[end] === ')') depth--
    end++
  }
  if (depth !== 0) return undefined

  const fallback = ref[2] === ',' ? value.slice(start, end - 1).trim() : undefined
  const replacement = resolve(tokens, ref[1], seen) ??
    (fallback === undefined ? undefined : resolveValue(fallback, tokens, seen))
  const remainder = resolveValue(value.slice(end), tokens, seen)
  if (replacement === undefined || remainder === undefined) return undefined
  return value.slice(0, ref.index) + replacement + remainder
}

function comparable(value: string): string {
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value)
  if (hex) {
    const expanded = hex[1].length <= 4 ? [...hex[1]].map((digit) => digit + digit).join('') : hex[1]
    const alpha = expanded.length === 8 ? parseInt(expanded.slice(6), 16) / 255 : 1
    return `#${expanded.slice(0, 6).toUpperCase()}/${alpha}`
  }

  const rgb = /^rgb\(\s*([\d\s]+?)(?:\s*\/\s*(\d*\.?\d+))?\s*\)$/i.exec(value)
  const channels = rgb && tripleToHex(rgb[1])
  return channels ? `${channels}/${Number(rgb[2] ?? 1)}` : value
}

it('resolves a fallback against the declarations in each sheet', () => {
  const declaration = '--colour: var(--preferred, var(--secondary, rgb(17 34 51)));'
  const docs = tokensOf(`:root { ${declaration} }`)
  const served = tokensOf(`:root { ${declaration} --preferred: #445566; }`)
  expect(resolve(docs, '--colour')).toBe('rgb(17 34 51)')
  expect(resolve(served, '--colour')).toBe('#445566')
})

it('mirrors served colours, radii, spacing, z-index and default durations in the design token sheet', () => {
  const served = tokensOf(read('src/styles/brand.css'))
  const docs = tokensOf(read('docs/Design/system/tokens.css'))
  expect([...docs.keys()]).toEqual(expect.arrayContaining([
    '--info', '--focus-color', '--radius-md', '--space-3', '--z-modal', '--duration-fast',
  ]))
  const drift: string[] = []
  for (const [name] of docs) {
    // The generated sheet also illustrates typography and easing. This guard
    // covers the colour and size palette, layer tokens and default durations.
    if (/^--(?:font|ease)-/.test(name)) continue
    const documentedValue = resolve(docs, name)
    const runtimeValue = resolve(served, name)
    if (documentedValue === undefined || runtimeValue === undefined) {
      drift.push(`${name}: unresolved in ${documentedValue === undefined ? 'tokens.css' : 'brand.css'}`)
      continue
    }
    const documented = comparable(documentedValue)
    const runtime = comparable(runtimeValue)
    if (documented !== runtime) drift.push(`${name}: docs ${documented}, brand.css ${runtime}`)
  }
  expect(drift).toEqual([])
})
