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
    const hasParentVpcId =
      Boolean(subnet.parentId) &&
      nodes.some((n) => n.id === subnet.parentId && n.data.resourceType === 'aws_vpc');

    if (hasParentVpcId) {
      continue;
    }

    let hasValidVpcEdge = false;
    let hasUntypedEdge = false;
    let hasInvalidRelEdge = false;
    let connectedVpcLabel = '';
    let invalidRelType = '';

    for (const edge of edges) {
      const relType = edge.data?.relationshipType;
      const dir = edge.data?.direction;

      if (edge.target === subnet.id) {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        if (sourceNode?.data.resourceType === 'aws_vpc') {
          connectedVpcLabel = sourceNode.data.label || sourceNode.id;
          if (!relType) {
            hasUntypedEdge = true;
          } else if (relType === 'contains' && dir !== 'target-to-source') {
            hasValidVpcEdge = true;
            break;
          } else if ((relType === 'attached-to' || relType === 'depends-on') && dir === 'target-to-source') {
            hasValidVpcEdge = true;
            break;
          } else {
            hasInvalidRelEdge = true;
            invalidRelType = relType;
          }
        }
      }

      if (edge.source === subnet.id) {
        const targetNode = nodes.find((n) => n.id === edge.target);
        if (targetNode?.data.resourceType === 'aws_vpc') {
          connectedVpcLabel = targetNode.data.label || targetNode.id;
          if (!relType) {
            hasUntypedEdge = true;
          } else if ((relType === 'attached-to' || relType === 'depends-on') && dir !== 'target-to-source') {
            hasValidVpcEdge = true;
            break;
          } else if (relType === 'contains' && dir === 'target-to-source') {
            hasValidVpcEdge = true;
            break;
          } else {
            hasInvalidRelEdge = true;
            invalidRelType = relType;
          }
        }
      }
    }

    if (hasValidVpcEdge) {
      continue;
    }

    if (hasUntypedEdge) {
      findings.push({
        id: `STRUCT-001-${subnet.id}`,
        ruleId: 'STRUCT-001',
        ruleTitle: 'Subnet Must Belong to a VPC',
        category: 'structural',
        severity: 'critical',
        status: 'invalid',
        affectedNodeIds: [subnet.id],
        message: `Subnet "${subnet.data.label || subnet.id}" is connected to VPC "${connectedVpcLabel}" by an edge without a defined relationship type.`,
        description: 'Untyped connections do not satisfy VPC containment. A "contains" relationship from VPC to Subnet is required.',
        remediation: 'Configure the connection with relationshipType: "contains" and direction: "source-to-target".',
        documentationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Subnets.html',
      });
    } else if (hasInvalidRelEdge) {
      findings.push({
        id: `STRUCT-001-${subnet.id}`,
        ruleId: 'STRUCT-001',
        ruleTitle: 'Subnet Must Belong to a VPC',
        category: 'structural',
        severity: 'critical',
        status: 'invalid',
        affectedNodeIds: [subnet.id],
        message: `Subnet "${subnet.data.label || subnet.id}" has an invalid "${invalidRelType}" relationship with VPC "${connectedVpcLabel}".`,
        description: 'A Subnet must have a "contains" relationship from its enclosing VPC or an "attached-to" relationship to the VPC.',
        remediation: 'Change the relationship type to "contains" (VPC -> Subnet) or "attached-to" (Subnet -> VPC).',
        documentationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Subnets.html',
      });
    } else {
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
    const hasParentSubnetId =
      Boolean(candidate.parentId) &&
      nodes.some((n) => n.id === candidate.parentId && n.data.resourceType === 'aws_subnet');

    if (hasParentSubnetId) {
      continue;
    }

    let hasValidSubnetEdge = false;
    let hasUntypedEdge = false;
    let hasInvalidRelEdge = false;
    let connectedSubnetLabel = '';
    let invalidRelType = '';

    for (const edge of edges) {
      const relType = edge.data?.relationshipType;
      const dir = edge.data?.direction;

      if (edge.target === candidate.id) {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        if (sourceNode?.data.resourceType === 'aws_subnet') {
          connectedSubnetLabel = sourceNode.data.label || sourceNode.id;
          if (!relType) {
            hasUntypedEdge = true;
          } else if (relType === 'contains' && dir !== 'target-to-source') {
            hasValidSubnetEdge = true;
            break;
          } else if ((relType === 'attached-to' || relType === 'depends-on') && dir === 'target-to-source') {
            hasValidSubnetEdge = true;
            break;
          } else {
            hasInvalidRelEdge = true;
            invalidRelType = relType;
          }
        }
      }

      if (edge.source === candidate.id) {
        const targetNode = nodes.find((n) => n.id === edge.target);
        if (targetNode?.data.resourceType === 'aws_subnet') {
          connectedSubnetLabel = targetNode.data.label || targetNode.id;
          if (!relType) {
            hasUntypedEdge = true;
          } else if ((relType === 'attached-to' || relType === 'depends-on') && dir !== 'target-to-source') {
            hasValidSubnetEdge = true;
            break;
          } else if (relType === 'contains' && dir === 'target-to-source') {
            hasValidSubnetEdge = true;
            break;
          } else {
            hasInvalidRelEdge = true;
            invalidRelType = relType;
          }
        }
      }
    }

    if (hasValidSubnetEdge) {
      continue;
    }

    const resourceName = candidate.data.resourceName || candidate.data.resourceType;
    const candidateLabel = candidate.data.label || candidate.id;

    if (hasUntypedEdge) {
      findings.push({
        id: `STRUCT-002-${candidate.id}`,
        ruleId: 'STRUCT-002',
        ruleTitle: 'Compute & DB Resources Must Reside in a Subnet',
        category: 'structural',
        severity: 'high',
        status: 'invalid',
        affectedNodeIds: [candidate.id],
        message: `${resourceName} "${candidateLabel}" is connected to Subnet "${connectedSubnetLabel}" by an edge without a defined relationship type.`,
        description: 'Untyped connections do not satisfy subnet placement. An explicit "contains" or "attached-to" relationship is required.',
        remediation: 'Configure the connection with relationshipType: "contains" (Subnet -> Resource) or "attached-to" (Resource -> Subnet).',
        documentationUrl: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-vpc.html',
      });
    } else if (hasInvalidRelEdge) {
      findings.push({
        id: `STRUCT-002-${candidate.id}`,
        ruleId: 'STRUCT-002',
        ruleTitle: 'Compute & DB Resources Must Reside in a Subnet',
        category: 'structural',
        severity: 'high',
        status: 'invalid',
        affectedNodeIds: [candidate.id],
        message: `${resourceName} "${candidateLabel}" has an invalid "${invalidRelType}" relationship with Subnet "${connectedSubnetLabel}".`,
        description: 'A resource in a Subnet requires a "contains" placement relationship from the Subnet or an "attached-to" / "depends-on" relationship.',
        remediation: 'Update the relationship type to "contains" from Subnet to resource or "attached-to" from resource to Subnet.',
        documentationUrl: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-vpc.html',
      });
    } else {
      findings.push({
        id: `STRUCT-002-${candidate.id}`,
        ruleId: 'STRUCT-002',
        ruleTitle: 'Compute & DB Resources Must Reside in a Subnet',
        category: 'structural',
        severity: 'high',
        status: 'invalid',
        affectedNodeIds: [candidate.id],
        message: `${resourceName} "${candidateLabel}" is not placed in a Subnet.`,
        description: 'EC2, RDS, and NAT Gateway instances require an active VPC subnet placement to receive an ENI and IP address.',
        remediation: 'Connect an AWS Subnet node to this resource to define its network location.',
        documentationUrl: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-vpc.html',
      });
    }
  }

  // STRUCT-003: Internet Gateway Attachment
  const igws = nodes.filter((n) => n.data.resourceType === 'aws_internet_gateway');
  for (const igw of igws) {
    let hasValidVpcAttachment = false;
    let hasUntypedEdge = false;
    let hasInvalidRelEdge = false;
    let connectedVpcLabel = '';
    let invalidRelType = '';

    for (const edge of edges) {
      const relType = edge.data?.relationshipType;
      const dir = edge.data?.direction;

      if (edge.source === igw.id) {
        const targetNode = nodes.find((n) => n.id === edge.target);
        if (targetNode?.data.resourceType === 'aws_vpc') {
          connectedVpcLabel = targetNode.data.label || targetNode.id;
          if (!relType) {
            hasUntypedEdge = true;
          } else if ((relType === 'attached-to' || relType === 'depends-on') && dir !== 'target-to-source') {
            hasValidVpcAttachment = true;
            break;
          } else if (relType === 'contains' && dir === 'target-to-source') {
            hasValidVpcAttachment = true;
            break;
          } else {
            hasInvalidRelEdge = true;
            invalidRelType = relType;
          }
        }
      }

      if (edge.target === igw.id) {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        if (sourceNode?.data.resourceType === 'aws_vpc') {
          connectedVpcLabel = sourceNode.data.label || sourceNode.id;
          if (!relType) {
            hasUntypedEdge = true;
          } else if ((relType === 'attached-to' || relType === 'contains') && dir !== 'target-to-source') {
            hasValidVpcAttachment = true;
            break;
          } else if ((relType === 'attached-to' || relType === 'depends-on') && dir === 'target-to-source') {
            hasValidVpcAttachment = true;
            break;
          } else {
            hasInvalidRelEdge = true;
            invalidRelType = relType;
          }
        }
      }
    }

    if (hasValidVpcAttachment) {
      continue;
    }

    const igwLabel = igw.data.label || igw.id;

    if (hasUntypedEdge) {
      findings.push({
        id: `STRUCT-003-${igw.id}`,
        ruleId: 'STRUCT-003',
        ruleTitle: 'Internet Gateway Must Attach to a VPC',
        category: 'structural',
        severity: 'high',
        status: 'invalid',
        affectedNodeIds: [igw.id],
        message: `Internet Gateway "${igwLabel}" is connected to VPC "${connectedVpcLabel}" by an edge without a defined relationship type.`,
        description: 'An Internet Gateway requires an explicit "attached-to" relationship to attach to a VPC.',
        remediation: 'Configure the connection with relationshipType: "attached-to" from Internet Gateway to VPC.',
        documentationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html',
      });
    } else if (hasInvalidRelEdge) {
      findings.push({
        id: `STRUCT-003-${igw.id}`,
        ruleId: 'STRUCT-003',
        ruleTitle: 'Internet Gateway Must Attach to a VPC',
        category: 'structural',
        severity: 'high',
        status: 'invalid',
        affectedNodeIds: [igw.id],
        message: `Internet Gateway "${igwLabel}" has an invalid "${invalidRelType}" relationship with VPC "${connectedVpcLabel}".`,
        description: 'An Internet Gateway must be connected to a VPC using an "attached-to" relationship.',
        remediation: 'Update the relationship type to "attached-to" from Internet Gateway to VPC.',
        documentationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html',
      });
    } else {
      findings.push({
        id: `STRUCT-003-${igw.id}`,
        ruleId: 'STRUCT-003',
        ruleTitle: 'Internet Gateway Must Attach to a VPC',
        category: 'structural',
        severity: 'high',
        status: 'invalid',
        affectedNodeIds: [igw.id],
        message: `Internet Gateway "${igwLabel}" is not attached to any VPC.`,
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

  // NET-005: NAT Gateway Must Reside in a Public Subnet
  const natGateways = nodes.filter((n) => n.data.resourceType === 'aws_nat_gateway');
  for (const nat of natGateways) {
    const subnetEdge = edges.find((e) => {
      if (e.target !== nat.id && e.source !== nat.id) return false;
      const otherId = e.target === nat.id ? e.source : e.target;
      const otherNode = nodes.find((n) => n.id === otherId);
      return otherNode?.data.resourceType === 'aws_subnet';
    });

    if (!subnetEdge) continue;

    const subnetId = subnetEdge.target === nat.id ? subnetEdge.source : subnetEdge.target;
    const subnetNode = nodes.find((n) => n.id === subnetId);
    if (!subnetNode) continue;

    const hasRouteToIgw = edges.some((e) => {
      if (e.source !== subnetNode.id && e.target !== subnetNode.id) return false;
      const otherId = e.source === subnetNode.id ? e.target : e.source;
      const otherNode = nodes.find((n) => n.id === otherId);
      if (!otherNode) return false;

      const relType = e.data?.relationshipType;
      const dir = e.data?.direction;

      if (otherNode.data.resourceType === 'aws_internet_gateway') {
        if (relType === 'routes-to' || relType === 'attached-to') {
          return dir !== 'target-to-source';
        }
        return false;
      }

      if (otherNode.data.resourceType === 'aws_route_table') {
        const isValidSubnetRtEdge =
          (relType === 'attached-to' || relType === 'routes-to' || relType === 'depends-on') &&
          dir !== 'target-to-source';
        if (!isValidSubnetRtEdge) return false;

        return edges.some((rte) => {
          if (rte.source !== otherNode.id && rte.target !== otherNode.id) return false;
          const targetId = rte.source === otherNode.id ? rte.target : rte.source;
          const targetNode = nodes.find((n) => n.id === targetId);
          if (targetNode?.data.resourceType === 'aws_internet_gateway') return false;

          const rtRelType = rte.data?.relationshipType;
          const rtDir = rte.data?.direction;
          return (
            (rtRelType === 'routes-to' || rtRelType === 'depends-on' || rtRelType === 'attached-to') &&
            rtDir !== 'target-to-source'
          );
        });
      }
      return false;
    });

    if (!hasRouteToIgw) {
      findings.push({
        id: `NET-005-${nat.id}`,
        ruleId: 'NET-005',
        ruleTitle: 'NAT Gateway Must Reside in a Public Subnet',
        category: 'network',
        severity: 'high',
        status: 'invalid',
        affectedNodeIds: [nat.id, subnetNode.id],
        message: `NAT Gateway "${nat.data.label || nat.id}" is placed in subnet "${subnetNode.data.label || subnetNode.id}" without an Internet Gateway route.`,
        description: 'A NAT Gateway in a private subnet cannot route traffic to the internet.',
        remediation: 'Ensure the Subnet hosting the NAT Gateway has a route table entry to an Internet Gateway.',
        documentationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html',
      });
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
    const isMultiAz = db.data.metadata?.multi_az;
    if (isMultiAz === false) {
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
    } else if (isMultiAz === undefined || isMultiAz === null) {
      findings.push({
        id: `REL-001-unknown-${db.id}`,
        ruleId: 'REL-001',
        ruleTitle: 'RDS High Availability Multi-AZ Configuration',
        category: 'reliability',
        severity: 'medium',
        status: 'unknown',
        affectedNodeIds: [db.id],
        message: `RDS Instance "${db.data.label || db.id}" does not specify a Multi-AZ deployment configuration.`,
        description: 'Without Multi-AZ configured, high availability standby failover across availability zones cannot be verified.',
        remediation: 'Explicitly configure "multi_az = true" in resource settings for high availability.',
        documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html',
      });
    }
  }

  // REL-002: Automated Backup Retention
  for (const db of dbNodes) {
    const retention = db.data.metadata?.backup_retention_period;

    // 1. Missing / null / undefined / empty string -> UNKNOWN
    if (retention === undefined || retention === null || retention === '') {
      findings.push({
        id: `REL-002-unknown-${db.id}`,
        ruleId: 'REL-002',
        ruleTitle: 'RDS Automated Backups Enabled',
        category: 'reliability',
        severity: 'medium',
        status: 'unknown',
        affectedNodeIds: [db.id],
        message: `RDS Instance "${db.data.label || db.id}" has no backup retention period specified.`,
        description: 'Automated backup retention is not configured, risking data loss in disaster recovery scenarios.',
        remediation: 'Configure a backup retention period of between 7 and 35 days in resource properties.',
        documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html',
      });
      continue;
    }

    // 2. Parse number and validate non-numeric
    const numRetention =
      typeof retention === 'number'
        ? retention
        : typeof retention === 'string' && retention.trim() !== ''
          ? Number(retention)
          : NaN;

    if (isNaN(numRetention)) {
      findings.push({
        id: `REL-002-invalid-${db.id}`,
        ruleId: 'REL-002',
        ruleTitle: 'RDS Automated Backups Enabled',
        category: 'reliability',
        severity: 'high',
        status: 'invalid',
        affectedNodeIds: [db.id],
        message: `RDS Instance "${db.data.label || db.id}" has invalid non-numeric backup retention "${retention}".`,
        description: 'Backup retention period must be an integer between 7 and 35 days representing snapshot retention in days.',
        remediation: 'Set backup_retention_period to an integer between 7 and 35 days.',
        documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html',
      });
      continue;
    }

    // 3. Fractional number check
    if (!Number.isInteger(numRetention)) {
      findings.push({
        id: `REL-002-invalid-${db.id}`,
        ruleId: 'REL-002',
        ruleTitle: 'RDS Automated Backups Enabled',
        category: 'reliability',
        severity: 'high',
        status: 'invalid',
        affectedNodeIds: [db.id],
        message: `RDS Instance "${db.data.label || db.id}" has fractional backup retention "${retention}". Retention must be a whole number of days.`,
        description: 'Backup retention period must be an integer representing snapshot retention in whole days.',
        remediation: 'Set backup_retention_period to a whole integer between 7 and 35 days.',
        documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html',
      });
      continue;
    }

    // 4. Negative number check
    if (numRetention < 0) {
      findings.push({
        id: `REL-002-invalid-${db.id}`,
        ruleId: 'REL-002',
        ruleTitle: 'RDS Automated Backups Enabled',
        category: 'reliability',
        severity: 'high',
        status: 'invalid',
        affectedNodeIds: [db.id],
        message: `RDS Instance "${db.data.label || db.id}" has negative backup retention (${numRetention} days).`,
        description: 'Backup retention period cannot be negative.',
        remediation: 'Set backup_retention_period to an integer between 7 and 35 days.',
        documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html',
      });
      continue;
    }

    // 5. Explicitly disabled (0 days)
    if (numRetention === 0) {
      findings.push({
        id: `REL-002-${db.id}`,
        ruleId: 'REL-002',
        ruleTitle: 'RDS Automated Backups Enabled',
        category: 'reliability',
        severity: 'high',
        status: 'invalid',
        affectedNodeIds: [db.id],
        message: `RDS Instance "${db.data.label || db.id}" has automated backups disabled (retention = 0).`,
        description: 'A backup retention of 0 disables automated point-in-time recovery snapshots entirely.',
        remediation: 'Configure a backup retention period of between 7 and 35 days.',
        documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html',
      });
      continue;
    }

    // 6. Exceeds AWS maximum of 35 days
    if (numRetention > 35) {
      findings.push({
        id: `REL-002-invalid-${db.id}`,
        ruleId: 'REL-002',
        ruleTitle: 'RDS Automated Backups Enabled',
        category: 'reliability',
        severity: 'high',
        status: 'invalid',
        affectedNodeIds: [db.id],
        message: `RDS Instance "${db.data.label || db.id}" specifies ${numRetention} days retention, exceeding AWS maximum limit of 35 days.`,
        description: 'Amazon RDS supports a maximum automated backup retention period of 35 days.',
        remediation: 'Reduce backup_retention_period to 35 days or fewer, or use AWS Backup for longer retention.',
        documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html',
      });
      continue;
    }

    // 7. Below production policy recommendation (1-6 days) -> status: 'unknown', severity: 'medium'
    if (numRetention >= 1 && numRetention < 7) {
      findings.push({
        id: `REL-002-policy-${db.id}`,
        ruleId: 'REL-002',
        ruleTitle: 'RDS Automated Backups Enabled',
        category: 'reliability',
        severity: 'medium',
        status: 'unknown',
        affectedNodeIds: [db.id],
        message: `RDS Instance "${db.data.label || db.id}" has backup retention period of ${numRetention} day(s), which is below the recommended 7 days for production workloads.`,
        description: 'While AWS allows retention periods from 1 to 35 days, CloudForge best practices recommend at least 7 days for production recovery.',
        remediation: 'Increase backup_retention_period to at least 7 days for production environments.',
        documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html',
      });
      continue;
    }

    // 8. 7 to 35 days: fully compliant, no finding generated.
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
