import { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import type { ArchitectureFlowEdge } from '../types/architecture.types';
import {
  getRelationshipDefinition,
  normalizeEdgeData,
} from '../utils/relationshipModel';
import { cn } from '@/utils/cn';

export function RelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  style,
}: EdgeProps<ArchitectureFlowEdge>) {
  const [hovered, setHovered] = useState(false);

  const normalized = normalizeEdgeData(data);
  const def = getRelationshipDefinition(normalized.relationshipType);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12,
  });

  const isHighlighted = Boolean(selected || hovered);
  const strokeColor = selected ? '#38bdf8' : def.strokeColor;
  const strokeWidth = selected ? 2.6 : hovered ? 2.2 : 1.75;

  const markerIdEnd = `cf-arrow-end-${id}`;
  const markerIdStart = `cf-arrow-start-${id}`;

  const showEndArrow =
    normalized.direction === 'source-to-target' ||
    normalized.direction === 'bidirectional';
  const showStartArrow =
    normalized.direction === 'target-to-source' ||
    normalized.direction === 'bidirectional';

  const portSuffix =
    normalized.metadata.protocol || normalized.metadata.port
      ? ` (${[normalized.metadata.protocol, normalized.metadata.port].filter(Boolean).join(':')})`
      : '';

  return (
    <>
      <defs>
        <marker
          id={markerIdEnd}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill={strokeColor} />
        </marker>
        <marker
          id={markerIdStart}
          viewBox="0 0 10 10"
          refX="2"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 10 1 L 0 5 L 10 9 z" fill={strokeColor} />
        </marker>
      </defs>

      <g
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={showEndArrow ? `url(#${markerIdEnd})` : undefined}
          markerStart={showStartArrow ? `url(#${markerIdStart})` : undefined}
          style={{
            ...style,
            stroke: strokeColor,
            strokeWidth,
            strokeDasharray: def.strokeDasharray,
            filter: isHighlighted ? `drop-shadow(0 0 6px ${strokeColor}55)` : undefined,
            transition: 'stroke 150ms ease, stroke-width 150ms ease',
          }}
        />
      </g>

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={cn(
            'nodrag nopan flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium shadow-sm backdrop-blur-sm transition-all',
            selected
              ? 'border-sky-400 bg-slate-900/95 text-sky-200 ring-1 ring-sky-400/40'
              : hovered
                ? 'border-slate-600 bg-slate-900/95 text-slate-100'
                : 'border-slate-700/80 bg-slate-950/85 text-slate-300',
          )}
          title={`${def.label}: ${normalized.label}${portSuffix}`}
        >
          <span
            className={cn(
              'rounded px-1 py-0.2 font-mono text-[9px] font-semibold uppercase tracking-wider',
              def.badgeClassName,
            )}
          >
            {def.shortTag}
          </span>
          <span className="max-w-[130px] truncate">
            {normalized.label}
            {portSuffix}
          </span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
