/**
 * SCM-lite API handlers
 * Core logic for version control and diff functionality
 */

import { diff, DiffResult } from './diff.js';
import {
  listVersions,
  getVersion,
  saveVersion,
  listProposals,
  getProposal,
  saveProposal
} from './registry.js';

/**
 * Check if SCM is enabled
 */
function isScmEnabled(): boolean {
  return process.env.SCM_ENABLE === '1';
}

/**
 * Check if SCM writes are enabled
 */
function isWriteEnabled(): boolean {
  return process.env.SCM_WRITES === '1';
}

/**
 * Core SCM API logic that can be integrated with any framework
 */
export class ScmApi {
  /**
   * List all available versions
   */
  async listVersions(): Promise<{ success: boolean; data?: any; error?: string; status: number }> {
    if (!isScmEnabled()) {
      return {
        success: false,
        error: 'The requested resource could not be found.',
        status: 404
      };
    }

    try {
      const versions = await listVersions();
      return {
        success: true,
        data: {
          schema: 'versions.v1',
          versions
        },
        status: 200
      };
    } catch (error) {
      return {
        success: false,
        error: 'Unable to retrieve versions at this time.',
        status: 500
      };
    }
  }

  /**
   * Get a specific version
   */
  async getVersion(versionId: string): Promise<{ success: boolean; data?: any; error?: string; status: number }> {
    if (!isScmEnabled()) {
      return {
        success: false,
        error: 'The requested resource could not be found.',
        status: 404
      };
    }

    if (!versionId) {
      return {
        success: false,
        error: 'Version ID is required.',
        status: 400
      };
    }

    try {
      const version = await getVersion(versionId);

      if (!version) {
        return {
          success: false,
          error: 'The requested version could not be found.',
          status: 404
        };
      }

      return {
        success: true,
        data: {
          schema: 'version.v1',
          metadata: version.metadata,
          scenario: version.scenario
        },
        status: 200
      };
    } catch (error) {
      return {
        success: false,
        error: 'Unable to retrieve version at this time.',
        status: 500
      };
    }
  }

  /**
   * Calculate diff between scenarios
   */
  async calculateDiff(baseRef: string, candidate: any): Promise<{ success: boolean; data?: any; error?: string; status: number }> {
    if (!isScmEnabled()) {
      return {
        success: false,
        error: 'The requested resource could not be found.',
        status: 404
      };
    }

    if (!baseRef || !candidate) {
      return {
        success: false,
        error: 'Both baseRef and candidate are required.',
        status: 400
      };
    }

    try {
      // Get base scenario
      let baseScenario: any = null;

      const baseVersion = await getVersion(baseRef);
      if (baseVersion) {
        baseScenario = baseVersion.scenario;
      } else {
        return {
          success: false,
          error: 'Base reference could not be found.',
          status: 404
        };
      }

      // Get candidate scenario
      let candidateScenario: any = null;

      if (candidate.inlineScenario) {
        candidateScenario = candidate.inlineScenario;
      } else if (candidate.versionId) {
        const candidateVersion = await getVersion(candidate.versionId);
        if (candidateVersion) {
          candidateScenario = candidateVersion.scenario;
        }
      } else if (candidate.proposalId) {
        const candidateProposal = await getProposal(candidate.proposalId);
        if (candidateProposal) {
          candidateScenario = candidateProposal.scenario;
        }
      }

      if (!candidateScenario) {
        return {
          success: false,
          error: 'Invalid candidate specification.',
          status: 400
        };
      }

      // Calculate diff
      const diffResult = diff({
        base: baseScenario,
        candidate: candidateScenario
      });

      return {
        success: true,
        data: diffResult,
        status: 200
      };
    } catch (error) {
      return {
        success: false,
        error: 'Unable to calculate diff at this time.',
        status: 500
      };
    }
  }

  /**
   * Create a proposal
   */
  async createProposal(
    baseRef: string,
    title: string,
    note: string | undefined,
    candidateScenario: any
  ): Promise<{ success: boolean; data?: any; error?: string; status: number; headers?: Record<string, string> }> {
    if (!isScmEnabled()) {
      return {
        success: false,
        error: 'The requested resource could not be found.',
        status: 404
      };
    }

    if (!baseRef || !title || !candidateScenario) {
      return {
        success: false,
        error: 'baseRef, title, and candidateScenario are required.',
        status: 400
      };
    }

    try {
      // Get base scenario
      const baseVersion = await getVersion(baseRef);
      if (!baseVersion) {
        return {
          success: false,
          error: 'Base reference could not be found.',
          status: 404
        };
      }

      // Calculate diff
      const diffResult = diff({
        base: baseVersion.scenario,
        candidate: candidateScenario
      });

      // Create proposal response
      const proposalData = {
        id: `prop-${Date.now()}-transient`,
        baseRef,
        title,
        note,
        createdAt: new Date().toISOString()
      };

      const headers: Record<string, string> = {};

      // If writes are enabled, persist the proposal
      if (isWriteEnabled()) {
        const saveResult = await saveProposal(
          baseRef,
          title,
          note,
          candidateScenario,
          diffResult
        );

        if (saveResult.success && saveResult.proposalId) {
          proposalData.id = saveResult.proposalId;
        }
      } else {
        headers['X-Proposal-Transient'] = 'true';
      }

      return {
        success: true,
        data: {
          schema: 'proposal.v1',
          proposal: proposalData,
          diff: diffResult
        },
        headers,
        status: 200
      };
    } catch (error) {
      return {
        success: false,
        error: 'Unable to create proposal at this time.',
        status: 500
      };
    }
  }

  /**
   * Get a specific proposal
   */
  async getProposal(proposalId: string): Promise<{ success: boolean; data?: any; error?: string; status: number }> {
    if (!isScmEnabled()) {
      return {
        success: false,
        error: 'The requested resource could not be found.',
        status: 404
      };
    }

    if (!isWriteEnabled()) {
      return {
        success: false,
        error: 'Proposal persistence is currently unavailable.',
        status: 404
      };
    }

    if (!proposalId) {
      return {
        success: false,
        error: 'Proposal ID is required.',
        status: 400
      };
    }

    try {
      const proposal = await getProposal(proposalId);

      if (!proposal) {
        return {
          success: false,
          error: 'The requested proposal could not be found.',
          status: 404
        };
      }

      return {
        success: true,
        data: {
          schema: 'proposal.v1',
          proposal: proposal.metadata,
          diff: proposal.diff
        },
        status: 200
      };
    } catch (error) {
      return {
        success: false,
        error: 'Unable to retrieve proposal at this time.',
        status: 500
      };
    }
  }
}

export const scmApi = new ScmApi();