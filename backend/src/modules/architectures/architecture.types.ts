export interface CanvasViewportDto {
  x: number;
  y: number;
  zoom: number;
}

export interface ArchitectureNodeDataDto {
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

export interface ArchitectureNodeDto {
  id: string;
  type: 'awsResource';
  position: {
    x: number;
    y: number;
  };
  data: ArchitectureNodeDataDto;
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

export interface RelationshipMetadataDto {
  protocol?: string | null;
  port?: number | null;
  description?: string;
  [key: string]: unknown;
}

export interface ArchitectureEdgeDataDto {
  relationshipType: string;
  direction?: RelationshipDirection;
  label?: string;
  metadata?: RelationshipMetadataDto;
}

export interface ArchitectureEdgeDto {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type: 'smoothstep' | 'relationship';
  data?: ArchitectureEdgeDataDto;
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
  viewport: CanvasViewportDto;
}
