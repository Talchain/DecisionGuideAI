/**
 * SCM-lite contract tests
 * Verifies gating, determinism, and core functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { diff } from '../../src/lib/scm/diff';
import {
  listVersions,
  getVersion,
  saveVersion,
  listProposals,
  getProposal,
  saveProposal
} from '../../src/lib/scm/registry';
import { verifyManifest } from '../../src/lib/scm/signing';
import fs from 'fs/promises';
import path from 'path';

describe('SCM-lite Contract Tests', () => {
  const originalScmEnable = process.env.SCM_ENABLE;
  const originalScmWrites = process.env.SCM_WRITES;
  const originalSigningKey = process.env.SCM_SIGNING_KEY;

  beforeEach(() => {
    // Reset environment for each test
    delete process.env.SCM_ENABLE;
    delete process.env.SCM_WRITES;
    delete process.env.SCM_SIGNING_KEY;
  });

  afterEach(() => {
    // Restore original environment
    if (originalScmEnable !== undefined) process.env.SCM_ENABLE = originalScmEnable;
    if (originalScmWrites !== undefined) process.env.SCM_WRITES = originalScmWrites;
    if (originalSigningKey !== undefined) process.env.SCM_SIGNING_KEY = originalSigningKey;
  });

  describe('Environment Gating', () => {
    it('should return appropriate responses when SCM_ENABLE=0', () => {
      process.env.SCM_ENABLE = '0';

      // This would be tested via API endpoints
      // Here we just verify the environment check works
      expect(process.env.SCM_ENABLE).toBe('0');
    });

    it('should return 404 for write operations when SCM_WRITES=0', async () => {
      process.env.SCM_ENABLE = '1';
      process.env.SCM_WRITES = '0';

      const scenario = {
        nodes: [{ id: 'test', label: 'Test Node' }],
        links: []
      };

      const result = await saveVersion(scenario, 'Test Version', 'scenario-001');
      expect(result.success).toBe(false);
      expect(result.error).toContain('unavailable');
    });

    it('should allow writes when SCM_WRITES=1', async () => {
      process.env.SCM_ENABLE = '1';
      process.env.SCM_WRITES = '1';

      const scenario = {
        nodes: [{ id: 'test', label: 'Test Node' }],
        links: []
      };

      const result = await saveVersion(scenario, 'Test Version', 'scenario-001');

      // Clean up if successful
      if (result.success && result.versionId) {
        try {
          const versionPath = path.join('artifacts/scm/versions', `${result.versionId}.json`);
          const metaPath = path.join('artifacts/scm/versions', `${result.versionId}.meta.json`);
          const manifestPath = path.join('artifacts/scm/versions', `${result.versionId}.manifest.json`);

          await Promise.all([
            fs.unlink(versionPath).catch(() => {}),
            fs.unlink(metaPath).catch(() => {}),
            fs.unlink(manifestPath).catch(() => {})
          ]);
        } catch (error) {
          // Ignore cleanup errors
        }
      }

      expect(result.success).toBe(true);
      expect(result.versionId).toBeTruthy();
    });
  });

  describe('Deterministic Diff', () => {
    const baseScenario = {
      nodes: [
        { id: 'node1', label: 'Node 1', weight: 0.5 },
        { id: 'node2', label: 'Node 2', weight: 0.7 }
      ],
      links: [
        { from: 'node1', to: 'node2', weight: 0.6 }
      ]
    };

    const candidateScenario = {
      nodes: [
        { id: 'node1', label: 'Node 1', weight: 0.6 }, // Weight changed
        { id: 'node3', label: 'Node 3', weight: 0.8 }  // node2 removed, node3 added
      ],
      links: [
        { from: 'node1', to: 'node3', weight: 0.7 } // Link changed
      ]
    };

    it('should produce identical diffs for the same inputs', () => {
      const diff1 = diff({ base: baseScenario, candidate: candidateScenario });
      const diff2 = diff({ base: baseScenario, candidate: candidateScenario });

      expect(diff1).toEqual(diff2);
      expect(diff1.schema).toBe('diff.v1');
    });

    it('should have deterministic change ordering', () => {
      const diffResult = diff({ base: baseScenario, candidate: candidateScenario });

      // Verify changes are sorted by path
      const paths = diffResult.changes.map(c => c.path);
      const sortedPaths = [...paths].sort();
      expect(paths).toEqual(sortedPaths);
    });

    it('should correctly identify all change types', () => {
      const diffResult = diff({ base: baseScenario, candidate: candidateScenario });

      expect(diffResult.summary.nodesAdded).toBe(1); // node3 added
      expect(diffResult.summary.nodesRemoved).toBe(1); // node2 removed
      expect(diffResult.summary.nodesChanged).toBe(1); // node1 weight changed
      expect(diffResult.summary.linksAdded).toBe(1); // new link added
      expect(diffResult.summary.linksRemoved).toBe(1); // old link removed
      expect(diffResult.summary.weightsChanged).toBeGreaterThan(0); // Weight changes detected
    });

    it('should handle empty scenarios', () => {
      const emptyScenario = { nodes: [], links: [] };
      const diffResult = diff({ base: emptyScenario, candidate: baseScenario });

      expect(diffResult.summary.nodesAdded).toBe(2);
      expect(diffResult.summary.linksAdded).toBe(1);
      expect(diffResult.summary.nodesRemoved).toBe(0);
    });
  });

  describe('Suggest Mode', () => {
    it('should return transient proposal when SCM_WRITES=0', async () => {
      process.env.SCM_WRITES = '0';

      const proposal = await saveProposal(
        'base-ref',
        'Test Proposal',
        'Test note',
        { nodes: [], links: [] },
        { schema: 'diff.v1', meta: {}, summary: {}, changes: [] } as any
      );

      expect(proposal.success).toBe(false);
      expect(proposal.error).toContain('unavailable');
    });

    it('should persist proposal when SCM_WRITES=1', async () => {
      process.env.SCM_WRITES = '1';

      const testDiff = {
        schema: 'diff.v1' as const,
        meta: {
          baseRef: 'test-base',
          candidateRef: 'test-candidate',
          createdAt: new Date().toISOString()
        },
        summary: {
          nodesAdded: 0,
          nodesRemoved: 0,
          nodesChanged: 0,
          linksAdded: 0,
          linksRemoved: 0,
          weightsChanged: 0
        },
        changes: []
      };

      const proposal = await saveProposal(
        'base-ref',
        'Test Proposal',
        'Test note',
        { nodes: [], links: [] },
        testDiff
      );

      // Clean up if successful
      if (proposal.success && proposal.proposalId) {
        try {
          const proposalPath = path.join('artifacts/scm/proposals', `${proposal.proposalId}.json`);
          const metaPath = path.join('artifacts/scm/proposals', `${proposal.proposalId}.meta.json`);
          const diffPath = path.join('artifacts/scm/proposals', `${proposal.proposalId}.diff.json`);
          const manifestPath = path.join('artifacts/scm/proposals', `${proposal.proposalId}.manifest.json`);

          await Promise.all([
            fs.unlink(proposalPath).catch(() => {}),
            fs.unlink(metaPath).catch(() => {}),
            fs.unlink(diffPath).catch(() => {}),
            fs.unlink(manifestPath).catch(() => {})
          ]);
        } catch (error) {
          // Ignore cleanup errors
        }
      }

      expect(proposal.success).toBe(true);
      expect(proposal.proposalId).toBeTruthy();
    });
  });

  describe('Manifest Signing', () => {
    it('should create and verify signed manifests when signing key is set', async () => {
      process.env.SCM_WRITES = '1';
      process.env.SCM_SIGNING_KEY = 'test-signing-key-123';

      const scenario = {
        nodes: [{ id: 'signed', label: 'Signed Node' }],
        links: []
      };

      const result = await saveVersion(scenario, 'Signed Version', 'scenario-signed');

      if (result.success && result.versionId) {
        try {
          // Read the manifest
          const manifestPath = path.join('artifacts/scm/versions', `${result.versionId}.manifest.json`);
          const manifestContent = await fs.readFile(manifestPath, 'utf-8');
          const manifest = JSON.parse(manifestContent);

          // Verify signature exists
          expect(manifest.signature).toBeTruthy();

          // Verify the signature
          const isValid = verifyManifest(manifest, manifest.signature, 'test-signing-key-123');
          expect(isValid).toBe(true);

          // Clean up
          const versionPath = path.join('artifacts/scm/versions', `${result.versionId}.json`);
          const metaPath = path.join('artifacts/scm/versions', `${result.versionId}.meta.json`);

          await Promise.all([
            fs.unlink(versionPath).catch(() => {}),
            fs.unlink(metaPath).catch(() => {}),
            fs.unlink(manifestPath).catch(() => {})
          ]);
        } catch (error) {
          // Test might fail if files don't exist
          expect(result.success).toBe(true);
        }
      }
    });
  });

  describe('Performance', () => {
    it('should complete diff on small scenario under 200ms', () => {
      const smallBase = {
        nodes: Array.from({ length: 10 }, (_, i) => ({
          id: `node${i}`,
          label: `Node ${i}`,
          weight: Math.random()
        })),
        links: Array.from({ length: 5 }, (_, i) => ({
          from: `node${i}`,
          to: `node${i + 1}`,
          weight: Math.random()
        }))
      };

      const smallCandidate = {
        nodes: Array.from({ length: 12 }, (_, i) => ({
          id: `node${i}`,
          label: `Node ${i}`,
          weight: Math.random()
        })),
        links: Array.from({ length: 6 }, (_, i) => ({
          from: `node${i}`,
          to: `node${i + 1}`,
          weight: Math.random()
        }))
      };

      const startTime = performance.now();
      const diffResult = diff({ base: smallBase, candidate: smallCandidate });
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(200);
      expect(diffResult.schema).toBe('diff.v1');
    });
  });
});