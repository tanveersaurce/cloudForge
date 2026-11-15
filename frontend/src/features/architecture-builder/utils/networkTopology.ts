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

interface RouteEntry {
  destination?: string;
  destinationCidr?: string;
  destination_cidr_block?: string;
  target?: string;
  gatewayId?: string;
  natGatewayId?: string;
  targetType?: string;
}

function isInternetGateway(node: ArchitectureFlowNode): boolean {
  const resType = (node.data.resourceType || '').toLowerCase();
  const slug = (node.data.serviceSlug || '').toLowerCase();
  const icon = (node.data.iconKey || '').toLowerCase();
  return (
    resType === 'internet-gateway' ||
    resType === 'aws_internet_gateway' ||
    slug === 'internet-gateway' ||
    slug === 'aws-internet-gateway' ||
    icon === 'internet-gateway'
  );
}

function isNatGateway(node: ArchitectureFlowNode): boolean {
  const resType = (node.data.resourceType || '').toLowerCase();
  const slug = (node.data.serviceSlug || '').toLowerCase();
  const icon = (node.data.iconKey || '').toLowerCase();
  return (
    resType === 'nat-gateway' ||
    resType === 'aws_nat_gateway' ||
    slug === 'nat-gateway' ||
    slug === 'aws-nat-gateway' ||
    icon === 'nat-gateway'
  );
}

function isRouteTableNode(node: ArchitectureFlowNode): boolean {
  const resType = (node.data.resourceType || '').toLowerCase();
  const slug = (node.data.serviceSlug || '').toLowerCase();
  return (
    resType === 'route-table' ||
    resType === 'aws_route_table' ||
    slug === 'route-table' ||
    slug === 'aws-route-table'
  );
}

/**
 * Checks if an edge represents an active routing association.
 * Unrelated edges (e.g. connects-to, accesses, monitors, replicates-to) are not routing evidence.
 */
function isRouteEdge(edge: ArchitectureFlowEdge): boolean {
  const rel = (edge.data?.relationshipType || '').toLowerCase();
  const meta = edge.data?.metadata || {};
  const hasDestCidr = Boolean(
    meta.destinationCidr || meta.destination_cidr_block || meta.destination,
  );

  return (
    rel === 'routes-to' ||
    rel === 'routes-traffic-to' ||
    rel === 'default-route' ||
    rel === 'attached-to' ||
    rel === 'gateway-attachment' ||
    rel === 'associated-with' ||
    hasDestCidr
  );
}

/**
 * Validates whether the route targets a default internet destination (0.0.0.0/0 or ::/0).
 * If destination CIDR is restricted to an internal block (e.g. 10.0.0.0/16), it is NOT a default route.
 */
function isDefaultInternetRoute(edge: ArchitectureFlowEdge): boolean {
  const meta = edge.data?.metadata || {};
  const dest = (
    meta.destinationCidr ||
    meta.destination_cidr_block ||
    meta.destination ||
    ''
  ) as string;

  if (!dest) return true; // Default / implicit default route when routing to a gateway
  const trimmed = dest.trim().toLowerCase();
  return trimmed === '0.0.0.0/0' || trimmed === '::/0' || trimmed === 'default';
}

/**
 * Classifies a subnet using actual networking evidence rather than naive label substring matching.
 *
 * Rules:
 * 1. Never classify a subnet as public solely because its label or metadata says "public".
 * 2. Verify public reachability using actual route table, subnet association, destination CIDR (0.0.0.0/0)
 *    and Internet Gateway configuration.
 * 3. Classify private subnets only when valid NAT-based routing is established without direct IGW access.
 * 4. Do not classify unrelated graph connections (EC2, RDS, ALB) as isolated subnet evidence.
 * 5. If networking configuration is incomplete or ambiguous, return 'unknown'.
 * 6. Keep classification separate from visual labels and display names.
 */
export function classifySubnet(
  subnetData: AwsResourceNodeData,
  subnetId?: string,
  allNodes?: ArchitectureFlowNode[],
  allEdges?: ArchitectureFlowEdge[],
): SubnetClassificationResult {
  const metadata = subnetData.metadata || {};
  let hasIgwRoute = false;
  let hasNatRoute = false;
  let hasExplicitLocalRouteTable = false;

  // 1. Inspect explicit route table defined in subnet metadata
  const routesConfig: RouteEntry[] = Array.isArray(metadata.routes)
    ? (metadata.routes as RouteEntry[])
    : Array.isArray((metadata.routeTable as Record<string, unknown>)?.routes)
      ? ((metadata.routeTable as Record<string, unknown>).routes as RouteEntry[])
      : [];

  if (routesConfig.length > 0) {
    let hasDefaultRoute = false;
    for (const r of routesConfig) {
      const dest = (r.destination || r.destinationCidr || r.destination_cidr_block || '').trim();
      const target = (r.target || r.gatewayId || r.natGatewayId || r.targetType || '').toLowerCase();
      const isDefault = dest === '0.0.0.0/0' || dest === '::/0' || dest.toLowerCase() === 'default';

      if (isDefault) {
        hasDefaultRoute = true;
        if (target.includes('igw') || target.includes('internet-gateway')) {
          // If allNodes is provided, verify IGW actually exists in topology
          const igwExists = allNodes ? allNodes.some(isInternetGateway) : true;
          if (igwExists) {
            hasIgwRoute = true;
          }
        }
        if (target.includes('nat')) {
          const natExists = allNodes ? allNodes.some(isNatGateway) : true;
          if (natExists) {
            hasNatRoute = true;
          }
        }
      }
    }

    if (!hasDefaultRoute && routesConfig.length > 0) {
      // Route table configured with only local / VPC endpoints routes
      hasExplicitLocalRouteTable = true;
    }
  }

  // 2. Topology Inspection: Verify route associations via graph edges
  if (subnetId && allNodes && allEdges) {
    // Direct edges connected to this subnet
    const directEdges = allEdges.filter(
      (e) => e.source === subnetId || e.target === subnetId,
    );

    // Child nodes contained within this subnet
    const childNodeIds = new Set(
      allNodes.filter((n) => n.parentId === subnetId).map((n) => n.id),
    );

    // Evaluate direct routing edges from the subnet
    for (const edge of directEdges) {
      if (!isRouteEdge(edge)) continue;

      const otherId = edge.source === subnetId ? edge.target : edge.source;
      const otherNode = allNodes.find((n) => n.id === otherId);
      if (!otherNode) continue;

      // Check direct link to Internet Gateway with default route
      if (isInternetGateway(otherNode)) {
        if (isDefaultInternetRoute(edge)) {
          hasIgwRoute = true;
        }
      }

      // Check direct link to NAT Gateway
      if (isNatGateway(otherNode)) {
        if (isDefaultInternetRoute(edge)) {
          hasNatRoute = true;
        }
      }

      // Check link to Route Table intermediary
      if (isRouteTableNode(otherNode)) {
        const rtEdges = allEdges.filter(
          (e) => e.source === otherId || e.target === otherId,
        );
        for (const rtEdge of rtEdges) {
          if (!isRouteEdge(rtEdge) || !isDefaultInternetRoute(rtEdge)) continue;
          const targetId = rtEdge.source === otherId ? rtEdge.target : rtEdge.source;
          const targetNode = allNodes.find((n) => n.id === targetId);
          if (!targetNode) continue;

          if (isInternetGateway(targetNode)) {
            hasIgwRoute = true;
          }
          if (isNatGateway(targetNode)) {
            hasNatRoute = true;
          }
        }
      }
    }

    // Evaluate child workloads routing to NAT or IGW
    if (childNodeIds.size > 0) {
      for (const edge of allEdges) {
        if (!isRouteEdge(edge)) continue;
        const isSourceChild = childNodeIds.has(edge.source);
        const isTargetChild = childNodeIds.has(edge.target);
        if (!isSourceChild && !isTargetChild) continue;

        const otherId = isSourceChild ? edge.target : edge.source;
        const otherNode = allNodes.find((n) => n.id === otherId);
        if (!otherNode) continue;

        if (isNatGateway(otherNode) && isDefaultInternetRoute(edge)) {
          hasNatRoute = true;
        }
        if (isInternetGateway(otherNode) && isDefaultInternetRoute(edge)) {
          hasIgwRoute = true;
        }
      }
    }
  }

  // 3. Classification Determination

  // Public: Verified default route to an Internet Gateway
  if (hasIgwRoute) {
    return {
      classification: 'public',
      confidence: 'verified',
      reason: 'Verified direct route to Internet Gateway (IGW) with 0.0.0.0/0 public reachability.',
      hasIgwRoute: true,
      hasNatRoute,
    };
  }

  // Private: Verified egress route through NAT Gateway without direct IGW reachability
  if (hasNatRoute) {
    return {
      classification: 'private',
      confidence: 'verified',
      reason: 'Outbound egress routed through NAT Gateway without direct Internet Gateway reachability.',
      hasIgwRoute: false,
      hasNatRoute: true,
    };
  }

  // Database Subnet: Explicitly configured database workload tier with no direct IGW
  const explicitSubnetType = (metadata.subnetType as string)?.toLowerCase();
  const explicitTier = (metadata.tier as string)?.toLowerCase();
  const explicitPurpose = (metadata.purpose as string)?.toLowerCase();

  if (
    explicitSubnetType === 'database' ||
    explicitTier === 'database' ||
    explicitPurpose === 'database'
  ) {
    return {
      classification: 'database',
      confidence: 'verified',
      reason: 'Explicitly configured as isolated Database Subnet for database workloads.',
      hasIgwRoute: false,
      hasNatRoute: false,
    };
  }

  // Isolated Subnet: Verified local-only VPC routing with no internet egress
  const isExplicitlyIsolated =
    metadata.isolated === true ||
    explicitSubnetType === 'isolated' ||
    metadata.routesOnlyLocal === true ||
    hasExplicitLocalRouteTable;

  if (isExplicitlyIsolated) {
    return {
      classification: 'isolated',
      confidence: 'verified',
      reason: 'Configured as isolated subnet with local-only VPC routing and no internet egress routes.',
      hasIgwRoute: false,
      hasNatRoute: false,
    };
  }

  // Incomplete / Misleading / Ambiguous: Never assume public or private based on labels or partial configs
  if (explicitSubnetType === 'public') {
    return {
      classification: 'unknown',
      confidence: 'unknown',
      reason: 'Subnet designated as public lacks required Internet Gateway (0.0.0.0/0) route table association.',
      hasIgwRoute: false,
      hasNatRoute: false,
    };
  }

  if (explicitSubnetType === 'private') {
    return {
      classification: 'unknown',
      confidence: 'unknown',
      reason: 'Subnet designated as private lacks required NAT Gateway egress route association.',
      hasIgwRoute: false,
      hasNatRoute: false,
    };
  }

  return {
    classification: 'unknown',
    confidence: 'unknown',
    reason: 'Insufficient networking configuration: no verified route table, Internet Gateway, or NAT Gateway route detected.',
    hasIgwRoute: false,
    hasNatRoute: false,
  };
}
