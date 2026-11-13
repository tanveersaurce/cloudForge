export type ConfigFieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multi-select'
  | 'radio'
  | 'resource-reference'
  | 'resource-reference-multi'
  | 'tags'
  | 'textarea';

export interface FieldOption {
  label: string;
  value: string | number | boolean;
  description?: string;
  badge?: string;
}

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'not_in'
  | 'truthy'
  | 'falsy';

export interface FieldCondition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface ConfigFieldValidation {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  cidrBlock?: boolean;
}

export interface TerraformFieldMapping {
  terraformArgument?: string;
  terraformCompatibility: 'supported' | 'optional' | 'computed' | 'unsupported';
  isSensitive?: boolean;
  notes?: string;
}

export interface ConfigFieldDefinition {
  key: string;
  label: string;
  type: ConfigFieldType;
  description?: string;
  tooltip?: string;
  defaultValue?: unknown;
  placeholder?: string;
  options?: FieldOption[];
  targetResourceTypes?: string[];
  validation?: ConfigFieldValidation;
  condition?: FieldCondition;
  terraform?: TerraformFieldMapping;
  sensitive?: boolean;
  readOnly?: boolean;
}

export type ConfigSectionId =
  | 'general'
  | 'resource_settings'
  | 'networking'
  | 'security'
  | 'storage'
  | 'advanced';

export interface ConfigSectionDefinition {
  id: ConfigSectionId | string;
  title: string;
  description?: string;
  fields: ConfigFieldDefinition[];
  defaultCollapsed?: boolean;
}

export interface ResourceConfigurationSchema {
  resourceType: string;
  serviceSlug: string;
  serviceName: string;
  schemaVersion: number;
  description: string;
  sections: ConfigSectionDefinition[];
}

export interface ConfigurationValidationIssue {
  fieldKey: string;
  sectionId?: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ConfigurationValidationResult {
  isValid: boolean;
  errors: ConfigurationValidationIssue[];
  warnings: ConfigurationValidationIssue[];
  infos: ConfigurationValidationIssue[];
}

export type ResourceConfigStatus = 'valid' | 'incomplete' | 'warning' | 'unconfigured';
