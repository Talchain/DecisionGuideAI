/**
 * The decision brief, rendered from `DecisionBriefModel` and deciding nothing: every sentence and figure is the
 * builder's. An element the model names on this canvas is a button that shows it on the graph (`onShowNode`).
 */
import type { ReactNode } from 'react'

import type { BriefSource, DecisionBriefModel } from './buildDecisionBrief'

export interface DecisionBriefViewProps {
  readonly brief: DecisionBriefModel
  /** Show this graph element on the canvas. Absent → items render as plain text. */
  readonly onShowNode?: (nodeId: string) => void
}

function Section({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  return (
    <section className="mt-4" data-testid={testId}>
      <h3 className="text-xs font-semibold text-text-light">{title}</h3>
      <div className="mt-1.5 text-sm text-text-body">{children}</div>
    </section>
  )
}

function SourcePill({ source }: { source: BriefSource }) {
  return (
    <span
      className="ml-2 inline-block rounded-full border border-panel-border bg-transparent px-2 py-0.5 text-xs text-text-body"
      data-testid={`brief-source-${source.kind}`}
    >
      {source.label}
    </span>
  )
}

function NodeLink({
  nodeId,
  onShowNode,
  children,
  testId,
}: {
  nodeId: string | null
  onShowNode?: (nodeId: string) => void
  children: ReactNode
  testId?: string
}) {
  if (nodeId === null || !onShowNode) return <span data-testid={testId}>{children}</span>
  return (
    <button
      type="button"
      onClick={() => onShowNode(nodeId)}
      className="text-left underline decoration-panel-border underline-offset-2 hover:decoration-current focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
      title="Show on the model"
      data-testid={testId}
      data-node-id={nodeId}
    >
      {children}
    </button>
  )
}

export function DecisionBriefView({ brief, onShowNode }: DecisionBriefViewProps) {
  const current = brief.run.status === 'current'
  return (
    <article className="text-text-body" data-testid="decision-brief" data-run-status={brief.run.status}>
      <header>
        <h2 className="text-base font-semibold text-text-header" data-testid="brief-decision">
          {brief.decision.label ?? 'Decision'}
        </h2>
        <p className="mt-1 text-xs text-text-light" data-testid="brief-version">
          Saved model version {brief.version.shortVersion ?? 'not stated'}
          {brief.run.computedAtText ? ` · latest Run ${brief.run.computedAtText}` : ''}
        </p>
      </header>

      {brief.options.length > 0 && (
        <Section title="Options" testId="brief-options">
          <ul className="space-y-1">
            {brief.options.map((o) => (
              <li key={o.nodeId}>
                <NodeLink nodeId={o.nodeId} onShowNode={onShowNode}>{o.label}</NodeLink>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {brief.goal && (
        <Section title="Goal" testId="brief-goal">
          <NodeLink nodeId={brief.goal.nodeId} onShowNode={onShowNode}>{brief.goal.label}</NodeLink>
          {brief.goal.targetText && (
            <>
              <span>: {brief.goal.targetText}</span>
              {brief.goal.targetSource && <SourcePill source={brief.goal.targetSource} />}
            </>
          )}
        </Section>
      )}

      {brief.limits.length > 0 && (
        <Section title="Limits" testId="brief-limits">
          <ul className="space-y-1">
            {brief.limits.map((l) => (
              <li key={l.id}>
                <NodeLink nodeId={l.nodeId} onShowNode={onShowNode}>{l.text}</NodeLink>
                <SourcePill source={l.source} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Latest Run" testId="brief-run">
        <p data-testid="brief-run-statement">{brief.run.statement}</p>
        {current && brief.chances.length > 0 && (
          <ul className="mt-2 space-y-1.5" data-testid="brief-chances">
            {brief.chances.map((c) => (
              <li key={c.optionId} data-option-id={c.optionId}>
                <NodeLink nodeId={c.optionId} onShowNode={onShowNode}>
                  <span className="font-medium">{c.optionLabel}</span>
                </NodeLink>
                <span>: {c.chanceText ?? c.withheldText}</span>
                {c.caveat && <span className="block text-xs text-text-light">{c.caveat}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {current && brief.drivers.length > 0 && (
        <Section title="What drives the result most" testId="brief-drivers">
          <ol className="list-decimal space-y-1 pl-5">
            {brief.drivers.map((d) => (
              <li key={d.nodeId}>
                <NodeLink nodeId={d.nodeId} onShowNode={onShowNode} testId="brief-driver">{d.label}</NodeLink>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {brief.figures.length > 0 && (
        <Section title="Figures the model uses" testId="brief-figures">
          <ul className="space-y-1">
            {brief.figures.map((f) => (
              <li key={f.nodeId}>
                <NodeLink nodeId={f.nodeId} onShowNode={onShowNode}>{f.label}</NodeLink>
                <span>: {f.valueText}</span>
                <SourcePill source={f.source} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {brief.withheld.length > 0 && (
        <Section title="Not shown, and what I need" testId="brief-withheld">
          <ul className="space-y-1.5">
            {brief.withheld.map((w) => (
              <li key={w.id}>
                <NodeLink nodeId={w.nodeId} onShowNode={onShowNode} testId="brief-withheld-item">{w.text}</NodeLink>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </article>
  )
}
