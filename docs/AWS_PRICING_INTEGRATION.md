# AWS Pricing Integration & Regional Rate Structure

## Official Sources
- **AWS Price List Bulk API & AWS Pricing Calculator Engine**:
  - `https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/Welcome.html`
  - `https://aws.amazon.com/pricing/`

## Pricing Dimensions & Modifiers
All base prices are established for `us-east-1` (US East, N. Virginia) and scaled using verified regional multipliers:

| Region | Code | Multiplier | Relative Impact |
|---|---|---|---|
| US East (N. Virginia) | `us-east-1` | 1.00x | Benchmark rate |
| US East (Ohio) | `us-east-2` | 1.00x | Benchmark rate |
| US West (Oregon) | `us-west-2` | 1.00x | Benchmark rate |
| US West (N. California) | `us-west-1` | 1.12x | +12% cost factor |
| Europe (Ireland) | `eu-west-1` | 1.08x | +8% cost factor |
| Europe (Frankfurt) | `eu-central-1` | 1.10x | +10% cost factor |
| Asia Pacific (Tokyo) | `ap-northeast-1` | 1.14x | +14% cost factor |
| Asia Pacific (Singapore) | `ap-southeast-1` | 1.15x | +15% cost factor |

## Commitment & Pricing Models
- **On-Demand**: Standard baseline pay-as-you-go pricing without upfront commitments.
- **1-Year Compute Savings Plans / Reserved Instances**: Evaluated with ~35% average cost reduction for 24x7 steady-state workloads.
- **Spot Instances**: Evaluated with ~70% savings for interruption-tolerant stateless batch tasks.
