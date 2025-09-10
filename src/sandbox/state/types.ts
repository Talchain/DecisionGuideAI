// Canonical graph typing for Scenario Sandbox
export enum NodeType {
  Decision = 'decision',
  Option = 'option',
  Assumption = 'assumption',
  Problem = 'problem',
  Action = 'action',
}

export enum EdgeType {
  DecisionHasOption = 'DECISION_HAS_OPTION',
  AssumptionAppliesToDecision = 'ASSUMPTION→DECISION',
  AssumptionAppliesToOption = 'ASSUMPTION→OPTION',
  OptionAddressesProblem = 'OPTION→PROBLEM',
  OptionImpliesAction = 'OPTION→ACTION',
}
