import type { Edge, Node, Viewport } from '@xyflow/react';

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

export interface AwsResourceEdgeData extends Record<string, unknown> {
  relationshipType: string;
  label?: string;
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
  type: 'smoothstep';
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
