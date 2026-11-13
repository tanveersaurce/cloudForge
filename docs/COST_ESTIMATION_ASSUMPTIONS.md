# CloudForge Workload Estimation Assumptions

## Presets & Default Parameters

| Parameter | Development | Small Production (Default) | Medium Production | High Traffic |
|---|---|---|---|---|
| **Monthly Operating Hours** | 240 hrs (10h/day for 24 weekdays) | 730 hrs (24x7 full month) | 730 hrs | 730 hrs |
| **Average CPU Utilization** | 20% | 50% | 65% | 80% |
| **Outbound Data Transfer** | 20 GB | 100 GB | 500 GB | 5,000 GB |
| **Monthly S3 Storage** | 10 GB | 50 GB | 500 GB | 5,000 GB |
| **Monthly S3 Requests** | 5,000 | 50,000 | 500,000 | 10,000,000 |
| **NAT Data Processed** | 10 GB | 50 GB | 250 GB | 2,500 GB |
| **Lambda Invocations** | 50,000 | 1,000,000 | 10,000,000 | 100,000,000 |
| **Avg Lambda Duration** | 100 ms | 200 ms | 250 ms | 350 ms |

## Customization
Users can switch presets with a single click or modify any individual parameter in the Workload Assumptions modal. When customized, the profile is preserved under the `Custom` preset.
