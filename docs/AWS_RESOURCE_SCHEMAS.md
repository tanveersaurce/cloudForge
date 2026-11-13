# CloudForge – AWS Resource Configuration Schemas (Phase 06)

CloudForge implements verified configuration schemas for 17 core AWS resource types grounded in official AWS documentation and the Terraform AWS provider resource model.

## 1. Compute Resources

### `aws_instance` (Amazon EC2)
- **General Information**: `instance_name` (string), `ami` (string, pattern `^ami-[0-9a-f]{8,17}$`).
- **Hardware & Compute**: `instance_type` (select: `t3.nano` to `r6i.large`), `key_name` (string), `monitoring` (boolean).
- **Networking & Placement**: `vpc_id` (ref: `aws_vpc`), `subnet_id` (ref: `aws_subnet`), `security_groups` (multi-ref: `aws_security_group`), `associate_public_ip` (boolean).
- **Storage (Root EBS)**: `root_volume_type` (`gp3`, `gp2`, `io2`), `root_volume_size` (8-16384 GiB), `root_encrypted` (boolean).
- **Security**: `iam_instance_profile` (ref: `aws_iam_role`).

### `aws_lambda_function` (AWS Lambda)
- **General Information**: `function_name` (string), `runtime` (`nodejs20.x`, `nodejs18.x`, `python3.12`, `python3.11`, `java21`, `provided.al2023`, `dotnet8`), `handler` (string), `architectures` (`arm64`, `x86_64`).
- **Memory & Limits**: `memory_size` (128-10240 MB), `timeout` (1-900 seconds).
- **Security**: `role` (ref: `aws_iam_role`).
- **Networking**: `enable_vpc` (boolean), `vpc_id` (ref: `aws_vpc`, conditional), `subnet_ids` (multi-ref: `aws_subnet`, conditional), `security_group_ids` (multi-ref: `aws_security_group`, conditional).

### `aws_ecs_service` (Amazon ECS)
- **General Settings**: `service_name` (string), `launch_type` (`FARGATE`, `EC2`), `desired_count` (number, 1-100).
- **Network Configuration**: `subnet_ids` (multi-ref: `aws_subnet`), `security_groups` (multi-ref: `aws_security_group`), `assign_public_ip` (boolean).

### `aws_ecr_repository` (Amazon ECR)
- **Repository Configuration**: `repository_name` (string), `image_tag_mutability` (`MUTABLE`, `IMMUTABLE`).
- **Security & Scanning**: `scan_on_push` (boolean), `encryption_type` (`AES256`, `KMS`), `kms_key_id` (ref: `aws_kms_key`, conditional).

---

## 2. Networking Resources

### `aws_vpc` (Amazon VPC)
- **VPC Settings**: `vpc_name` (string), `cidr_block` (IPv4 CIDR block, e.g. `10.0.0.0/16`), `enable_dns_support` (boolean), `enable_dns_hostnames` (boolean), `instance_tenancy` (`default`, `dedicated`).

### `aws_subnet` (Amazon VPC Subnet)
- **Subnet Configuration**: `subnet_name` (string), `vpc_id` (ref: `aws_vpc`, required), `cidr_block` (IPv4 CIDR block, e.g. `10.0.1.0/24`), `availability_zone` (select: AZs), `map_public_ip_on_launch` (boolean).

### `aws_internet_gateway` (Internet Gateway)
- **Gateway Configuration**: `igw_name` (string), `vpc_id` (ref: `aws_vpc`, required).

### `aws_nat_gateway` (NAT Gateway)
- **NAT Gateway Configuration**: `nat_name` (string), `connectivity_type` (`public`, `private`), `subnet_id` (ref: `aws_subnet`, required).

### `aws_route_table` (Route Table)
- **Route Table Settings**: `route_table_name` (string), `vpc_id` (ref: `aws_vpc`, required), `gateway_id` (ref: `aws_internet_gateway` or `aws_nat_gateway`).

### `aws_security_group` (Security Group)
- **Identity**: `name` (string), `description` (textarea), `vpc_id` (ref: `aws_vpc`, required).
- **Ingress Rules**: `allow_http` (boolean), `allow_https` (boolean), `allow_ssh` (boolean), `custom_port` (number, 1-65535).

### `aws_lb` (Application Load Balancer)
- **Settings**: `name` (string, max 32 chars), `internal` (select: Internet-facing vs Internal), `ip_address_type` (`ipv4`, `dualstack`).
- **Network Mapping**: `vpc_id` (ref: `aws_vpc`), `subnets` (multi-ref: `aws_subnet`, requires >= 2 across AZs), `security_groups` (multi-ref: `aws_security_group`).

---

## 3. Storage Resources

### `aws_s3_bucket` (Amazon S3)
- **General**: `bucket` (DNS compliant, 3-63 lowercase alphanumeric/hyphen characters), `force_destroy` (boolean).
- **Object Management**: `versioning_status` (`Enabled`, `Suspended`).
- **Security**: `block_public_access` (boolean), `sse_algorithm` (`AES256`, `aws:kms`), `kms_master_key_id` (ref: `aws_kms_key`, conditional).

### `aws_ebs_volume` (Amazon EBS)
- **Volume Properties**: `volume_name` (string), `type` (`gp3`, `gp2`, `io2`, `st1`, `sc1`), `size` (1-16384 GiB), `iops` (number, conditional on `gp3`/`io2`), `encrypted` (boolean).

---

## 4. Database Resources

### `aws_db_instance` (Amazon RDS)
- **Engine & Identity**: `identifier` (string), `engine` (`postgres`, `mysql`, `aurora-postgresql`, `aurora-mysql`, `mariadb`), `engine_version` (string), `instance_class` (`db.t4g.micro` to `db.r6g.large`).
- **Storage**: `storage_type` (`gp3`, `io1`), `allocated_storage` (20-65536 GiB), `max_allocated_storage` (autoscaling max), `storage_encrypted` (boolean).
- **HA & Backups**: `multi_az` (boolean), `backup_retention_period` (0-35 days).
- **Networking**: `db_subnet_group_name` (ref: `aws_db_subnet_group` or `aws_subnet`), `vpc_security_group_ids` (multi-ref: `aws_security_group`), `publicly_accessible` (boolean).

### `aws_dynamodb_table` (Amazon DynamoDB)
- **Identity & Billing**: `name` (string), `billing_mode` (`PAY_PER_REQUEST`, `PROVISIONED`).
- **Primary Key Schema**: `hash_key` (string, required PK), `hash_key_type` (`S`, `N`, `B`), `range_key` (string, optional SK).
- **Reliability & Security**: `point_in_time_recovery` (boolean), `server_side_encryption` (boolean).

---

## 5. Security & Identity Resources

### `aws_iam_role` (AWS IAM Role)
- **Role Identity**: `name` (string), `description` (textarea).
- **Trust Relationship**: `trusted_service` (`ec2.amazonaws.com`, `lambda.amazonaws.com`, `ecs-tasks.amazonaws.com`, `apigateway.amazonaws.com`), `max_session_duration` (3600-43200 seconds).

### `aws_iam_policy` (AWS IAM Policy)
- **Policy Details**: `name` (string), `description` (textarea).
- **Policy Template**: `policy_template` (`s3_read_only`, `s3_full_access`, `dynamodb_read_write`, `lambda_basic_execution`, `vpc_enis`).

### `aws_kms_key` (AWS KMS Key)
- **Key Configuration**: `description` (string), `key_usage` (`ENCRYPT_DECRYPT`, `SIGN_VERIFY`), `enable_key_rotation` (boolean), `deletion_window_in_days` (7-30 days).
