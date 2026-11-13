import type { ResourceConfigurationSchema } from '../types/configuration.types';

export const iamRoleSchema: ResourceConfigurationSchema = {
  resourceType: 'aws_iam_role',
  serviceSlug: 'aws-iam',
  serviceName: 'AWS IAM Role',
  schemaVersion: 1,
  description: 'AWS Identity and Access Management execution or service identity role',
  sections: [
    {
      id: 'general',
      title: 'Role Identity',
      description: 'Role name and description',
      fields: [
        {
          key: 'name',
          label: 'Role Name',
          type: 'text',
          defaultValue: 'app-execution-role',
          placeholder: 'e.g. app-execution-role',
          validation: { required: true, maxLength: 64, pattern: '^[a-zA-Z0-9+=,.@_-]+$', patternMessage: 'Alphanumeric and standard IAM special characters' },
          terraform: { terraformArgument: 'name', terraformCompatibility: 'supported' },
        },
        {
          key: 'description',
          label: 'Role Description',
          type: 'textarea',
          defaultValue: 'Allows AWS services to assume this role for workload execution',
          validation: { maxLength: 1000 },
          terraform: { terraformArgument: 'description', terraformCompatibility: 'supported' },
        },
      ],
    },
    {
      id: 'security',
      title: 'Trust Relationship',
      description: 'Entities trusted to assume this role',
      fields: [
        {
          key: 'trusted_service',
          label: 'Trusted AWS Principal Service',
          type: 'select',
          defaultValue: 'ec2.amazonaws.com',
          description: 'AWS service allowed to perform sts:AssumeRole for this role',
          validation: { required: true },
          options: [
            { label: 'EC2 (ec2.amazonaws.com)', value: 'ec2.amazonaws.com' },
            { label: 'Lambda (lambda.amazonaws.com)', value: 'lambda.amazonaws.com' },
            { label: 'ECS Tasks (ecs-tasks.amazonaws.com)', value: 'ecs-tasks.amazonaws.com' },
            { label: 'API Gateway (apigateway.amazonaws.com)', value: 'apigateway.amazonaws.com' },
          ],
          terraform: { terraformArgument: 'assume_role_policy', terraformCompatibility: 'supported' },
        },
        {
          key: 'max_session_duration',
          label: 'Max Session Duration (Seconds)',
          type: 'number',
          defaultValue: 3600,
          description: 'Maximum STS assumed session validity duration (3600 - 43200 seconds)',
          validation: { min: 3600, max: 43200 },
          terraform: { terraformArgument: 'max_session_duration', terraformCompatibility: 'supported' },
        },
      ],
    },
  ],
};

export const iamPolicySchema: ResourceConfigurationSchema = {
  resourceType: 'aws_iam_policy',
  serviceSlug: 'aws-iam',
  serviceName: 'AWS IAM Policy',
  schemaVersion: 1,
  description: 'Managed IAM policy defining fine-grained permission statements',
  sections: [
    {
      id: 'general',
      title: 'Policy Details',
      description: 'Policy name and description',
      fields: [
        {
          key: 'name',
          label: 'Policy Name',
          type: 'text',
          defaultValue: 's3-readonly-policy',
          placeholder: 'e.g. s3-readonly-policy',
          validation: { required: true, maxLength: 128 },
          terraform: { terraformArgument: 'name', terraformCompatibility: 'supported' },
        },
        {
          key: 'description',
          label: 'Description',
          type: 'textarea',
          defaultValue: 'Grants read-only access to application S3 bucket objects',
          validation: { maxLength: 1000 },
          terraform: { terraformArgument: 'description', terraformCompatibility: 'supported' },
        },
      ],
    },
    {
      id: 'security',
      title: 'Policy Template',
      description: 'Pre-configured AWS policy template statement',
      fields: [
        {
          key: 'policy_template',
          label: 'Permission Preset',
          type: 'select',
          defaultValue: 's3_read_only',
          options: [
            { label: 'S3 Read-Only Access', value: 's3_read_only' },
            { label: 'S3 Full Access', value: 's3_full_access' },
            { label: 'DynamoDB Read/Write Access', value: 'dynamodb_read_write' },
            { label: 'AWS Lambda Basic Execution', value: 'lambda_basic_execution' },
            { label: 'VPC Network Interface Management', value: 'vpc_enis' },
          ],
          terraform: { terraformArgument: 'policy', terraformCompatibility: 'supported' },
        },
      ],
    },
  ],
};

export const kmsKeySchema: ResourceConfigurationSchema = {
  resourceType: 'aws_kms_key',
  serviceSlug: 'aws-kms',
  serviceName: 'AWS KMS Customer Managed Key',
  schemaVersion: 1,
  description: 'AWS Key Management Service customer managed encryption key (CMK)',
  sections: [
    {
      id: 'general',
      title: 'Key Configuration',
      description: 'Key alias, purpose, and rotation',
      fields: [
        {
          key: 'description',
          label: 'Key Description',
          type: 'text',
          defaultValue: 'Encryption key for CloudForge application data',
          placeholder: 'e.g. Encryption key for CloudForge production database',
          validation: { required: true, maxLength: 255 },
          terraform: { terraformArgument: 'description', terraformCompatibility: 'supported' },
        },
        {
          key: 'key_usage',
          label: 'Key Usage',
          type: 'select',
          defaultValue: 'ENCRYPT_DECRYPT',
          options: [
            { label: 'Encrypt / Decrypt (Symmetric encryption)', value: 'ENCRYPT_DECRYPT' },
            { label: 'Sign / Verify (Asymmetric signing)', value: 'SIGN_VERIFY' },
          ],
          terraform: { terraformArgument: 'key_usage', terraformCompatibility: 'supported' },
        },
        {
          key: 'enable_key_rotation',
          label: 'Automatic Annual Key Rotation',
          type: 'boolean',
          defaultValue: true,
          description: 'AWS KMS automatically rotates the backing cryptographic material every year',
          terraform: { terraformArgument: 'enable_key_rotation', terraformCompatibility: 'supported' },
        },
        {
          key: 'deletion_window_in_days',
          label: 'Key Deletion Waiting Window (Days)',
          type: 'number',
          defaultValue: 30,
          description: 'Waiting period before irreversible key destruction (7 to 30 days)',
          validation: { min: 7, max: 30 },
          terraform: { terraformArgument: 'deletion_window_in_days', terraformCompatibility: 'supported' },
        },
      ],
    },
  ],
};
