/**
 * Types for Terraform Generator (Standard & Modular)
 */

export type ExportMode = 'standard' | 'modular';

export interface TerraformNodeInput {
  id: string;
  resourceType: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface TerraformEdgeInput {
  id: string;
  source: string;
  target: string;
  relationshipType?: string;
  direction?: string;
  metadata?: Record<string, unknown>;
}

export interface TerraformFile {
  filename: string;
  content: string;
}

export interface DependencyIssue {
  nodeId: string;
  resourceType: string;
  missing: string;
  severity: 'error' | 'warning';
}

export interface TfExpression {
  __tfExpr: true;
  value: string;
}

export interface GeneratorOptions {
  mode?: ExportMode;
}

export interface TerraformGenerateResult {
  files: TerraformFile[];
  issues: DependencyIssue[];
  mode: ExportMode;
}
