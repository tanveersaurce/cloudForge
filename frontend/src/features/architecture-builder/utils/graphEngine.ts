import type {
  ArchitectureFlowEdge,
  ArchitectureFlowNode,
} from '../types/architecture.types';
import {
  getNormalizedAwsResourceType,
  getResourceDependencyRules,
  validateConnectionCompatibility,
} from './awsCompatibilityRegistry';
import {
  getRelationshipDefinition,
  normalizeEdgeData,
} from './relationshipModel';

export interface GraphCycle {
  nodeIds: string[];
  edgeIds: string[];
  relationshipTypes: string[];
}

export interface MissingDependencyIssue {
  nodeId: string;
  nodeLabel: string;
  resourceType: string;
  requiredTargetTypes: string[];
  description: string;
}

export interface GraphValidationIssue {
  code:
    | 'SELF_LOOP'
    | 'DANGLING_EDGE'
    | 'INCOMPATIBLE_RELATIONSHIP'
    | 'STRUCTURAL_CYCLE'
    | 'MISSING_HARD_DEPENDENCY';
  severity: 'error' | 'warning';
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface GraphValidationResult {
  isValid: boolean;
  errors: GraphValidationIssue[];
  warnings: GraphValidationIssue[];
  cycles: GraphCycle[];
  missingDependencies: MissingDependencyIssue[];
  componentCount: number;
}

export function getNodeById(
  nodes: ArchitectureFlowNode[],
  nodeId: string,
): ArchitectureFlowNode | undefined {
  return nodes.find((n) => n.id === nodeId);
}

export function getIncomingEdges(
  edges: ArchitectureFlowEdge[],
  nodeId: string,
): ArchitectureFlowEdge[] {
  return edges.filter((e) => e.target === nodeId);
}

export function getOutgoingEdges(
  edges: ArchitectureFlowEdge[],
  nodeId: string,
): ArchitectureFlowEdge[] {
  return edges.filter((e) => e.source === nodeId);
}

export function getConnectedNodes(
  nodes: ArchitectureFlowNode[],
  edges: ArchitectureFlowEdge[],
  nodeId: string,
): ArchitectureFlowNode[] {
  const neighborIds = new Set<string>();
  for (const edge of edges) {
    if (edge.source === nodeId) neighborIds.add(edge.target);
    if (edge.target === nodeId) neighborIds.add(edge.source);
  }
  return nodes.filter((n) => neighborIds.has(n.id));
}

/**
 * Returns nodes that the given node depends on (hard or structural dependencies):
 * - Outgoing `depends-on` or `attached-to` edges (source -> target)
 * - Incoming `contains` edges (parent -> child, so child depends on parent)
 */
export function getDependencies(
  nodes: ArchitectureFlowNode[],
  edges: ArchitectureFlowEdge[],
  nodeId: string,
): ArchitectureFlowNode[] {
  const depIds = new Set<string>();

  for (const edge of edges) {
    const normalized = normalizeEdgeData(edge.data);
    if (
      edge.source === nodeId &&
      (normalized.relationshipType === 'depends-on' ||
        normalized.relationshipType === 'attached-to')
    ) {
      depIds.add(edge.target);
    }
    if (edge.target === nodeId && normalized.relationshipType === 'contains') {
      depIds.add(edge.source);
    }
  }

  return nodes.filter((n) => depIds.has(n.id));
}

/**
 * Returns nodes that depend on the given node.
 */
export function getDependents(
  nodes: ArchitectureFlowNode[],
  edges: ArchitectureFlowEdge[],
  nodeId: string,
): ArchitectureFlowNode[] {
  const dependentIds = new Set<string>();

  for (const edge of edges) {
    const normalized = normalizeEdgeData(edge.data);
    if (
      edge.target === nodeId &&
      (normalized.relationshipType === 'depends-on' ||
        normalized.relationshipType === 'attached-to')
    ) {
      dependentIds.add(edge.source);
    }
    if (edge.source === nodeId && normalized.relationshipType === 'contains') {
      dependentIds.add(edge.target);
    }
  }

  return nodes.filter((n) => dependentIds.has(n.id));
}

/**
 * Computes undirected connected components (each element is an array of node IDs).
 */
export function getConnectedComponents(
  nodes: ArchitectureFlowNode[],
  edges: ArchitectureFlowEdge[],
): string[][] {
  const adj = new Map<string, string[]>();
  for (const node of nodes) {
    adj.set(node.id, []);
  }
  for (const edge of edges) {
    if (adj.has(edge.source) && adj.has(edge.target)) {
      adj.get(edge.source)!.push(edge.target);
      adj.get(edge.target)!.push(edge.source);
    }
  }

  const visited = new Set<string>();
  const components: string[][] = [];

  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    const component: string[] = [];
    const queue: string[] = [node.id];
    visited.add(node.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const neighbor of adj.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    components.push(component);
  }

  return components;
}

/**
 * Relationship-aware cycle detection.
 * Only evaluates relationships where cycles are structurally invalid (e.g. `contains`, `depends-on`, `attached-to`).
 * Legitimate cyclic network traffic, connections, or replication edges are NOT flagged as cycles.
 */
export function detectCycles(
  nodes: ArchitectureFlowNode[],
  edges: ArchitectureFlowEdge[],
): GraphCycle[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const adj = new Map<string, Array<{ target: string; edgeId: string; relType: string }>>();

  for (const id of nodeIds) {
    adj.set(id, []);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    const normalized = normalizeEdgeData(edge.data);
    const def = getRelationshipDefinition(normalized.relationshipType);
    if (!def.isAcyclicRequired) continue;

    adj.get(edge.source)!.push({
      target: edge.target,
      edgeId: edge.id,
      relType: normalized.relationshipType,
    });
  }

  const state = new Map<string, 0 | 1 | 2>(); // 0=unvisited, 1=visiting, 2=visited
  const stack: string[] = [];
  const edgeStack: Array<{ edgeId: string; relType: string }> = [];
  const cycles: GraphCycle[] = [];

  function dfs(u: string) {
    state.set(u, 1);
    stack.push(u);

    for (const next of adj.get(u) ?? []) {
      const nextState = state.get(next.target) ?? 0;
      if (nextState === 0) {
        edgeStack.push({ edgeId: next.edgeId, relType: next.relType });
        dfs(next.target);
        edgeStack.pop();
      } else if (nextState === 1) {
        const startIdx = stack.indexOf(next.target);
        if (startIdx !== -1) {
          const cycleNodes = stack.slice(startIdx);
          const cycleEdges = [
            ...edgeStack.slice(startIdx).map((e) => e.edgeId),
            next.edgeId,
          ];
          const cycleRelTypes = [
            ...edgeStack.slice(startIdx).map((e) => e.relType),
            next.relType,
          ];
          cycles.push({
            nodeIds: cycleNodes,
            edgeIds: cycleEdges,
            relationshipTypes: cycleRelTypes,
          });
        }
      }
    }

    stack.pop();
    state.set(u, 2);
  }

  for (const id of nodeIds) {
    if ((state.get(id) ?? 0) === 0) {
      dfs(id);
    }
  }

  return cycles;
}

/**
 * Evaluates structural integrity, AWS compatibility, missing hard dependencies, and cycles.
 */
export function validateGraphStructure(
  nodes: ArchitectureFlowNode[],
  edges: ArchitectureFlowEdge[],
): GraphValidationResult {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const errors: GraphValidationIssue[] = [];
  const warnings: GraphValidationIssue[] = [];

  for (const edge of edges) {
    if (edge.source === edge.target) {
      errors.push({
        code: 'SELF_LOOP',
        severity: 'error',
        message: `Edge "${edge.id}" cannot connect a resource to itself.`,
        edgeId: edge.id,
      });
      continue;
    }

    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) {
      errors.push({
        code: 'DANGLING_EDGE',
        severity: 'error',
        message: `Edge "${edge.id}" references a missing node.`,
        edgeId: edge.id,
      });
      continue;
    }

    const normalized = normalizeEdgeData(edge.data);
    const compat = validateConnectionCompatibility(
      sourceNode,
      targetNode,
      normalized.relationshipType as Parameters<typeof validateConnectionCompatibility>[2],
    );
    if (!compat.valid) {
      errors.push({
        code: 'INCOMPATIBLE_RELATIONSHIP',
        severity: 'error',
        message: compat.reason,
        edgeId: edge.id,
      });
    }
  }

  const cycles = detectCycles(nodes, edges);
  for (const cycle of cycles) {
    errors.push({
      code: 'STRUCTURAL_CYCLE',
      severity: 'error',
      message: `Invalid structural/dependency cycle detected across ${cycle.nodeIds.length} resources (${cycle.relationshipTypes.join(' → ')}).`,
      edgeId: cycle.edgeIds[0],
    });
  }

  // Check missing hard dependencies per node
  const missingDependencies: MissingDependencyIssue[] = [];
  for (const node of nodes) {
    const rules = getResourceDependencyRules(node);
    for (const rule of rules) {
      if (rule.dependencyKind !== 'hard-dependency') continue;

      const satisfied = edges.some((edge) => {
        const normalized = normalizeEdgeData(edge.data);
        if (!rule.acceptedRelationships.includes(normalized.relationshipType as never)) {
          return false;
        }
        // Check either outgoing (subnet -> vpc via depends-on/attached-to) or incoming (vpc -> subnet via contains)
        if (edge.source === node.id) {
          const target = nodeMap.get(edge.target);
          return target
            ? rule.requiredTargetTypes.includes(getNormalizedAwsResourceType(target))
            : false;
        }
        if (edge.target === node.id && normalized.relationshipType === 'contains') {
          const source = nodeMap.get(edge.source);
          return source
            ? rule.requiredTargetTypes.includes(getNormalizedAwsResourceType(source))
            : false;
        }
        return false;
      });

      if (!satisfied) {
        const issue: MissingDependencyIssue = {
          nodeId: node.id,
          nodeLabel: node.data.label || node.data.resourceName,
          resourceType: getNormalizedAwsResourceType(node),
          requiredTargetTypes: rule.requiredTargetTypes,
          description: rule.description,
        };
        missingDependencies.push(issue);
        warnings.push({
          code: 'MISSING_HARD_DEPENDENCY',
          severity: 'warning',
          message: `${issue.nodeLabel}: ${rule.description}`,
          nodeId: node.id,
        });
      }
    }
  }

  const components = getConnectedComponents(nodes, edges);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    cycles,
    missingDependencies,
    componentCount: components.length,
  };
}
