import type { Connection, Edge, Node, Viewport } from '@xyflow/react';

export interface CanvasViewportDto {
  x: number;
  y: number;
  zoom: number;
}

export interface AwsResourceNodeData extends Record<string, unknown> {
  serviceId: string;
  serviceSlug: string;
  serviceName: string;
  categorySlug: string;
  categoryName: string;
  iconKey: string;
  resourceName: string;
  resourceType: string;
  label: string;
  description: string;
  metadata: Record<string, unknown>;
}

export type RelationshipType =
  | 'contains'
  | 'attached-to'
  | 'routes-to'
  | 'connects-to'
  | 'sends-traffic-to'
  | 'receives-traffic-from'
  | 'depends-on'
  | 'accesses'
  | 'replicates-to'
  | 'load-balances-to'
  | 'stores-data-in'
  | 'triggers';

export type RelationshipDirection =
  | 'source-to-target'
  | 'target-to-source'
  | 'bidirectional';

export type RelationshipCategory =
  | 'structural'
  | 'dependency'
  | 'network'
  | 'storage'
  | 'replication'
  | 'integration'
  | 'security';

export type DependencyKind =
  | 'hard-dependency'
  | 'optional'
  | 'logical'
  | 'network-traffic'
  | 'security-permission';

export interface RelationshipMetadata {
  protocol?: string | null;
  port?: number | null;
  description?: string;
  [key: string]: unknown;
}

export interface AwsResourceEdgeData extends Record<string, unknown> {
  relationshipType: RelationshipType | string;
  direction?: RelationshipDirection;
  label?: string;
  metadata?: RelationshipMetadata;
}

export type ArchitectureFlowNode = Node<AwsResourceNodeData, 'awsResource'>;
export type ArchitectureFlowEdge = Edge<AwsResourceEdgeData>;

export interface ArchitectureNodeDto {
  id: string;
  type: 'awsResource';
  position: {
    x: number;
    y: number;
  };
  data: AwsResourceNodeData;
}

export interface ArchitectureEdgeDto {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type: 'smoothstep' | 'relationship';
  data?: AwsResourceEdgeData;
}

export interface ArchitectureSummaryDto {
  id: string;
  userId: string | null;
  name: string;
  description: string | null;
  region: string;
  status: string;
  resourceCount: number;
  edgeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArchitectureDetailDto extends ArchitectureSummaryDto {
  nodes: ArchitectureNodeDto[];
  edges: ArchitectureEdgeDto[];
  viewport: Viewport;
}

export interface AwsResourceRegistryItem {
  key: string;
  serviceId: string;
  serviceSlug: string;
  serviceName: string;
  shortName: string;
  categorySlug: string;
  categoryName: string;
  categoryIconKey: string;
  iconKey: string;
  resourceName: string;
  resourceType: string;
  description: string;
}

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

export interface PendingConnection {
  connection: Connection;
  sourceNodeId: string;
  targetNodeId: string;
}

export interface CreateArchitectureInput {
  name: string;
  description?: string;
  region?: string;
}

export interface UpdateArchitectureMetadataInput {
  name?: string;
  description?: string | null;
  region?: string;
  status?: string;
}

export interface SaveArchitectureCanvasInput {
  nodes: ArchitectureNodeDto[];
  edges: ArchitectureEdgeDto[];
  viewport: CanvasViewportDto;
}
