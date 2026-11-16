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
      // 1. Check parentId hierarchy first
      const hasParentVpcId =
        Boolean(subnet.parentId) &&
        ctx.nodes.some((n) => n.id === subnet.parentId && n.data.resourceType === 'aws_vpc');

      if (hasParentVpcId) {
        continue;
      }

      // 2. Inspect edges connecting to VPC
      let hasValidVpcEdge = false;
      let hasUntypedEdge = false;
      let hasInvalidRelEdge = false;
      let connectedVpcLabel = '';
      let invalidRelType = '';

      for (const edge of ctx.edges) {
        const relType = edge.data?.relationshipType;
        const dir = edge.data?.direction;

        if (edge.target === subnet.id) {
          const sourceNode = ctx.nodes.find((n) => n.id === edge.source);
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
          const targetNode = ctx.nodes.find((n) => n.id === edge.target);
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
      // 1. Check parentId hierarchy first
      const hasParentSubnetId =
        Boolean(candidate.parentId) &&
        ctx.nodes.some((n) => n.id === candidate.parentId && n.data.resourceType === 'aws_subnet');

      if (hasParentSubnetId) {
        continue;
      }

      // 2. Inspect edges connecting to Subnet
      let hasValidSubnetEdge = false;
      let hasUntypedEdge = false;
      let hasInvalidRelEdge = false;
      let connectedSubnetLabel = '';
      let invalidRelType = '';

      for (const edge of ctx.edges) {
        const relType = edge.data?.relationshipType;
        const dir = edge.data?.direction;

        if (edge.target === candidate.id) {
          const sourceNode = ctx.nodes.find((n) => n.id === edge.source);
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
          const targetNode = ctx.nodes.find((n) => n.id === edge.target);
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
      let hasValidVpcAttachment = false;
      let hasUntypedEdge = false;
      let hasInvalidRelEdge = false;
      let connectedVpcLabel = '';
      let invalidRelType = '';

      for (const edge of ctx.edges) {
        const relType = edge.data?.relationshipType;
        const dir = edge.data?.direction;

        if (edge.source === igw.id) {
          const targetNode = ctx.nodes.find((n) => n.id === edge.target);
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
          const sourceNode = ctx.nodes.find((n) => n.id === edge.source);
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

    return findings;
  },
};

export const structuralRules: ValidationRule[] = [
  subnetVpcContainmentRule,
  computeSubnetPlacementRule,
  internetGatewayAttachmentRule,
];
