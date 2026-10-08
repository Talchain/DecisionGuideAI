import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { stripComments } from '../../../../tests/helpers/stripSourceComments'
import { buildRunView, RUN_AGAIN_FOR_CHANCE } from '../runView'
import { report as capturedReport } from '../../../components/results/__tests__/helpers/paulRun4276f3f9'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { fx } from '../../../components/results/__tests__/helpers/paulRun4276f3f9'

const MODULE = '../canonicalAnalysisView'
const loadParser = async () => {
  const module = await import(MODULE).catch(() => ({}))
  expect(module.parseCanonicalAnalysisView, 'P1 parser exists').toBeTypeOf('function')
  return module.parseCanonicalAnalysisView as (body: unknown) => any
}
// Real route-inject body from CEE #2864 @283b8a98; additional malformed records are test mutations.
import bodies from './fixtures/cee-canonical-view-bodies-283b8a98.json'
const wire = () => structuredClone(bodies.a_current)
const ctx = { goalChanceHeroSays: false, labelOf: () => null }
describe('WS5 tolerant canonical READ boundary', () => {
  it('P1 malformed and other schema yield null without throwing', async () => {
    const parse = await loadParser()
    for (const body of [null, [], {}, { schema: 'other' },
      { ...wire(), run: 5 }, { ...wire(), leader_licence: {} },
      { ...wire(), options: [{ option_id: 'a', cell: { kind: 'none' }, main_driver: { kind: 'unknown' } }] },
      { ...wire(), options: [{ option_id: 'a', cell: { kind: 'figure', display: 5 }, main_driver: { kind: 'not_recorded' } }] },
      { ...wire(), options: [{ option_id: 'a', cell: { kind: 'withheld', reasons: [{ code: 'x', message: 5 }] }, main_driver: { kind: 'not_recorded' } }] }]) {
      expect(() => parse(body)).not.toThrow()
      expect(parse(body)).toBeNull()
    }
    expect(parse(wire())).toEqual(wire())
  })
  // C-CELL: hash alone cannot bind a READ cell to a Run (DL r6-3c).
  it('hash fallback also requires the report producer timestamp when its run id is absent', async () => {
    const view = (await loadParser())(wire())
    expect(buildRunView({ ...capturedReport, meta: { computed_at: bodies.a_current.run.computed_at }, computed_against_hash: bodies.a_current.run.graph_hash_at_run }, view).chanceCellOf('raise_prices_10', ctx).text).toBe('about 47%')
    expect(buildRunView({ ...capturedReport, computed_against_hash: 'another' }, view).chanceCellOf('raise_prices_10', ctx).kind).toBe('none')
    expect(buildRunView(capturedReport, view).chanceCellOf('raise_prices_10', ctx).kind).toBe('none')
  })
  // C-CELL: feed the producer timestamp through the report, preserving figure and identity assertions.
  it('the existing mapper preserves producer identity for canonical run matching', async () => {
    const report = mapV5AnalysisToReport({ ...fx.analysis_block as object, computed_against_hash: bodies.a_current.run.graph_hash_at_run } as never, { computedAt: bodies.a_current.run.computed_at })
    const view = (await loadParser())(wire())
    expect(report.meta.computed_at).toBe(bodies.a_current.run.computed_at)
    expect(buildRunView(report, view).chanceCellOf('raise_prices_10', ctx).text).toBe('about 47%')
  })
  it('none is authoritative; a missing option and stale:null fall through', async () => {
    const body = wire()
    body.options = [{ option_id: 'a', cell: { kind: 'none' }, main_driver: { kind: 'not_recorded' } }] as never
    const view = (await loadParser())(body)
    const report = { ...capturedReport, run_id: bodies.a_current.run.run_id, option_probabilities: { ...capturedReport.option_probabilities, a: { goal_probability: 0.4 }, b: { goal_probability: 0.4 } } }
    expect(buildRunView(report, view).chanceCellOf('a', ctx).kind).toBe('none')
    expect(buildRunView(report, view).chanceCellOf('b', ctx).text).toBe(RUN_AGAIN_FOR_CHANCE)
    expect(buildRunView(report, { ...view, staleness: { ...view.staleness, stale: null } }).chanceCellOf('a', ctx).text).toBe(RUN_AGAIN_FOR_CHANCE)
  })
  it('GUARD only the narrow adapter carry reads the wire key; parsing has one owner, with positive control', () => {
    const root = join(process.cwd(), 'src')
    const readers = (source: string, name: string) => {
      const hits: string[] = []
      const parsed = ts.createSourceFile(name, stripComments(source, name), ts.ScriptTarget.Latest, true)
      const visit = (node: ts.Node) => {
        if (ts.isPropertyAccessExpression(node) && node.name.text === 'canonical_analysis_view') hits.push(`${name}:${node.getText(parsed)}`)
        if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression) && node.argumentExpression.text === 'canonical_analysis_view') hits.push(`${name}:${node.getText(parsed)}`)
        if (ts.isBindingElement(node) && (node.propertyName ?? node.name).getText(parsed) === 'canonical_analysis_view') hits.push(`${name}:${node.getText(parsed)}`)
        ts.forEachChild(node, visit)
      }
      visit(parsed)
      return hits
    }
    expect(readers('// x.canonical_analysis_view\nconst v = x.canonical_analysis_view', 'control.ts')).toEqual(['control.ts:x.canonical_analysis_view'])
    const hits: string[] = []
    const walk = (dir: string) => { for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) { if (!['__tests__', '__fixtures__', '__mocks__', 'fixtures', 'tests', 'test'].includes(entry.name)) walk(path) }
      else if (/\.tsx?$/.test(entry.name) && !/\.(spec|test|stories)\./.test(entry.name)) hits.push(...readers(readFileSync(path, 'utf8'), relative(root, path)))
    } }
    walk(root)
    // R2-4 narrow opaque transport exception: exactly one adapter expression, never the whole READ envelope.
    expect(hits).toEqual(['adapters/cee/scenarioGraph.ts:b.canonical_analysis_view'])
    const hydration = stripComments(readFileSync(join(root, 'canvas/hydrate/serverGraphHydration.ts'), 'utf8'), 'serverGraphHydration.ts')
    expect(hydration).toContain('parseCanonicalAnalysisView(result.canonicalAnalysisView)')
  })
})
