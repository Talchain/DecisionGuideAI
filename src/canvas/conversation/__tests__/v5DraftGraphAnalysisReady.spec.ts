import { describe, expect, it } from 'vitest'

import { attachAnalysisReadyToInlineDraftGraph } from '../useConversation'

describe('attachAnalysisReadyToInlineDraftGraph', () => {
  it('attaches response-level analysis_ready to an inline draft graph', () => {
    const draftGraph = {
      nodes: [{ id: 'goal_1' }, { id: 'opt_a' }],
      edges: [],
    }

    const responseAnalysisReady = {
      status: 'ready',
      goal_node_id: 'goal_1',
      options: [
        {
          option_id: 'opt_a',
          label: 'Option A',
          status: 'ready',
          interventions: {},
        },
      ],
    }

    const result = attachAnalysisReadyToInlineDraftGraph(draftGraph, { analysis_ready: responseAnalysisReady })

    expect(result).toMatchObject({
      nodes: draftGraph.nodes,
      edges: draftGraph.edges,
      analysis_ready: {
        status: 'ready',
        goal_node_id: 'goal_1',
        options: [
          {
            id: 'opt_a',
            option_id: 'opt_a',
            status: 'ready',
            interventions: {},
          },
        ],
      },
    })
  })

  it('preserves inline graph analysis_ready when already present', () => {
    const draftGraph = {
      nodes: [{ id: 'goal_1' }, { id: 'opt_inline' }],
      edges: [],
      analysis_ready: {
        status: 'ready',
        goal_node_id: 'goal_1',
        options: [
          {
            id: 'opt_inline',
            label: 'Inline option',
            status: 'ready',
            interventions: {},
          },
        ],
      },
    }

    const result = attachAnalysisReadyToInlineDraftGraph(draftGraph, {
      analysis_ready: {
        status: 'ready',
        goal_node_id: 'goal_1',
        options: [
          {
            option_id: 'opt_response',
            label: 'Response option',
            status: 'ready',
            interventions: {},
          },
        ],
      },
    })

    expect(result).toBe(draftGraph)
  })

  it('leaves the draft graph unchanged when response analysis_ready is invalid', () => {
    const draftGraph = {
      nodes: [{ id: 'goal_1' }, { id: 'opt_a' }],
      edges: [],
    }

    const result = attachAnalysisReadyToInlineDraftGraph(draftGraph, {
      analysis_ready: {
        goal_node_id: 'goal_1',
        options: [{ option_id: 'opt_a', label: 'Option A', interventions: {} }],
      },
    })

    expect(result).toBe(draftGraph)
    expect(result).not.toHaveProperty('analysis_ready')
  })
})
