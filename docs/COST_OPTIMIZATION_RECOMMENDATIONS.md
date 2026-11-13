# CloudForge Intelligent Cost Optimization Recommendations

## Optimization Pillars & Strategies

### 1. Compute Optimization
- **Graviton Migration**: Automatically detects x86 architectures (`t3.*`, `m5.*`) and proposes direct ARM64 Graviton equivalents (`t4g.*`, `m6g.*`). Delivers up to 20% lower hourly cost with improved performance.
- **Compute Rightsizing**: Flags oversized instance selections (e.g. `m5.2xlarge`) in lower-traffic profiles and proposes right-sized alternatives.
- **Compute Savings Plans**: Analyzes steady-state 24x7 workloads (>700 operating hours) and projects ~35% savings under 1-year commitments.

### 2. Storage Optimization
- **EBS gp2 to gp3 Upgrades**: Detects legacy `gp2` volumes and recommends upgrading to `gp3`. gp3 saves 20% on storage ($0.08 vs $0.10/GB-month) and provides 3,000 baseline IOPS for free. Can be applied online without volume downtime.
- **S3 Intelligent-Tiering**: Recommends lifecycle automation for objects inactive past 30 days, cutting cold storage costs by 45%.

### 3. Database Optimization
- **Non-Production Multi-AZ Tuning**: In `Development` environments, recommends running Single-AZ instances instead of dual synchronous standby replicas, cutting database costs in half.

### 4. Networking Optimization
- **S3 Gateway VPC Endpoint**: When both a NAT Gateway and S3 bucket exist, recommends provisioning a free S3 Gateway Endpoint to bypass NAT Gateway data processing fees ($0.045/GB).

## Workflow & Safe Application
1. **Review**: Recommendations display affected resources, confidence levels (`high`, `medium`, `low`), and impact indicators (Performance, Security, Availability).
2. **Preview Diff**: Side-by-side comparison of current configuration vs. proposed configuration.
3. **Explicit User Consent**: User clicks **"Apply Optimization"**, which writes the updated metadata directly to the architecture nodes and recalculates the updated lower spend.
