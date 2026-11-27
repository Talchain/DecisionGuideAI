/**
 * Test seam for the links lane: what a link's element is drawn WITH. The lane writes classes (and two custom properties for where a part stands), never an
 * inline style, so a spec that asks "what stroke, width, dash?" reads the applied recipe: the classes on the element against the declarations in
 * olumiLook.css (jsdom loads no stylesheet). Match class and focus selectors including ancestors. More classes and pseudo-classes win; later wins a tie.
 * `var(--x)` resolves through the element's ancestors where this sheet defines it. Theme references stay as tokens.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

type Rule = { selector: string; classes: string[]; weight: number; decls: Record<string, string> }

const sheet = (source: string): Rule[] => {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: Rule[] = []
  for (const m of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const decls: Record<string, string> = {}
    for (const d of m[2]!.split(';')) { const k = d.indexOf(':'); if (k > 0) decls[d.slice(0, k).trim()] = d.slice(k + 1).trim() }
    for (const selector of m[1]!.split(',').map((x) => x.trim())) {
      if (!/^\.[\w-]+(?:\.[\w-]+|\s+\.[\w-]+|:focus(?:-visible)?)*$/.test(selector)) continue
      const last = selector.split(/\s+/).pop()!
      rules.push({ selector, classes: [...last.matchAll(/\.([\w-]+)/g)].map((c) => c[1]!), weight: [...selector.matchAll(/[.:][\w-]+/g)].length, decls })
    }
  }
  return rules
}
let cached: Rule[] | null = null
export const rules = (): Rule[] => (cached ??= sheet(readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8')))

const own = (el: Element, activeRules: Rule[]): Record<string, string> => {
  const out: Record<string, { value: string; weight: number }> = {}
  for (const r of activeRules) {
    if (!el.matches(r.selector)) continue
    for (const [property, value] of Object.entries(r.decls)) {
      if (r.weight >= (out[property]?.weight ?? 0)) out[property] = { value, weight: r.weight }
    }
  }
  return Object.fromEntries(Object.entries(out).map(([property, rule]) => [property, rule.value]))
}

const custom = (el: Element | null, name: string, activeRules: Rule[]): string | null => {
  for (let e = el; e !== null; e = e.parentElement) { const v = own(e, activeRules)[name]; if (v !== undefined) return v }
  return null
}

/** The element's applied declarations, in camelCase (`strokeWidth`), custom properties resolved. A declaration nothing sets is absent. */
export const applied = (el: Element, laterCss?: string): Record<string, string> => {
  const activeRules = laterCss === undefined ? rules() : [...rules(), ...sheet(laterCss)]
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(own(el, activeRules))) {
    if (k.startsWith('--')) continue
    const resolved = v.replace(/var\((--[\w-]+)(?:,\s*([^)]*))?\)/g, (reference, name: string, fallback: string | undefined) => custom(el, name, activeRules) ?? fallback ?? reference)
    out[k.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())] = resolved
  }
  return out
}

/** What a class (with the other classes its rule names beside it, e.g. `react-flow__edge-path`) declares in the stylesheet, whole: for a rule no element in the page carries. */
export const declared = (cls: string, ...also: string[]): Record<string, string> => {
  const want = [cls, ...also].sort().join(' ')
  return Object.assign({}, ...rules().filter((r) => [...r.classes].sort().join(' ') === want).map((r) => r.decls))
}

/** Where a label-layer part stands: the custom properties the lane writes (links/place.ts), in flow px. */
export const standsAt = (el: HTMLElement): { x: number; y: number } => ({ x: Number.parseFloat(el.style.getPropertyValue('--link-x')), y: Number.parseFloat(el.style.getPropertyValue('--link-y')) })

/** Hidden by the class (olumiLook.css `.ok-link-hidden`: visibility hidden), never by an inline style. */
export const isHidden = (el: Element): boolean => el.classList.contains('ok-link-hidden') && declared('ok-link-hidden').visibility === 'hidden'
