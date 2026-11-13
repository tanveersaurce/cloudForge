export type ValidationSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type ValidationCategory =
  | 'structural'
  | 'network'
  | 'security'
  | 'compute'
  | 'database'
  | 'storage'
  | 'reliability'
  | 'cost-awareness';

export type ValidationStatus = 'valid' | 'invalid' | 'unknown';

export interface ValidationFinding {
  id: string;
  ruleId: string;
  ruleTitle: string;
  category: ValidationCategory;
  severity: ValidationSeverity;
  status: ValidationStatus;
  affectedNodeIds: string[];
  affectedEdgeIds?: string[];
  message: string;
  description: string;
  remediation?: string;
  documentationUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ValidationSummary {
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  passedRulesCount: number;
  totalRulesEvaluated: number;
  status: ValidationStatus;
  evaluatedAt: string;
}

export interface ValidationEngineResult {
  architectureId: string;
  summary: ValidationSummary;
  findings: ValidationFinding[];
  evaluatedAt: string;
}

export interface ValidationRuleMetadata {
  id: string;
  title: string;
  category: ValidationCategory;
  severity: ValidationSeverity;
  description: string;
  remediationTemplate?: string;
  documentationUrl?: string;
}

export interface RuleExecutionContext {
  architectureId: string;
  nodes: Array<{
    id: string;
    type: string;
    data: {
      resourceType: string;
      resourceName?: string;
      label?: string;
      metadata?: Record<string, unknown>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    data?: {
      relationshipType?: string;
      direction?: string;
      metadata?: Record<string, unknown>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }>;
}

export interface ValidationRule {
  metadata: ValidationRuleMetadata;
  evaluate: (context: RuleExecutionContext) => ValidationFinding[];
}
