/**
 * SCM-lite diff module
 * Provides deterministic diffing for scenario versions
 */

import * as crypto from 'crypto';

export interface DiffMeta {
  baseRef: string;
  candidateRef: string;
  createdAt: string;
}

export interface DiffSummary {
  nodesAdded: number;
  nodesRemoved: number;
  nodesChanged: number;
  linksAdded: number;
  linksRemoved: number;
  weightsChanged: number;
}

export interface DiffChange {
  path: string;
  before?: any;
  after?: any;
}

export interface DiffResult {
  schema: 'diff.v1';
  meta: DiffMeta;
  summary: DiffSummary;
  changes: DiffChange[];
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
  nodes?: ScenarioNode[];
  links?: ScenarioLink[];
  [key: string]: any;
}

/**
 * Generate a deterministic reference for a scenario
 */
function generateRef(scenario: any): string {
  const hash = crypto.createHash('sha256');
  const serialised = JSON.stringify(scenario, Object.keys(scenario).sort());
  hash.update(serialised);
  return hash.digest('hex').substring(0, 8);
}

/**
 * Create a stable path for sorting
 */
function createPath(type: string, id: string, field?: string): string {
  return field ? `${type}[${id}].${field}` : `${type}[${id}]`;
}

/**
 * Compare two values for equality
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

/**
 * Perform deterministic diff between two scenarios
 */
export function diff(options: {
  base: Scenario;
  candidate: Scenario;
}): DiffResult {
  const { base, candidate } = options;

  const changes: DiffChange[] = [];
  const summary: DiffSummary = {
    nodesAdded: 0,
    nodesRemoved: 0,
    nodesChanged: 0,
    linksAdded: 0,
    linksRemoved: 0,
    weightsChanged: 0
  };

  // Process nodes
  const baseNodes = new Map<string, ScenarioNode>();
  const candidateNodes = new Map<string, ScenarioNode>();

  (base.nodes || []).forEach(node => baseNodes.set(node.id, node));
  (candidate.nodes || []).forEach(node => candidateNodes.set(node.id, node));

  // Find removed nodes
  for (const [id, node] of Array.from(baseNodes)) {
    if (!candidateNodes.has(id)) {
      changes.push({
        path: createPath('node', id),
        before: node,
        after: undefined
      });
      summary.nodesRemoved++;
    }
  }

  // Find added and changed nodes
  for (const [id, node] of Array.from(candidateNodes)) {
    const baseNode = baseNodes.get(id);
    if (!baseNode) {
      changes.push({
        path: createPath('node', id),
        before: undefined,
        after: node
      });
      summary.nodesAdded++;
    } else if (!deepEqual(baseNode, node)) {
      // Check specific changes
      const nodeChanges: DiffChange[] = [];

      // Check weight changes
      if (baseNode.weight !== node.weight) {
        nodeChanges.push({
          path: createPath('node', id, 'weight'),
          before: baseNode.weight,
          after: node.weight
        });
        summary.weightsChanged++;
      }

      // Check other field changes
      const allKeys = new Set([...Object.keys(baseNode), ...Object.keys(node)]);
      for (const key of Array.from(allKeys)) {
        if (key === 'weight' || key === 'id') continue;
        if (!deepEqual(baseNode[key], node[key])) {
          nodeChanges.push({
            path: createPath('node', id, key),
            before: baseNode[key],
            after: node[key]
          });
        }
      }

      if (nodeChanges.length > 0) {
        changes.push(...nodeChanges);
        summary.nodesChanged++;
      }
    }
  }

  // Process links
  const linkKey = (link: ScenarioLink) => `${link.from}->${link.to}`;
  const baseLinks = new Map<string, ScenarioLink>();
  const candidateLinks = new Map<string, ScenarioLink>();

  (base.links || []).forEach(link => baseLinks.set(linkKey(link), link));
  (candidate.links || []).forEach(link => candidateLinks.set(linkKey(link), link));

  // Find removed links
  for (const [key, link] of Array.from(baseLinks)) {
    if (!candidateLinks.has(key)) {
      changes.push({
        path: `link[${key}]`,
        before: link,
        after: undefined
      });
      summary.linksRemoved++;
    }
  }

  // Find added and changed links
  for (const [key, link] of Array.from(candidateLinks)) {
    const baseLink = baseLinks.get(key);
    if (!baseLink) {
      changes.push({
        path: `link[${key}]`,
        before: undefined,
        after: link
      });
      summary.linksAdded++;
    } else if (!deepEqual(baseLink, link)) {
      // Check weight changes in links
      if (baseLink.weight !== link.weight) {
        changes.push({
          path: `link[${key}].weight`,
          before: baseLink.weight,
          after: link.weight
        });
        summary.weightsChanged++;
      }

      // Check other field changes
      const allKeys = new Set([...Object.keys(baseLink), ...Object.keys(link)]);
      for (const fieldKey of Array.from(allKeys)) {
        if (fieldKey === 'weight' || fieldKey === 'from' || fieldKey === 'to') continue;
        if (!deepEqual(baseLink[fieldKey], link[fieldKey])) {
          changes.push({
            path: `link[${key}].${fieldKey}`,
            before: baseLink[fieldKey],
            after: link[fieldKey]
          });
        }
      }
    }
  }

  // Sort changes for determinism
  changes.sort((a, b) => a.path.localeCompare(b.path));

  return {
    schema: 'diff.v1',
    meta: {
      baseRef: generateRef(base),
      candidateRef: generateRef(candidate),
      createdAt: new Date().toISOString()
    },
    summary,
    changes
  };
}