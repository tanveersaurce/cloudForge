# CloudForge – Connection & Graph Engine (Phase 05)

## Connection Creation Workflow

1. User drags from a source node handle to a target node handle in `ArchitectureCanvas.tsx`.
2. `useArchitectureBuilderStore.onConnect` validates `source !== target` and stores `pendingConnection`.
3. `ConnectionTypeModal.tsx` opens, inspects `getCompatibleRelationships(sourceNode, targetNode)`, and highlights recommended relationships.
4. Selecting an incompatible relationship displays an inline error explaining why the relationship is invalid and disables creation.
5. Confirming calls `confirmPendingConnection`, creating a `relationship` edge, pushing undo history, and marking the canvas dirty.

## Visual Edge System (`RelationshipEdge.tsx`)

- **Line Styles & Colors**: Each relationship type has a dedicated stroke color and dash pattern (solid for structural containment/connections, dashed for attachments/routes/dependencies, dotted for security access).
- **Non-Color Indicators**: Every edge renders a compact tag (`CONT`, `ATCH`, `ROUT`, `TX`, `RX`, `LB`, `DEP`, `ACC`, `DATA`, `REPL`, `TRIG`) plus its label and optional `protocol:port` suffix.
- **Directionality**: SVG `<marker>` arrowheads render on target (`source-to-target`), source (`target-to-source`), or both (`bidirectional`).
- **Context Menu & Inspector**: Clicking an edge opens the Connection Editor in `NodeInspectorSidebar.tsx` (Save Changes, Cancel Changes, Swap Endpoints, Delete Relationship). Right-clicking opens a quick context menu.

## Graph Engine (`graphEngine.ts`)

Reusable, memoizable graph utilities:
- `getNodeById(nodes, nodeId)`
- `getIncomingEdges(edges, nodeId)` / `getOutgoingEdges(edges, nodeId)`
- `getConnectedNodes(nodes, edges, nodeId)`
- `getDependencies(nodes, edges, nodeId)` / `getDependents(nodes, edges, nodeId)`
- `getConnectedComponents(nodes, edges)`
- `detectCycles(nodes, edges)` — **relationship-aware**: evaluates only acyclic-required relationships (`contains`, `attached-to`, `depends-on`) so legitimate bidirectional/cyclic traffic (`sends-traffic-to`, `connects-to`) or replication (`replicates-to`) topologies are not rejected.
- `validateGraphStructure(nodes, edges)` — aggregates self-loops, dangling edges, compatibility violations, structural cycles, and missing hard dependencies.
