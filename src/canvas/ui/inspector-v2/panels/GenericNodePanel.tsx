/**
 * GenericNodePanel — the InspectorRouter's real fallback (L-24).
 *
 * `resolvePanelType` returned `null` for any node type without a bespoke panel
 * — `action`, `constraint`, `ghost-option`, and anything a future producer
 * emits. The router then rendered NOTHING: the user selected an element on the
 * canvas and the inspector silently refused to appear, which is
 * indistinguishable from a broken click.
 *
 * This panel is deliberately modest. It shows what every node has — its
 * description and its connections — and says plainly that this element type has
 * no specialised editor yet. Selecting an element always produces a panel; a
 * panel that admits its own limits beats a panel that does not exist.
 */

import { memo, useMemo, useState } from 'react'

import { useCanvasStore } from '../../../store'
import type { NodeType } from '../../../domain/nodes'
import { typography } from '../../../../styles/typography'
import { useNodeMutations } from '../useInspectorMutations'
import { GROUP_LABELS, EMPTY_STATES, DESCRIPTION_PLACEHOLDERS, GENERIC_STRINGS } from '../inspectorStrings'
import { PanelGroup } from '../shared/PanelGroup'
import { ConnectionRow } from '../shared/ConnectionRow'
import { EmptyDescriptionPrompt } from '../shared/EmptyDescriptionPrompt'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import { resolveEdgeSignedStrengthDisplay } from '../../../domain/edgeValueProvenance'
import type { EdgeValueDisplay } from '../../../domain/edgeValueProvenance'
import type { InspectorPanelProps } from '../types'

export const GenericNodePanel = memo(function GenericNodePanel({
  nodeId,
  techMode,
  onNavigate,
}: InspectorPanelProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const node = nodeId ? nodes.find(n => n.id === nodeId) : undefined
  const mutations = useNodeMutations(nodeId ?? '')

  const [description, setDescription] = useState(String(node?.data?.description ?? ''))
  const [isEditingDescription, setIsEditingDescription] = useState(false)

  const connections = useMemo(() => {
    return edges
      .filter(e => e.source === nodeId || e.target === nodeId)
      .map(e => {
        const otherId = e.source === nodeId ? e.target : e.source
        const other = nodes.find(n => n.id === otherId)
        if (!other) return null
        return {
          edgeId: e.id,
          nodeId: otherId,
          nodeKind: (other.type || other.data?.kind || 'factor') as NodeType,
          label: String(other.data?.label ?? otherId),
          strength: resolveEdgeSignedStrengthDisplay(e.data as Record<string, unknown> | undefined),
        }
      })
      .filter(Boolean) as Array<{
        edgeId: string
        nodeId: string
        nodeKind: NodeType
        label: string
        strength: EdgeValueDisplay
      }>
  }, [edges, nodes, nodeId])

  if (!nodeId || !node) return null

  const rawKind = String(node.type || node.data?.kind || 'unknown')

  return (
    <div data-testid="inspector-generic-panel">
      <PanelGroup kind="context" label={GROUP_LABELS.context}>
        {description || isEditingDescription ? (
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={() => {
              mutations.setDescription(description)
              if (!description.trim()) setIsEditingDescription(false)
            }}
            autoFocus={isEditingDescription && !description}
            placeholder={DESCRIPTION_PLACEHOLDERS.decision}
            rows={2}
            maxLength={500}
            className={`${typography.panelBody} w-full border border-panel-border rounded-lg px-2.5 py-1.5 bg-panel resize-none`}
          />
        ) : (
          <EmptyDescriptionPrompt
            placeholder={DESCRIPTION_PLACEHOLDERS.decision}
            onStartEditing={() => setIsEditingDescription(true)}
          />
        )}

        <p className={`${typography.panelMeta} text-text-light mt-2`} data-testid="inspector-generic-note">
          {GENERIC_STRINGS.noSpecialisedEditor}
        </p>
      </PanelGroup>

      <PanelGroup kind="connections" label={GROUP_LABELS.connections}>
        {connections.map(conn => (
          <ConnectionRow
            key={conn.edgeId}
            nodeKind={conn.nodeKind}
            label={conn.label}
            strength={conn.strength}
            fullLabel
            techMode={techMode}
            onClick={() => onNavigate(conn.nodeId)}
          />
        ))}
        {connections.length === 0 && (
          <p className={`${typography.panelMeta} text-text-light`}>{EMPTY_STATES.noConnectionsFlat}</p>
        )}
      </PanelGroup>

      <TechnicalDisclosure visible={techMode}>
        <div>System: node type: {rawKind}</div>
      </TechnicalDisclosure>
    </div>
  )
})
