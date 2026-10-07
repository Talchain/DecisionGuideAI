/**
 * ⚠ THE CONTRACT'S OWN EXAMPLE, NOT A CAPTURE. Written from the ruled `action_bar`
 * v1 contract (lane file, 7 Oct 2026) so the reader and the renderer can be built
 * before CEE emits. It is evidence about THIS reader's rules, never about what
 * CEE sends: the rows that bind to the wire use the bars CEE captured from its
 * own route test (see `actionBarContract.spec.ts`).
 */
export const REVISION = { graph_hash: '5fd5cde8737f85c9', run_key: 'run_0001' } as const

const offer = (o: Record<string, unknown>) => ({ enabled: true, why_now: 'Why this is worth doing now.', ...o })

export const SET_TARGET = offer({
  action_id: 'set_target', label: 'Set target', icon: 'Target', group: 'gap', press_id: 'act:set_target',
  user_line: 'Help me set a target for this goal.', why_now: 'The goal has no target, so no chance can be worked out.',
  target: { kind: 'goal', id: 'goal_1' }, offer_key: 'aaaaaaaaaaaaaaa1',
})
export const MORE_OPTIONS = offer({
  action_id: 'more_options', label: 'More options', icon: 'GitFork', group: 'gap', press_id: 'agent-next-widen',
  user_line: 'What options have we not compared yet?', why_now: 'Only two options are being compared.', offer_key: 'aaaaaaaaaaaaaaa2',
})
export const REVIEW = offer({
  action_id: 'review', label: 'Review', icon: 'ListChecks', group: 'review', press_id: 'agent-next-review-decision',
  user_line: 'Review this decision.', why_now: 'Check what to confirm before relying on this analysis.', offer_key: 'bbbbbbbbbbbbbbb1',
})
export const WHAT_CHANGES = offer({
  action_id: 'what_changes', label: 'What changes', icon: 'SlidersHorizontal', group: 'method', press_id: 'agent-next-what-would-change',
  user_line: 'What would most likely change this result?', enabled: false, why_now: undefined,
  disabled_reason: 'Run the analysis first: there is no result to test yet.', offer_key: 'bbbbbbbbbbbbbbb2',
})
export const STRENGTHEN = offer({
  action_id: 'strengthen', label: 'Strengthen', icon: 'ShieldCheck', group: 'review', press_id: 'agent-next-strengthen',
  user_line: 'What would most strengthen this model?', why_now: 'One link on the goal path is still Olumi’s estimate.', offer_key: 'bbbbbbbbbbbbbbb3',
})
export const PRE_MORTEM = offer({
  action_id: 'pre_mortem', label: 'Pre-mortem', icon: 'ClipboardList', group: 'method', press_id: 'agent-next-pre-mortem',
  user_line: 'Run a pre-mortem with me.', why_now: 'Stress-test the options before committing.',
  protocol: { id: 'DSK-P-001', version: 'v1' }, offer_key: 'bbbbbbbbbbbbbbb4',
})
export const TEST_LINK = offer({
  action_id: 'test_link', label: 'Test link', icon: 'Unlink', group: 'method', press_id: 'agent-test-without-link:["f1","g1"]',
  user_line: 'What happens without this link?', why_now: 'This link moves the result the most.',
  target: { kind: 'link', from_id: 'f1', to_id: 'g1' }, offer_key: 'ccccccccccccccc1',
})

export const EXAMPLE_BAR = {
  v: 1, state_key: '0123456789abcdef', revision: REVISION,
  priority: [SET_TARGET, MORE_OPTIONS], standard: [REVIEW, WHAT_CHANGES, STRENGTHEN, PRE_MORTEM], more: [TEST_LINK],
} as const
