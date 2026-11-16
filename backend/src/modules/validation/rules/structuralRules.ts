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
      // Check parentId hierarchy first
      const hasParentVpcId =
        Boolean(subnet.parentId) &&
        ctx.nodes.some((n) => n.id === subnet.parentId && n.data.resourceType === 'aws_vpc');

      // Check containment/attachment edge with valid relationship type and direction
      const hasVpcEdge = ctx.edges.some((edge) => {
        const relType = edge.data?.relationshipType;
        const dir = edge.data?.direction;

        if (edge.target === subnet.id) {
          const sourceNode = ctx.nodes.find((n) => n.id === edge.source);
          if (sourceNode?.data.resourceType !== 'aws_vpc') return false;
          // VPC -> Subnet: valid if 'contains' (and not target-to-source), or default untyped edge
          if (!relType && dir !== 'target-to-source') return true;
          if (relType === 'contains' && dir !== 'target-to-source') return true;
          if ((relType === 'attached-to' || relType === 'depends-on') && dir === 'target-to-source') return true;
          return false;
        }

        if (edge.source === subnet.id) {
          const targetNode = ctx.nodes.find((n) => n.id === edge.target);
          if (targetNode?.data.resourceType !== 'aws_vpc') return false;
          // Subnet -> VPC: valid if 'attached-to' or 'depends-on' (and not target-to-source)
          if ((relType === 'attached-to' || relType === 'depends-on') && dir !== 'target-to-source') return true;
          if (relType === 'contains' && dir === 'target-to-source') return true;
          return false;
        }

        return false;
      });

      if (!hasParentVpcId && !hasVpcEdge) {
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
      // Check parentId hierarchy first
      const hasParentSubnetId =
        Boolean(candidate.parentId) &&
        ctx.nodes.some((n) => n.id === candidate.parentId && n.data.resourceType === 'aws_subnet');

      // Check containment/attachment edge with valid relationship type and direction
      const hasSubnetEdge = ctx.edges.some((edge) => {
        const relType = edge.data?.relationshipType;
        const dir = edge.data?.direction;

        if (edge.target === candidate.id) {
          const sourceNode = ctx.nodes.find((n) => n.id === edge.source);
          if (sourceNode?.data.resourceType !== 'aws_subnet') return false;
          // Subnet -> Resource: valid if 'contains' (and not target-to-source) or default untyped edge
          if (!relType && dir !== 'target-to-source') return true;
          if (relType === 'contains' && dir !== 'target-to-source') return true;
          if ((relType === 'attached-to' || relType === 'depends-on') && dir === 'target-to-source') return true;
          return false;
        }

        if (edge.source === candidate.id) {
          const targetNode = ctx.nodes.find((n) => n.id === edge.target);
          if (targetNode?.data.resourceType !== 'aws_subnet') return false;
          // Resource -> Subnet: valid if 'attached-to' or 'depends-on' (and not target-to-source)
          if ((relType === 'attached-to' || relType === 'depends-on') && dir !== 'target-to-source') return true;
          if (relType === 'contains' && dir === 'target-to-source') return true;
          return false;
        }

        return false;
      });

      if (!hasParentSubnetId && !hasSubnetEdge) {
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
      // Check attachment edge with valid relationship type and direction
      const hasVpcAttachment = ctx.edges.some((edge) => {
        const relType = edge.data?.relationshipType;
        const dir = edge.data?.direction;

        if (edge.source === igw.id) {
          const targetNode = ctx.nodes.find((n) => n.id === edge.target);
          if (targetNode?.data.resourceType !== 'aws_vpc') return false;
          // IGW -> VPC: valid if 'attached-to' or 'depends-on' (and not target-to-source)
          if (!relType && dir !== 'target-to-source') return true;
          if ((relType === 'attached-to' || relType === 'depends-on') && dir !== 'target-to-source') return true;
          if (relType === 'contains' && dir === 'target-to-source') return true;
          return false;
        }

        if (edge.target === igw.id) {
          const sourceNode = ctx.nodes.find((n) => n.id === edge.source);
          if (sourceNode?.data.resourceType !== 'aws_vpc') return false;
          // VPC -> IGW: valid if 'attached-to' or 'contains' (and not target-to-source)
          if (!relType && dir !== 'target-to-source') return true;
          if ((relType === 'attached-to' || relType === 'contains') && dir !== 'target-to-source') return true;
          if ((relType === 'attached-to' || relType === 'depends-on') && dir === 'target-to-source') return true;
          return false;
        }

        return false;
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
