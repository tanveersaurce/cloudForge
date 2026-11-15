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
 * Route relationships represent actual packet forwarding / route entries.
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

/**
 * Validates explicitly supported subnet-to-route-table association relationships.
 * Does NOT accept generic 'connects-to', 'routes-through', or arbitrary labels containing 'assoc'.
 */
function isAssociationRelationship(rel?: string): boolean {
  if (!rel) return false;
  const r = rel.toLowerCase();
  return (
    r === 'associated-with' ||
    r === 'associates-with' ||
    r === 'subnet-association'
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
    // If destination is specified but not 0.0.0.0/0 (e.g. 10.0.0.0/16 or 198.51.100.0/24), not a default route
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
 * Checks if a CIDR block belongs to a private/local IPv4 or IPv6 network range.
 */
function isPrivateOrLocalCidr(cidr: string): boolean {
  const trimmed = cidr.trim();
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(trimmed)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(trimmed)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(trimmed)) return true;
  if (/^fc00:/.test(trimmed) || /^fd00:/.test(trimmed)) return true;
  return false;
}

/**
 * Validates if a route is a local VPC route (destination in VPC/private CIDR and target 'local').
 */
function isLocalVpcRoute(r: RouteEntry, vpcCidr?: string): boolean {
  const dest = (r.destination || r.destinationCidr || r.destination_cidr_block || '').trim().toLowerCase();
  const target = (r.target || r.gatewayId || r.natGatewayId || r.targetType || '').trim().toLowerCase();

  // Target must explicitly be 'local'
  if (target !== 'local') return false;

  // Cannot be default internet route
  if (dest === '0.0.0.0/0' || dest === '::/0' || dest === 'default') return false;

  // Destination must match VPC CIDR if known, or be a private RFC 1918 CIDR block
  if (vpcCidr && dest === vpcCidr.trim().toLowerCase()) return true;
  return isPrivateOrLocalCidr(dest);
}

/**
 * Finds Route Table nodes that are actually associated with the given subnet.
 * Checks:
 * 1. Subnet metadata routeTableId referencing the Route Table node
 * 2. Explicit association edge ('associated-with', 'subnet-association')
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
      const rel = edge.data?.relationshipType;
      // Accept only explicitly supported association relationships
      if (!isAssociationRelationship(rel)) continue;

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
 * Strict Rules:
 * 1. Enforces complete 3-hop verification:
 *    Subnet -> Actual Route Table Association -> Explicit Default Route (0.0.0.0/0) -> Correct Gateway Target (IGW/NAT).
 *    Direct Subnet -> IGW/NAT edges without an associated Route Table are rejected (unknown).
 * 2. Prevents subnet metadata route bypass: Subnet routes must belong to an associated Route Table.
 * 3. Tight association validation: Only 'associated-with', 'associates-with', 'subnet-association' accepted.
 *    Generic 'connects-to', 'routes-through', or arbitrary labels containing 'assoc' are rejected.
 * 4. Strict isolated subnet verification: All configured routes must be local VPC routes with target 'local',
 *    and no internet egress route can exist. Non-local restricted routes return unknown.
 * 5. Strict topology requirement: If allNodes is missing or required evidence cannot be verified, return unknown.
 */
export function classifySubnet(
  subnetData: AwsResourceNodeData,
  subnetId?: string,
  allNodes?: ArchitectureFlowNode[],
  allEdges?: ArchitectureFlowEdge[],
): SubnetClassificationResult {
  // Rule 5: Strict topology requirement
  if (!allNodes || allNodes.length === 0) {
    return {
      classification: 'unknown',
      confidence: 'unknown',
      reason: 'Insufficient topology: allNodes is required for verified subnet routing classification.',
      hasIgwRoute: false,
      hasNatRoute: false,
    };
  }

  const metadata = subnetData.metadata || {};
  let hasIgwRoute = false;
  let hasNatRoute = false;
  let allAssociatedRoutesLocal = false;
  let hasNonLocalRoute = false;

  // Retrieve VPC CIDR if available from parent VPC or metadata
  const vpcCidr = (metadata.vpcCidr || metadata.vpc_cidr || '') as string;

  // Rule 1 & 2: Subnet must have an actual Route Table association
  const associatedRouteTables = getAssociatedRouteTables(
    subnetData,
    subnetId,
    allNodes,
    allEdges,
  );

  if (associatedRouteTables.length > 0) {
    let totalRoutesChecked = 0;
    let localRoutesCount = 0;

    for (const rtNode of associatedRouteTables) {
      // Inspect routes defined on the associated Route Table's metadata
      const rtMetadataRoutes: RouteEntry[] = Array.isArray(rtNode.data.metadata?.routes)
        ? (rtNode.data.metadata.routes as RouteEntry[])
        : Array.isArray((rtNode.data.metadata?.routeTable as Record<string, unknown>)?.routes)
          ? ((rtNode.data.metadata.routeTable as Record<string, unknown>).routes as RouteEntry[])
          : [];

      for (const r of rtMetadataRoutes) {
        totalRoutesChecked++;
        const dest = (r.destination || r.destinationCidr || r.destination_cidr_block || '').trim();
        const target = (r.target || r.gatewayId || r.natGatewayId || '').trim();
        const isDefault = dest === '0.0.0.0/0' || dest === '::/0' || dest.toLowerCase() === 'default';

        if (isDefault) {
          // Rule 5: Exact target ID verification against allNodes
          if (verifyIgwTargetId(target, allNodes)) {
            hasIgwRoute = true;
          }
          if (verifyNatTargetId(target, allNodes)) {
            hasNatRoute = true;
          }
        } else if (isLocalVpcRoute(r, vpcCidr)) {
          localRoutesCount++;
        } else {
          // Non-local restricted route (e.g. 198.51.100.0/24 or target != 'local')
          hasNonLocalRoute = true;
        }
      }

      // Inspect outgoing route edges from the associated Route Table
      if (allEdges) {
        const rtEdges = allEdges.filter(
          (e) => e.source === rtNode.id || e.target === rtNode.id,
        );

        for (const edge of rtEdges) {
          const rel = edge.data?.relationshipType;
          // Must be an active route relationship
          if (!isRouteRelationship(rel)) continue;

          // Must require explicit default route (0.0.0.0/0 or ::/0)
          if (!isExplicitDefaultRoute(edge.data?.metadata, edge.data?.label)) {
            // Check if it's a restricted non-default route
            const dest = (edge.data?.metadata?.destinationCidr || edge.data?.metadata?.destination || '') as string;
            if (dest && !isPrivateOrLocalCidr(dest)) {
              hasNonLocalRoute = true;
            }
            continue;
          }

          const targetId = edge.source === rtNode.id ? edge.target : edge.source;
          const targetNode = allNodes.find((n) => n.id === targetId);
          if (!targetNode) continue;

          totalRoutesChecked++;
          if (isInternetGatewayNode(targetNode)) {
            hasIgwRoute = true;
          }
          if (isNatGatewayNode(targetNode)) {
            hasNatRoute = true;
          }
        }
      }
    }

    if (totalRoutesChecked > 0 && localRoutesCount === totalRoutesChecked && !hasNonLocalRoute) {
      allAssociatedRoutesLocal = true;
    }
  }

  // --- Classification Determination ---

  // 1. Public: Complete 3-hop verification: Subnet -> Route Table -> IGW (0.0.0.0/0)
  if (hasIgwRoute) {
    return {
      classification: 'public',
      confidence: 'verified',
      reason: 'Verified 3-hop route: Subnet -> Route Table -> Internet Gateway (0.0.0.0/0).',
      hasIgwRoute: true,
      hasNatRoute,
    };
  }

  // 2. Private: Complete 3-hop verification: Subnet -> Route Table -> NAT Gateway (0.0.0.0/0)
  if (hasNatRoute) {
    return {
      classification: 'private',
      confidence: 'verified',
      reason: 'Verified 3-hop route: Subnet -> Route Table -> NAT Gateway egress (0.0.0.0/0).',
      hasIgwRoute: false,
      hasNatRoute: true,
    };
  }

  // 3. Database Subnet: Explicitly configured database workload tier with no direct IGW
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

  // 4. Isolated Subnet:
  // Rule 4: Verify that all configured routes are local VPC routes and that NO internet egress route exists.
  // If non-local routes exist or routes cannot be verified as local-only, return unknown.
  if (hasNonLocalRoute) {
    return {
      classification: 'unknown',
      confidence: 'unknown',
      reason: 'Subnet contains non-local or unverified routes that do not qualify as local VPC isolation.',
      hasIgwRoute: false,
      hasNatRoute: false,
    };
  }

  const isExplicitlyIsolated =
    allAssociatedRoutesLocal ||
    ((metadata.isolated === true || explicitSubnetType === 'isolated') && !hasNonLocalRoute);

  if (isExplicitlyIsolated && !hasIgwRoute && !hasNatRoute) {
    return {
      classification: 'isolated',
      confidence: 'verified',
      reason: 'Configured as isolated subnet with local-only VPC routing and no internet egress routes.',
      hasIgwRoute: false,
      hasNatRoute: false,
    };
  }

  // 5. Incomplete / Misleading / Ambiguous fallback
  if (explicitSubnetType === 'public') {
    return {
      classification: 'unknown',
      confidence: 'unknown',
      reason: 'Subnet designated as public lacks verified Subnet -> Route Table -> Internet Gateway association.',
      hasIgwRoute: false,
      hasNatRoute: false,
    };
  }

  if (explicitSubnetType === 'private') {
    return {
      classification: 'unknown',
      confidence: 'unknown',
      reason: 'Subnet designated as private lacks verified Subnet -> Route Table -> NAT Gateway association.',
      hasIgwRoute: false,
      hasNatRoute: false,
    };
  }

  return {
    classification: 'unknown',
    confidence: 'unknown',
    reason: 'Insufficient networking configuration: missing verified Subnet -> Route Table -> Gateway path.',
    hasIgwRoute: false,
    hasNatRoute: false,
  };
}
