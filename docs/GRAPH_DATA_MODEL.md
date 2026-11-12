# CloudForge – Graph Data Model (Phase 05)

## Overview

CloudForge stores each architecture canvas as a persisted JSON graph inside the `architectures` PostgreSQL table (`nodes`, `edges`, `viewport` columns in `backend/prisma/schema.prisma`), with zero breaking schema migrations from Phase 04.

## Node Model (`ArchitectureNodeDto`)

- `id`: Unique string identifier (e.g., `node-a1b2c3d4`).
- `type`: `'awsResource'`.
- `position`: `{ x: number, y: number }`.
- `data`: `AwsResourceNodeData` (`serviceId`, `serviceSlug`, `serviceName`, `categorySlug`, `categoryName`, `iconKey`, `resourceName`, `resourceType`, `label`, `description`, `metadata`).

## Edge & Relationship Model (`ArchitectureEdgeDto`)

```json
{
  "id": "edge-node-vpc-node-subnet-a1b2",
  "source": "node-vpc",
  "target": "node-subnet",
  "sourceHandle": null,
  "targetHandle": null,
  "type": "relationship",
  "data": {
    "relationshipType": "contains",
    "direction": "source-to-target",
    "label": "Contains",
    "metadata": {
      "protocol": null,
      "port": null,
      "description": "Subnet belongs to VPC"
    }
  }
}
```

### Supported Relationship Types

| Relationship Type | Category | Dependency Kind | Acyclic Required | Default Direction |
|---|---|---|---|---|
| `contains` | `structural` | `hard-dependency` | Yes | `source-to-target` |
| `attached-to` | `structural` | `hard-dependency` | Yes | `source-to-target` |
| `routes-to` | `network` | `network-traffic` | No | `source-to-target` |
| `connects-to` | `network` | `logical` | No | `source-to-target` |
| `sends-traffic-to` | `network` | `network-traffic` | No | `source-to-target` |
| `receives-traffic-from` | `network` | `network-traffic` | No | `target-to-source` |
| `load-balances-to` | `network` | `network-traffic` | No | `source-to-target` |
| `depends-on` | `dependency` | `hard-dependency` | Yes | `source-to-target` |
| `accesses` | `security` | `security-permission` | No | `source-to-target` |
| `stores-data-in` | `storage` | `logical` | No | `source-to-target` |
| `replicates-to` | `replication` | `optional` | No | `source-to-target` |
| `triggers` | `integration` | `logical` | No | `source-to-target` |

### Backward Compatibility

Legacy Phase 04 edges with `type: "smoothstep"` or `relationshipType: "traffic-flow"` are automatically normalized on load via `normalizeEdgeData()` (`traffic-flow` maps to `sends-traffic-to` with `direction: "source-to-target"` and `metadata: { protocol: null, port: null, description: "" }`). Backend Zod validation (`backend/src/modules/architecture-edges/edgeValidation.ts`) accepts both `'smoothstep'` and `'relationship'` edge types.
