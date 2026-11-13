import type { ArchitectureFlowEdge, ArchitectureFlowNode } from '@/features/architecture-builder/types/architecture.types';
import type {
  ValidationEngineResult,
  ValidationFinding,
  ValidationStatus,
  ValidationSummary,
} from '../types/validation.types';
import { doCidrsOverlap, isCidrContained, parseCidr } from '../utils/cidrUtils';

export function runClientValidation(
  architectureId: string,
  nodes: ArchitectureFlowNode[],
  edges: ArchitectureFlowEdge[],
): ValidationEngineResult {
  const findings: ValidationFinding[] = [];

  // STRUCT-001: Subnet Must Belong to a VPC
  const subnets = nodes.filter((n) => n.data.resourceType === 'aws_subnet');
  for (const subnet of subnets) {
    const hasVpcParent = edges.some((edge) => {
      if (edge.target !== subnet.id && edge.source !== subnet.id) return false;
      const otherId = edge.target === subnet.id ? edge.source : edge.target;
      const otherNode = nodes.find((n) => n.id === otherId);
      return otherNode?.data.resourceType === 'aws_vpc';
    });

    if (!hasVpcParent) {
      findings.push({
        id: `STRUCT-001-${subnet.id}`,
        ruleId: 'STRUCT-001',
        ruleTitle: 'Subnet Must Belong to a VPC',
        category: 'structural',
        severity: 'critical',
        status: 'invalid',
        affectedNodeIds: [subnet.id],
        message: `Subnet "${subnet.data.label || subnet.id}" is orphaned without a parent VPC.`,
        description: 'AWS subnets cannot exist standalone without an enclosing Virtual Private Cloud.',
        remediation: 'Attach this Subnet to an enclosing VPC by dragging a connection from VPC to Subnet.',
        documentationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Subnets.html',
      });
    }
  }

  // STRUCT-002: Compute & DB in Subnet
  const targetTypes = ['aws_instance', 'aws_db_instance', 'aws_nat_gateway'];
  const computeCandidates = nodes.filter((n) => targetTypes.includes(n.data.resourceType));
  for (const candidate of computeCandidates) {
    const hasSubnetParent = edges.some((edge) => {
      if (edge.target !== candidate.id && edge.source !== candidate.id) return false;
      const otherId = edge.target === candidate.id ? edge.source : edge.target;
      const otherNode = nodes.find((n) => n.id === otherId);
      return otherNode?.data.resourceType === 'aws_subnet';
    });

    if (!hasSubnetParent) {
      findings.push({
        id: `STRUCT-002-${candidate.id}`,
        ruleId: 'STRUCT-002',
        ruleTitle: 'Compute & DB Resources Must Reside in a Subnet',
        category: 'structural',
        severity: 'high',
        status: 'invalid',
        affectedNodeIds: [candidate.id],
        message: `${candidate.data.resourceName || candidate.data.resourceType} "${candidate.data.label || candidate.id}" is not placed in a Subnet.`,
        description: 'EC2, RDS, and NAT Gateway instances require an active VPC subnet placement to receive an ENI and IP address.',
        remediation: 'Connect an AWS Subnet node to this resource to define its network location.',
        documentationUrl: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-vpc.html',
      });
    }
  }

  // STRUCT-003: Internet Gateway Attachment
  const igws = nodes.filter((n) => n.data.resourceType === 'aws_internet_gateway');
  for (const igw of igws) {
    const hasVpcAttachment = edges.some((edge) => {
      if (edge.target !== igw.id && edge.source !== igw.id) return false;
      const otherId = edge.target === igw.id ? edge.source : edge.target;
      const otherNode = nodes.find((n) => n.id === otherId);
      return otherNode?.data.resourceType === 'aws_vpc';
    });

    if (!hasVpcAttachment) {
      findings.push({
        id: `STRUCT-003-${igw.id}`,
        ruleId: 'STRUCT-003',
        ruleTitle: 'Internet Gateway Must Attach to a VPC',
        category: 'structural',
        severity: 'high',
        status: 'invalid',
        affectedNodeIds: [igw.id],
        message: `Internet Gateway "${igw.data.label || igw.id}" is not attached to any VPC.`,
        description: 'An unattached Internet Gateway cannot route internet traffic.',
        remediation: 'Connect this Internet Gateway to its destination VPC.',
        documentationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html',
      });
    }
  }

  // NET-003: Valid IPv4 CIDR Format
  const networkNodes = nodes.filter(
    (n) => n.data.resourceType === 'aws_vpc' || n.data.resourceType === 'aws_subnet',
  );
  for (const node of networkNodes) {
    const cidr = node.data.metadata?.cidr_block;
    if (!cidr || typeof cidr !== 'string' || cidr.trim() === '') {
      findings.push({
        id: `NET-003-missing-${node.id}`,
        ruleId: 'NET-003',
        ruleTitle: 'Valid IPv4 CIDR Block Format',
        category: 'network',
        severity: 'medium',
        status: 'unknown',
        affectedNodeIds: [node.id],
        message: `${node.data.resourceName || node.data.resourceType} "${node.data.label || node.id}" has no CIDR block configured.`,
        description: 'A CIDR block has not yet been assigned to this resource configuration.',
        remediation: 'Configure a valid IPv4 CIDR block in the Resource Inspector.',
        documentationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Subnets.html#vpc-sizing-ipv4',
      });
      continue;
    }

    const parsed = parseCidr(cidr);
    if (!parsed) {
      findings.push({
        id: `NET-003-invalid-${node.id}`,
        ruleId: 'NET-003',
        ruleTitle: 'Valid IPv4 CIDR Block Format',
        category: 'network',
        severity: 'critical',
        status: 'invalid',
        affectedNodeIds: [node.id],
        message: `Invalid CIDR block "${cidr}" on ${node.data.resourceName || node.data.resourceType} "${node.data.label || node.id}".`,
        description: 'CIDR blocks must be valid IPv4 notation with netmask between /0 and /32 (e.g. 10.0.0.0/16).',
        remediation: 'Update CIDR block with standard dot-decimal IPv4 address and netmask.',
        documentationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Subnets.html#vpc-sizing-ipv4',
      });
    }
  }

  // NET-001: Subnet CIDR Contained in VPC CIDR
  for (const subnet of subnets) {
    const subnetCidr = subnet.data.metadata?.cidr_block;
    if (typeof subnetCidr !== 'string' || !parseCidr(subnetCidr)) continue;

    const parentVpcEdge = edges.find((e) => {
      if (e.target !== subnet.id && e.source !== subnet.id) return false;
      const otherId = e.target === subnet.id ? e.source : e.target;
      const otherNode = nodes.find((n) => n.id === otherId);
      return otherNode?.data.resourceType === 'aws_vpc';
    });

    if (!parentVpcEdge) continue;
    const vpcId = parentVpcEdge.target === subnet.id ? parentVpcEdge.source : parentVpcEdge.target;
    const vpcNode = nodes.find((n) => n.id === vpcId);
    if (!vpcNode) continue;

    const vpcCidr = vpcNode.data.metadata?.cidr_block;
    if (typeof vpcCidr !== 'string' || !parseCidr(vpcCidr)) continue;

    if (!isCidrContained(vpcCidr, subnetCidr)) {
      findings.push({
        id: `NET-001-${subnet.id}`,
        ruleId: 'NET-001',
        ruleTitle: 'Subnet CIDR Must Be Contained in VPC CIDR',
        category: 'network',
        severity: 'critical',
        status: 'invalid',
        affectedNodeIds: [subnet.id, vpcNode.id],
        message: `Subnet CIDR ${subnetCidr} is outside parent VPC ${vpcNode.data.label || vpcNode.id} CIDR ${vpcCidr}.`,
        description: 'AWS requires all subnet address ranges to be a strict mathematical subset of the enclosing VPC CIDR.',
        remediation: `Change Subnet CIDR to a prefix within ${vpcCidr}.`,
        documentationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Subnets.html',
      });
    }
  }

  // NET-002: Subnet Overlap
  const vpcs = nodes.filter((n) => n.data.resourceType === 'aws_vpc');
  for (const vpc of vpcs) {
    const attachedSubnets = nodes.filter((n) => {
      if (n.data.resourceType !== 'aws_subnet') return false;
      return edges.some(
        (e) => (e.source === vpc.id && e.target === n.id) || (e.target === vpc.id && e.source === n.id),
      );
    });

    for (let i = 0; i < attachedSubnets.length; i++) {
      const s1 = attachedSubnets[i];
      const cidr1 = s1.data.metadata?.cidr_block;
      if (typeof cidr1 !== 'string' || !parseCidr(cidr1)) continue;

      for (let j = i + 1; j < attachedSubnets.length; j++) {
        const s2 = attachedSubnets[j];
        const cidr2 = s2.data.metadata?.cidr_block;
        if (typeof cidr2 !== 'string' || !parseCidr(cidr2)) continue;

        if (doCidrsOverlap(cidr1, cidr2)) {
          findings.push({
            id: `NET-002-${s1.id}-${s2.id}`,
            ruleId: 'NET-002',
            ruleTitle: 'Subnet CIDR Blocks Must Not Overlap',
            category: 'network',
            severity: 'critical',
            status: 'invalid',
            affectedNodeIds: [s1.id, s2.id],
            message: `Subnet "${s1.data.label}" (${cidr1}) overlaps with Subnet "${s2.data.label}" (${cidr2}).`,
            description: 'Overlapping subnet CIDRs cause routing conflicts.',
            remediation: 'Reallocate non-conflicting IP ranges.',
            documentationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Subnets.html',
          });
        }
      }
    }
  }

  // SEC-001: Public RDS Instance
  const dbNodes = nodes.filter((n) => n.data.resourceType === 'aws_db_instance');
  for (const db of dbNodes) {
    if (db.data.metadata?.publicly_accessible === true) {
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
        remediation: 'Set "publicly_accessible" to false on the RDS database instance configuration.',
        documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_CommonTasks.WebServerDB.html',
      });
    }
  }

  // SEC-002: Unrestricted Management Ports
  const secGroups = nodes.filter((n) => n.data.resourceType === 'aws_security_group');
  for (const sg of secGroups) {
    const ingressRules = sg.data.metadata?.ingress_rules;
    if (Array.isArray(ingressRules)) {
      for (const rule of ingressRules) {
        const cidr = (rule as { cidr_blocks?: string | string[]; cidr_block?: string }).cidr_blocks ||
          (rule as { cidr_block?: string }).cidr_block;
        const fromPort = Number((rule as { from_port?: number }).from_port);
        const toPort = Number((rule as { to_port?: number }).to_port);
        const isWildcard = cidr === '0.0.0.0/0' || (Array.isArray(cidr) && cidr.includes('0.0.0.0/0'));

        const includesPort22 = fromPort <= 22 && toPort >= 22;
        const includesPort3389 = fromPort <= 3389 && toPort >= 3389;

        if (isWildcard && (includesPort22 || includesPort3389)) {
          findings.push({
            id: `SEC-002-${sg.id}`,
            ruleId: 'SEC-002',
            ruleTitle: 'No Unrestricted Ingress to Management Ports (22/3389)',
            category: 'security',
            severity: 'critical',
            status: 'invalid',
            affectedNodeIds: [sg.id],
            message: `Security Group "${sg.data.label || sg.id}" permits unrestricted 0.0.0.0/0 ingress to management ports.`,
            description: 'Open management ports exposed to the entire internet invite brute-force and zero-day exploitation.',
            remediation: 'Restrict CIDR blocks to internal corporate CIDRs or AWS Systems Manager Session Manager.',
            documentationUrl: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html',
          });
        }
      }
    }
  }

  // SEC-003: S3 Public Access Block
  const s3Buckets = nodes.filter((n) => n.data.resourceType === 'aws_s3_bucket');
  for (const bucket of s3Buckets) {
    if (bucket.data.metadata?.block_public_acls === false || bucket.data.metadata?.block_public_policy === false) {
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

  // SEC-004: Storage Encryption
  const ebsVolumes = nodes.filter((n) => n.data.resourceType === 'aws_ebs_volume');
  for (const vol of ebsVolumes) {
    if (vol.data.metadata?.encrypted === false) {
      findings.push({
        id: `SEC-004-${vol.id}`,
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

  // SEC-005: IAM Wildcards
  const iamPolicies = nodes.filter(
    (n) => n.data.resourceType === 'aws_iam_policy' || n.data.resourceType === 'aws_iam_role',
  );
  for (const policy of iamPolicies) {
    const doc = policy.data.metadata?.policy_document;
    if (
      typeof doc === 'string' &&
      (/["']Action["']\s*:\s*["']\*["']/i.test(doc) || doc.includes('"*"'))
    ) {
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
        remediation: 'Scope down IAM actions to specific AWS API operations.',
        documentationUrl: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#grant-least-privilege',
      });
    }
  }

  // REL-001: Multi-AZ RDS
  for (const db of dbNodes) {
    if (db.data.metadata?.multi_az === false) {
      findings.push({
        id: `REL-001-${db.id}`,
        ruleId: 'REL-001',
        ruleTitle: 'RDS High Availability Multi-AZ Configuration',
        category: 'reliability',
        severity: 'medium',
        status: 'invalid',
        affectedNodeIds: [db.id],
        message: `RDS Instance "${db.data.label || db.id}" is deployed in Single-AZ mode without standby failover.`,
        description: 'Single-AZ database instances are susceptible to downtime during maintenance or AZ outages.',
        remediation: 'Enable Multi-AZ deployment for automatic failover and high availability.',
        documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html',
      });
    }
  }

  // Calculate Summary
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let infoCount = 0;

  for (const f of findings) {
    switch (f.severity) {
      case 'critical':
        criticalCount++;
        break;
      case 'high':
        highCount++;
        break;
      case 'medium':
        mediumCount++;
        break;
      case 'low':
        lowCount++;
        break;
      case 'info':
        infoCount++;
        break;
    }
  }

  let overallStatus: ValidationStatus = 'valid';
  if (criticalCount > 0 || highCount > 0) {
    overallStatus = 'invalid';
  } else if (mediumCount > 0 || findings.some((f) => f.status === 'unknown')) {
    overallStatus = 'unknown';
  }

  const summary: ValidationSummary = {
    totalFindings: findings.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    infoCount,
    passedRulesCount: Math.max(0, 12 - findings.length),
    totalRulesEvaluated: 12,
    status: overallStatus,
    evaluatedAt: new Date().toISOString(),
  };

  return {
    architectureId,
    summary,
    findings,
    evaluatedAt: summary.evaluatedAt,
  };
}
