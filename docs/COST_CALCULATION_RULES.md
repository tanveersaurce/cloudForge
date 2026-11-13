# CloudForge Cost Calculation Rules & Formulas

## Resource Pricing Formulas

### 1. Amazon EC2 (`aws_instance`)
- `Compute Cost = instance_type_hourly_rate * monthly_operating_hours`
- `Root EBS Cost = root_volume_size_gb * ebs_gp3_rate`
- **Total = Compute Cost + Root EBS Cost**

### 2. Amazon RDS (`aws_db_instance`)
- `Multi-AZ Multiplier = multi_az ? 2.0 : 1.0`
- `Instance Cost = instance_class_hourly_rate * Multi-AZ Multiplier * monthly_operating_hours`
- `Storage Cost = allocated_storage_gb * rds_gp3_storage_rate * Multi-AZ Multiplier`
- **Total = Instance Cost + Storage Cost**

### 3. Amazon S3 (`aws_s3_bucket`)
- `Storage Cost = monthly_s3_storage_gb * s3_standard_rate` ($0.023/GB-Mo)
- `Request Cost = (monthly_s3_requests / 1,000) * $0.005`
- **Total = Storage Cost + Request Cost**

### 4. Amazon EBS (`aws_ebs_volume`)
- `Storage Cost = volume_size_gb * volume_type_rate` (gp3 = $0.08, gp2 = $0.10, io2 = $0.125)
- **Total = Storage Cost**

### 5. AWS NAT Gateway (`aws_nat_gateway`)
- `Provisioned Cost = nat_gateway_hourly_rate ($0.045/hr) * monthly_operating_hours`
- `Traffic Cost = monthly_nat_traffic_gb * $0.045/GB`
- **Total = Provisioned Cost + Traffic Cost**

### 6. Application Load Balancer (`aws_lb`)
- `Running Cost = alb_hourly_rate ($0.0225/hr) * monthly_operating_hours`
- `LCU Cost = 1_baseline_lcu * $0.008/hr * monthly_operating_hours`
- **Total = Running Cost + LCU Cost**

### 7. Non-Billable Core AWS Resources
- **VPC, Subnets, Internet Gateways, Route Tables, Security Groups, IAM Roles, IAM Policies**:
  - Itemized as **$0.00** with an explicit label confirming inclusion in the AWS free tier / standard account features.
