import type {
  ArchitectureFlowEdge,
  ArchitectureFlowNode,
  AwsResourceNodeData,
} from '../types/architecture.types';

export type SubnetClassification = 'public' | 'private' | 'isolated' | 'database' | 'unknown';

export interface SubnetClassificationResult {
  classification: SubnetClassification;
  confidence: 'verified' | 'inferred' | 'unknown';
  reason: string;
  hasIgwRoute: boolean;
  hasNatRoute: boolean;
}

/**
 * Classifies a subnet using actual networking evidence rather than naive label substring matching.
 * Factors evaluated:
 * - Direct or route table links to an Internet Gateway (public)
 * - Route to a NAT Gateway without direct IGW attachment (private)
 * - Explicit verified subnet metadata
 * - Isolated subnets with no route to either
 * - Incomplete or ambiguous configurations marked as 'unknown'
 */
export function classifySubnet(
  subnetData: AwsResourceNodeData,
  subnetId?: string,
  allNodes?: ArchitectureFlowNode[],
  allEdges?: ArchitectureFlowEdge[],
): SubnetClassificationResult {
  const metadata = subnetData.metadata || {};

  // 1. Explicit verified metadata
  const explicitType = (metadata.subnetType as string)?.toLowerCase();
  if (explicitType === 'database') {
    return {
      classification: 'database',
      confidence: 'verified',
      reason: 'Explicitly configured as isolated Database Subnet in metadata.',
      hasIgwRoute: false,
      hasNatRoute: false,
    };
  }
  if (explicitType === 'private') {
    return {
      classification: 'private',
      confidence: 'verified',
      reason: 'Explicitly configured as Private Subnet in metadata.',
      hasIgwRoute: false,
      hasNatRoute: true,
    };
  }
  if (explicitType === 'public') {
    return {
      classification: 'public',
      confidence: 'verified',
      reason: 'Explicitly configured as Public Subnet in metadata.',
      hasIgwRoute: true,
      hasNatRoute: false,
    };
  }
  if (explicitType === 'isolated') {
    return {
      classification: 'isolated',
      confidence: 'verified',
      reason: 'Explicitly configured as Isolated Subnet without egress routes.',
      hasIgwRoute: false,
      hasNatRoute: false,
    };
  }

  // 2. Topology Inspection if graph context is available
  if (subnetId && allNodes && allEdges) {
    const connectedEdges = allEdges.filter(
      (e) => e.source === subnetId || e.target === subnetId,
    );

    let hasIgwRoute = false;
    let hasNatRoute = false;

    for (const edge of connectedEdges) {
      const otherId = edge.source === subnetId ? edge.target : edge.source;
      const otherNode = allNodes.find((n) => n.id === otherId);
      if (!otherNode) continue;

      const resType = otherNode.data.resourceType?.toLowerCase();
      if (resType === 'internet-gateway' || resType === 'aws_internet_gateway') {
        hasIgwRoute = true;
      }
      if (resType === 'nat-gateway' || resType === 'aws_nat_gateway') {
        hasNatRoute = true;
      }
    }

    if (hasIgwRoute) {
      return {
        classification: 'public',
        confidence: 'verified',
        reason: 'Directly routed to Internet Gateway (IGW).',
        hasIgwRoute: true,
        hasNatRoute,
      };
    }

    if (hasNatRoute) {
      return {
        classification: 'private',
        confidence: 'verified',
        reason: 'Outbound egress routed through NAT Gateway without direct IGW attachment.',
        hasIgwRoute: false,
        hasNatRoute: true,
      };
    }

    // If connected to a VPC that has an IGW or standalone isolated
    if (connectedEdges.length > 0) {
      return {
        classification: 'isolated',
        confidence: 'inferred',
        reason: 'No default route to Internet Gateway or NAT Gateway detected.',
        hasIgwRoute: false,
        hasNatRoute: false,
      };
    }
  }

  // 3. Fallback: If not enough networking information is available, mark as 'unknown'
  return {
    classification: 'unknown',
    confidence: 'unknown',
    reason: 'Insufficient networking configuration to determine public reachability.',
    hasIgwRoute: false,
    hasNatRoute: false,
  };
}
