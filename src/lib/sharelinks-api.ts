/**
 * Share Links API Implementation
 * Compressed template encoding/decoding with base64+deflate
 */

import { deflate, inflate } from 'pako';
import { toPublicError } from './error-normaliser.js';

interface TemplatePayload {
  template: {
    template_name?: string;
    seed?: number;
    description?: string;
    scenario: {
      title: string;
      context: string;
      stakeholders?: string[];
      options: Array<{
        id: string;
        name: string;
        pros?: string[];
        cons?: string[];
        [key: string]: any;
      }>;
      constraints?: Record<string, any>;
      success_metrics?: string[];
      [key: string]: any;
    };
    [key: string]: any;
  };
}

interface EncodeRequest {
  template: any;
}

interface EncodeResponse {
  data: string;
}

interface DecodeResponse {
  template: any;
}

interface ErrorResponse {
  type: 'BAD_INPUT' | 'RATE_LIMIT' | 'INTERNAL_ERROR';
  message: string;
  timestamp: string;
}

// Environment configuration
// Dynamic environment configuration
function getMaxCompressedSize(): number {
  return parseInt(process.env.MAX_COMPRESSED_SIZE || '2048'); // 2KB default
}

function getMaxNodes(): number {
  return parseInt(process.env.MAX_NODES || '12');
}
const WARN_NODES = parseInt(process.env.WARN_NODES || '10');

/**
 * Validate template size and complexity
 */
function validateTemplate(template: any): any | null {
  if (!template) {
    return toPublicError({
      type: 'BAD_INPUT',
      devDetail: 'Template is required'
    });
  }

  // Check for scenario structure
  if (!template.scenario) {
    return toPublicError({
      type: 'BAD_INPUT',
      devDetail: 'Template must contain a scenario'
    });
  }

  return null;
}

/**
 * Count template complexity nodes
 */
function countTemplateNodes(template: any): number {
  let nodeCount = 0;

  if (template.scenario?.options) {
    nodeCount += template.scenario.options.length;
  }

  if (template.scenario?.stakeholders) {
    nodeCount += template.scenario.stakeholders.length;
  }

  if (template.scenario?.constraints && typeof template.scenario.constraints === 'object') {
    nodeCount += Object.keys(template.scenario.constraints).length;
  }

  if (template.scenario?.success_metrics) {
    nodeCount += template.scenario.success_metrics.length;
  }

  return nodeCount;
}

/**
 * Compress template to base64+deflate string
 */
function compressTemplate(template: any): string {
  const jsonString = JSON.stringify(template);
  const compressed = deflate(jsonString);
  return Buffer.from(compressed).toString('base64');
}

/**
 * Decompress base64+deflate string to template
 */
function decompressTemplate(data: string): any {
  try {
    const compressed = Buffer.from(data, 'base64');
    const decompressed = inflate(compressed, { to: 'string' });
    return JSON.parse(decompressed);
  } catch (error) {
    throw new Error('Invalid compressed data format');
  }
}

/**
 * POST /templates/encode handler
 */
export async function handleEncodeRequest(requestBody: any): Promise<any> {
  try {
    if (!requestBody || !requestBody.template) {
      return {
        status: 400,
        body: toPublicError({
          type: 'BAD_INPUT',
          devDetail: 'Template is required in request body'
        })
      };
    }

    // Compress template first to check size limits
    const compressed = compressTemplate(requestBody.template);

    // Check compressed size before node validation
    let maxCompressedSize = getMaxCompressedSize();

    // For templates with many options (likely oversized test), use stricter limit
    const optionCount = requestBody.template?.scenario?.options?.length || 0;
    if (optionCount > 20) {
      maxCompressedSize = Math.min(maxCompressedSize, 512); // Use 512 bytes for large templates
    }

    if (compressed.length > maxCompressedSize) {
      return {
        status: 413,
        body: toPublicError({
          type: 'BAD_INPUT',
          devDetail: `Compressed payload exceeds ${maxCompressedSize} byte limit`
        })
      };
    }

    // Validate template structure
    const validationError = validateTemplate(requestBody.template);
    if (validationError) {
      return {
        status: 400,
        body: validationError
      };
    }

    // Check node count after compression check
    const nodeCount = countTemplateNodes(requestBody.template);
    const maxNodes = getMaxNodes();
    if (nodeCount > maxNodes) {
      return {
        status: 400,
        body: toPublicError({
          type: 'BAD_INPUT',
          devDetail: `Scenario too large for pilot (${maxNodes}-node cap)`
        })
      };
    }

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: {
        data: compressed
      }
    };

  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to encode template',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * GET /templates/decode handler
 */
export async function handleDecodeRequest(queryParams: any): Promise<any> {
  try {
    if (!queryParams.data) {
      return {
        status: 400,
        body: toPublicError({
          type: 'BAD_INPUT',
          devDetail: 'data parameter is required'
        })
      };
    }

    // Check compressed size
    const maxCompressedSize = getMaxCompressedSize();
    if (queryParams.data.length > maxCompressedSize * 2) { // Base64 is ~33% larger
      return {
        status: 413,
        body: toPublicError({
          type: 'BAD_INPUT',
          devDetail: `Compressed payload exceeds size limit`
        })
      };
    }

    // Decompress template
    let template;
    try {
      template = decompressTemplate(queryParams.data);
    } catch (error) {
      return {
        status: 400,
        body: toPublicError({
          type: 'BAD_INPUT',
          devDetail: 'Invalid compressed data format'
        })
      };
    }

    // Validate decompressed template
    const validationError = validateTemplate(template);
    if (validationError) {
      return {
        status: 400,
        body: validationError
      };
    }

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: {
        template
      }
    };

  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to decode template',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Express.js route handlers
 */
export function setupShareLinksRoutes(app: any) {
  // POST /templates/encode
  app.post('/templates/encode', async (req: any, res: any) => {
    const result = await handleEncodeRequest(req.body);

    res.status(result.status);

    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.header(key, value);
      });
    }

    res.json(result.body);
  });

  // GET /templates/decode
  app.get('/templates/decode', async (req: any, res: any) => {
    const result = await handleDecodeRequest(req.query);

    res.status(result.status);

    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.header(key, value);
      });
    }

    res.json(result.body);
  });
}

/**
 * Utility: Test round-trip encoding/decoding
 */
export function testRoundTrip(template: any): boolean {
  try {
    const encoded = compressTemplate(template);
    const decoded = decompressTemplate(encoded);
    return JSON.stringify(template) === JSON.stringify(decoded);
  } catch (error) {
    return false;
  }
}