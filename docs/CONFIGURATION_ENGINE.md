# CloudForge – Dynamic AWS Configuration Engine (Phase 06)

## Architecture Overview

CloudForge's Dynamic AWS Configuration Engine provides a schema-driven, metadata-backed inspector for configuring AWS resources placed on the canvas. Instead of writing custom, hardcoded form components for each AWS resource, the engine relies on a declarative, centralized schema architecture.

```
+-------------------------------------------------------------------------------+
|                             Architecture Builder                              |
|                                                                               |
|   +-------------------+    +----------------------+    +------------------+   |
|   | AWS Resource Lib  |    |  Architecture Canvas |    |  Node Inspector  |   |
|   |                   |    |                      |    |                  |   |
|   |  - EC2            |    |  [ VPC Node ]        |    |  +------------+  |   |
|   |  - RDS            |    |       |              |    |  | Dynamic    |  |   |
|   |  - S3             |    |  [ Subnet Node ]     |    |  | ConfigForm |  |   |
|   |  - Lambda         |    |       |              |    |  +------------+  |   |
|   |                   |    |  [ EC2 Node (Sel) ]  |--->|  - Hardware      |   |
|   |                   |    |                      |    |  - Networking    |   |
|   |                   |    |                      |    |  - Storage       |   |
|   +-------------------+    +----------------------+    +------------------+   |
+-------------------------------------------------------------------------------+
```

## Core Components

1. **Configuration Schema Registry (`configurationSchemaRegistry.ts`)**:
   - Maps normalized AWS resource types (`aws_instance`, `aws_vpc`, `aws_s3_bucket`, `aws_db_instance`, etc.) to structured `ResourceConfigurationSchema` specifications.
   - Provides safe declarative condition evaluation (`isFieldVisible`, `evaluateCondition`) supporting `equals`, `not_equals`, `in`, `not_in`, `truthy`, and `falsy` operators without `eval` or dynamic code execution.
   - Initialises default values (`initializeDefaultConfiguration`) without overwriting user-configured attributes.
   - Provides generic fallback schemas for catalog services without custom overrides.

2. **Form Engine (`DynamicConfigForm.tsx` & `ConfigFieldRenderer.tsx`)**:
   - Groups fields into collapsible, categorized sections (`General Information`, `Resource Settings`, `Networking`, `Security`, `Storage`, `Advanced Settings`).
   - Dispatches inputs based on field type: text, number, boolean toggle, select, radio button groups, textarea, and resource references.
   - Real-time validation with inline field error messages, section error indicators, and summary banners.
   - Manages local draft values with dirty state detection, `Reset Changes`, and `Save Configuration` controls.

3. **Canvas Resource Reference System (`ResourceReferenceSelect.tsx`)**:
   - Enables configuration fields to reference other resources already placed on the canvas (e.g. EC2 selecting a VPC, Subnet, or Security Group; RDS selecting a DB Subnet Group; Subnet selecting a Parent VPC).
   - Filters candidate options by compatible `targetResourceTypes`.
   - Surfaces alerts if a previously referenced resource is deleted from the canvas.

4. **State & Persistence**:
   - Stores configuration in `node.data.metadata` (serialized via `serializeFlowNodes`).
   - `updateNodeConfiguration(nodeId, metadata)` updates state in Zustand, adds snapshots to undo/redo history, and marks the canvas dirty for autosave.
   - Full persistence through existing `PUT /api/architectures/:id/canvas` with zero database migrations or breaking schema changes.
