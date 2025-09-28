/**
 * Report Schema v1 with meta.seed for deterministic analysis
 * Contract wall compliance - PRD v15
 */

export interface ReportV1Meta {
  /** Deterministic seed for reproducible analysis (12-char hex) */
  seed: string;
  /** Report generation timestamp */
  timestamp: string;
  /** Analysis engine version */
  version: string;
  /** Type of analysis performed */
  analysisType: 'decision' | 'scenario' | 'impact' | 'risk';
  /** Optional session identifier */
  sessionId?: string;
  /** Optional user identifier */
  userId?: string;
}

export interface ReportV1Recommendation {
  /** Recommended action */
  action: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Supporting rationale */
  rationale?: string;
  /** Priority level */
  priority?: 'low' | 'medium' | 'high' | 'critical';
  /** Expected impact if implemented */
  expectedImpact?: string;
}

export interface ReportV1Factor {
  /** Factor name */
  name: string;
  /** Factor importance weight (0-1) */
  weight: number;
  /** Factor score (0-1) */
  score: number;
  /** Factor description */
  description?: string;
  /** Data sources used for this factor */
  sources?: string[];
}

export interface ReportV1Risk {
  /** Risk description */
  description: string;
  /** Probability of occurrence (0-1) */
  probability: number;
  /** Impact severity if occurs (0-1) */
  impact: number;
  /** Risk category */
  category?: 'financial' | 'operational' | 'strategic' | 'compliance' | 'technical';
  /** Mitigation strategies */
  mitigation?: string[];
}

export interface ReportV1Content {
  /** Report title (max 200 chars) */
  title: string;
  /** Executive summary (max 2000 chars) */
  summary: string;
  /** Analysis recommendations */
  recommendations?: ReportV1Recommendation[];
  /** Decision factors analysed */
  factors?: ReportV1Factor[];
  /** Identified risks */
  risks?: ReportV1Risk[];
  /** Additional analysis notes */
  notes?: string[];
  /** Data quality indicators */
  dataQuality?: {
    completeness: number; // 0-1
    accuracy: number;     // 0-1
    timeliness: number;   // 0-1
    sources: string[];
  };
}

/**
 * Main Report Schema v1
 */
export interface ReportV1 {
  /** Schema version identifier - MUST be "report.v1" */
  schema: 'report.v1';
  /** Report metadata with deterministic seed */
  meta: ReportV1Meta;
  /** Report content and analysis results */
  content: ReportV1Content;
}

/**
 * Report Validation Utilities
 */
export class ReportV1Validator {
  static isValidSeed(seed: string): boolean {
    return /^[a-f0-9]{12}$/.test(seed);
  }

  static isValidSchema(report: any): report is ReportV1 {
    return (
      report &&
      typeof report === 'object' &&
      report.schema === 'report.v1' &&
      this.isValidMeta(report.meta) &&
      this.isValidContent(report.content)
    );
  }

  static isValidMeta(meta: any): meta is ReportV1Meta {
    return (
      meta &&
      typeof meta === 'object' &&
      this.isValidSeed(meta.seed) &&
      typeof meta.timestamp === 'string' &&
      typeof meta.version === 'string' &&
      ['decision', 'scenario', 'impact', 'risk'].includes(meta.analysisType)
    );
  }

  static isValidContent(content: any): content is ReportV1Content {
    return (
      content &&
      typeof content === 'object' &&
      typeof content.title === 'string' &&
      content.title.length <= 200 &&
      typeof content.summary === 'string' &&
      content.summary.length <= 2000
    );
  }

  static validateRecommendation(rec: any): rec is ReportV1Recommendation {
    return (
      rec &&
      typeof rec === 'object' &&
      typeof rec.action === 'string' &&
      typeof rec.confidence === 'number' &&
      rec.confidence >= 0 &&
      rec.confidence <= 1
    );
  }

  static validateFactor(factor: any): factor is ReportV1Factor {
    return (
      factor &&
      typeof factor === 'object' &&
      typeof factor.name === 'string' &&
      typeof factor.weight === 'number' &&
      factor.weight >= 0 &&
      factor.weight <= 1 &&
      typeof factor.score === 'number' &&
      factor.score >= 0 &&
      factor.score <= 1
    );
  }

  static validateRisk(risk: any): risk is ReportV1Risk {
    return (
      risk &&
      typeof risk === 'object' &&
      typeof risk.description === 'string' &&
      typeof risk.probability === 'number' &&
      risk.probability >= 0 &&
      risk.probability <= 1 &&
      typeof risk.impact === 'number' &&
      risk.impact >= 0 &&
      risk.impact <= 1
    );
  }

  static getValidationErrors(report: any): string[] {
    const errors: string[] = [];

    if (!report || typeof report !== 'object') {
      return ['Report must be a valid object'];
    }

    if (report.schema !== 'report.v1') {
      errors.push('schema must be "report.v1"');
    }

    if (!this.isValidMeta(report.meta)) {
      if (!report.meta) {
        errors.push('meta is required');
      } else {
        if (!this.isValidSeed(report.meta.seed)) {
          errors.push('meta.seed must be a 12-character hexadecimal string');
        }
        if (!report.meta.timestamp) {
          errors.push('meta.timestamp is required');
        }
        if (!report.meta.version) {
          errors.push('meta.version is required');
        }
        if (!['decision', 'scenario', 'impact', 'risk'].includes(report.meta.analysisType)) {
          errors.push('meta.analysisType must be one of: decision, scenario, impact, risk');
        }
      }
    }

    if (!this.isValidContent(report.content)) {
      if (!report.content) {
        errors.push('content is required');
      } else {
        if (!report.content.title) {
          errors.push('content.title is required');
        } else if (report.content.title.length > 200) {
          errors.push('content.title must be 200 characters or fewer');
        }
        if (!report.content.summary) {
          errors.push('content.summary is required');
        } else if (report.content.summary.length > 2000) {
          errors.push('content.summary must be 2000 characters or fewer');
        }
      }
    }

    // Validate recommendations if present
    if (report.content?.recommendations) {
      if (!Array.isArray(report.content.recommendations)) {
        errors.push('content.recommendations must be an array');
      } else {
        report.content.recommendations.forEach((rec: any, index: number) => {
          if (!this.validateRecommendation(rec)) {
            errors.push(`content.recommendations[${index}] is invalid`);
          }
        });
      }
    }

    // Validate factors if present
    if (report.content?.factors) {
      if (!Array.isArray(report.content.factors)) {
        errors.push('content.factors must be an array');
      } else {
        report.content.factors.forEach((factor: any, index: number) => {
          if (!this.validateFactor(factor)) {
            errors.push(`content.factors[${index}] is invalid`);
          }
        });
      }
    }

    // Validate risks if present
    if (report.content?.risks) {
      if (!Array.isArray(report.content.risks)) {
        errors.push('content.risks must be an array');
      } else {
        report.content.risks.forEach((risk: any, index: number) => {
          if (!this.validateRisk(risk)) {
            errors.push(`content.risks[${index}] is invalid`);
          }
        });
      }
    }

    return errors;
  }
}

/**
 * Report Factory
 */
export class ReportV1Factory {
  static generateSeed(): string {
    // Generate 12-character deterministic hex seed
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars[Math.floor(Math.random() * 16)];
    }
    return result;
  }

  static create(
    analysisType: ReportV1Meta['analysisType'],
    title: string,
    summary: string,
    version: string = '1.0.0'
  ): ReportV1 {
    return {
      schema: 'report.v1',
      meta: {
        seed: this.generateSeed(),
        timestamp: new Date().toISOString(),
        version,
        analysisType
      },
      content: {
        title,
        summary
      }
    };
  }

  static withSeed(
    seed: string,
    analysisType: ReportV1Meta['analysisType'],
    title: string,
    summary: string,
    version: string = '1.0.0'
  ): ReportV1 {
    if (!ReportV1Validator.isValidSeed(seed)) {
      throw new Error('Invalid seed format. Must be 12-character hexadecimal string.');
    }

    return {
      schema: 'report.v1',
      meta: {
        seed,
        timestamp: new Date().toISOString(),
        version,
        analysisType
      },
      content: {
        title,
        summary
      }
    };
  }
}