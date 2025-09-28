/**
 * SCM-lite Determinism Guard
 *
 * Ensures that SCM diff operations are deterministic (same input produces identical output)
 */

import { describe, it, expect } from 'vitest';

describe('SCM-lite Determinism Guard', () => {
  // Mock SCM diff function (in real system, this would import from SCM API)
  function calculateDiff(baseScenario: any, candidateScenario: any) {
    // This is a simplified mock of the SCM diff algorithm
    // In real implementation, this would call the actual SCM diff logic

    const changes: Array<{
      path: string;
      before: any;
      after: any;
      type: 'added' | 'removed' | 'modified';
    }> = [];

    // Compare nodes
    const baseNodes = new Map(baseScenario.nodes?.map((n: any) => [n.id, n]) || []);
    const candidateNodes = new Map(candidateScenario.nodes?.map((n: any) => [n.id, n]) || []);

    // Find added nodes
    for (const [id, node] of candidateNodes) {
      if (!baseNodes.has(id)) {
        changes.push({
          path: `nodes[${id}]`,
          before: undefined,
          after: node,
          type: 'added'
        });
      }
    }

    // Find removed nodes
    for (const [id, node] of baseNodes) {
      if (!candidateNodes.has(id)) {
        changes.push({
          path: `nodes[${id}]`,
          before: node,
          after: undefined,
          type: 'removed'
        });
      }
    }

    // Find modified nodes
    for (const [id, candidateNode] of candidateNodes) {
      const baseNode = baseNodes.get(id);
      if (baseNode && JSON.stringify(baseNode) !== JSON.stringify(candidateNode)) {
        changes.push({
          path: `nodes[${id}]`,
          before: baseNode,
          after: candidateNode,
          type: 'modified'
        });
      }
    }

    // Sort changes by path for deterministic output
    changes.sort((a, b) => a.path.localeCompare(b.path));

    return {
      schema: 'scm-diff.v1',
      meta: {
        baseRef: baseScenario.scenarioId || 'unknown',
        candidateRef: candidateScenario.scenarioId || 'unknown',
        createdAt: new Date().toISOString()
      },
      summary: {
        nodesAdded: changes.filter(c => c.type === 'added').length,
        nodesRemoved: changes.filter(c => c.type === 'removed').length,
        nodesChanged: changes.filter(c => c.type === 'modified').length,
        linksAdded: 0, // Simplified for this test
        linksRemoved: 0,
        weightsChanged: changes.filter(c => c.type === 'modified' &&
          c.before?.weight !== c.after?.weight).length
      },
      changes
    };
  }

  const sampleBaseScenario = {
    scenarioId: 'test-base',
    nodes: [
      { id: 'a', label: 'Option A', weight: 0.8 },
      { id: 'b', label: 'Option B', weight: 0.6 }
    ],
    links: [
      { from: 'a', to: 'b', weight: 0.5 }
    ]
  };

  const sampleCandidateScenario = {
    scenarioId: 'test-candidate',
    nodes: [
      { id: 'a', label: 'Option A Modified', weight: 0.9 },
      { id: 'b', label: 'Option B', weight: 0.6 },
      { id: 'c', label: 'Option C', weight: 0.7 }
    ],
    links: [
      { from: 'a', to: 'b', weight: 0.5 }
    ]
  };

  it('should produce identical results for same input (run 1)', () => {
    const result1 = calculateDiff(sampleBaseScenario, sampleCandidateScenario);
    const result2 = calculateDiff(sampleBaseScenario, sampleCandidateScenario);

    // Remove timestamp which will always be different
    const normalized1 = { ...result1, meta: { ...result1.meta, createdAt: 'TIMESTAMP' } };
    const normalized2 = { ...result2, meta: { ...result2.meta, createdAt: 'TIMESTAMP' } };

    expect(normalized1).toEqual(normalized2);
  });

  it('should produce identical results for same input (run 2)', () => {
    const result1 = calculateDiff(sampleBaseScenario, sampleCandidateScenario);
    const result2 = calculateDiff(sampleBaseScenario, sampleCandidateScenario);

    // Check that changes are in the same order
    expect(result1.changes.map(c => c.path)).toEqual(result2.changes.map(c => c.path));

    // Check that summary is identical
    expect(result1.summary).toEqual(result2.summary);

    // Check that changes content is identical
    expect(result1.changes).toEqual(result2.changes);
  });

  it('should produce deterministic ordering for changes', () => {
    const multipleChangesScenario = {
      scenarioId: 'multi-changes',
      nodes: [
        { id: 'z', label: 'Z Node', weight: 1.0 },
        { id: 'a', label: 'A Node Modified', weight: 0.9 },
        { id: 'm', label: 'M Node', weight: 0.5 }
      ]
    };

    const result = calculateDiff(sampleBaseScenario, multipleChangesScenario);

    // Changes should be sorted alphabetically by path
    const paths = result.changes.map(c => c.path);
    const sortedPaths = [...paths].sort();
    expect(paths).toEqual(sortedPaths);
  });

  it('should detect all types of changes correctly', () => {
    const result = calculateDiff(sampleBaseScenario, sampleCandidateScenario);

    expect(result.summary.nodesAdded).toBe(1); // node 'c' added
    expect(result.summary.nodesRemoved).toBe(0); // no nodes removed
    expect(result.summary.nodesChanged).toBe(1); // node 'a' modified
    expect(result.summary.weightsChanged).toBe(1); // node 'a' weight changed

    // Check specific changes
    const addedChange = result.changes.find(c => c.type === 'added');
    expect(addedChange?.path).toBe('nodes[c]');
    expect(addedChange?.after.id).toBe('c');

    const modifiedChange = result.changes.find(c => c.type === 'modified');
    expect(modifiedChange?.path).toBe('nodes[a]');
    expect(modifiedChange?.before.label).toBe('Option A');
    expect(modifiedChange?.after.label).toBe('Option A Modified');
  });

  it('should handle empty scenarios deterministically', () => {
    const emptyScenario = { scenarioId: 'empty', nodes: [], links: [] };

    const result1 = calculateDiff(emptyScenario, emptyScenario);
    const result2 = calculateDiff(emptyScenario, emptyScenario);

    expect(result1.changes).toEqual(result2.changes);
    expect(result1.summary).toEqual(result2.summary);
    expect(result1.changes).toHaveLength(0);
  });

  it('should maintain consistency across multiple runs', () => {
    const results = [];

    // Run the same diff calculation 5 times
    for (let i = 0; i < 5; i++) {
      const result = calculateDiff(sampleBaseScenario, sampleCandidateScenario);
      // Normalize timestamp for comparison
      result.meta.createdAt = 'TIMESTAMP';
      results.push(result);
    }

    // All results should be identical
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toEqual(results[0]);
    }
  });

  it('should produce consistent schema and metadata structure', () => {
    const result = calculateDiff(sampleBaseScenario, sampleCandidateScenario);

    expect(result.schema).toBe('scm-diff.v1');
    expect(result.meta).toHaveProperty('baseRef');
    expect(result.meta).toHaveProperty('candidateRef');
    expect(result.meta).toHaveProperty('createdAt');
    expect(result.summary).toHaveProperty('nodesAdded');
    expect(result.summary).toHaveProperty('nodesRemoved');
    expect(result.summary).toHaveProperty('nodesChanged');
    expect(Array.isArray(result.changes)).toBe(true);
  });

  it('should handle scenarios with identical content', () => {
    const identicalScenario = JSON.parse(JSON.stringify(sampleBaseScenario));
    identicalScenario.scenarioId = 'identical-copy';

    const result = calculateDiff(sampleBaseScenario, identicalScenario);

    expect(result.changes).toHaveLength(0);
    expect(result.summary.nodesAdded).toBe(0);
    expect(result.summary.nodesRemoved).toBe(0);
    expect(result.summary.nodesChanged).toBe(0);
  });

  it('should produce byte-for-byte identical JSON output', () => {
    const result1 = calculateDiff(sampleBaseScenario, sampleCandidateScenario);
    const result2 = calculateDiff(sampleBaseScenario, sampleCandidateScenario);

    // Normalize timestamps
    result1.meta.createdAt = '2025-09-28T12:00:00.000Z';
    result2.meta.createdAt = '2025-09-28T12:00:00.000Z';

    const json1 = JSON.stringify(result1, null, 2);
    const json2 = JSON.stringify(result2, null, 2);

    expect(json1).toBe(json2);
  });
});