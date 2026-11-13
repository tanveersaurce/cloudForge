# CloudForge Cost Estimation & Optimization Engine Architecture

## Overview
Phase 08 establishes the financial intelligence layer of CloudForge. It integrates official AWS pricing datasets, regional cost factors, user-configurable workload assumptions, and an intelligent recommendation engine that guides users toward cost-efficient, high-performance architecture designs.

```mermaid
flowchart TD
    Arch[Architecture Canvas: Nodes & Edges] --> Analyzer[Architecture Cost Analyzer]
    Assumptions[Workload Assumptions Preset] --> Analyzer
    Catalog[AWS Pricing Catalog: Decimal-Safe Rates] --> Analyzer
    Analyzer --> CostCalc[Multi-Dimension Cost Calculator]
    CostCalc --> Items[Itemized Resource Breakdown]
    CostCalc --> Services[Service-Wise Distribution]
    CostCalc --> Total[Monthly & Hourly Totals]
    Items --> OptEngine[Intelligent Cost Optimization Engine]
    OptEngine --> Graviton[Graviton Alternatives]
    OptEngine --> Storage[EBS gp2 to gp3 Upgrades]
    OptEngine --> MultiAz[Multi-AZ Non-Prod Tuning]
    OptEngine --> GatewayEndpoints[Free S3/DDB Gateway Endpoints]
    OptEngine --> SavingsPlans[Compute Savings Plans]
    Graviton --> Recs[Actionable Recommendations with Before/After Diffs]
    Storage --> Recs
    MultiAz --> Recs
    GatewayEndpoints --> Recs
    SavingsPlans --> Recs
    Recs --> ExplorerUI[Cost Explorer Dashboard /cost-explorer/:id]
    ExplorerUI --> ApplyOpt[One-Click Optimization Application]
    ApplyOpt --> UpdateArch[Update Architecture & Recalculate]
```

## Core Tenets
1. **Never Invent Prices**: All calculations derive from documented AWS Price List specifications. When a rate cannot be matched, it is clearly flagged as unavailable rather than fabricated.
2. **Transparent Workload Assumptions**: Infrastructure configurations alone do not dictate cost. A compute instance requires running hours; an S3 bucket requires storage volume. The Workload Assumptions System makes all usage expectations transparent.
3. **No Automatic Destructive Changes**: Recommendations require explicit user consent and provide clear diffs of before/after configurations before applying.
