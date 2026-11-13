# CloudForge Security Validation Standards

## Core Security Philosophy
CloudForge enforces the principle of least privilege, defense-in-depth, and automated posture verification. Unlike static linting tools, CloudForge models the actual graph semantics of AWS architectures to evaluate exposure paths.

## Key Inspection Vectores

### 1. Public Exposure Analysis
- **Databases**: Relational databases (`aws_db_instance`) must never be marked with `publicly_accessible: true`. Even when a database resides in a VPC, direct public DNS endpoints invite brute-force and vulnerability scanning.
- **Management Ports**: Security groups guarding compute instances are checked for unrestricted ingress (`0.0.0.0/0`) on administrative ports (SSH port 22, RDP port 3389). CloudForge recommends AWS Systems Manager Session Manager or private corporate bastion endpoints.
- **S3 Public Access Blocks**: S3 buckets must activate `block_public_acls`, `block_public_policy`, `ignore_public_acls`, and `restrict_public_buckets` unless explicitly designated for public static website hosting.

### 2. Encryption at Rest
- All storage volumes (`aws_ebs_volume`) and database storage configurations (`aws_db_instance`) must have encryption flags enabled with AWS KMS or standard provider encryption keys.

### 3. IAM Least Privilege
- IAM Roles and Policies are scanned for wildcard administrative statements (`"Action": "*"` with `"Resource": "*"`). Overly permissive policies are flagged as critical vulnerabilities.
