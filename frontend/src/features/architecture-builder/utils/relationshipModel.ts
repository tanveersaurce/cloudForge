import type {
  AwsResourceEdgeData,
  DependencyKind,
  RelationshipCategory,
  RelationshipDirection,
  RelationshipMetadata,
  RelationshipType,
} from '../types/architecture.types';

export interface RelationshipDefinition {
  type: RelationshipType;
  label: string;
  shortTag: string;
  category: RelationshipCategory;
  dependencyKind: DependencyKind;
  defaultDirection: RelationshipDirection;
  allowsBidirectional: boolean;
  isAcyclicRequired: boolean;
  description: string;
  strokeColor: string;
  strokeDasharray?: string;
  badgeClassName: string;
}

export const RELATIONSHIP_DEFINITIONS: Record<RelationshipType, RelationshipDefinition> = {
  contains: {
    type: 'contains',
    label: 'Contains',
    shortTag: 'CONT',
    category: 'structural',
    dependencyKind: 'hard-dependency',
    defaultDirection: 'source-to-target',
    allowsBidirectional: false,
    isAcyclicRequired: true,
    description: 'Parent resource structurally contains or scopes the child resource (e.g., VPC contains Subnet).',
    strokeColor: '#38bdf8',
    badgeClassName: 'border-sky-500/40 bg-sky-500/15 text-sky-300',
  },
  'attached-to': {
    type: 'attached-to',
    label: 'Attached To',
    shortTag: 'ATCH',
    category: 'structural',
    dependencyKind: 'hard-dependency',
    defaultDirection: 'source-to-target',
    allowsBidirectional: false,
    isAcyclicRequired: true,
    description: 'Resource is explicitly attached to or associated with another resource (e.g., IGW attached to VPC).',
    strokeColor: '#22d3ee',
    strokeDasharray: '6 3',
    badgeClassName: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300',
  },
  'routes-to': {
    type: 'routes-to',
    label: 'Routes To',
    shortTag: 'ROUT',
    category: 'network',
    dependencyKind: 'network-traffic',
    defaultDirection: 'source-to-target',
    allowsBidirectional: false,
    isAcyclicRequired: false,
    description: 'Route table or network gateway directs packet forwarding toward a target.',
    strokeColor: '#60a5fa',
    strokeDasharray: '8 4',
    badgeClassName: 'border-blue-500/40 bg-blue-500/15 text-blue-300',
  },
  'connects-to': {
    type: 'connects-to',
    label: 'Connects To',
    shortTag: 'CONN',
    category: 'network',
    dependencyKind: 'logical',
    defaultDirection: 'source-to-target',
    allowsBidirectional: true,
    isAcyclicRequired: false,
    description: 'Logical or network-level association between two infrastructure resources.',
    strokeColor: '#818cf8',
    badgeClassName: 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300',
  },
  'sends-traffic-to': {
    type: 'sends-traffic-to',
    label: 'Sends Traffic To',
    shortTag: 'TX',
    category: 'network',
    dependencyKind: 'network-traffic',
    defaultDirection: 'source-to-target',
    allowsBidirectional: true,
    isAcyclicRequired: false,
    description: 'Application or network tier initiates traffic toward the target resource.',
    strokeColor: '#34d399',
    badgeClassName: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  },
  'receives-traffic-from': {
    type: 'receives-traffic-from',
    label: 'Receives Traffic From',
    shortTag: 'RX',
    category: 'network',
    dependencyKind: 'network-traffic',
    defaultDirection: 'target-to-source',
    allowsBidirectional: false,
    isAcyclicRequired: false,
    description: 'Resource accepts inbound traffic from the specified source resource.',
    strokeColor: '#2dd4bf',
    strokeDasharray: '5 3',
    badgeClassName: 'border-teal-500/40 bg-teal-500/15 text-teal-300',
  },
  'load-balances-to': {
    type: 'load-balances-to',
    label: 'Load Balances To',
    shortTag: 'LB',
    category: 'network',
    dependencyKind: 'network-traffic',
    defaultDirection: 'source-to-target',
    allowsBidirectional: false,
    isAcyclicRequired: false,
    description: 'Load balancer distributes incoming requests across target compute resources.',
    strokeColor: '#4ade80',
    badgeClassName: 'border-green-500/40 bg-green-500/15 text-green-300',
  },
  'depends-on': {
    type: 'depends-on',
    label: 'Depends On',
    shortTag: 'DEP',
    category: 'dependency',
    dependencyKind: 'hard-dependency',
    defaultDirection: 'source-to-target',
    allowsBidirectional: false,
    isAcyclicRequired: true,
    description: 'Source resource requires the target resource to exist or be provisioned first.',
    strokeColor: '#fbbf24',
    strokeDasharray: '4 4',
    badgeClassName: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  },
  accesses: {
    type: 'accesses',
    label: 'Accesses',
    shortTag: 'ACC',
    category: 'security',
    dependencyKind: 'security-permission',
    defaultDirection: 'source-to-target',
    allowsBidirectional: false,
    isAcyclicRequired: false,
    description: 'Resource accesses or assumes an identity/resource (requires explicit IAM & network rules).',
    strokeColor: '#f472b6',
    strokeDasharray: '3 3',
    badgeClassName: 'border-pink-500/40 bg-pink-500/15 text-pink-300',
  },
  'stores-data-in': {
    type: 'stores-data-in',
    label: 'Stores Data In',
    shortTag: 'DATA',
    category: 'storage',
    dependencyKind: 'logical',
    defaultDirection: 'source-to-target',
    allowsBidirectional: false,
    isAcyclicRequired: false,
    description: 'Compute or service persists application objects, state, or records in target storage.',
    strokeColor: '#a78bfa',
    badgeClassName: 'border-violet-500/40 bg-violet-500/15 text-violet-300',
  },
  'replicates-to': {
    type: 'replicates-to',
    label: 'Replicates To',
    shortTag: 'REPL',
    category: 'replication',
    dependencyKind: 'optional',
    defaultDirection: 'source-to-target',
    allowsBidirectional: true,
    isAcyclicRequired: false,
    description: 'Data or state is asynchronously or synchronously replicated to a target resource.',
    strokeColor: '#fb923c',
    strokeDasharray: '7 3 2 3',
    badgeClassName: 'border-orange-500/40 bg-orange-500/15 text-orange-300',
  },
  triggers: {
    type: 'triggers',
    label: 'Triggers',
    shortTag: 'TRIG',
    category: 'integration',
    dependencyKind: 'logical',
    defaultDirection: 'source-to-target',
    allowsBidirectional: false,
    isAcyclicRequired: false,
    description: 'Event source invokes or publishes notifications/messages to a downstream target.',
    strokeColor: '#e879f9',
    strokeDasharray: '6 2',
    badgeClassName: 'border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-300',
  },
};

export const ALL_RELATIONSHIP_TYPES = Object.keys(RELATIONSHIP_DEFINITIONS) as RelationshipType[];

export function normalizeRelationshipType(rawType?: string): RelationshipType {
  if (!rawType) return 'connects-to';
  if (rawType === 'traffic-flow') return 'sends-traffic-to';
  if (rawType in RELATIONSHIP_DEFINITIONS) {
    return rawType as RelationshipType;
  }
  return 'connects-to';
}

export function getRelationshipDefinition(rawType?: string): RelationshipDefinition {
  const normalized = normalizeRelationshipType(rawType);
  return RELATIONSHIP_DEFINITIONS[normalized];
}

export function normalizeEdgeData(data?: AwsResourceEdgeData): Required<
  Pick<AwsResourceEdgeData, 'relationshipType' | 'direction' | 'label' | 'metadata'>
> {
  const relType = normalizeRelationshipType(data?.relationshipType);
  const def = RELATIONSHIP_DEFINITIONS[relType];
  const direction: RelationshipDirection = data?.direction ?? def.defaultDirection;
  const label = data?.label?.trim() ? data.label.trim() : def.label;
  const metadata: RelationshipMetadata = {
    protocol: data?.metadata?.protocol ?? null,
    port: data?.metadata?.port ?? null,
    description: data?.metadata?.description ?? '',
    ...(data?.metadata ?? {}),
  };

  return {
    relationshipType: relType,
    direction,
    label,
    metadata,
  };
}
