import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Viewport,
} from '@xyflow/react';
import { create } from 'zustand';
import {
  saveArchitectureCanvas,
  updateArchitectureMetadata,
} from '@/features/architecture-builder/services/architectureService';
import type {
  ArchitectureDetailDto,
  ArchitectureEdgeDto,
  ArchitectureFlowEdge,
  ArchitectureFlowNode,
  ArchitectureNodeDto,
  AwsResourceEdgeData,
  AwsResourceNodeData,
  AwsResourceRegistryItem,
  PendingConnection,
  RelationshipDirection,
  RelationshipMetadata,
  RelationshipType,
  SaveStatus,
} from '@/features/architecture-builder/types/architecture.types';
import { normalizeEdgeData } from '@/features/architecture-builder/utils/relationshipModel';

interface GraphSnapshot {
  nodes: ArchitectureFlowNode[];
  edges: ArchitectureFlowEdge[];
}

const MAX_HISTORY = 25;
const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

function toFlowNodes(nodes: ArchitectureNodeDto[]): ArchitectureFlowNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: 'awsResource',
    position: { x: node.position.x, y: node.position.y },
    data: { ...node.data, metadata: { ...(node.data.metadata ?? {}) } },
  }));
}

function toFlowEdges(edges: ArchitectureEdgeDto[]): ArchitectureFlowEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    type: 'relationship',
    data: normalizeEdgeData(edge.data),
  }));
}

export function serializeFlowNodes(nodes: ArchitectureFlowNode[]): ArchitectureNodeDto[] {
  return nodes.map((node) => ({
    id: node.id,
    type: 'awsResource',
    position: {
      x: Math.round(node.position.x * 100) / 100,
      y: Math.round(node.position.y * 100) / 100,
    },
    data: {
      serviceId: node.data.serviceId,
      serviceSlug: node.data.serviceSlug,
      serviceName: node.data.serviceName,
      categorySlug: node.data.categorySlug,
      categoryName: node.data.categoryName,
      iconKey: node.data.iconKey,
      resourceName: node.data.resourceName,
      resourceType: node.data.resourceType,
      label: node.data.label,
      description: node.data.description,
      metadata: node.data.metadata ?? {},
    },
  }));
}

export function serializeFlowEdges(edges: ArchitectureFlowEdge[]): ArchitectureEdgeDto[] {
  return edges.map((edge) => {
    const normalized = normalizeEdgeData(edge.data);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
      type: 'relationship',
      data: {
        relationshipType: normalized.relationshipType,
        direction: normalized.direction,
        ...(normalized.label ? { label: normalized.label } : {}),
        metadata: normalized.metadata,
      },
    };
  });
}

function createNodeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `node-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function createEdgeId(source: string, target: string): string {
  const suffix = Math.random().toString(36).slice(2, 6);
  return `edge-${source}-${target}-${suffix}`;
}

export interface ConfirmConnectionInput {
  relationshipType: RelationshipType;
  direction: RelationshipDirection;
  label?: string;
  metadata?: RelationshipMetadata;
}

interface ArchitectureBuilderState {
  architecture: ArchitectureDetailDto | null;
  nodes: ArchitectureFlowNode[];
  edges: ArchitectureFlowEdge[];
  viewport: Viewport;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  pendingConnection: PendingConnection | null;
  isDirty: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  lastSavedAt: string | null;
  isSavingInFlight: boolean;
  pendingSaveRequested: boolean;
  past: GraphSnapshot[];
  future: GraphSnapshot[];

  hydrateArchitecture: (architecture: ArchitectureDetailDto) => void;
  resetBuilder: () => void;
  setViewport: (viewport: Viewport) => void;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  onNodesChange: (changes: NodeChange<ArchitectureFlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<ArchitectureFlowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  cancelPendingConnection: () => void;
  confirmPendingConnection: (input: ConfirmConnectionInput) => ArchitectureFlowEdge | null;
  addResourceNode: (
    resource: AwsResourceRegistryItem,
    position?: { x: number; y: number },
  ) => ArchitectureFlowNode;
  updateNodeMetadata: (
    nodeId: string,
    patch: Partial<Pick<AwsResourceNodeData, 'label' | 'description'>>,
  ) => void;
  updateEdgeMetadata: (edgeId: string, patch: Partial<AwsResourceEdgeData>) => void;
  reverseEdgeDirection: (edgeId: string) => void;
  duplicateNode: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;
  undo: () => void;
  redo: () => void;
  saveCanvas: () => Promise<boolean>;
  renameArchitecture: (name: string) => Promise<boolean>;
}

function pushHistory(
  past: GraphSnapshot[],
  nodes: ArchitectureFlowNode[],
  edges: ArchitectureFlowEdge[],
): GraphSnapshot[] {
  const snapshot: GraphSnapshot = {
    nodes: nodes.map((n) => ({ ...n, position: { ...n.position }, data: { ...n.data } })),
    edges: edges.map((e) => ({
      ...e,
      data: e.data
        ? {
            ...e.data,
            metadata: e.data.metadata ? { ...e.data.metadata } : undefined,
          }
        : undefined,
    })),
  };
  const next = [...past, snapshot];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}

export const useArchitectureBuilderStore = create<ArchitectureBuilderState>((set, get) => ({
  architecture: null,
  nodes: [],
  edges: [],
  viewport: DEFAULT_VIEWPORT,
  selectedNodeId: null,
  selectedEdgeId: null,
  pendingConnection: null,
  isDirty: false,
  saveStatus: 'idle',
  saveError: null,
  lastSavedAt: null,
  isSavingInFlight: false,
  pendingSaveRequested: false,
  past: [],
  future: [],

  hydrateArchitecture: (architecture) =>
    set({
      architecture,
      nodes: toFlowNodes(architecture.nodes ?? []),
      edges: toFlowEdges(architecture.edges ?? []),
      viewport: architecture.viewport ?? DEFAULT_VIEWPORT,
      selectedNodeId: null,
      selectedEdgeId: null,
      pendingConnection: null,
      isDirty: false,
      saveStatus: 'saved',
      saveError: null,
      lastSavedAt: architecture.updatedAt,
      isSavingInFlight: false,
      pendingSaveRequested: false,
      past: [],
      future: [],
    }),

  resetBuilder: () =>
    set({
      architecture: null,
      nodes: [],
      edges: [],
      viewport: DEFAULT_VIEWPORT,
      selectedNodeId: null,
      selectedEdgeId: null,
      pendingConnection: null,
      isDirty: false,
      saveStatus: 'idle',
      saveError: null,
      lastSavedAt: null,
      isSavingInFlight: false,
      pendingSaveRequested: false,
      past: [],
      future: [],
    }),

  setViewport: (viewport) => set({ viewport }),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedEdgeId: null }),

  selectEdge: (edgeId) => set({ selectedEdgeId: edgeId, selectedNodeId: null }),

  onNodesChange: (changes) => {
    const state = get();
    const hasMeaningfulChange = changes.some(
      (c) => c.type === 'position' || c.type === 'remove' || c.type === 'add',
    );
    const nextNodes = applyNodeChanges(changes, state.nodes);

    const removedIds = new Set(
      changes.filter((c) => c.type === 'remove').map((c) => c.id),
    );
    const nextEdges =
      removedIds.size > 0
        ? state.edges.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target))
        : state.edges;

    const selectedChange = changes.find((c) => c.type === 'select' && c.selected);
    const nextSelectedNodeId =
      selectedChange && 'id' in selectedChange
        ? selectedChange.id
        : state.selectedNodeId && nextNodes.some((n) => n.id === state.selectedNodeId)
          ? state.selectedNodeId
          : null;

    set({
      nodes: nextNodes,
      edges: nextEdges,
      selectedNodeId: nextSelectedNodeId,
      isDirty: hasMeaningfulChange ? true : state.isDirty,
      saveStatus: hasMeaningfulChange ? 'unsaved' : state.saveStatus,
      saveError: hasMeaningfulChange ? null : state.saveError,
    });
  },

  onEdgesChange: (changes) => {
    const state = get();
    const hasMeaningfulChange = changes.some((c) => c.type === 'remove' || c.type === 'add');
    const nextEdges = applyEdgeChanges(changes, state.edges);

    const selectedChange = changes.find((c) => c.type === 'select' && c.selected);
    const nextSelectedEdgeId =
      selectedChange && 'id' in selectedChange
        ? selectedChange.id
        : state.selectedEdgeId && nextEdges.some((e) => e.id === state.selectedEdgeId)
          ? state.selectedEdgeId
          : null;

    set({
      edges: nextEdges,
      selectedEdgeId: nextSelectedEdgeId,
      isDirty: hasMeaningfulChange ? true : state.isDirty,
      saveStatus: hasMeaningfulChange ? 'unsaved' : state.saveStatus,
      saveError: hasMeaningfulChange ? null : state.saveError,
    });
  },

  onConnect: (connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) {
      return;
    }
    set({
      pendingConnection: {
        connection,
        sourceNodeId: connection.source,
        targetNodeId: connection.target,
      },
    });
  },

  cancelPendingConnection: () => set({ pendingConnection: null }),

  confirmPendingConnection: (input) => {
    const state = get();
    const pending = state.pendingConnection;
    if (!pending) return null;

    const normalized = normalizeEdgeData({
      relationshipType: input.relationshipType,
      direction: input.direction,
      label: input.label,
      metadata: input.metadata,
    });

    const newEdge: ArchitectureFlowEdge = {
      id: createEdgeId(pending.sourceNodeId, pending.targetNodeId),
      source: pending.sourceNodeId,
      target: pending.targetNodeId,
      sourceHandle: pending.connection.sourceHandle ?? undefined,
      targetHandle: pending.connection.targetHandle ?? undefined,
      type: 'relationship',
      data: normalized,
    };

    set({
      past: pushHistory(state.past, state.nodes, state.edges),
      future: [],
      edges: addEdge(newEdge, state.edges),
      pendingConnection: null,
      selectedEdgeId: newEdge.id,
      selectedNodeId: null,
      isDirty: true,
      saveStatus: 'unsaved',
      saveError: null,
    });

    return newEdge;
  },

  addResourceNode: (resource, position) => {
    const state = get();
    const offset = (state.nodes.length % 6) * 32;
    const node: ArchitectureFlowNode = {
      id: createNodeId(),
      type: 'awsResource',
      position: position ?? { x: 180 + offset, y: 140 + offset },
      data: {
        serviceId: resource.serviceId,
        serviceSlug: resource.serviceSlug,
        serviceName: resource.serviceName,
        categorySlug: resource.categorySlug,
        categoryName: resource.categoryName,
        iconKey: resource.iconKey,
        resourceName: resource.resourceName,
        resourceType: resource.resourceType,
        label: resource.resourceName,
        description: resource.description,
        metadata: {},
      },
    };

    set({
      past: pushHistory(state.past, state.nodes, state.edges),
      future: [],
      nodes: [...state.nodes, node],
      selectedNodeId: node.id,
      selectedEdgeId: null,
      isDirty: true,
      saveStatus: 'unsaved',
      saveError: null,
    });

    return node;
  },

  updateNodeMetadata: (nodeId, patch) => {
    const state = get();
    const nextNodes = state.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            data: {
              ...node.data,
              ...patch,
            },
          }
        : node,
    );

    set({
      nodes: nextNodes,
      isDirty: true,
      saveStatus: 'unsaved',
      saveError: null,
    });
  },

  updateEdgeMetadata: (edgeId, patch) => {
    const state = get();
    const nextEdges = state.edges.map((edge) => {
      if (edge.id !== edgeId) return edge;
      const merged = normalizeEdgeData({
        ...edge.data,
        ...patch,
        relationshipType:
          patch.relationshipType ?? edge.data?.relationshipType ?? 'connects-to',
        metadata: {
          ...(edge.data?.metadata ?? {}),
          ...(patch.metadata ?? {}),
        },
      });
      return {
        ...edge,
        type: 'relationship',
        data: merged,
      };
    });

    set({
      past: pushHistory(state.past, state.nodes, state.edges),
      future: [],
      edges: nextEdges,
      isDirty: true,
      saveStatus: 'unsaved',
      saveError: null,
    });
  },

  reverseEdgeDirection: (edgeId) => {
    const state = get();
    const nextEdges = state.edges.map((edge) => {
      if (edge.id !== edgeId) return edge;
      return {
        ...edge,
        source: edge.target,
        target: edge.source,
        sourceHandle: edge.targetHandle,
        targetHandle: edge.sourceHandle,
      };
    });

    set({
      past: pushHistory(state.past, state.nodes, state.edges),
      future: [],
      edges: nextEdges,
      isDirty: true,
      saveStatus: 'unsaved',
      saveError: null,
    });
  },

  duplicateNode: (nodeId) => {
    const state = get();
    const source = state.nodes.find((n) => n.id === nodeId);
    if (!source) return;

    const copy: ArchitectureFlowNode = {
      id: createNodeId(),
      type: 'awsResource',
      position: {
        x: source.position.x + 48,
        y: source.position.y + 48,
      },
      data: {
        ...source.data,
        label: `${source.data.label} (Copy)`,
        metadata: { ...(source.data.metadata ?? {}) },
      },
    };

    set({
      past: pushHistory(state.past, state.nodes, state.edges),
      future: [],
      nodes: [...state.nodes, copy],
      selectedNodeId: copy.id,
      selectedEdgeId: null,
      isDirty: true,
      saveStatus: 'unsaved',
      saveError: null,
    });
  },

  deleteNode: (nodeId) => {
    const state = get();
    set({
      past: pushHistory(state.past, state.nodes, state.edges),
      future: [],
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      isDirty: true,
      saveStatus: 'unsaved',
      saveError: null,
    });
  },

  deleteEdge: (edgeId) => {
    const state = get();
    set({
      past: pushHistory(state.past, state.nodes, state.edges),
      future: [],
      edges: state.edges.filter((e) => e.id !== edgeId),
      selectedEdgeId: state.selectedEdgeId === edgeId ? null : state.selectedEdgeId,
      isDirty: true,
      saveStatus: 'unsaved',
      saveError: null,
    });
  },

  undo: () => {
    const state = get();
    if (state.past.length === 0) return;
    const previous = state.past[state.past.length - 1];
    const nextPast = state.past.slice(0, -1);
    set({
      past: nextPast,
      future: pushHistory(state.future, state.nodes, state.edges),
      nodes: previous.nodes,
      edges: previous.edges,
      selectedNodeId: null,
      selectedEdgeId: null,
      isDirty: true,
      saveStatus: 'unsaved',
    });
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
    const next = state.future[state.future.length - 1];
    const nextFuture = state.future.slice(0, -1);
    set({
      past: pushHistory(state.past, state.nodes, state.edges),
      future: nextFuture,
      nodes: next.nodes,
      edges: next.edges,
      selectedNodeId: null,
      selectedEdgeId: null,
      isDirty: true,
      saveStatus: 'unsaved',
    });
  },

  saveCanvas: async () => {
    const state = get();
    if (!state.architecture) return false;

    if (state.isSavingInFlight) {
      set({ pendingSaveRequested: true });
      return false;
    }

    const targetArchId = state.architecture.id;
    const snapshotNodes = serializeFlowNodes(state.nodes);
    const snapshotEdges = serializeFlowEdges(state.edges);
    const snapshotViewport = {
      x: Math.round(state.viewport.x * 100) / 100,
      y: Math.round(state.viewport.y * 100) / 100,
      zoom: Math.round(state.viewport.zoom * 1000) / 1000,
    };

    set({
      isSavingInFlight: true,
      pendingSaveRequested: false,
      saveStatus: 'saving',
      saveError: null,
    });

    try {
      const updated = await saveArchitectureCanvas(targetArchId, {
        nodes: snapshotNodes,
        edges: snapshotEdges,
        viewport: snapshotViewport,
      });

      const current = get();
      if (current.architecture?.id !== targetArchId) {
        return false;
      }

      const moreEditsOccurred = current.pendingSaveRequested;
      set({
        architecture: updated,
        isSavingInFlight: false,
        pendingSaveRequested: false,
        isDirty: moreEditsOccurred,
        saveStatus: moreEditsOccurred ? 'unsaved' : 'saved',
        lastSavedAt: updated.updatedAt,
      });

      if (moreEditsOccurred) {
        return get().saveCanvas();
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save architecture canvas';
      set({
        isSavingInFlight: false,
        saveStatus: 'error',
        saveError: message,
      });
      return false;
    }
  },

  renameArchitecture: async (name) => {
    const state = get();
    if (!state.architecture) return false;
    const trimmed = name.trim();
    if (!trimmed) return false;

    try {
      const updated = await updateArchitectureMetadata(state.architecture.id, { name: trimmed });
      set((curr) => ({
        architecture: curr.architecture ? { ...curr.architecture, ...updated } : updated,
        lastSavedAt: updated.updatedAt,
      }));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rename architecture';
      set({ saveStatus: 'error', saveError: message });
      return false;
    }
  },
}));
