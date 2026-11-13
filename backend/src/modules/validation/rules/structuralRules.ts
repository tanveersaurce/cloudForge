import type { ValidationFinding, ValidationRule } from '../types/validation.types.js';

export const subnetVpcContainmentRule: ValidationRule = {
  metadata: {
    id: 'STRUCT-001',
    title: 'Subnet Must Belong to a VPC',
    category: 'structural',
    severity: 'critical',
    description: 'Every AWS Subnet must reside inside a Virtual Private Cloud (VPC) via a containment relationship.',
    remediationTemplate: 'Connect a parent VPC node to this Subnet using a "contains" relationship edge.',
    documentationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Subnets.html',
  },
  evaluate: (ctx): ValidationFinding[] => {
    const findings: ValidationFinding[] = [];
    const subnets = ctx.nodes.filter((n) => n.data.resourceType === 'aws_subnet');

    for (const subnet of subnets) {
      // Find incoming edges with type 'contains' or outgoing from VPC
      const hasVpcParent = ctx.edges.some((edge) => {
        if (edge.target !== subnet.id) return false;
        const sourceNode = ctx.nodes.find((n) => n.id === edge.source);
        return sourceNode?.data.resourceType === 'aws_vpc';
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

    return findings;
  },
};

export const computeSubnetPlacementRule: ValidationRule = {
  metadata: {
    id: 'STRUCT-002',
    title: 'Compute & DB Resources Must Reside in a Subnet',
    category: 'structural',
    severity: 'high',
    description: 'EC2 instances, RDS instances, and NAT Gateways must be placed in a Subnet.',
    remediationTemplate: 'Connect a parent Subnet to this resource with a "contains" or "attached-to" edge.',
    documentationUrl: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-vpc.html',
  },
  evaluate: (ctx): ValidationFinding[] => {
    const findings: ValidationFinding[] = [];
    const targetTypes = ['aws_instance', 'aws_db_instance', 'aws_nat_gateway'];
    const candidates = ctx.nodes.filter((n) => targetTypes.includes(n.data.resourceType));

    for (const candidate of candidates) {
      const hasSubnetParent = ctx.edges.some((edge) => {
        if (edge.target !== candidate.id && edge.source !== candidate.id) return false;
        const otherId = edge.target === candidate.id ? edge.source : edge.target;
        const otherNode = ctx.nodes.find((n) => n.id === otherId);
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

    return findings;
  },
};

export const internetGatewayAttachmentRule: ValidationRule = {
  metadata: {
    id: 'STRUCT-003',
    title: 'Internet Gateway Must Attach to a VPC',
    category: 'structural',
    severity: 'high',
    description: 'An Internet Gateway must be attached to a VPC to enable internet access.',
    remediationTemplate: 'Connect the Internet Gateway to a VPC using an "attached-to" relationship.',
    documentationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html',
  },
  evaluate: (ctx): ValidationFinding[] => {
    const findings: ValidationFinding[] = [];
    const igws = ctx.nodes.filter((n) => n.data.resourceType === 'aws_internet_gateway');

    for (const igw of igws) {
      const hasVpcAttachment = ctx.edges.some((edge) => {
        if (edge.target !== igw.id && edge.source !== igw.id) return false;
        const otherId = edge.target === igw.id ? edge.source : edge.target;
        const otherNode = ctx.nodes.find((n) => n.id === otherId);
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

    return findings;
  },
};

export const structuralRules: ValidationRule[] = [
  subnetVpcContainmentRule,
  computeSubnetPlacementRule,
  internetGatewayAttachmentRule,
];
