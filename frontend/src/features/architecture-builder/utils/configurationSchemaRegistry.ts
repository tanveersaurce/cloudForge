import { ec2Schema } from '../schemas/ec2Schema';
import {
  ecsServiceSchema,
  ecrRepositorySchema,
  lambdaSchema,
} from '../schemas/computeSchemas';
import {
  albSchema,
  internetGatewaySchema,
  natGatewaySchema,
  routeTableSchema,
  securityGroupSchema,
  subnetSchema,
  vpcSchema,
} from '../schemas/networkingSchemas';
import {
  dynamoDbSchema,
  ebsVolumeSchema,
  rdsSchema,
  s3BucketSchema,
} from '../schemas/storageAndDatabaseSchemas';
import {
  iamPolicySchema,
  iamRoleSchema,
  kmsKeySchema,
} from '../schemas/securitySchemas';
import type {
  ConfigFieldDefinition,
  FieldCondition,
  ResourceConfigurationSchema,
} from '../types/configuration.types';

const SCHEMA_MAP = new Map<string, ResourceConfigurationSchema>([
  ['aws_instance', ec2Schema],
  ['aws_lambda_function', lambdaSchema],
  ['aws_ecs_service', ecsServiceSchema],
  ['aws_ecr_repository', ecrRepositorySchema],
  ['aws_vpc', vpcSchema],
  ['aws_subnet', subnetSchema],
  ['aws_internet_gateway', internetGatewaySchema],
  ['aws_nat_gateway', natGatewaySchema],
  ['aws_route_table', routeTableSchema],
  ['aws_security_group', securityGroupSchema],
  ['aws_lb', albSchema],
  ['aws_s3_bucket', s3BucketSchema],
  ['aws_ebs_volume', ebsVolumeSchema],
  ['aws_db_instance', rdsSchema],
  ['aws_dynamodb_table', dynamoDbSchema],
  ['aws_iam_role', iamRoleSchema],
  ['aws_iam_policy', iamPolicySchema],
  ['aws_kms_key', kmsKeySchema],
]);

function normalizeResourceType(resourceTypeOrSlug: string): string {
  const raw = (resourceTypeOrSlug || '').toLowerCase().trim();
  if (raw === 'amazon-ec2' || raw === 'ec2') return 'aws_instance';
  if (raw === 'amazon-vpc' || raw === 'vpc') return 'aws_vpc';
  if (raw === 'amazon-rds' || raw === 'rds') return 'aws_db_instance';
  if (raw === 'amazon-s3' || raw === 's3') return 'aws_s3_bucket';
  if (raw === 'aws-lambda' || raw === 'lambda') return 'aws_lambda_function';
  if (raw === 'amazon-ecs' || raw === 'ecs') return 'aws_ecs_service';
  if (raw === 'amazon-ecr' || raw === 'ecr') return 'aws_ecr_repository';
  if (raw === 'elastic-load-balancing' || raw === 'alb' || raw === 'elb') return 'aws_lb';
  if (raw === 'amazon-dynamodb' || raw === 'dynamodb') return 'aws_dynamodb_table';
  if (raw === 'amazon-ebs' || raw === 'ebs') return 'aws_ebs_volume';
  if (raw === 'aws-iam' || raw === 'iam') return 'aws_iam_role';
  if (raw === 'aws-kms' || raw === 'kms') return 'aws_kms_key';
  return raw;
}

export function createGenericFallbackSchema(
  resourceType: string,
  serviceName: string,
): ResourceConfigurationSchema {
  return {
    resourceType,
    serviceSlug: resourceType,
    serviceName: serviceName || resourceType,
    schemaVersion: 1,
    description: `Configuration properties for ${serviceName || resourceType}`,
    sections: [
      {
        id: 'general',
        title: 'General Information',
        description: 'Resource identification',
        fields: [
          {
            key: 'resource_name',
            label: 'Resource Name Tag',
            type: 'text',
            defaultValue: `${resourceType}-01`,
            description: 'Name tag applied to this resource',
            validation: { required: true },
          },
          {
            key: 'notes',
            label: 'Architectural Notes',
            type: 'textarea',
            defaultValue: '',
            placeholder: 'Document deployment notes, configuration considerations, or Terraform references...',
            description: 'Optional design and operational notes',
          },
        ],
      },
    ],
  };
}

export function getResourceConfigurationSchema(
  resourceType: string,
  serviceName?: string,
): ResourceConfigurationSchema {
  const normalized = normalizeResourceType(resourceType);
  const found = SCHEMA_MAP.get(normalized);
  if (found) {
    return found;
  }
  return createGenericFallbackSchema(resourceType, serviceName ?? resourceType);
}

export function isFieldVisible(
  field: ConfigFieldDefinition,
  currentValues: Record<string, unknown>,
): boolean {
  if (!field.condition) return true;
  return evaluateCondition(field.condition, currentValues);
}

export function evaluateCondition(
  condition: FieldCondition,
  values: Record<string, unknown>,
): boolean {
  const actualValue = values[condition.field];

  switch (condition.operator) {
    case 'equals':
      return actualValue === condition.value;
    case 'not_equals':
      return actualValue !== condition.value;
    case 'truthy':
      return Boolean(actualValue);
    case 'falsy':
      return !actualValue;
    case 'in':
      if (Array.isArray(condition.value)) {
        return condition.value.includes(actualValue);
      }
      return false;
    case 'not_in':
      if (Array.isArray(condition.value)) {
        return !condition.value.includes(actualValue);
      }
      return true;
    default:
      return true;
  }
}

export function initializeDefaultConfiguration(
  schema: ResourceConfigurationSchema,
  currentMetadata?: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...(currentMetadata ?? {}) };

  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (result[field.key] === undefined || result[field.key] === null) {
        if (field.defaultValue !== undefined) {
          result[field.key] = structuredClone(field.defaultValue);
        } else {
          switch (field.type) {
            case 'boolean':
              result[field.key] = false;
              break;
            case 'number':
              result[field.key] = 0;
              break;
            case 'multi-select':
            case 'resource-reference-multi':
            case 'tags':
              result[field.key] = [];
              break;
            default:
              result[field.key] = '';
              break;
          }
        }
      }
    }
  }

  return result;
}

export function getAllRegisteredSchemas(): ResourceConfigurationSchema[] {
  return Array.from(SCHEMA_MAP.values());
}
