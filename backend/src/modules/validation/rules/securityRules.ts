import type { ValidationFinding, ValidationRule } from '../types/validation.types.js';

export const publicRdsInstanceRule: ValidationRule = {
  metadata: {
    id: 'SEC-001',
    title: 'RDS Database Must Not Be Publicly Accessible',
    category: 'security',
    severity: 'critical',
    description: 'Relational Database Service (RDS) instances must not have public IP endpoints enabled.',
    remediationTemplate: 'Set "publicly_accessible" to false on the RDS database instance configuration.',
    documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_CommonTasks.WebServerDB.html',
  },
  evaluate: (ctx): ValidationFinding[] => {
    const findings: ValidationFinding[] = [];
    const dbNodes = ctx.nodes.filter((n) => n.data.resourceType === 'aws_db_instance');

    for (const db of dbNodes) {
      const isPublic = db.data.metadata?.publicly_accessible;
      if (isPublic === true) {
        findings.push({
          id: `SEC-001-${db.id}`,
          ruleId: 'SEC-001',
          ruleTitle: 'RDS Database Must Not Be Publicly Accessible',
          category: 'security',
          severity: 'critical',
          status: 'invalid',
          affectedNodeIds: [db.id],
          message: `Database "${db.data.label || db.id}" has public internet access enabled.`,
          description: 'Exposing relational databases to the public internet presents severe data breach risks.',
          remediation: 'Disable "publicly_accessible" and route database traffic through private subnets and security groups.',
          documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_CommonTasks.WebServerDB.html',
        });
      }
    }

    return findings;
  },
};

export const unrestrictedManagementPortsRule: ValidationRule = {
  metadata: {
    id: 'SEC-002',
    title: 'No Unrestricted Ingress to Management Ports (22/3389)',
    category: 'security',
    severity: 'critical',
    description: 'Security groups must not allow inbound traffic from 0.0.0.0/0 on SSH (port 22) or RDP (port 3389).',
    remediationTemplate: 'Restrict CIDR blocks for ports 22 and 3389 to specific administrator IP addresses or bastion VPNs.',
    documentationUrl: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html',
  },
  evaluate: (ctx): ValidationFinding[] => {
    const findings: ValidationFinding[] = [];
    const secGroups = ctx.nodes.filter((n) => n.data.resourceType === 'aws_security_group');

    for (const sg of secGroups) {
      const ingressRules = sg.data.metadata?.ingress_rules;
      if (Array.isArray(ingressRules)) {
        for (const rule of ingressRules) {
          const cidr = rule?.cidr_blocks || rule?.cidr_block;
          const fromPort = Number(rule?.from_port);
          const toPort = Number(rule?.to_port);
          const isWildcardCidr =
            cidr === '0.0.0.0/0' || (Array.isArray(cidr) && cidr.includes('0.0.0.0/0'));

          const includesPort22 = fromPort <= 22 && toPort >= 22;
          const includesPort3389 = fromPort <= 3389 && toPort >= 3389;

          if (isWildcardCidr && (includesPort22 || includesPort3389)) {
            const portName = includesPort22 && includesPort3389 ? 'SSH & RDP' : includesPort22 ? 'SSH (port 22)' : 'RDP (port 3389)';
            findings.push({
              id: `SEC-002-${sg.id}-${fromPort}-${toPort}`,
              ruleId: 'SEC-002',
              ruleTitle: 'No Unrestricted Ingress to Management Ports (22/3389)',
              category: 'security',
              severity: 'critical',
              status: 'invalid',
              affectedNodeIds: [sg.id],
              message: `Security Group "${sg.data.label || sg.id}" permits unrestricted 0.0.0.0/0 inbound access to ${portName}.`,
              description: 'Open management ports exposed to the entire internet invite brute-force and zero-day exploitation.',
              remediation: 'Restrict CIDR blocks to internal corporate CIDRs or AWS Systems Manager Session Manager.',
              documentationUrl: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html',
            });
          }
        }
      }
    }

    return findings;
  },
};

export const s3PublicAccessBlockRule: ValidationRule = {
  metadata: {
    id: 'SEC-003',
    title: 'S3 Buckets Must Enable Public Access Block',
    category: 'security',
    severity: 'high',
    description: 'Amazon S3 buckets must enable Public Access Block protections against inadvertent data exposure.',
    remediationTemplate: 'Enable block_public_acls, block_public_policy, ignore_public_acls, and restrict_public_buckets.',
    documentationUrl: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html',
  },
  evaluate: (ctx): ValidationFinding[] => {
    const findings: ValidationFinding[] = [];
    const s3Buckets = ctx.nodes.filter((n) => n.data.resourceType === 'aws_s3_bucket');

    for (const bucket of s3Buckets) {
      const blockPublicAcls = bucket.data.metadata?.block_public_acls;
      const blockPublicPolicy = bucket.data.metadata?.block_public_policy;

      if (blockPublicAcls === false || blockPublicPolicy === false) {
        findings.push({
          id: `SEC-003-${bucket.id}`,
          ruleId: 'SEC-003',
          ruleTitle: 'S3 Buckets Must Enable Public Access Block',
          category: 'security',
          severity: 'high',
          status: 'invalid',
          affectedNodeIds: [bucket.id],
          message: `S3 Bucket "${bucket.data.label || bucket.id}" has Public Access Block disabled.`,
          description: 'Without Public Access Block enabled, public object ACLs or bucket policies can leak private data.',
          remediation: 'Enable S3 Public Access Block settings to prevent unauthorized public read access.',
          documentationUrl: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html',
        });
      }
    }

    return findings;
  },
};

export const storageEncryptionRule: ValidationRule = {
  metadata: {
    id: 'SEC-004',
    title: 'Data Storage Resources Must Enable Encryption at Rest',
    category: 'security',
    severity: 'high',
    description: 'EBS volumes, RDS databases, and S3 buckets must enforce encryption at rest (KMS or AES256).',
    remediationTemplate: 'Enable encryption at rest with an AWS managed key or customer-managed KMS CMK.',
    documentationUrl: 'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/protect-data-at-rest.html',
  },
  evaluate: (ctx): ValidationFinding[] => {
    const findings: ValidationFinding[] = [];

    // EBS Volumes
    const ebsVolumes = ctx.nodes.filter((n) => n.data.resourceType === 'aws_ebs_volume');
    for (const vol of ebsVolumes) {
      if (vol.data.metadata?.encrypted === false) {
        findings.push({
          id: `SEC-004-ebs-${vol.id}`,
          ruleId: 'SEC-004',
          ruleTitle: 'Data Storage Resources Must Enable Encryption at Rest',
          category: 'security',
          severity: 'high',
          status: 'invalid',
          affectedNodeIds: [vol.id],
          message: `EBS Volume "${vol.data.label || vol.id}" is unencrypted.`,
          description: 'Unencrypted EBS volumes do not meet compliance standards for data protection at rest.',
          remediation: 'Set encrypted = true and specify an AWS KMS key for volume encryption.',
          documentationUrl: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/EBSEncryption.html',
        });
      }
    }

    // RDS Instances
    const rdsInstances = ctx.nodes.filter((n) => n.data.resourceType === 'aws_db_instance');
    for (const rds of rdsInstances) {
      if (rds.data.metadata?.storage_encrypted === false) {
        findings.push({
          id: `SEC-004-rds-${rds.id}`,
          ruleId: 'SEC-004',
          ruleTitle: 'Data Storage Resources Must Enable Encryption at Rest',
          category: 'security',
          severity: 'high',
          status: 'invalid',
          affectedNodeIds: [rds.id],
          message: `RDS Instance "${rds.data.label || rds.id}" does not have storage encryption enabled.`,
          description: 'RDS instances storing persistent records must enforce storage encryption.',
          remediation: 'Enable storage encryption in RDS configuration.',
          documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.Encryption.html',
        });
      }
    }

    return findings;
  },
};

export const wildcardIamPermissionsRule: ValidationRule = {
  metadata: {
    id: 'SEC-005',
    title: 'Avoid IAM Wildcard Administrator Policies',
    category: 'security',
    severity: 'critical',
    description: 'IAM policies must adhere to the principle of least privilege and avoid "*" action with "*" resource.',
    remediationTemplate: 'Narrow IAM action verbs and resource ARNs to specific required service endpoints.',
    documentationUrl: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#grant-least-privilege',
  },
  evaluate: (ctx): ValidationFinding[] => {
    const findings: ValidationFinding[] = [];
    const iamPolicies = ctx.nodes.filter(
      (n) => n.data.resourceType === 'aws_iam_policy' || n.data.resourceType === 'aws_iam_role',
    );

    for (const policy of iamPolicies) {
      const doc = policy.data.metadata?.policy_document;
      let hasWildcard = false;

      if (typeof doc === 'string') {
        hasWildcard =
          /["']Action["']\s*:\s*["']\*["']/i.test(doc) ||
          /["']Action["']\s*:\s*\[[^\]]*["']\*["'][^\]]*\]/i.test(doc) ||
          (doc.includes('"*"') && doc.includes('Action'));
      } else if (typeof doc === 'object' && doc !== null) {
        const str = JSON.stringify(doc);
        hasWildcard =
          /["']Action["']\s*:\s*["']\*["']/i.test(str) ||
          /["']Action["']\s*:\s*\[[^\]]*["']\*["'][^\]]*\]/i.test(str);
      }

      if (hasWildcard) {
        findings.push({
          id: `SEC-005-${policy.id}`,
          ruleId: 'SEC-005',
          ruleTitle: 'Avoid IAM Wildcard Administrator Policies',
          category: 'security',
          severity: 'critical',
          status: 'invalid',
          affectedNodeIds: [policy.id],
          message: `IAM Policy "${policy.data.label || policy.id}" contains wildcard "*" administrative privileges.`,
          description: 'Granting full administrative access violates the principle of least privilege.',
          remediation: 'Scope down IAM actions to the specific AWS API operations required by your workloads.',
          documentationUrl: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#grant-least-privilege',
        });
      }
    }

    return findings;
  },
};

export const securityRules: ValidationRule[] = [
  publicRdsInstanceRule,
  unrestrictedManagementPortsRule,
  s3PublicAccessBlockRule,
  storageEncryptionRule,
  wildcardIamPermissionsRule,
];
