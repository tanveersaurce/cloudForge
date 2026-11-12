import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, GitBranch } from 'lucide-react';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { useArchitectureBuilderStore } from '@/store/useArchitectureBuilderStore';
import type {
  RelationshipDirection,
  RelationshipType,
} from '../types/architecture.types';
import {
  getCompatibleRelationships,
  validateConnectionCompatibility,
} from '../utils/awsCompatibilityRegistry';
import {
  ALL_RELATIONSHIP_TYPES,
  RELATIONSHIP_DEFINITIONS,
} from '../utils/relationshipModel';

export function ConnectionTypeModal() {
  const pendingConnection = useArchitectureBuilderStore((s) => s.pendingConnection);
  const nodes = useArchitectureBuilderStore((s) => s.nodes);
  const cancelPendingConnection = useArchitectureBuilderStore(
    (s) => s.cancelPendingConnection,
  );
  const confirmPendingConnection = useArchitectureBuilderStore(
    (s) => s.confirmPendingConnection,
  );

  const sourceNode = useMemo(
    () =>
      pendingConnection
        ? nodes.find((n) => n.id === pendingConnection.sourceNodeId)
        : undefined,
    [nodes, pendingConnection],
  );
  const targetNode = useMemo(
    () =>
      pendingConnection
        ? nodes.find((n) => n.id === pendingConnection.targetNodeId)
        : undefined,
    [nodes, pendingConnection],
  );

  const compatibleOptions = useMemo(() => {
    if (!sourceNode || !targetNode) return [];
    return getCompatibleRelationships(sourceNode, targetNode);
  }, [sourceNode, targetNode]);

  const defaultType: RelationshipType = useMemo(() => {
    const rec = compatibleOptions.find((o) => o.recommended);
    return rec?.relationshipType ?? compatibleOptions[0]?.relationshipType ?? 'connects-to';
  }, [compatibleOptions]);

  const [relationshipType, setRelationshipType] = useState<RelationshipType>(defaultType);
  const [direction, setDirection] = useState<RelationshipDirection>('source-to-target');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [protocol, setProtocol] = useState('');
  const [port, setPort] = useState('');

  useEffect(() => {
    if (pendingConnection && sourceNode && targetNode) {
      const def = RELATIONSHIP_DEFINITIONS[defaultType];
      setRelationshipType(defaultType);
      setDirection(def.defaultDirection);
      setLabel(def.label);
      setDescription('');
      setProtocol('');
      setPort('');
    }
  }, [pendingConnection, sourceNode, targetNode, defaultType]);

  const validation = useMemo(() => {
    if (!sourceNode || !targetNode) return null;
    return validateConnectionCompatibility(sourceNode, targetNode, relationshipType);
  }, [sourceNode, targetNode, relationshipType]);

  const selectedDef = RELATIONSHIP_DEFINITIONS[relationshipType];

  const handleTypeChange = (nextType: RelationshipType) => {
    const nextDef = RELATIONSHIP_DEFINITIONS[nextType];
    setRelationshipType(nextType);
    setDirection(nextDef.defaultDirection);
    setLabel(nextDef.label);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!validation?.valid) return;

    const parsedPort = port.trim() ? Number(port.trim()) : null;
    confirmPendingConnection({
      relationshipType,
      direction,
      label: label.trim() || selectedDef.label,
      metadata: {
        protocol: protocol.trim() || null,
        port: parsedPort !== null && Number.isInteger(parsedPort) ? parsedPort : null,
        description: description.trim(),
      },
    });
  };

  if (!pendingConnection || !sourceNode || !targetNode) {
    return null;
  }

  const compatibleSet = new Set(compatibleOptions.map((o) => o.relationshipType));

  return (
    <Modal
      open={Boolean(pendingConnection)}
      onClose={cancelPendingConnection}
      title="Define Resource Relationship"
      subtitle="Select a verified AWS architectural relationship for this connection"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Source -> Target Header */}
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-canvas/80 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-slate-100">
              {sourceNode.data.label || sourceNode.data.resourceName}
            </p>
            <p className="font-mono text-[10px] text-slate-400">
              {sourceNode.data.resourceType}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-sky-400" />
          <div className="min-w-0 text-right">
            <p className="truncate text-xs font-semibold text-slate-100">
              {targetNode.data.label || targetNode.data.resourceName}
            </p>
            <p className="font-mono text-[10px] text-slate-400">
              {targetNode.data.resourceType}
            </p>
          </div>
        </div>

        {/* Relationship Type Selector */}
        <div className="space-y-1.5">
          <label
            htmlFor="conn-rel-type"
            className="flex items-center gap-1.5 text-xs font-medium text-slate-300"
          >
            <GitBranch className="h-3.5 w-3.5 text-sky-400" />
            <span>Relationship Type</span>
          </label>
          <select
            id="conn-rel-type"
            value={relationshipType}
            onChange={(e) => handleTypeChange(e.target.value as RelationshipType)}
            className="w-full rounded-lg border border-border-subtle bg-canvas px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
          >
            {ALL_RELATIONSHIP_TYPES.map((type) => {
              const def = RELATIONSHIP_DEFINITIONS[type];
              const isCompat = compatibleSet.has(type);
              const isRec = compatibleOptions.find(
                (o) => o.relationshipType === type,
              )?.recommended;
              return (
                <option key={type} value={type}>
                  {def.label}
                  {isRec ? ' (Recommended)' : !isCompat ? ' (Incompatible)' : ''}
                </option>
              );
            })}
          </select>
        </div>

        {/* Compatibility Status Banner */}
        {validation ? (
          validation.valid ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div className="space-y-1">
                  <p className="font-medium">{validation.reason}</p>
                  {validation.warning ? (
                    <p className="text-[11px] text-emerald-300/80">{validation.warning}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <div>
                  <p className="font-semibold">Incompatible Relationship</p>
                  <p className="mt-0.5 text-[11px] text-rose-200/90">{validation.reason}</p>
                </div>
              </div>
            </div>
          )
        ) : null}

        {/* Direction & Label */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="conn-direction" className="block text-xs font-medium text-slate-300">
              Direction
            </label>
            <select
              id="conn-direction"
              value={direction}
              onChange={(e) => setDirection(e.target.value as RelationshipDirection)}
              className="w-full rounded-lg border border-border-subtle bg-canvas px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
            >
              <option value="source-to-target">Source → Target</option>
              <option value="target-to-source">Target → Source</option>
              {selectedDef.allowsBidirectional ? (
                <option value="bidirectional">Bidirectional ↔</option>
              ) : null}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="conn-label" className="block text-xs font-medium text-slate-300">
              Display Label
            </label>
            <input
              id="conn-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={120}
              placeholder={selectedDef.label}
              className="w-full rounded-lg border border-border-subtle bg-canvas px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Optional Protocol / Port */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="conn-protocol" className="block text-xs font-medium text-slate-300">
              Protocol <span className="text-slate-500">(optional)</span>
            </label>
            <input
              id="conn-protocol"
              type="text"
              value={protocol}
              onChange={(e) => setProtocol(e.target.value)}
              placeholder="HTTPS, TCP, SQL..."
              maxLength={32}
              className="w-full rounded-lg border border-border-subtle bg-canvas px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="conn-port" className="block text-xs font-medium text-slate-300">
              Port <span className="text-slate-500">(optional)</span>
            </label>
            <input
              id="conn-port"
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="443, 5432..."
              className="w-full rounded-lg border border-border-subtle bg-canvas px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label htmlFor="conn-description" className="block text-xs font-medium text-slate-300">
            Description <span className="text-slate-500">(optional)</span>
          </label>
          <textarea
            id="conn-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            placeholder="Document architectural intent or networking prerequisites..."
            className="w-full resize-none rounded-lg border border-border-subtle bg-canvas px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={cancelPendingConnection}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!validation?.valid}>
            Create Relationship
          </Button>
        </div>
      </form>
    </Modal>
  );
}
