/**
 * Import Dry-Run API - DISABLED BY DEFAULT
 *
 * Flag: IMPORT_ENABLE=1 (default 0)
 * Read-only operations that convert external data sources into scenario shape
 * without persisting anything server-side.
 */

// Environment guard - disabled by default
export const IMPORT_ENABLED = process.env.IMPORT_ENABLE === '1';

if (!IMPORT_ENABLED) {
  console.debug('Import API disabled. Set IMPORT_ENABLE=1 to enable.');
}

import { applySecurityHeaders, validateRequestSecurity, logRequestSafely } from './security-headers.js';
import { ensureCorrelationId } from './correlation.js';

// Import dry-run schema v1
export interface ImportDryRunResponse {
  schema: 'import-dryrun.v1';
  summary: {
    nodes: number;
    links: number;
    warnings: string[];
    errors: string[];
  };
  scenarioPreview: {
    scenarioId: string;
    title: string;
    description: string;
    nodes: Array<{
      id: string;
      title: string;
      description?: string;
      weight?: number;
    }>;
    links: Array<{
      from: string;
      to: string;
      weight?: number;
      label?: string;
    }>;
  };
  mappingEcho: any;
}

// Mapping configuration interface
export interface FieldMapping {
  title?: string;
  description?: string;
  weight?: string;
  id?: string;
  links?: {
    from?: string;
    to?: string;
    weight?: string;
    label?: string;
  };
}

// CSV input interface
export interface CsvImportRequest {
  csv: string;
  mapping: FieldMapping;
}

// Google Sheets input interface (placeholder)
export interface GoogleSheetsImportRequest {
  googleSheet: {
    sheetId: string;
    range: string;
  };
  mapping: FieldMapping;
}

// Jira input interface (placeholder)
export interface JiraImportRequest {
  jira: {
    jql: string;
  };
  mapping: FieldMapping;
}

export type ImportRequest = CsvImportRequest | GoogleSheetsImportRequest | JiraImportRequest;

/**
 * Parse CSV string into rows
 */
function parseCSV(csvString: string): string[][] {
  const lines = csvString.trim().split('\n');
  const result: string[][] = [];

  for (const line of lines) {
    // Simple CSV parsing (handles basic cases)
    const row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"' && (i === 0 || line[i-1] === ',')) {
        inQuotes = true;
      } else if (char === '"' && inQuotes && (i === line.length - 1 || line[i+1] === ',')) {
        inQuotes = false;
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    row.push(current.trim());
    result.push(row);
  }

  return result;
}

/**
 * Process CSV import (dry-run only)
 */
function processCsvImport(request: CsvImportRequest): ImportDryRunResponse {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    const rows = parseCSV(request.csv);

    if (rows.length === 0) {
      errors.push('CSV is empty');
      return createErrorResponse(errors, request.mapping);
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Validate mapping fields exist in CSV
    const { title: titleField, description: descField, weight: weightField, id: idField } = request.mapping;

    if (titleField && !headers.includes(titleField)) {
      errors.push(`Title field '${titleField}' not found in CSV headers`);
    }

    if (descField && !headers.includes(descField)) {
      warnings.push(`Description field '${descField}' not found in CSV headers`);
    }

    if (weightField && !headers.includes(weightField)) {
      warnings.push(`Weight field '${weightField}' not found in CSV headers`);
    }

    if (errors.length > 0) {
      return createErrorResponse(errors, request.mapping);
    }

    // Create nodes from CSV data
    const nodes: any[] = [];
    const links: any[] = [];

    dataRows.forEach((row, index) => {
      const rowData: any = {};
      headers.forEach((header, headerIndex) => {
        rowData[header] = row[headerIndex] || '';
      });

      const nodeId = idField ? rowData[idField] : `node_${index + 1}`;
      const title = titleField ? rowData[titleField] : `Item ${index + 1}`;
      const description = descField ? rowData[descField] : undefined;
      let weight = undefined;

      if (weightField && rowData[weightField]) {
        const parsedWeight = parseFloat(rowData[weightField]);
        if (isNaN(parsedWeight)) {
          warnings.push(`Invalid weight value '${rowData[weightField]}' in row ${index + 1}, using default`);
          weight = 1.0;
        } else {
          weight = parsedWeight;
        }
      } else if (weightField) {
        warnings.push(`Missing weight value in row ${index + 1}, using default`);
        weight = 1.0;
      }

      nodes.push({
        id: nodeId,
        title,
        description,
        weight
      });
    });

    return {
      schema: 'import-dryrun.v1',
      summary: {
        nodes: nodes.length,
        links: links.length,
        warnings,
        errors: []
      },
      scenarioPreview: {
        scenarioId: `csv_import_${Date.now()}`,
        title: 'CSV Import Preview',
        description: `Imported ${nodes.length} items from CSV`,
        nodes,
        links
      },
      mappingEcho: request.mapping
    };

  } catch (error) {
    errors.push(`CSV parsing failed: ${error.message}`);
    return createErrorResponse(errors, request.mapping);
  }
}

/**
 * Process Google Sheets import (placeholder - dry-run only)
 */
function processGoogleSheetsImport(request: GoogleSheetsImportRequest): ImportDryRunResponse {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Placeholder implementation
  warnings.push('Google Sheets integration not yet implemented');

  return {
    schema: 'import-dryrun.v1',
    summary: {
      nodes: 0,
      links: 0,
      warnings,
      errors
    },
    scenarioPreview: {
      scenarioId: `sheets_import_${Date.now()}`,
      title: 'Google Sheets Import Preview',
      description: `Sheets ID: ${request.googleSheet.sheetId}, Range: ${request.googleSheet.range}`,
      nodes: [],
      links: []
    },
    mappingEcho: request.mapping
  };
}

/**
 * Process Jira import (placeholder - dry-run only)
 */
function processJiraImport(request: JiraImportRequest): ImportDryRunResponse {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Placeholder implementation
  warnings.push('Jira integration not yet implemented');

  return {
    schema: 'import-dryrun.v1',
    summary: {
      nodes: 0,
      links: 0,
      warnings,
      errors
    },
    scenarioPreview: {
      scenarioId: `jira_import_${Date.now()}`,
      title: 'Jira Import Preview',
      description: `JQL: ${request.jira.jql}`,
      nodes: [],
      links: []
    },
    mappingEcho: request.mapping
  };
}

/**
 * Create error response
 */
function createErrorResponse(errors: string[], mapping: any): ImportDryRunResponse {
  return {
    schema: 'import-dryrun.v1',
    summary: {
      nodes: 0,
      links: 0,
      warnings: [],
      errors
    },
    scenarioPreview: {
      scenarioId: 'error',
      title: 'Import Error',
      description: 'Import failed due to validation errors',
      nodes: [],
      links: []
    },
    mappingEcho: mapping
  };
}

/**
 * Main import dry-run handler
 */
export async function handleImportDryRun(request: any): Promise<ImportDryRunResponse> {
  if (!IMPORT_ENABLED) {
    throw new Error('Import functionality is disabled. Set IMPORT_ENABLE=1 to enable.');
  }

  // Validate request structure
  if (!request) {
    throw new Error('Request body is required');
  }

  // Determine import type and process
  if ('csv' in request) {
    return processCsvImport(request as CsvImportRequest);
  } else if ('googleSheet' in request) {
    return processGoogleSheetsImport(request as GoogleSheetsImportRequest);
  } else if ('jira' in request) {
    return processJiraImport(request as JiraImportRequest);
  } else {
    throw new Error('Invalid request: must contain csv, googleSheet, or jira configuration');
  }
}

/**
 * Validate import request
 */
export function validateImportRequest(request: any): string[] {
  const errors: string[] = [];

  if (!request) {
    errors.push('Request body is required');
    return errors;
  }

  // Check for required mapping
  if (!request.mapping) {
    errors.push('Mapping configuration is required');
    return errors;
  }

  // Validate specific import types
  if ('csv' in request) {
    if (!request.csv || typeof request.csv !== 'string') {
      errors.push('CSV data must be a non-empty string');
    }
    if (!request.mapping.title) {
      errors.push('Mapping must specify a title field for CSV import');
    }
  } else if ('googleSheet' in request) {
    if (!request.googleSheet?.sheetId) {
      errors.push('Google Sheets import requires sheetId');
    }
    if (!request.googleSheet?.range) {
      errors.push('Google Sheets import requires range');
    }
  } else if ('jira' in request) {
    if (!request.jira?.jql) {
      errors.push('Jira import requires JQL query');
    }
  } else {
    errors.push('Request must contain csv, googleSheet, or jira configuration');
  }

  return errors;
}