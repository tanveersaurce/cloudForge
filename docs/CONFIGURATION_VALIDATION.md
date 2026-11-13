# CloudForge – Configuration Validation Engine (Phase 06)

## Multi-Level Validation Architecture

Validation in the CloudForge Dynamic Configuration Engine is implemented across two distinct levels to ensure structural accuracy before IaC generation.

```
+-------------------------------------------------------------------------------+
|                       Multi-Level Validation Engine                           |
|                                                                               |
|   LEVEL 1: Field-Level Validation                                             |
|   - Required field presence                                                   |
|   - Numeric boundaries (min / max / integer checks)                           |
|   - String constraints (length / pattern / regex)                             |
|   - IPv4 CIDR octet and mask validation (0.0.0.0/0 to 255.255.255.255/32)     |
|   - S3 DNS naming compliance                                                  |
|                                                                               |
|   LEVEL 2: Architecture & Canvas Validation                                   |
|   - Resource reference existence (checks canvas nodes)                        |
|   - Candidate type compatibility (targetResourceTypes matching)               |
|   - Deleted or missing canvas reference detection                             |
|   - Security best practice warnings (public RDS, disabled S3 BPA)             |
|                                                                               |
+-------------------------------------------------------------------------------+
```

## Validation Severities

1. **`error`**:
   - Blocks `Save Configuration`.
   - Examples: Missing required field, invalid IPv4 CIDR string, referencing a deleted canvas node, numeric value out of bounds.
   - Displayed with red badges on section headers and inline under the affected input.

2. **`warning`**:
   - Highlights architectural best-practice deviations without blocking configuration save.
   - Examples: `publicly_accessible = true` on an RDS instance, or `block_public_access = false` on an S3 bucket.
   - Displayed with amber alert badges.

3. **`info`**:
   - Informational notices regarding AWS cloud runtime behaviors.
   - Example: Visual canvas connections do not replace AWS Security Group ingress rules or IAM policies.

## Declarative Conditional Visibility

Fields can declare conditional evaluation logic without storing executable functions in database JSON:

```ts
condition: {
  field: 'sse_algorithm',
  operator: 'equals',
  value: 'aws:kms'
}
```

Supported operators:
- `equals`: `actual === expected`
- `not_equals`: `actual !== expected`
- `truthy`: `Boolean(actual)`
- `falsy`: `!actual`
- `in`: `expectedArray.includes(actual)`
- `not_in`: `!expectedArray.includes(actual)`

When a condition is not met, the field is hidden and excluded from validation errors.
