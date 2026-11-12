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

export interface ArchitectureEdgeDataDto {
  relationshipType: string;
  label?: string;
}

export interface ArchitectureEdgeDto {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type: 'smoothstep';
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
