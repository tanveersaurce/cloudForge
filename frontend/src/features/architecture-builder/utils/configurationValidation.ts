import type {
  ArchitectureFlowEdge,
  ArchitectureFlowNode,
} from '../types/architecture.types';
import type {
  ConfigFieldDefinition,
  ConfigurationValidationIssue,
  ConfigurationValidationResult,
  ResourceConfigurationSchema,
} from '../types/configuration.types';
import { isFieldVisible } from './configurationSchemaRegistry';

const IPV4_CIDR_REGEX =
  /^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\/([0-9]|[1-2][0-9]|3[0-2])$/;

export function isValidIpv4Cidr(cidr: string): boolean {
  const match = IPV4_CIDR_REGEX.exec(cidr.trim());
  if (!match) return false;
  const octets = [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
  return octets.every((o) => o >= 0 && o <= 255);
}

export function validateResourceField(
  field: ConfigFieldDefinition,
  value: unknown,
  allValues: Record<string, unknown>,
  canvasNodes: ArchitectureFlowNode[],
): ConfigurationValidationIssue[] {
  const issues: ConfigurationValidationIssue[] = [];

  if (!isFieldVisible(field, allValues)) {
    return issues;
  }

  const isValueEmpty =
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0);

  if (field.validation?.required && isValueEmpty) {
    issues.push({
      fieldKey: field.key,
      message: `${field.label} is required.`,
      severity: 'error',
    });
    return issues;
  }

  if (isValueEmpty) {
    return issues;
  }

  // Type-specific validations
  if (field.type === 'number' && typeof value === 'number') {
    if (field.validation?.min !== undefined && value < field.validation.min) {
      issues.push({
        fieldKey: field.key,
        message: `${field.label} must be at least ${field.validation.min}.`,
        severity: 'error',
      });
    }
    if (field.validation?.max !== undefined && value > field.validation.max) {
      issues.push({
        fieldKey: field.key,
        message: `${field.label} cannot exceed ${field.validation.max}.`,
        severity: 'error',
      });
    }
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (field.validation?.minLength !== undefined && trimmed.length < field.validation.minLength) {
      issues.push({
        fieldKey: field.key,
        message: `${field.label} must be at least ${field.validation.minLength} characters.`,
        severity: 'error',
      });
    }
    if (field.validation?.maxLength !== undefined && trimmed.length > field.validation.maxLength) {
      issues.push({
        fieldKey: field.key,
        message: `${field.label} must be ${field.validation.maxLength} characters or fewer.`,
        severity: 'error',
      });
    }
    if (field.validation?.pattern) {
      const regex = new RegExp(field.validation.pattern);
      if (!regex.test(trimmed)) {
        issues.push({
          fieldKey: field.key,
          message:
            field.validation.patternMessage ??
            `${field.label} format is invalid.`,
          severity: 'error',
        });
      }
    }
    if (field.validation?.cidrBlock) {
      if (!isValidIpv4Cidr(trimmed)) {
        issues.push({
          fieldKey: field.key,
          message: `${field.label} must be a valid IPv4 CIDR block (e.g. 10.0.0.0/16).`,
          severity: 'error',
        });
      }
    }
  }

  // Canvas Resource Reference Validation (Level 2)
  if (field.type === 'resource-reference' && typeof value === 'string' && value.trim()) {
    const targetNode = canvasNodes.find((n) => n.id === value.trim());
    if (!targetNode) {
      issues.push({
        fieldKey: field.key,
        message: `${field.label} references missing or deleted canvas resource "${value}".`,
        severity: 'error',
      });
    } else if (field.targetResourceTypes && field.targetResourceTypes.length > 0) {
      const actualType = targetNode.data.resourceType;
      const actualSlug = targetNode.data.serviceSlug;
      const isTypeMatched = field.targetResourceTypes.some(
        (t) => t === actualType || t === actualSlug,
      );
      if (!isTypeMatched) {
        issues.push({
          fieldKey: field.key,
          message: `${field.label} expected ${field.targetResourceTypes.join(' or ')}, but references ${actualType}.`,
          severity: 'error',
        });
      }
    }
  }

  if (field.type === 'resource-reference-multi' && Array.isArray(value)) {
    for (const refId of value) {
      if (typeof refId === 'string' && refId.trim()) {
        const targetNode = canvasNodes.find((n) => n.id === refId.trim());
        if (!targetNode) {
          issues.push({
            fieldKey: field.key,
            message: `${field.label} contains reference to missing canvas resource "${refId}".`,
            severity: 'error',
          });
        }
      }
    }
  }

  return issues;
}

export function validateNodeConfiguration(
  schema: ResourceConfigurationSchema,
  configValues: Record<string, unknown>,
  canvasNodes: ArchitectureFlowNode[],
  _canvasEdges?: ArchitectureFlowEdge[],
): ConfigurationValidationResult {
  const errors: ConfigurationValidationIssue[] = [];
  const warnings: ConfigurationValidationIssue[] = [];
  const infos: ConfigurationValidationIssue[] = [];

  for (const section of schema.sections) {
    for (const field of section.fields) {
      const fieldIssues = validateResourceField(
        field,
        configValues[field.key],
        configValues,
        canvasNodes,
      );

      for (const issue of fieldIssues) {
        const fullIssue = { ...issue, sectionId: section.id };
        if (issue.severity === 'error') {
          errors.push(fullIssue);
        } else if (issue.severity === 'warning') {
          warnings.push(fullIssue);
        } else {
          infos.push(fullIssue);
        }
      }
    }
  }

  // Security / Production Best Practice Warnings
  if (schema.resourceType === 'aws_db_instance') {
    if (configValues.publicly_accessible === true) {
      warnings.push({
        fieldKey: 'publicly_accessible',
        sectionId: 'networking',
        message: 'Public accessibility is enabled on RDS instance. Production databases should reside in private subnets.',
        severity: 'warning',
      });
    }
  }

  if (schema.resourceType === 'aws_s3_bucket') {
    if (configValues.block_public_access === false) {
      warnings.push({
        fieldKey: 'block_public_access',
        sectionId: 'security',
        message: 'S3 Block Public Access is disabled. Bucket objects may be publicly accessible over the internet.',
        severity: 'warning',
      });
    }
  }

  // Info: CloudForge runtime deployment reminder
  infos.push({
    fieldKey: '__runtime_info__',
    message: 'Local configuration validated. AWS runtime provisioning requires valid IAM permissions and AWS region quotas.',
    severity: 'info',
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    infos,
  };
}
