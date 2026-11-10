/**
 * THE PREVIOUS MODEL TAB'S SECTIONS, FED FROM CORE'S VIEW (DL brief A4, 10 Nov: Paul wants the previous Model tab back). Under the outline
 * the previous tab (`canvas/components/ModelTabBody.tsx`) drew Limits, structural issues, the model card and its audit. They read the old
 * canvas store and CEE's fields; here each draws what core's View holds, in core's words, under the previous section's own heading and in
 * its look (a plain headed section; `Accordion`, closed on open, for the model card and the audit).
 * - Limits: each aim or limit card's bound (`cards[].bound`), with Olumi's mark where core marks it.
 * - Structural issues: what stops a chance being worked out (`run.shared_blockers`, `run.coverage`) and what it waits on (`run.waits_on`).
 * - Model card: what would strengthen the model (`model.sharpen`).
 * - Audit trail: the version shown and what changed in it (`view.version`), what was removed (`model.removed`), how core read each aim
 *   (`run.readings`) and Olumi's own assumptions in the run (`run.notes`).
 * A section core sends nothing for is not drawn (absence is drawn as absence). What the previous sections showed that core has no field
 * for is listed for the engine in BUILD-LEDGER (A4 gaps), never made up here. No model word is composed, rounded or formatted.
 */
import type { ReactNode } from 'react'
import { typography } from '../../styles/typography'
import { ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import { Accordion } from '../../components/results/Accordion'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import type { View, ViewModel } from '../client'

/** The previous tab's section headings (`GoalConstraintsSection` "Limits", `ModelHealthSection` "Model card"). UI words, not model words. */
export const MODEL_SECTION_LABELS = { limits: 'Limits', structure: 'Structural issues', card: 'Model card', audit: 'Audit trail' } as const

const uniq = (xs: readonly string[]): string[] => [...new Set(xs)]
const HEAD = `${typography.panelHeader} m-0 mb-1 text-text-header`
const LINE = `${typography.viewPanelBody} m-0 break-words text-text-body`
const QUIET = `${typography.viewPanelMeta} m-0 break-words text-text-light`

/** A card's heading as a way to it: pressing puts its card in front on the canvas (the outline rows' own focus). */
function CardLink({ id, children }: { id: string; children: ReactNode }) {
  return (
    <button type="button" data-model-section-card={id} onClick={() => focusNodeById(id)}
      className={`${typography.viewPanelBody} rounded-sm text-left text-text-header underline-offset-2 hover:underline ${ACTION_FOCUS}`}>{children}</button>
  )
}

function Limits({ model }: { model: ViewModel }) {
  const rows = model.cards.filter((c) => c.bound != null)
  if (rows.length === 0) return null
  return (
    <section aria-label={MODEL_SECTION_LABELS.limits} data-testid="view-model-limits" className="py-2.5">
      <h3 className={HEAD}>{MODEL_SECTION_LABELS.limits}</h3>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {rows.map((c) => (
          <li key={c.id} data-model-limit={c.id}>
            <CardLink id={c.id}>{c.heading}</CardLink>
            <p className={LINE} title={c.bound!.title} data-view={`model.cards.${c.id}.bound.text`}>
              {c.bound!.olumi ? <span title={c.bound!.olumi.title} className="text-text-light" data-model-limit-olumi={c.id}>{c.bound!.olumi.glyph} </span> : null}
              {c.bound!.text}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Structure({ model }: { model: ViewModel }) {
  const run = model.run
  if (run === null) return null
  const blocked = uniq([...(run.shared_blockers ?? []).map((b) => b.text), ...(run.coverage ?? []).map((c) => c.text)])
  const waits = run.waits_on
  if (blocked.length === 0 && waits === null) return null
  const isCard = (id: string) => model.cards.some((c) => c.id === id)
  return (
    <section aria-label={MODEL_SECTION_LABELS.structure} data-testid="view-model-structure" className="py-2.5">
      <h3 className={HEAD}>{MODEL_SECTION_LABELS.structure}</h3>
      {blocked.length === 0 ? null : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0" data-model-structure="blocked">
          {blocked.map((t) => <li key={t} className={LINE}>{t}</li>)}
        </ul>
      )}
      {waits === null ? null : (
        <div className="pt-1.5" data-model-structure="waits">
          <p className={QUIET}><span data-view="model.run.waits_on.head">{waits.head}</span> <span data-view="model.run.waits_on.text">{waits.text}</span></p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 pt-1">
            {waits.items.map((it) => (
              <li key={it.id} data-model-waits={it.id}>
                {isCard(it.id) ? <CardLink id={it.id}>{it.text}</CardLink> : <span className={LINE} title={it.title}>{it.text}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function ModelCard({ model }: { model: ViewModel }) {
  const sharpen = model.sharpen ?? []
  if (sharpen.length === 0) return null
  return (
    <Accordion title={MODEL_SECTION_LABELS.card} testId="view-model-card">
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {sharpen.map((s) => (
          <li key={s.id} data-model-sharpen={s.id}>
            <p className={LINE}>{s.lead} {s.emphasis}</p>
            <p className={QUIET}>{s.rationale}</p>
          </li>
        ))}
      </ul>
    </Accordion>
  )
}

function Audit({ model, version }: { model: ViewModel; version: View['version'] }) {
  const readings = uniq((model.run?.readings ?? []).map((r) => r.text))
  const notes = uniq((model.run?.notes ?? []).map((n) => n.text))
  const removed = model.removed ?? []
  if (version == null && readings.length + notes.length + removed.length === 0) return null
  return (
    <Accordion title={MODEL_SECTION_LABELS.audit} testId="view-model-audit">
      <div className="flex flex-col gap-2">
        {version == null ? null : (
          <div data-model-audit="version">
            <p className={LINE}><span data-view="version.label">{version.label}</span>{version.at_text ? <span className="text-text-light"> · <span data-view="version.at_text">{version.at_text}</span></span> : null}</p>
            {version.changed.length === 0 ? null : (
              <ul className="m-0 list-none p-0">{version.changed.map((t, k) => <li key={k} className={QUIET} data-model-audit-changed={k}>{t}</li>)}</ul>
            )}
          </div>
        )}
        {removed.length === 0 ? null : (
          <ul className="m-0 list-none p-0" data-model-audit="removed">
            {removed.map((r) => <li key={r.id} className={LINE} data-model-audit-removed={r.id}>{r.heading}{r.title !== r.heading ? <span className={`${QUIET} block`}>{r.title}</span> : null}</li>)}
          </ul>
        )}
        {readings.length === 0 ? null : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0" data-model-audit="readings">{readings.map((t) => <li key={t} className={LINE}>{t}</li>)}</ul>
        )}
        {notes.length === 0 ? null : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0" data-model-audit="notes">{notes.map((t) => <li key={t} className={QUIET}>{t}</li>)}</ul>
        )}
      </div>
    </Accordion>
  )
}

/** The previous tab's sections under the outline, in its order: Limits, structural issues, the model card, the audit. */
export function ModelSections({ model, version }: { model: ViewModel; version: View['version'] }): JSX.Element {
  return (
    <div data-testid="view-model-sections">
      <Limits model={model} />
      <Structure model={model} />
      <ModelCard model={model} />
      <Audit model={model} version={version} />
    </div>
  )
}
