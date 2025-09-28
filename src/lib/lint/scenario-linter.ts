/**
 * Scenario Linter and Advisor
 * Deterministic checks for common scenario issues with actionable advice
 */

export interface LintIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  advice: string;
  path?: string;
  context?: any;
}

export interface LintResult {
  schema: 'lint.v1';
  timestamp: string;
  scenario: {
    id?: string;
    nodeCount: number;
    linkCount: number;
  };
  summary: {
    errors: number;
    warnings: number;
    info: number;
    score: number; // 0-100
  };
  issues: LintIssue[];
}

interface ScenarioNode {
  id: string;
  label?: string;
  weight?: number;
  [key: string]: any;
}

interface ScenarioLink {
  from: string;
  to: string;
  weight?: number;
  [key: string]: any;
}

interface Scenario {
  id?: string;
  nodes?: ScenarioNode[];
  links?: ScenarioLink[];
  [key: string]: any;
}

/**
 * Main linting function
 */
export function lintScenario(scenario: Scenario): LintResult {
  const issues: LintIssue[] = [];
  const nodes = scenario.nodes || [];
  const links = scenario.links || [];

  // Basic structure checks
  checkBasicStructure(scenario, nodes, links, issues);

  // Node-specific checks
  checkNodes(nodes, issues);

  // Link-specific checks
  checkLinks(nodes, links, issues);

  // Topology checks
  checkTopology(nodes, links, issues);

  // Weight consistency checks
  checkWeightConsistency(nodes, links, issues);

  // Performance and complexity checks
  checkComplexity(nodes, links, issues);

  // Calculate summary
  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const info = issues.filter(i => i.severity === 'info').length;

  // Calculate score (100 - penalty points)
  let score = 100;
  score -= errors * 20; // Errors are serious
  score -= warnings * 5; // Warnings are moderate
  score -= info * 1; // Info items are minor
  score = Math.max(0, Math.min(100, score));

  return {
    schema: 'lint.v1',
    timestamp: new Date().toISOString(),
    scenario: {
      id: scenario.id,
      nodeCount: nodes.length,
      linkCount: links.length
    },
    summary: {
      errors,
      warnings,
      info,
      score: Math.round(score)
    },
    issues: issues.sort((a, b) => {
      // Sort by severity (errors first), then by code
      const severityOrder = { error: 0, warning: 1, info: 2 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      return severityDiff !== 0 ? severityDiff : a.code.localeCompare(b.code);
    })
  };
}

/**
 * Check basic scenario structure
 */
function checkBasicStructure(scenario: Scenario, nodes: ScenarioNode[], links: ScenarioLink[], issues: LintIssue[]) {
  // Empty scenario
  if (nodes.length === 0) {
    issues.push({
      severity: 'error',
      code: 'EMPTY_SCENARIO',
      message: 'Scenario contains no nodes',
      advice: 'Add at least one decision node to define what needs to be decided.'
    });
    return;
  }

  // Single node scenario
  if (nodes.length === 1) {
    issues.push({
      severity: 'warning',
      code: 'SINGLE_NODE',
      message: 'Scenario contains only one node',
      advice: 'Add additional nodes to represent factors, constraints, or outcomes that influence the decision.'
    });
  }

  // No links
  if (links.length === 0 && nodes.length > 1) {
    issues.push({
      severity: 'warning',
      code: 'NO_LINKS',
      message: 'Scenario has multiple nodes but no links',
      advice: 'Add links between nodes to show relationships and dependencies.'
    });
  }

  // Missing scenario ID
  if (!scenario.id) {
    issues.push({
      severity: 'info',
      code: 'MISSING_ID',
      message: 'Scenario has no ID',
      advice: 'Add a unique ID to help track and reference this scenario.'
    });
  }
}

/**
 * Check node-specific issues
 */
function checkNodes(nodes: ScenarioNode[], issues: LintIssue[]) {
  const nodeIds = new Set<string>();
  let unlabelledCount = 0;
  let invalidWeightCount = 0;

  for (const node of nodes) {
    const path = `node[${node.id}]`;

    // Duplicate IDs
    if (nodeIds.has(node.id)) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_NODE_ID',
        message: `Node ID '${node.id}' is used multiple times`,
        advice: 'Ensure each node has a unique ID to avoid conflicts.',
        path: path
      });
    }
    nodeIds.add(node.id);

    // Empty or missing ID
    if (!node.id || node.id.trim() === '') {
      issues.push({
        severity: 'error',
        code: 'EMPTY_NODE_ID',
        message: 'Node has empty or missing ID',
        advice: 'Give each node a meaningful, unique identifier.',
        path: path
      });
    }

    // Missing label
    if (!node.label || node.label.trim() === '') {
      unlabelledCount++;
      issues.push({
        severity: 'warning',
        code: 'MISSING_LABEL',
        message: `Node '${node.id}' has no label`,
        advice: 'Add a descriptive label to help users understand what this node represents.',
        path: path
      });
    }

    // Invalid weight
    if (node.weight !== undefined) {
      if (typeof node.weight !== 'number' || isNaN(node.weight)) {
        invalidWeightCount++;
        issues.push({
          severity: 'error',
          code: 'INVALID_WEIGHT',
          message: `Node '${node.id}' has invalid weight: ${node.weight}`,
          advice: 'Weights must be numeric values, typically between 0 and 1.',
          path: `${path}.weight`
        });
      } else if (node.weight < 0 || node.weight > 1) {
        issues.push({
          severity: 'warning',
          code: 'WEIGHT_OUT_OF_RANGE',
          message: `Node '${node.id}' weight ${node.weight} is outside typical range [0,1]`,
          advice: 'Consider normalising weights to the 0-1 range for consistency.',
          path: `${path}.weight`,
          context: { weight: node.weight }
        });
      }
    }
  }

  // Summary checks
  if (unlabelledCount > nodes.length * 0.5) {
    issues.push({
      severity: 'warning',
      code: 'MANY_UNLABELLED',
      message: `${unlabelledCount} of ${nodes.length} nodes lack labels`,
      advice: 'Add labels to improve scenario readability and user experience.'
    });
  }

  if (nodes.length > 50) {
    issues.push({
      severity: 'warning',
      code: 'LARGE_SCENARIO',
      message: `Scenario has ${nodes.length} nodes, which may be complex to analyse`,
      advice: 'Consider breaking down large scenarios into smaller, focused decision trees.'
    });
  }
}

/**
 * Check link-specific issues
 */
function checkLinks(nodes: ScenarioNode[], links: ScenarioLink[], issues: LintIssue[]) {
  const nodeIds = new Set(nodes.map(n => n.id));
  const linkKeys = new Set<string>();

  for (const link of links) {
    const linkKey = `${link.from}->${link.to}`;
    const path = `link[${linkKey}]`;

    // Duplicate links
    if (linkKeys.has(linkKey)) {
      issues.push({
        severity: 'warning',
        code: 'DUPLICATE_LINK',
        message: `Duplicate link from '${link.from}' to '${link.to}'`,
        advice: 'Remove duplicate links or combine their weights if representing multiple relationships.',
        path: path
      });
    }
    linkKeys.add(linkKey);

    // Missing from/to
    if (!link.from || !link.to) {
      issues.push({
        severity: 'error',
        code: 'INCOMPLETE_LINK',
        message: 'Link is missing from or to node reference',
        advice: 'Ensure all links specify both source (from) and target (to) nodes.',
        path: path
      });
      continue;
    }

    // Invalid node references
    if (!nodeIds.has(link.from)) {
      issues.push({
        severity: 'error',
        code: 'INVALID_FROM_NODE',
        message: `Link references non-existent node '${link.from}'`,
        advice: 'Ensure the source node exists or correct the node reference.',
        path: `${path}.from`
      });
    }

    if (!nodeIds.has(link.to)) {
      issues.push({
        severity: 'error',
        code: 'INVALID_TO_NODE',
        message: `Link references non-existent node '${link.to}'`,
        advice: 'Ensure the target node exists or correct the node reference.',
        path: `${path}.to`
      });
    }

    // Self-loops
    if (link.from === link.to) {
      issues.push({
        severity: 'warning',
        code: 'SELF_LOOP',
        message: `Node '${link.from}' links to itself`,
        advice: 'Self-loops may cause circular dependencies. Consider if this relationship is necessary.',
        path: path
      });
    }

    // Invalid weight
    if (link.weight !== undefined) {
      if (typeof link.weight !== 'number' || isNaN(link.weight)) {
        issues.push({
          severity: 'error',
          code: 'INVALID_LINK_WEIGHT',
          message: `Link ${linkKey} has invalid weight: ${link.weight}`,
          advice: 'Link weights must be numeric values.',
          path: `${path}.weight`
        });
      } else if (link.weight < 0 || link.weight > 1) {
        issues.push({
          severity: 'info',
          code: 'LINK_WEIGHT_OUT_OF_RANGE',
          message: `Link ${linkKey} weight ${link.weight} is outside typical range [0,1]`,
          advice: 'Consider normalising link weights for consistency.',
          path: `${path}.weight`,
          context: { weight: link.weight }
        });
      }
    }
  }
}

/**
 * Check topology and structural issues
 */
function checkTopology(nodes: ScenarioNode[], links: ScenarioLink[], issues: LintIssue[]) {
  if (nodes.length === 0 || links.length === 0) return;

  const nodeIds = new Set(nodes.map(n => n.id));
  const validLinks = links.filter(l => nodeIds.has(l.from) && nodeIds.has(l.to));

  // Build adjacency lists
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  for (const node of nodes) {
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
  }

  for (const link of validLinks) {
    outgoing.get(link.from)?.push(link.to);
    incoming.get(link.to)?.push(link.from);
  }

  // Find isolated nodes
  const isolatedNodes = nodes.filter(node => {
    const hasOutgoing = (outgoing.get(node.id)?.length || 0) > 0;
    const hasIncoming = (incoming.get(node.id)?.length || 0) > 0;
    return !hasOutgoing && !hasIncoming;
  });

  for (const node of isolatedNodes) {
    issues.push({
      severity: 'warning',
      code: 'ISOLATED_NODE',
      message: `Node '${node.id}' has no connections`,
      advice: 'Connect isolated nodes to the decision network or remove them if not needed.',
      path: `node[${node.id}]`
    });
  }

  // Find nodes with no inputs (potential root nodes)
  const rootNodes = nodes.filter(node => (incoming.get(node.id)?.length || 0) === 0 && (outgoing.get(node.id)?.length || 0) > 0);

  if (rootNodes.length === 0 && nodes.length > 1) {
    issues.push({
      severity: 'warning',
      code: 'NO_ROOT_NODES',
      message: 'No clear starting points found in the scenario',
      advice: 'Identify root decision nodes or entry points to guide analysis.'
    });
  } else if (rootNodes.length > 3) {
    issues.push({
      severity: 'info',
      code: 'MANY_ROOT_NODES',
      message: `${rootNodes.length} potential root nodes found`,
      advice: 'Consider consolidating entry points for clearer decision flow.',
      context: { rootNodes: rootNodes.map(n => n.id) }
    });
  }

  // Find nodes with no outputs (potential leaf nodes)
  const leafNodes = nodes.filter(node => (outgoing.get(node.id)?.length || 0) === 0 && (incoming.get(node.id)?.length || 0) > 0);

  if (leafNodes.length === 0 && nodes.length > 1) {
    issues.push({
      severity: 'info',
      code: 'NO_LEAF_NODES',
      message: 'No clear outcome nodes found',
      advice: 'Consider adding outcome or result nodes to represent decision consequences.'
    });
  }

  // Check for potential cycles (basic detection)
  checkForCycles(outgoing, issues);
}

/**
 * Basic cycle detection using DFS
 */
function checkForCycles(outgoing: Map<string, string[]>, issues: LintIssue[]) {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(node: string, path: string[]): boolean {
    if (recursionStack.has(node)) {
      const cycleStart = path.indexOf(node);
      const cycle = path.slice(cycleStart).concat(node);
      issues.push({
        severity: 'warning',
        code: 'CIRCULAR_DEPENDENCY',
        message: `Circular dependency detected: ${cycle.join(' → ')}`,
        advice: 'Review the decision flow to eliminate circular references that may cause infinite loops.',
        context: { cycle }
      });
      return true;
    }

    if (visited.has(node)) {
      return false;
    }

    visited.add(node);
    recursionStack.add(node);

    const neighbors = outgoing.get(node) || [];
    for (const neighbor of neighbors) {
      if (dfs(neighbor, [...path, node])) {
        recursionStack.delete(node);
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  }

  for (const node of outgoing.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }
}

/**
 * Check weight consistency and patterns
 */
function checkWeightConsistency(nodes: ScenarioNode[], links: ScenarioLink[], issues: LintIssue[]) {
  // Check for nodes with weights that sum to unusual totals
  const nodeWeights = nodes.filter(n => n.weight !== undefined).map(n => n.weight!);
  const linkWeights = links.filter(l => l.weight !== undefined).map(l => l.weight!);

  if (nodeWeights.length > 0) {
    const nodeSum = nodeWeights.reduce((sum, w) => sum + w, 0);
    const avgNodeWeight = nodeSum / nodeWeights.length;

    if (avgNodeWeight < 0.1) {
      issues.push({
        severity: 'info',
        code: 'LOW_AVERAGE_WEIGHTS',
        message: `Average node weight is ${avgNodeWeight.toFixed(3)}, which is quite low`,
        advice: 'Consider if weights accurately reflect the relative importance of factors.'
      });
    }

    // Check for weight imbalance
    const maxWeight = Math.max(...nodeWeights);
    const minWeight = Math.min(...nodeWeights);
    if (maxWeight > 0 && (maxWeight / minWeight) > 10) {
      issues.push({
        severity: 'info',
        code: 'WEIGHT_IMBALANCE',
        message: `Large weight disparity: max ${maxWeight} vs min ${minWeight}`,
        advice: 'Review weight distribution to ensure fair representation of factor importance.'
      });
    }
  }

  // Check for missing weights where they might be expected
  const nodesWithoutWeights = nodes.filter(n => n.weight === undefined).length;
  if (nodesWithoutWeights > 0 && nodeWeights.length > 0) {
    issues.push({
      severity: 'info',
      code: 'MIXED_WEIGHT_USAGE',
      message: `${nodesWithoutWeights} nodes lack weights while ${nodeWeights.length} have them`,
      advice: 'Consider adding weights to all nodes for consistent analysis, or document why some nodes are unweighted.'
    });
  }
}

/**
 * Check scenario complexity and performance implications
 */
function checkComplexity(nodes: ScenarioNode[], links: ScenarioLink[], issues: LintIssue[]) {
  const nodeCount = nodes.length;
  const linkCount = links.length;

  // Density check
  const maxPossibleLinks = nodeCount * (nodeCount - 1);
  const density = maxPossibleLinks > 0 ? linkCount / maxPossibleLinks : 0;

  if (density > 0.8) {
    issues.push({
      severity: 'warning',
      code: 'VERY_DENSE_GRAPH',
      message: `Scenario is ${(density * 100).toFixed(1)}% connected (very dense)`,
      advice: 'Dense scenarios may be complex to understand and slow to process. Consider simplifying relationships.'
    });
  } else if (density < 0.1 && nodeCount > 5) {
    issues.push({
      severity: 'info',
      code: 'SPARSE_GRAPH',
      message: `Scenario is only ${(density * 100).toFixed(1)}% connected (sparse)`,
      advice: 'Sparse scenarios may lack important relationships. Consider if additional connections would improve the model.'
    });
  }

  // Complexity estimates
  if (nodeCount > 100) {
    issues.push({
      severity: 'warning',
      code: 'HIGH_COMPLEXITY',
      message: `Large scenario with ${nodeCount} nodes may impact performance`,
      advice: 'Consider breaking large scenarios into smaller modules or using hierarchical structures.'
    });
  }

  // Average connectivity
  if (nodeCount > 0) {
    const avgConnections = (linkCount * 2) / nodeCount; // Each link connects 2 nodes

    if (avgConnections > 10) {
      issues.push({
        severity: 'info',
        code: 'HIGH_CONNECTIVITY',
        message: `Average ${avgConnections.toFixed(1)} connections per node`,
        advice: 'High connectivity may indicate overly complex relationships. Consider grouping related factors.'
      });
    } else if (avgConnections < 1 && nodeCount > 2) {
      issues.push({
        severity: 'info',
        code: 'LOW_CONNECTIVITY',
        message: `Average ${avgConnections.toFixed(1)} connections per node`,
        advice: 'Low connectivity may indicate missing relationships between important factors.'
      });
    }
  }
}