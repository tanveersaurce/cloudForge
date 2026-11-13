# CloudForge – Terraform Field Mapping (Phase 06 Preparation for Phase 07)

## Design Principles

Each configuration property defined in Phase 06 schemas includes declarative metadata indicating how it will translate to HashiCorp Terraform AWS Provider arguments in Phase 07:

```ts
terraform: {
  terraformArgument: 'instance_type',
  terraformCompatibility: 'supported'
}
```

## Compatibility Classifications

1. **`supported`**: The field directly generates a top-level or nested Terraform resource argument.
2. **`optional`**: Generates an optional block or argument only when configured by the user.
3. **`computed`**: Derived from canvas topology or other resources during HCL generation (e.g. `vpc_id` computed from containing subnet).
4. **`unsupported`**: Architectural design metadata stored for visualization only; does not emit HCL.

## Key Resource Mappings

| Resource Type | CloudForge Field Key | Terraform Resource | Terraform Argument | Status |
|---|---|---|---|---|
| `aws_instance` | `instance_name` | `aws_instance` | `tags.Name` | `supported` |
| `aws_instance` | `ami` | `aws_instance` | `ami` | `supported` |
| `aws_instance` | `instance_type` | `aws_instance` | `instance_type` | `supported` |
| `aws_instance` | `subnet_id` | `aws_instance` | `subnet_id` | `supported` |
| `aws_instance` | `security_groups` | `aws_instance` | `vpc_security_group_ids` | `supported` |
| `aws_instance` | `root_volume_size`| `aws_instance` | `root_block_device.volume_size` | `supported` |
| `aws_vpc` | `cidr_block` | `aws_vpc` | `cidr_block` | `supported` |
| `aws_vpc` | `enable_dns_hostnames` | `aws_vpc` | `enable_dns_hostnames` | `supported` |
| `aws_subnet` | `cidr_block` | `aws_subnet` | `cidr_block` | `supported` |
| `aws_subnet` | `vpc_id` | `aws_subnet` | `vpc_id` | `supported` |
| `aws_internet_gateway` | `vpc_id` | `aws_internet_gateway` | `vpc_id` | `supported` |
| `aws_security_group` | `name` | `aws_security_group` | `name` | `supported` |
| `aws_s3_bucket` | `bucket` | `aws_s3_bucket` | `bucket` | `supported` |
| `aws_s3_bucket` | `versioning_status` | `aws_s3_bucket_versioning` | `versioning_configuration.status` | `supported` |
| `aws_db_instance` | `identifier` | `aws_db_instance` | `identifier` | `supported` |
| `aws_db_instance` | `engine` | `aws_db_instance` | `engine` | `supported` |
| `aws_db_instance` | `instance_class` | `aws_db_instance` | `instance_class` | `supported` |
| `aws_db_instance` | `allocated_storage`| `aws_db_instance` | `allocated_storage` | `supported` |
| `aws_dynamodb_table` | `name` | `aws_dynamodb_table` | `name` | `supported` |
| `aws_dynamodb_table` | `billing_mode` | `aws_dynamodb_table` | `billing_mode` | `supported` |
| `aws_dynamodb_table` | `hash_key` | `aws_dynamodb_table` | `hash_key` | `supported` |
| `aws_lambda_function`| `function_name` | `aws_lambda_function` | `function_name` | `supported` |
| `aws_lambda_function`| `runtime` | `aws_lambda_function` | `runtime` | `supported` |
| `aws_iam_role` | `name` | `aws_iam_role` | `name` | `supported` |
| `aws_kms_key` | `description` | `aws_kms_key` | `description` | `supported` |
