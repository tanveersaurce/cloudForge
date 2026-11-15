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

export function isInternetGatewayNode(node: ArchitectureFlowNode): boolean {
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

export function isNatGatewayNode(node: ArchitectureFlowNode): boolean {
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

export function isRouteTableNode(node: ArchitectureFlowNode): boolean {
  const resType = (node.data.resourceType || '').toLowerCase();
  const slug = (node.data.serviceSlug || '').toLowerCase();
  const icon = (node.data.iconKey || '').toLowerCase();
  return (
    resType === 'route-table' ||
    resType === 'aws_route_table' ||
    slug === 'route-table' ||
    slug === 'aws-route-table' ||
    icon === 'route-table'
  );
}

/**
 * Route relationships represent actual packet forwarding/routes.
 * Structural links like 'attached-to', 'associated-with', 'gateway-attachment'
 * are attachment / association links, NOT route hops.
 */
function isRouteRelationship(rel?: string): boolean {
  if (!rel) return false;
  const r = rel.toLowerCase();
  return (
    r === 'routes-to' ||
    r === 'routes-traffic-to' ||
    r === 'default-route' ||
    r === 'routes'
  );
}

function isAssociationRelationship(rel?: string, edgeLabel?: string): boolean {
  if (!rel) return false;
  const r = rel.toLowerCase();
  const l = (edgeLabel || '').toLowerCase();
  return (
    r === 'associated-with' ||
    r === 'associates-with' ||
    r === 'subnet-association' ||
    r === 'attached-to' ||
    r === 'routes-through' ||
    r === 'connects-to' ||
    l.includes('assoc')
  );
}

/**
 * Extracts and strictly validates destination CIDR.
 * NEVER treats a missing destination CIDR as 0.0.0.0/0.
 * Requires an explicit 0.0.0.0/0, ::/0 or explicit default route destination.
 */
function extractExplicitDefaultDestination(
  meta?: Record<string, unknown>,
  label?: string,
): string | null {
  const raw = (
    meta?.destinationCidr ||
    meta?.destination_cidr_block ||
    meta?.destination ||
    ''
  ) as string;

  if (raw && typeof raw === 'string') {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed === '0.0.0.0/0' || trimmed === '::/0' || trimmed === 'default') {
      return trimmed;
    }
    // If destination is specified but not 0.0.0.0/0 (e.g. 10.0.0.0/16), it's not a default route
    return null;
  }

  // Also check edge label if it explicitly specifies 0.0.0.0/0 or ::/0
  if (label && typeof label === 'string') {
    const trimmed = label.trim().toLowerCase();
    if (trimmed.includes('0.0.0.0/0') || trimmed.includes('::/0')) {
      return '0.0.0.0/0';
    }
  }

  // Missing destination CIDR is NOT a default route
  return null;
}

function isExplicitDefaultRoute(meta?: Record<string, unknown>, label?: string): boolean {
  return extractExplicitDefaultDestination(meta, label) !== null;
}

function findNodeById(id: string, allNodes: ArchitectureFlowNode[]): ArchitectureFlowNode | undefined {
  if (!id) return undefined;
  const cleanId = id.trim().toLowerCase();
  return allNodes.find((n) => n.id.toLowerCase() === cleanId);
}

function verifyIgwTargetId(targetId: string, allNodes: ArchitectureFlowNode[]): boolean {
  const node = findNodeById(targetId, allNodes);
  return Boolean(node && isInternetGatewayNode(node));
}

function verifyNatTargetId(targetId: string, allNodes: ArchitectureFlowNode[]): boolean {
  const node = findNodeById(targetId, allNodes);
  return Boolean(node && isNatGatewayNode(node));
}

/**
 * Finds Route Table nodes that are actually associated with the given subnet.
 * Checks:
 * 1. Subnet metadata routeTableId referencing the Route Table node
 * 2. Graph edge between Subnet and Route Table with association relationship
 * 3. Route Table node metadata subnetIds referencing this subnet
 */
function getAssociatedRouteTables(
  subnetData: AwsResourceNodeData,
  subnetId?: string,
  allNodes?: ArchitectureFlowNode[],
  allEdges?: ArchitectureFlowEdge[],
): ArchitectureFlowNode[] {
  if (!allNodes || allNodes.length === 0) return [];
  const associatedTables: ArchitectureFlowNode[] = [];
  const metadata = subnetData.metadata || {};
  const metaRtId = (metadata.routeTableId || metadata.associatedRouteTableId) as string | undefined;

  // 1. Metadata reference from subnet
  if (metaRtId) {
    const rtNode = findNodeById(metaRtId, allNodes);
    if (rtNode && isRouteTableNode(rtNode)) {
      associatedTables.push(rtNode);
    }
  }

  // 2. Association edge between Subnet and Route Table
  if (subnetId && allEdges) {
    const directEdges = allEdges.filter(
      (e) => e.source === subnetId || e.target === subnetId,
    );
    for (const edge of directEdges) {
      const rel = (edge.data?.relationshipType || '').toLowerCase();
      const label = (edge.data?.label || '').toLowerCase();
      if (!isAssociationRelationship(rel, label)) continue;

      const otherId = edge.source === subnetId ? edge.target : edge.source;
      const otherNode = allNodes.find((n) => n.id === otherId);
      if (otherNode && isRouteTableNode(otherNode)) {
        if (!associatedTables.some((t) => t.id === otherNode.id)) {
          associatedTables.push(otherNode);
        }
      }
    }
  }

  // 3. Metadata reference on Route Table
  if (subnetId) {
    for (const n of allNodes) {
      if (!isRouteTableNode(n)) continue;
      const subnetList = (n.data.metadata?.subnetIds || n.data.metadata?.subnets) as unknown;
      if (Array.isArray(subnetList) && subnetList.includes(subnetId)) {
        if (!associatedTables.some((t) => t.id === n.id)) {
          associatedTables.push(n);
        }
      }
    }
  }

  return associatedTables;
}

/**
 * Classifies a subnet using strict AWS networking evidence.
 *
 * Requirements:
 * 1. Never treat a missing destination CIDR as 0.0.0.0/0. Require an explicit valid default route.
 * 2. Do not treat 'attached-to', 'associated-with', or 'gateway-attachment' alone as routing evidence.
 * 3. Verify the complete relationship: Subnet -> Route Table association -> Route -> IGW/NAT target.
 * 4. A route table must actually be associated with the subnet before using its routes for classification.
 * 5. Verify NAT/IGW target IDs against the correct resource, not merely the existence of any NAT/IGW node.
 * 6. If association or route information is missing, return 'unknown'.
 * 7. Do not classify unrelated graph connections (EC2, RDS, ALB) as isolated subnet evidence.
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

  // 1. Inspect explicit route table configured directly in subnet metadata
  const routesConfig: RouteEntry[] = Array.isArray(metadata.routes)
    ? (metadata.routes as RouteEntry[])
    : Array.isArray((metadata.routeTable as Record<string, unknown>)?.routes)
      ? ((metadata.routeTable as Record<string, unknown>).routes as RouteEntry[])
      : [];

  if (routesConfig.length > 0) {
    let hasDefaultRoute = false;
    for (const r of routesConfig) {
      const dest = (r.destination || r.destinationCidr || r.destination_cidr_block || '').trim();
      const target = (r.target || r.gatewayId || r.natGatewayId || r.targetType || '').trim();
      const isDefault = dest === '0.0.0.0/0' || dest === '::/0' || dest.toLowerCase() === 'default';

      if (isDefault) {
        hasDefaultRoute = true;
        // Verify target ID against correct resource if allNodes is provided
        if (allNodes && allNodes.length > 0) {
          if (verifyIgwTargetId(target, allNodes)) {
            hasIgwRoute = true;
          }
          if (verifyNatTargetId(target, allNodes)) {
            hasNatRoute = true;
          }
        } else {
          // If no canvas topology is provided, check explicit target format
          const targetLower = target.toLowerCase();
          if (targetLower.includes('igw') || targetLower.includes('internet-gateway')) {
            hasIgwRoute = true;
          }
          if (targetLower.includes('nat')) {
            hasNatRoute = true;
          }
        }
      }
    }

    if (!hasDefaultRoute && routesConfig.length > 0) {
      hasExplicitLocalRouteTable = true;
    }
  }

  // 2. Topology Inspection: Verify associated route tables and route edges
  if (allNodes && allNodes.length > 0) {
    // A. Subnet -> Route Table association -> Route -> Gateway Target
    const associatedRouteTables = getAssociatedRouteTables(
      subnetData,
      subnetId,
      allNodes,
      allEdges,
    );

    for (const rtNode of associatedRouteTables) {
      // Check routes defined in Route Table node metadata
      const rtMetadataRoutes: RouteEntry[] = Array.isArray(rtNode.data.metadata?.routes)
        ? (rtNode.data.metadata.routes as RouteEntry[])
        : Array.isArray((rtNode.data.metadata?.routeTable as Record<string, unknown>)?.routes)
          ? ((rtNode.data.metadata.routeTable as Record<string, unknown>).routes as RouteEntry[])
          : [];

      for (const r of rtMetadataRoutes) {
        const dest = (r.destination || r.destinationCidr || r.destination_cidr_block || '').trim();
        const target = (r.target || r.gatewayId || r.natGatewayId || '').trim();
        const isDefault = dest === '0.0.0.0/0' || dest === '::/0' || dest.toLowerCase() === 'default';

        if (isDefault) {
          if (verifyIgwTargetId(target, allNodes)) {
            hasIgwRoute = true;
          }
          if (verifyNatTargetId(target, allNodes)) {
            hasNatRoute = true;
          }
        }
      }

      // Check outgoing route edges from the associated Route Table node
      if (allEdges) {
        const rtEdges = allEdges.filter(
          (e) => e.source === rtNode.id || e.target === rtNode.id,
        );

        for (const edge of rtEdges) {
          const rel = edge.data?.relationshipType;
          // Must be an active route relationship; attachments/associations alone are NOT routes
          if (!isRouteRelationship(rel)) continue;

          // Must require an explicit default destination CIDR (never assume default on missing CIDR)
          if (!isExplicitDefaultRoute(edge.data?.metadata, edge.data?.label)) continue;

          const targetId = edge.source === rtNode.id ? edge.target : edge.source;
          const targetNode = allNodes.find((n) => n.id === targetId);
          if (!targetNode) continue;

          if (isInternetGatewayNode(targetNode)) {
            hasIgwRoute = true;
          }
          if (isNatGatewayNode(targetNode)) {
            hasNatRoute = true;
          }
        }
      }
    }

    // B. Direct route edge between Subnet and Gateway (with explicit default CIDR & route relationship)
    if (subnetId && allEdges) {
      const directEdges = allEdges.filter(
        (e) => e.source === subnetId || e.target === subnetId,
      );

      for (const edge of directEdges) {
        const rel = edge.data?.relationshipType;
        // Do NOT treat attached-to, associated-with, or gateway-attachment as routing evidence
        if (!isRouteRelationship(rel)) continue;

        // Must require an explicit default route (0.0.0.0/0 or ::/0)
        if (!isExplicitDefaultRoute(edge.data?.metadata, edge.data?.label)) continue;

        const otherId = edge.source === subnetId ? edge.target : edge.source;
        const otherNode = allNodes.find((n) => n.id === otherId);
        if (!otherNode) continue;

        if (isInternetGatewayNode(otherNode)) {
          hasIgwRoute = true;
        }
        if (isNatGatewayNode(otherNode)) {
          hasNatRoute = true;
        }
      }
    }
  }

  // 3. Classification Determination

  // Public: Complete verified default route (0.0.0.0/0) to an Internet Gateway
  if (hasIgwRoute) {
    return {
      classification: 'public',
      confidence: 'verified',
      reason: 'Verified direct route to Internet Gateway (IGW) with 0.0.0.0/0 public reachability.',
      hasIgwRoute: true,
      hasNatRoute,
    };
  }

  // Private: Complete verified egress route through NAT Gateway without direct IGW reachability
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
