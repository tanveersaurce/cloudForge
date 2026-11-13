# CloudForge Validation Rule Catalog

## 1. Structural Category (`structural`)
- **`STRUCT-001: Subnet Must Belong to a VPC`**
  - **Severity:** Critical
  - **Description:** Every AWS Subnet node must be contained within a Virtual Private Cloud (VPC) via a `contains` relationship.
  - **Remediation:** Connect the Subnet to a parent VPC.
- **`STRUCT-002: Compute & DB Resources Must Reside in a Subnet`**
  - **Severity:** High
  - **Description:** EC2 instances, RDS databases, and NAT Gateways must reside in a Subnet to receive ENI IP assignments.
  - **Remediation:** Connect the resource to a hosting Subnet.
- **`STRUCT-003: Internet Gateway Must Attach to a VPC`**
  - **Severity:** High
  - **Description:** An Internet Gateway must attach to a VPC to enable external route targets.
  - **Remediation:** Connect the IGW to a VPC using an `attached-to` relationship.

## 2. Network Category (`network`)
- **`NET-001: Subnet CIDR Must Be Contained in VPC CIDR`**
  - **Severity:** Critical
  - **Description:** Subnet IPv4 CIDR blocks must be mathematically contained within the address space of the parent VPC CIDR.
  - **Remediation:** Reallocate Subnet IP space within parent VPC bounds.
- **`NET-002: Subnet CIDR Blocks Must Not Overlap`**
  - **Severity:** Critical
  - **Description:** Multiple subnets in the same VPC cannot claim overlapping IP ranges.
  - **Remediation:** Assign distinct non-overlapping CIDRs.
- **`NET-003: Valid IPv4 CIDR Block Format`**
  - **Severity:** Critical (or Medium/Unknown if unconfigured)
  - **Description:** Validates standard IPv4 prefix notation (e.g., 10.0.0.0/16 with mask 0–32).
- **`NET-005: NAT Gateway Must Reside in a Public Subnet`**
  - **Severity:** High
  - **Description:** NAT Gateways require placement in a subnet that possesses a route targeting an Internet Gateway.

## 3. Security Category (`security`)
- **`SEC-001: RDS Database Must Not Be Publicly Accessible`**
  - **Severity:** Critical
  - **Description:** Database instances must have `publicly_accessible = false` to prevent internet exposure.
- **`SEC-002: No Unrestricted Ingress to Management Ports (22/3389)`**
  - **Severity:** Critical
  - **Description:** Security groups must not allow inbound traffic from `0.0.0.0/0` on port 22 (SSH) or port 3389 (RDP).
- **`SEC-003: S3 Buckets Must Enable Public Access Block`**
  - **Severity:** High
  - **Description:** Public access blocks protect against accidental bucket or object leaks.
- **`SEC-004: Data Storage Resources Must Enable Encryption at Rest`**
  - **Severity:** High
  - **Description:** EBS volumes and RDS database storage must enforce encryption at rest.
- **`SEC-005: Avoid IAM Wildcard Administrator Policies`**
  - **Severity:** Critical
  - **Description:** Flags IAM policies granting full wildcard `*` privileges across all resources.

## 4. Reliability Category (`reliability`)
- **`REL-001: RDS High Availability Multi-AZ Configuration`**
  - **Severity:** Medium
  - **Description:** Production databases should use Multi-AZ standby replica failover.
- **`REL-002: RDS Automated Backups Enabled`**
  - **Severity:** High
  - **Description:** Automated backup retention must be greater than 0 days for point-in-time recovery.
- **`REL-003: Application Load Balancers Must Span Multiple AZs`**
  - **Severity:** High
  - **Description:** ALBs require subnets across at least two distinct Availability Zones for traffic resilience.
