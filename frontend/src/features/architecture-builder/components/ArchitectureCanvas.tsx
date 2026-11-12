import { useCallback, useEffect, type DragEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type OnMoveEnd,
  type ReactFlowInstance,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AwsResourceNode } from './AwsResourceNode';
import type {
  ArchitectureFlowEdge,
  ArchitectureFlowNode,
  AwsResourceRegistryItem,
} from '@/features/architecture-builder/types/architecture.types';
import { useArchitectureBuilderStore } from '@/store/useArchitectureBuilderStore';

const DRAG_DATA_FORMAT = 'application/cloudforge-aws-resource';
const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

const nodeTypes = {
  awsResource: AwsResourceNode,
};

const defaultEdgeOptions = {
  type: 'smoothstep' as const,
  animated: false,
};

export interface ArchitectureCanvasProps {
  onReactFlowInit?: (
    instance: ReactFlowInstance<ArchitectureFlowNode, ArchitectureFlowEdge>,
  ) => void;
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable
  );
}

function ArchitectureCanvasInner({ onReactFlowInit }: ArchitectureCanvasProps) {
  const { screenToFlowPosition } = useReactFlow<ArchitectureFlowNode, ArchitectureFlowEdge>();

  const architecture = useArchitectureBuilderStore((s) => s.architecture);
  const nodes = useArchitectureBuilderStore((s) => s.nodes);
  const edges = useArchitectureBuilderStore((s) => s.edges);
  const selectedNodeId = useArchitectureBuilderStore((s) => s.selectedNodeId);
  const selectedEdgeId = useArchitectureBuilderStore((s) => s.selectedEdgeId);

  const onNodesChange = useArchitectureBuilderStore((s) => s.onNodesChange);
  const onEdgesChange = useArchitectureBuilderStore((s) => s.onEdgesChange);
  const onConnect = useArchitectureBuilderStore((s) => s.onConnect);
  const setViewport = useArchitectureBuilderStore((s) => s.setViewport);
  const selectNode = useArchitectureBuilderStore((s) => s.selectNode);
  const selectEdge = useArchitectureBuilderStore((s) => s.selectEdge);
  const addResourceNode = useArchitectureBuilderStore((s) => s.addResourceNode);
  const deleteNode = useArchitectureBuilderStore((s) => s.deleteNode);
  const deleteEdge = useArchitectureBuilderStore((s) => s.deleteEdge);
  const undo = useArchitectureBuilderStore((s) => s.undo);
  const redo = useArchitectureBuilderStore((s) => s.redo);
  const saveCanvas = useArchitectureBuilderStore((s) => s.saveCanvas);

  const handleMoveEnd: OnMoveEnd = useCallback(
    (_event, viewport) => {
      setViewport(viewport);
    },
    [setViewport],
  );

  const handleNodeClick: NodeMouseHandler<ArchitectureFlowNode> = useCallback(
    (_event, node) => {
      selectNode(node.id);
    },
    [selectNode],
  );

  const handleEdgeClick: EdgeMouseHandler<ArchitectureFlowEdge> = useCallback(
    (_event, edge) => {
      selectEdge(edge.id);
    },
    [selectEdge],
  );

  const handlePaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const rawPayload = event.dataTransfer.getData(DRAG_DATA_FORMAT);
      if (!rawPayload) return;

      try {
        const resource = JSON.parse(rawPayload) as AwsResourceRegistryItem;
        if (!resource || !resource.serviceId || !resource.resourceType) {
          return;
        }
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        addResourceNode(resource, position);
      } catch {
        // Ignore malformed drag payloads
      }
    },
    [addResourceNode, screenToFlowPosition],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const hasModifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (hasModifier && key === 's') {
        event.preventDefault();
        void saveCanvas();
        return;
      }

      if (isEditableElement(event.target)) {
        return;
      }

      if (hasModifier && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedNodeId) {
          event.preventDefault();
          deleteNode(selectedNodeId);
        } else if (selectedEdgeId) {
          event.preventDefault();
          deleteEdge(selectedEdgeId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteEdge, deleteNode, redo, saveCanvas, selectedEdgeId, selectedNodeId, undo]);

  return (
    <div
      className="relative flex h-full w-full flex-1 bg-[#080d1a]"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow<ArchitectureFlowNode, ArchitectureFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        defaultViewport={architecture?.viewport ?? DEFAULT_VIEWPORT}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMoveEnd={handleMoveEnd}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onInit={onReactFlowInit}
        deleteKeyCode={null}
        colorMode="dark"
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="h-full w-full bg-[#080d1a]"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#1e293b"
        />
        <MiniMap
          pannable
          zoomable
          nodeColor="#38bdf8"
          maskColor="rgba(8, 13, 26, 0.78)"
          className="!rounded-lg !border !border-slate-800 !bg-slate-900/95 !shadow-xl"
        />
        <Controls
          showInteractive={false}
          className="!rounded-lg !border !border-slate-800 !bg-slate-900/95 !shadow-xl [&>button]:!border-slate-800 [&>button]:!bg-slate-900 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-800 [&>button:hover]:!text-slate-100"
        />
      </ReactFlow>
    </div>
  );
}

export function ArchitectureCanvas(props: ArchitectureCanvasProps) {
  return (
    <ReactFlowProvider>
      <ArchitectureCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
