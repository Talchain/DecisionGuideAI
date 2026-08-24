/**
 * FactorExternalEditor — structured technical detail for external factors.
 * Groups: Prior distribution, Classification.
 *
 * ── ⚠ THIS FILE CARRIED A FALSE COMPUTE CLAIM, AND IT WAS THE PANEL'S MOST
 *    EXPLICIT ONE (corrected UI #828) ──────────────────────────────────────
 * It rendered *"ISL converts to Normal(μ={mu}, σ={sigma})"* with
 * `σ = (max − min) / √12` — the uniform moment-match. **ISL performs no such
 * conversion.** Derived at the bytes (PLoT `7e5d8a7`, ISL `28fe0c9`, fresh
 * clones, with contrast controls on `uniform`/`range_max` firing in the same
 * sweep):
 *   · PLoT `translator-v3.ts:842-847` emits `{distribution:'uniform',
 *     range_min, range_max}` into `parameter_uncertainties` — a passthrough of
 *     the declared support, no arithmetic.
 *   · ISL `robustness_analyzer_v2.py:1275` draws `rng.uniform(range_min,
 *     range_max)` per Monte Carlo sample; the central value is the midpoint
 *     (`:1069-1075`).
 *   · `√12` appears NOWHERE in either service's live code. The only hits are
 *     comments recording that the Normal was REMOVED, and a PLoT test that
 *     now FORBIDS it (`translator-fixtures.test.ts:384`).
 * PLoT deleted that conversion on purpose (`translator-v3.ts:802-816`): a
 * σ=width/√12 Normal centred a declared `Uniform[0.6, 1.0]` on 0.0, putting
 * every one of 20,000 draws outside the declared support. **This panel was
 * advertising the defect that was fixed.**
 *
 * The two numbers were not wrong — μ=(a+b)/2 and σ=(b−a)/√12 are the true mean
 * and standard deviation OF THE UNIFORM, and the midpoint matches ISL's own
 * central value exactly. Only the distribution named was wrong, and it is wrong
 * where it matters: the draws are bounded and platykurtic, which is the whole
 * reason the Normal was removed. The line below therefore keeps the moments and
 * names the distribution ISL actually samples.
 */

import { useCanvasStore } from '../../../store'
import { useNodeMutations } from '../useInspectorMutations'
import { AdvancedField } from '../shared/AdvancedField'
import { AdvancedFieldGroup } from '../shared/AdvancedFieldGroup'
import { typography } from '../../../../styles/typography'

interface FactorExternalEditorProps {
  nodeId: string
}

export function FactorExternalEditor({ nodeId }: FactorExternalEditorProps) {
  const node = useCanvasStore(s => s.nodes.find(n => n.id === nodeId))
  const mutations = useNodeMutations(nodeId)

  const data = node?.data as Record<string, unknown> | undefined
  const prior = data?.prior as Record<string, unknown> | undefined
  const rangeMin = prior?.range_min as number | undefined
  const rangeMax = prior?.range_max as number | undefined

  const hasRange = rangeMin != null && rangeMax != null
  /**
   * Both moments are the UNIFORM's own: mean = (a+b)/2 (which is exactly ISL's
   * central value for this factor, `robustness_analyzer_v2.py:1069-1075`) and
   * sd = (b−a)/√12. `√12` is the closed form for U(a,b)'s standard deviation
   * here — it is NOT a moment-match to a Normal, which is what the old copy
   * claimed and what PLoT deleted.
   *
   * The em-dash placeholders these two carried are gone with them: they were
   * only ever read inside the `hasRange` branch below, so the fallbacks were
   * dead, and `Brief3Panels.spec.tsx` forbids U+2014 in rendered panel copy.
   */
  const mu = hasRange ? ((rangeMin + rangeMax) / 2).toFixed(2) : null
  const sigma = hasRange ? ((rangeMax - rangeMin) / Math.sqrt(12)).toFixed(2) : null

  /**
   * DERIVED, not hardcoded. This field displayed the literal string 'uniform'
   * whatever the node carried — a hand-maintained mirror of a value sitting
   * three lines above it (trap 12), and one the sentence below now depends on:
   * PLoT's prior→`parameter_uncertainties` pass gates on
   * `prior.distribution === 'uniform'` (`translator-v3.ts:748`) and silently
   * drops anything else. Reading the node means the panel cannot claim uniform
   * sampling for a prior that is not uniform.
   */
  const distribution = typeof prior?.distribution === 'string' && prior.distribution.length > 0
    ? prior.distribution
    : undefined

  if (!node) return null

  return (
    <div className="space-y-1">
      <AdvancedFieldGroup title="Prior distribution">
        <AdvancedField
          label="Distribution type"
          value={distribution ?? 'Not set'}
          type="readonly"
        />
        <AdvancedField
          label="Range minimum"
          value={rangeMin}
          onChange={v => mutations.setPriorRange(v as number, rangeMax ?? 1)}
          type="number"
          min={0}
          max={1}
          step={0.01}
        />
        <AdvancedField
          label="Range maximum"
          value={rangeMax}
          onChange={v => mutations.setPriorRange(rangeMin ?? 0, v as number)}
          type="number"
          min={0}
          max={1}
          step={0.01}
        />
        {/*
          Rendered only for a uniform prior, because that is the only shape the
          claim is true of — see the gate cited on `distribution` above. The
          moments are kept (they are the Uniform's own mean and sd, and the mean
          is exactly ISL's central value for this factor); the distribution name
          is corrected to the one ISL actually samples.

          No em-dash. `Brief3Panels.spec.tsx` forbids U+2014 in rendered panel
          copy, and it CANNOT REACH THIS LINE — it scans the collapsed panel,
          and `TechnicalDisclosure` is closed by default, the same blind spot
          that hid this file's false compute claim from the honesty scan. The
          rule is asserted on the EXPANDED surface by
          `FactorExternalPanel.priorRangeHonesty.spec.tsx`.
        */}
        {hasRange && distribution === 'uniform' && (
          <p className={`${typography.panelMeta} text-text-light mt-1`}>
            ISL samples Uniform({rangeMin!.toFixed(2)}, {rangeMax!.toFixed(2)}); mean {mu}, sd {sigma}
          </p>
        )}
      </AdvancedFieldGroup>

      <AdvancedFieldGroup title="Classification">
        <AdvancedField
          label="Category"
          value="external"
          type="readonly"
        />
      </AdvancedFieldGroup>
    </div>
  )
}
