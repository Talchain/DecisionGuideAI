/**
 * The View client's contract with olumi-core: the types are generated from core's published schema (never hand-written), every golden
 * View core froze validates against that schema, and the client reads exactly the View core serves, with what was opened.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import Ajv2020 from 'ajv/dist/2020'
import { setTeamFetch, TeamApiError } from '../../olumiCore/team/api'
import { readView, viewPath, VIEW_SHAPE_CHANGED, type View } from '../client'
// @ts-expect-error a plain .mjs script, run by node to write types.ts
import { generate } from '../../../scripts/olumi-view/gen-types.mjs'

const here = (f: string) => new URL(f, import.meta.url)
const json = (f: string) => JSON.parse(readFileSync(here(f), 'utf8'))
const schema = json('../view.v2.json')
const schema3 = json('../view.v3.json')
const GOLDEN = ['pricing', 'studio', 'bakery', 'european', 'app-launch', 's_ce285b3617bb', 'proposal'] as const
const GOLDEN3 = [...GOLDEN, 'bakery-science'] as const

afterEach(() => setTeamFetch(null))

describe('the View types and schema (olumi-core schema/view.v3.json, and view.v2.json for a core before it)', () => {
  it('the committed types are exactly what the generator prints from the vendored olumi.view/3 schema', () => {
    expect(schema3.properties.schema.const).toBe('olumi.view/3')
    expect(readFileSync(here('../types.ts'), 'utf8')).toBe(generate(schema3))
  })

  const validate3 = new Ajv2020({ strict: false }).compile(schema3)
  for (const n of GOLDEN3) {
    it(`${n}: core's golden olumi.view/3 View validates against the v3 schema`, () => {
      const ok = validate3(json(`../golden/${n}.view3.json`))
      expect(validate3.errors ?? []).toEqual([])
      expect(ok).toBe(true)
    })
  }

  const validate = new Ajv2020({ strict: false }).compile(schema)
  for (const n of GOLDEN) {
    it(`${n}: core's golden View validates against the schema`, () => {
      const ok = validate(json(`../golden/${n}.view.json`))
      expect(validate.errors ?? []).toEqual([])
      expect(ok).toBe(true)
    })
  }

  it('a View with a field the schema does not know fails validation, so a shape change is caught here, not dropped silently', () => {
    const v = json('../golden/pricing.view.json')
    v.model.cards[0].invented = true
    expect(validate(v)).toBe(false)
  })
})

describe('reading the View', () => {
  it('asks for what was opened, exactly as the View handed it out, and every figure', () => {
    expect(viewPath('s_0123456789ab')).toBe('/api/scenarios/s_0123456789ab/view?schema=3')
    const opened = { open: new Map([['profit', ['cups', 'cups_change']]]), all: true }
    const url = new URL(viewPath('s_0123456789ab', opened), 'http://local')
    expect(url.pathname).toBe('/api/scenarios/s_0123456789ab/view')
    expect(url.searchParams.get('schema')).toBe('3')
    expect(JSON.parse(url.searchParams.get('open')!)).toEqual({ profit: ['cups', 'cups_change'] })
    expect(url.searchParams.get('all')).toBe('1')
  })

  it('returns the olumi.view/3 View core served, untouched, science lines included', async () => {
    const golden: View = json('../golden/bakery-science.view3.json')
    expect(golden.model!.run!.science.map((l) => l.id)).toEqual(['F20', 'F21', 'F22'])
    const f = vi.fn(async () => new Response(JSON.stringify(golden), { status: 200 }))
    setTeamFetch(f as unknown as typeof fetch)
    expect(await readView('s_0123456789ab')).toEqual(golden)
    expect(f).toHaveBeenCalledWith('/api/scenarios/s_0123456789ab/view?schema=3', expect.objectContaining({ method: 'GET', credentials: 'same-origin' }))
  })

  it('a core before olumi.view/3 answers olumi.view/2: read untouched, with no science lines to draw', async () => {
    const golden = json('../golden/pricing.view.json')
    setTeamFetch((async () => new Response(JSON.stringify(golden), { status: 200 })) as unknown as typeof fetch)
    expect(await readView('s_0123456789ab')).toEqual(golden)
  })

  it('a View of another version is said, never drawn as this one', async () => {
    setTeamFetch((async () => new Response(JSON.stringify({ ...json('../golden/pricing.view3.json'), schema: 'olumi.view/4' }), { status: 200 })) as unknown as typeof fetch)
    await expect(readView('s_0123456789ab')).rejects.toEqual(new TeamApiError(0, VIEW_SHAPE_CHANGED))
  })

  it('core\'s own words for a refusal reach the person', async () => {
    setTeamFetch((async () => new Response(JSON.stringify({ error: 'That scenario is not available to you.' }), { status: 404 })) as unknown as typeof fetch)
    await expect(readView('s_0123456789ab')).rejects.toMatchObject({ status: 404, message: 'That scenario is not available to you.' })
  })
})
