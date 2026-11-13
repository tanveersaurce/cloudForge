import type { ValidationFinding, ValidationRule } from '../types/validation.types.js';
import { doCidrsOverlap, isCidrContained, parseCidr } from '../utils/cidrUtils.js';

export const cidrFormatRule: ValidationRule = {
  metadata: {
    id: 'NET-003',
    title: 'Valid IPv4 CIDR Block Format',
    category: 'network',
    severity: 'critical',
    description: 'VPCs and Subnets must declare valid IPv4 CIDR blocks in prefix notation (e.g., 10.0.0.0/16).',
    remediationTemplate: 'Provide a valid RFC 1918 IPv4 CIDR block such as 10.0.0.0/16 or 172.16.0.0/16.',
    documentationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Subnets.html#vpc-sizing-ipv4',
  },
  evaluate: (ctx): ValidationFinding[] => {
    const findings: ValidationFinding[] = [];
    const networkNodes = ctx.nodes.filter(
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

    return findings;
  },
};

export const subnetCidrContainmentRule: ValidationRule = {
  metadata: {
    id: 'NET-001',
    title: 'Subnet CIDR Must Be Contained in VPC CIDR',
    category: 'network',
    severity: 'critical',
    description: 'Each Subnet CIDR block must be fully contained within the address space of its parent VPC.',
    remediationTemplate: 'Adjust the Subnet CIDR so that it falls strictly within the parent VPC CIDR range.',
    documentationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Subnets.html',
  },
  evaluate: (ctx): ValidationFinding[] => {
    const findings: ValidationFinding[] = [];
    const subnets = ctx.nodes.filter((n) => n.data.resourceType === 'aws_subnet');

    for (const subnet of subnets) {
      const subnetCidr = subnet.data.metadata?.cidr_block;
      if (typeof subnetCidr !== 'string' || !parseCidr(subnetCidr)) {
        continue;
      }

      // Find parent VPC
      const parentVpcEdge = ctx.edges.find((e) => {
        if (e.target !== subnet.id && e.source !== subnet.id) return false;
        const otherId = e.target === subnet.id ? e.source : e.target;
        const otherNode = ctx.nodes.find((n) => n.id === otherId);
        return otherNode?.data.resourceType === 'aws_vpc';
      });

      if (!parentVpcEdge) continue;
      const vpcId = parentVpcEdge.target === subnet.id ? parentVpcEdge.source : parentVpcEdge.target;
      const vpcNode = ctx.nodes.find((n) => n.id === vpcId);
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
          remediation: `Change Subnet CIDR to a prefix within ${vpcCidr} (e.g., subnetting the VPC network).`,
          documentationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Subnets.html',
        });
      }
    }

    return findings;
  },
};

export const subnetCidrOverlapRule: ValidationRule = {
  metadata: {
    id: 'NET-002',
    title: 'Subnet CIDR Blocks Must Not Overlap',
    category: 'network',
    severity: 'critical',
    description: 'Subnets within the same VPC must have distinct, non-overlapping IPv4 CIDR blocks.',
    remediationTemplate: 'Assign unique, non-overlapping subnet IP ranges.',
    documentationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Subnets.html',
  },
  evaluate: (ctx): ValidationFinding[] => {
    const findings: ValidationFinding[] = [];
    const vpcs = ctx.nodes.filter((n) => n.data.resourceType === 'aws_vpc');

    for (const vpc of vpcs) {
      // Find all subnets connected to this VPC
      const subnetNodes = ctx.nodes.filter((n) => {
        if (n.data.resourceType !== 'aws_subnet') return false;
        return ctx.edges.some(
          (e) =>
            (e.source === vpc.id && e.target === n.id) ||
            (e.target === vpc.id && e.source === n.id),
        );
      });

      for (let i = 0; i < subnetNodes.length; i++) {
        const s1 = subnetNodes[i];
        const cidr1 = s1.data.metadata?.cidr_block;
        if (typeof cidr1 !== 'string' || !parseCidr(cidr1)) continue;

        for (let j = i + 1; j < subnetNodes.length; j++) {
          const s2 = subnetNodes[j];
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
              message: `Subnet "${s1.data.label}" (${cidr1}) overlaps with Subnet "${s2.data.label}" (${cidr2}) in VPC "${vpc.data.label}".`,
              description: 'AWS does not permit overlapping CIDR allocations within the same VPC.',
              remediation: 'Reallocate non-conflicting CIDRs across all subnets in the VPC.',
              documentationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Subnets.html',
            });
          }
        }
      }
    }

    return findings;
  },
};

export const natGatewayPublicPlacementRule: ValidationRule = {
  metadata: {
    id: 'NET-005',
    title: 'NAT Gateway Must Reside in a Public Subnet',
    category: 'network',
    severity: 'high',
    description: 'NAT Gateways must be placed in a public subnet that routes 0.0.0.0/0 to an Internet Gateway.',
    remediationTemplate: 'Associate the NAT Gateway with a subnet routed to an Internet Gateway.',
    documentationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html',
  },
  evaluate: (ctx): ValidationFinding[] => {
    const findings: ValidationFinding[] = [];
    const natGateways = ctx.nodes.filter((n) => n.data.resourceType === 'aws_nat_gateway');

    for (const nat of natGateways) {
      // Find connected subnet
      const subnetEdge = ctx.edges.find((e) => {
        if (e.target !== nat.id && e.source !== nat.id) return false;
        const otherId = e.target === nat.id ? e.source : e.target;
        const otherNode = ctx.nodes.find((n) => n.id === otherId);
        return otherNode?.data.resourceType === 'aws_subnet';
      });

      if (!subnetEdge) continue; // Handled by STRUCT-002

      const subnetId = subnetEdge.target === nat.id ? subnetEdge.source : subnetEdge.target;
      const subnetNode = ctx.nodes.find((n) => n.id === subnetId);
      if (!subnetNode) continue;

      // Check if this subnet is public by inspecting route table or direct connection to IGW
      const hasRouteToIgw = ctx.edges.some((e) => {
        if (e.source !== subnetNode.id && e.target !== subnetNode.id) return false;
        const otherId = e.source === subnetNode.id ? e.target : e.source;
        const otherNode = ctx.nodes.find((n) => n.id === otherId);
        if (!otherNode) return false;
        if (otherNode.data.resourceType === 'aws_internet_gateway') return true;
        if (otherNode.data.resourceType === 'aws_route_table') {
          // Check route table edges to IGW
          return ctx.edges.some((rte) => {
            if (rte.source !== otherNode.id && rte.target !== otherNode.id) return false;
            const targetId = rte.source === otherNode.id ? rte.target : rte.source;
            const targetNode = ctx.nodes.find((n) => n.id === targetId);
            return targetNode?.data.resourceType === 'aws_internet_gateway';
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

    return findings;
  },
};

export const networkRules: ValidationRule[] = [
  cidrFormatRule,
  subnetCidrContainmentRule,
  subnetCidrOverlapRule,
  natGatewayPublicPlacementRule,
];
