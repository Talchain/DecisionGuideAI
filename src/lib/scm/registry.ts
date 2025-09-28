/**
 * SCM-lite registry module
 * Filesystem helpers for managing versions and proposals
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

const SCM_BASE_PATH = 'artifacts/scm';
const VERSIONS_PATH = path.join(SCM_BASE_PATH, 'versions');
const PROPOSALS_PATH = path.join(SCM_BASE_PATH, 'proposals');
const DIFFS_PATH = path.join(SCM_BASE_PATH, 'diffs');

export interface VersionMetadata {
  id: string;
  label: string;
  scenarioId: string;
  createdAt: string;
  checksum: string;
  signer?: string;
}

export interface ProposalMetadata {
  id: string;
  baseRef: string;
  title: string;
  note?: string;
  createdAt: string;
}

export interface Manifest {
  sha256: string;
  createdAt: string;
  actor: string;
  scenarioId?: string;
  engineCodeHash?: string;
  signature?: string;
}

/**
 * Check if SCM writes are enabled
 */
function isWriteEnabled(): boolean {
  return process.env.SCM_WRITES === '1';
}

/**
 * Generate a deterministic ID
 */
function generateId(prefix: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Calculate SHA256 checksum
 */
function calculateChecksum(content: string | Buffer): string {
  const hash = crypto.createHash('sha256');
  hash.update(content);
  return hash.digest('hex');
}

/**
 * Ensure directory exists
 */
async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Directory may already exist
  }
}

/**
 * List all versions
 */
export async function listVersions(): Promise<VersionMetadata[]> {
  try {
    await ensureDirectory(VERSIONS_PATH);
    const entries = await fs.readdir(VERSIONS_PATH);
    const versions: VersionMetadata[] = [];

    for (const entry of entries) {
      if (entry.endsWith('.json') && !entry.includes('manifest')) {
        const versionPath = path.join(VERSIONS_PATH, entry);
        const metaPath = path.join(VERSIONS_PATH, entry.replace('.json', '.meta.json'));

        try {
          const metaContent = await fs.readFile(metaPath, 'utf-8');
          const metadata = JSON.parse(metaContent);
          versions.push(metadata);
        } catch (error) {
          // If metadata file doesn't exist, skip this version
          continue;
        }
      }
    }

    // Sort by creation date (newest first)
    versions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return versions;
  } catch (error) {
    return [];
  }
}

/**
 * Get a specific version
 */
export async function getVersion(versionId: string): Promise<{ metadata: VersionMetadata; scenario: any } | null> {
  try {
    const versionPath = path.join(VERSIONS_PATH, `${versionId}.json`);
    const metaPath = path.join(VERSIONS_PATH, `${versionId}.meta.json`);

    const [scenarioContent, metaContent] = await Promise.all([
      fs.readFile(versionPath, 'utf-8'),
      fs.readFile(metaPath, 'utf-8')
    ]);

    const scenario = JSON.parse(scenarioContent);
    const metadata = JSON.parse(metaContent);

    return { metadata, scenario };
  } catch (error) {
    return null;
  }
}

/**
 * Save a new version
 */
export async function saveVersion(scenario: any, label: string, scenarioId: string): Promise<{ success: boolean; versionId?: string; error?: string }> {
  if (!isWriteEnabled()) {
    return {
      success: false,
      error: 'Version persistence is currently unavailable. Please try again later.'
    };
  }

  try {
    await ensureDirectory(VERSIONS_PATH);

    const versionId = generateId('v');
    const versionPath = path.join(VERSIONS_PATH, `${versionId}.json`);
    const metaPath = path.join(VERSIONS_PATH, `${versionId}.meta.json`);
    const manifestPath = path.join(VERSIONS_PATH, `${versionId}.manifest.json`);

    const scenarioContent = JSON.stringify(scenario, null, 2);
    const checksum = calculateChecksum(scenarioContent);

    const metadata: VersionMetadata = {
      id: versionId,
      label,
      scenarioId,
      createdAt: new Date().toISOString(),
      checksum
    };

    const manifest: Manifest = {
      sha256: checksum,
      createdAt: metadata.createdAt,
      actor: 'system',
      scenarioId
    };

    // Add signature if signing key is available
    if (process.env.SCM_SIGNING_KEY) {
      const hmac = crypto.createHmac('sha256', process.env.SCM_SIGNING_KEY);
      hmac.update(JSON.stringify(manifest));
      manifest.signature = hmac.digest('hex');
      metadata.signer = 'system';
    }

    await Promise.all([
      fs.writeFile(versionPath, scenarioContent),
      fs.writeFile(metaPath, JSON.stringify(metadata, null, 2)),
      fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))
    ]);

    return { success: true, versionId };
  } catch (error) {
    return {
      success: false,
      error: 'Unable to save version at this time.'
    };
  }
}

/**
 * List all proposals
 */
export async function listProposals(): Promise<ProposalMetadata[]> {
  try {
    await ensureDirectory(PROPOSALS_PATH);
    const entries = await fs.readdir(PROPOSALS_PATH);
    const proposals: ProposalMetadata[] = [];

    for (const entry of entries) {
      if (entry.endsWith('.meta.json')) {
        const metaPath = path.join(PROPOSALS_PATH, entry);

        try {
          const metaContent = await fs.readFile(metaPath, 'utf-8');
          const metadata = JSON.parse(metaContent);
          proposals.push(metadata);
        } catch (error) {
          continue;
        }
      }
    }

    // Sort by creation date (newest first)
    proposals.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return proposals;
  } catch (error) {
    return [];
  }
}

/**
 * Get a specific proposal
 */
export async function getProposal(proposalId: string): Promise<{ metadata: ProposalMetadata; scenario: any; diff: any } | null> {
  if (!isWriteEnabled()) {
    return null;
  }

  try {
    const proposalPath = path.join(PROPOSALS_PATH, `${proposalId}.json`);
    const metaPath = path.join(PROPOSALS_PATH, `${proposalId}.meta.json`);
    const diffPath = path.join(PROPOSALS_PATH, `${proposalId}.diff.json`);

    const [scenarioContent, metaContent, diffContent] = await Promise.all([
      fs.readFile(proposalPath, 'utf-8'),
      fs.readFile(metaPath, 'utf-8'),
      fs.readFile(diffPath, 'utf-8')
    ]);

    const scenario = JSON.parse(scenarioContent);
    const metadata = JSON.parse(metaContent);
    const diff = JSON.parse(diffContent);

    return { metadata, scenario, diff };
  } catch (error) {
    return null;
  }
}

/**
 * Save a new proposal
 */
export async function saveProposal(
  baseRef: string,
  title: string,
  note: string | undefined,
  scenario: any,
  diff: any
): Promise<{ success: boolean; proposalId?: string; error?: string }> {
  if (!isWriteEnabled()) {
    return {
      success: false,
      error: 'Proposal persistence is currently unavailable.'
    };
  }

  try {
    await ensureDirectory(PROPOSALS_PATH);

    const proposalId = generateId('prop');
    const proposalPath = path.join(PROPOSALS_PATH, `${proposalId}.json`);
    const metaPath = path.join(PROPOSALS_PATH, `${proposalId}.meta.json`);
    const diffPath = path.join(PROPOSALS_PATH, `${proposalId}.diff.json`);
    const manifestPath = path.join(PROPOSALS_PATH, `${proposalId}.manifest.json`);

    const scenarioContent = JSON.stringify(scenario, null, 2);
    const checksum = calculateChecksum(scenarioContent);

    const metadata: ProposalMetadata = {
      id: proposalId,
      baseRef,
      title,
      note,
      createdAt: new Date().toISOString()
    };

    const manifest: Manifest = {
      sha256: checksum,
      createdAt: metadata.createdAt,
      actor: 'system'
    };

    // Add signature if signing key is available
    if (process.env.SCM_SIGNING_KEY) {
      const hmac = crypto.createHmac('sha256', process.env.SCM_SIGNING_KEY);
      hmac.update(JSON.stringify(manifest));
      manifest.signature = hmac.digest('hex');
    }

    await Promise.all([
      fs.writeFile(proposalPath, scenarioContent),
      fs.writeFile(metaPath, JSON.stringify(metadata, null, 2)),
      fs.writeFile(diffPath, JSON.stringify(diff, null, 2)),
      fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))
    ]);

    return { success: true, proposalId };
  } catch (error) {
    return {
      success: false,
      error: 'Unable to save proposal at this time.'
    };
  }
}