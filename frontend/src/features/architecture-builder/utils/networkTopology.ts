import type {
  ArchitectureFlowEdge,
  ArchitectureFlowNode,
  AwsResourceNodeData,
} from '../types/architecture.types';
import { parseCidr } from '../../validation/utils/cidrUtils';

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
 * Resolves the configured VPC CIDR for a subnet from:
 * 1. Subnet metadata (vpcCidr, vpc_cidr, vpcCidrBlock)
 * 2. Parent VPC node on canvas (via parentId)
 * 3. Associated VPC node (via metadata.vpcId)
 */
function resolveVpcCidr(
  subnetData: AwsResourceNodeData,
  subnetId?: string,
  allNodes?: ArchitectureFlowNode[],
): string | null {
  const metadata = subnetData.metadata || {};
  const directCidr = (metadata.vpcCidr || metadata.vpc_cidr || metadata.vpcCidrBlock) as string | undefined;
  if (directCidr && typeof directCidr === 'string' && directCidr.trim()) {
    return directCidr.trim();
  }

  if (!subnetId || !allNodes || allNodes.length === 0) return null;

  const subnetNode = allNodes.find((n) => n.id === subnetId);
  if (!subnetNode) return null;

  if (subnetNode.parentId) {
    const parentNode = allNodes.find((n) => n.id === subnetNode.parentId);
    if (parentNode) {
      const pMeta = parentNode.data.metadata || {};
      const pCidr = (pMeta.cidr_block || pMeta.cidrBlock || pMeta.cidr || pMeta.vpcCidr) as string | undefined;
      if (pCidr && typeof pCidr === 'string' && pCidr.trim()) {
        return pCidr.trim();
      }
    }
  }

  const vpcId = (metadata.vpcId || metadata.vpc_id) as string | undefined;
  if (vpcId && typeof vpcId === 'string') {
    const vpcNode = findNodeById(vpcId, allNodes);
    if (vpcNode) {
      const vMeta = vpcNode.data.metadata || {};
      const vCidr = (vMeta.cidr_block || vMeta.cidrBlock || vMeta.cidr || vMeta.vpcCidr) as string | undefined;
      if (vCidr && typeof vCidr === 'string' && vCidr.trim()) {
        return vCidr.trim();
      }
    }
  }

  return null;
}

/**
 * Validates if a route is an exact local VPC route:
 * 1. Target must explicitly be 'local'.
 * 2. Cannot be a default internet route (0.0.0.0/0, ::/0).
 * 3. VPC CIDR must be available and valid IPv4 CIDR.
 * 4. Route destination CIDR must be valid IPv4 CIDR.
 * 5. Route destination CIDR must match the actual configured VPC CIDR exactly.
 * RFC1918 private CIDRs that do not match the configured VPC CIDR are strictly rejected.
 */
function isLocalVpcRoute(r: RouteEntry, vpcCidr?: string | null): boolean {
  const dest = (r.destination || r.destinationCidr || r.destination_cidr_block || '').trim();
  const target = (r.target || r.gatewayId || r.natGatewayId || r.targetType || '').trim().toLowerCase();

  // Target must explicitly be 'local'
  if (target !== 'local') return false;

  // Cannot be default internet route
  if (dest === '0.0.0.0/0' || dest === '::/0' || dest.toLowerCase() === 'default') return false;

  // Exact VPC CIDR verification required
  if (!vpcCidr) return false;

  const parsedVpc = parseCidr(vpcCidr);
  const parsedDest = parseCidr(dest);
  if (!parsedVpc || !parsedDest) return false;

  return (
    parsedVpc.ipNumber === parsedDest.ipNumber &&
    parsedVpc.prefix === parsedDest.prefix
  );
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

  // Exact VPC CIDR resolution
  const vpcCidr = resolveVpcCidr(subnetData, subnetId, allNodes);

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
    const tableClassifications: ('public' | 'private' | 'isolated' | 'unknown')[] = [];

    for (const rtNode of associatedRouteTables) {
      let tableHasIgw = false;
      let tableHasNat = false;
      let tableLocalCount = 0;
      let tableRoutesCount = 0;
      let tableNonLocal = false;

      // Inspect routes defined on the associated Route Table's metadata
      const rtMetadataRoutes: RouteEntry[] = Array.isArray(rtNode.data.metadata?.routes)
        ? (rtNode.data.metadata.routes as RouteEntry[])
        : Array.isArray((rtNode.data.metadata?.routeTable as Record<string, unknown>)?.routes)
          ? ((rtNode.data.metadata.routeTable as Record<string, unknown>).routes as RouteEntry[])
          : [];

      for (const r of rtMetadataRoutes) {
        totalRoutesChecked++;
        tableRoutesCount++;
        const dest = (r.destination || r.destinationCidr || r.destination_cidr_block || '').trim();
        const target = (r.target || r.gatewayId || r.natGatewayId || '').trim();
        const isDefault = dest === '0.0.0.0/0' || dest === '::/0' || dest.toLowerCase() === 'default';

        if (isDefault) {
          // Rule 5: Exact target ID verification against allNodes
          if (verifyIgwTargetId(target, allNodes)) {
            hasIgwRoute = true;
            tableHasIgw = true;
          }
          if (verifyNatTargetId(target, allNodes)) {
            hasNatRoute = true;
            tableHasNat = true;
          }
        } else if (isLocalVpcRoute(r, vpcCidr)) {
          localRoutesCount++;
          tableLocalCount++;
        } else {
          // Non-local restricted route or VPC CIDR mismatch
          hasNonLocalRoute = true;
          tableNonLocal = true;
        }
      }

      // Inspect outgoing route edges from the associated Route Table
      // Rule 3: Enforce Route Table -> Gateway direction strictly (edge.source === rtNode.id).
      // Reject reversed edges (such as IGW -> Route Table or NAT -> Route Table).
      if (allEdges) {
        const outgoingRtEdges = allEdges.filter((e) => e.source === rtNode.id);

        for (const edge of outgoingRtEdges) {
          const rel = edge.data?.relationshipType;
          // Must be an active route relationship
          if (!isRouteRelationship(rel)) continue;

          // Must require explicit default route (0.0.0.0/0 or ::/0)
          if (!isExplicitDefaultRoute(edge.data?.metadata, edge.data?.label)) {
            // Check if it's a restricted non-default route
            const dest = (edge.data?.metadata?.destinationCidr || edge.data?.metadata?.destination || '') as string;
            if (dest && !isLocalVpcRoute({ destination: dest, target: 'local' }, vpcCidr)) {
              hasNonLocalRoute = true;
              tableNonLocal = true;
            }
            continue;
          }

          const targetNode = allNodes.find((n) => n.id === edge.target);
          if (!targetNode) continue;

          totalRoutesChecked++;
          tableRoutesCount++;
          if (isInternetGatewayNode(targetNode)) {
            hasIgwRoute = true;
            tableHasIgw = true;
          }
          if (isNatGatewayNode(targetNode)) {
            hasNatRoute = true;
            tableHasNat = true;
          }
        }
      }

      // Record classification for this individual route table
      if (tableHasIgw && tableHasNat) {
        tableClassifications.push('unknown');
      } else if (tableHasIgw) {
        tableClassifications.push('public');
      } else if (tableHasNat) {
        tableClassifications.push('private');
      } else if (tableLocalCount > 0 && tableLocalCount === tableRoutesCount && !tableNonLocal) {
        tableClassifications.push('isolated');
      } else {
        tableClassifications.push('unknown');
      }
    }

    // Rule 2: Detect multiple conflicting Route Table associations
    if (associatedRouteTables.length > 1) {
      const distinctActiveTypes = new Set(
        tableClassifications.filter((t) => t !== 'unknown'),
      );
      if (distinctActiveTypes.size > 1 || (hasIgwRoute && hasNatRoute)) {
        return {
          classification: 'unknown',
          confidence: 'unknown',
          reason: 'Conflicting Route Table associations detected: subnet is associated with multiple route tables providing conflicting routing (IGW vs NAT Gateway).',
          hasIgwRoute,
          hasNatRoute,
        };
      }
    }

    if (totalRoutesChecked > 0 && localRoutesCount === totalRoutesChecked && !hasNonLocalRoute) {
      allAssociatedRoutesLocal = true;
    }
  }

  // Detect conflict within single table or overall routes
  if (hasIgwRoute && hasNatRoute) {
    return {
      classification: 'unknown',
      confidence: 'unknown',
      reason: 'Conflicting routes detected: subnet has multiple conflicting default routes (both Internet Gateway and NAT Gateway).',
      hasIgwRoute: true,
      hasNatRoute: true,
    };
  }

  // --- Classification Determination ---

  // 1. Public: Complete 3-hop verification: Subnet -> Route Table -> IGW (0.0.0.0/0)
  if (hasIgwRoute) {
    return {
      classification: 'public',
      confidence: 'verified',
      reason: 'Verified 3-hop route: Subnet -> Route Table -> Internet Gateway (0.0.0.0/0).',
      hasIgwRoute: true,
      hasNatRoute: false,
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
  // Rule 1: If VPC CIDR is unavailable or cannot be verified, return unknown instead of claiming verified isolation.
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
    // Exact VPC CIDR verification: if unavailable or invalid, return unknown
    if (!vpcCidr || !parseCidr(vpcCidr)) {
      return {
        classification: 'unknown',
        confidence: 'unknown',
        reason: 'Cannot verify isolated subnet: VPC CIDR is unavailable or cannot be verified.',
        hasIgwRoute: false,
        hasNatRoute: false,
      };
    }

    if (!allAssociatedRoutesLocal && (metadata.isolated === true || explicitSubnetType === 'isolated')) {
      if (associatedRouteTables.length === 0) {
        return {
          classification: 'unknown',
          confidence: 'unknown',
          reason: 'Subnet designated as isolated lacks verified Route Table association with local VPC routing.',
          hasIgwRoute: false,
          hasNatRoute: false,
        };
      }
    }

    if (allAssociatedRoutesLocal && !hasNonLocalRoute) {
      return {
        classification: 'isolated',
        confidence: 'verified',
        reason: 'Configured as isolated subnet with local-only VPC routing and no internet egress routes.',
        hasIgwRoute: false,
        hasNatRoute: false,
      };
    }
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
