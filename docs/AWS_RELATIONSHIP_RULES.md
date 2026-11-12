# CloudForge – AWS Relationship & Compatibility Rules (Phase 05)

## Design Principles

1. **Verified AWS Semantics**: Compatibility rules in `frontend/src/features/architecture-builder/utils/awsCompatibilityRegistry.ts` reflect real AWS resource containment, attachment, routing, and dependency relationships.
2. **No Inferred Accessibility or Permissions**:
   - CloudForge does **not** infer public or private accessibility from subnet names or labels.
   - CloudForge does **not** assume successful network communication from a visual edge alone (actual connectivity requires route tables, security groups, network ACLs, gateways, and endpoints).
   - CloudForge does **not** automatically create IAM permissions or AWS resources from visual edges.

## Core Compatibility Rules

- **Amazon VPC (`aws_vpc`)**:
  - `contains` → `aws_subnet`
  - `attached-to` → `aws_internet_gateway`
- **Subnet (`aws_subnet`)**:
  - `depends-on` / `attached-to` → `aws_vpc` (cannot `contains` a VPC)
  - `contains` → `aws_instance`, `aws_lb`, `aws_nat_gateway`, `aws_ecs_service`
  - `attached-to` / `routes-to` → `aws_route_table`
- **Internet Gateway (`aws_internet_gateway`)**:
  - `attached-to` / `depends-on` → `aws_vpc` (cannot `contains` a VPC)
- **Route Table (`aws_route_table`)**:
  - `depends-on` / `attached-to` → `aws_vpc`
  - `attached-to` / `routes-to` → `aws_subnet`
  - `routes-to` / `depends-on` → `aws_internet_gateway`, `aws_nat_gateway`
- **Load Balancers / Edge (`aws_lb`, `aws_cloudfront_distribution`, `aws_api_gateway_rest_api`)**:
  - `load-balances-to` / `sends-traffic-to` → `aws_instance`, `aws_ecs_service`, `aws_lambda_function`
- **Compute (`aws_instance`, `aws_ecs_service`, `aws_lambda_function`)**:
  - `depends-on` / `attached-to` → `aws_subnet`
  - `attached-to` / `depends-on` → `aws_security_group`
  - `connects-to` / `sends-traffic-to` / `stores-data-in` → `aws_db_instance`, `aws_dynamodb_table`
  - `stores-data-in` / `accesses` → `aws_s3_bucket` (cannot `contains` S3)
  - `accesses` / `attached-to` → `aws_iam_role` (cannot `sends-traffic-to` or `load-balances-to` IAM Role)
- **RDS (`aws_db_instance`) & DB Subnet Group (`aws_db_subnet_group`)**:
  - `aws_db_instance` `depends-on` / `attached-to` → `aws_db_subnet_group`, `aws_security_group`
  - `aws_db_subnet_group` `depends-on` / `contains` → `aws_subnet`
- **Replication (`replicates-to`)**:
  - Supported between `aws_db_instance`, `aws_s3_bucket`, and `aws_dynamodb_table`.

## Hard Dependency Rules (`AWS_DEPENDENCY_RULES`)

The graph engine flags missing hard dependencies as warnings (without blocking canvas work):
- `aws_subnet` requires a parent `aws_vpc`.
- `aws_internet_gateway` requires an attached `aws_vpc`.
- `aws_route_table` requires a parent `aws_vpc`.
- `aws_db_subnet_group` requires associated `aws_subnet` resources.
