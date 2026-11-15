import type { WorkloadAssumptions, WorkloadPreset } from '../types/pricing.types.js';

export const WORKLOAD_PRESETS: Record<WorkloadPreset, WorkloadAssumptions> = {
  Development: {
    preset: 'Development',
    monthlyOperatingHours: 240, // 10h/day for 24 business days
    averageCpuUtilization: 20,
    monthlyDataTransferOutGb: 20,
    monthlyS3StorageGb: 10,
    monthlyS3Requests: 5000,
    monthlyS3PutRequests: 1000,
    monthlyS3GetRequests: 4000,
    monthlyNatTrafficGb: 10,
    monthlyLambdaInvocations: 50000,
    averageLambdaDurationMs: 100,
  },
  'Small Production': {
    preset: 'Small Production',
    monthlyOperatingHours: 730, // 24x7 standard month
    averageCpuUtilization: 50,
    monthlyDataTransferOutGb: 100,
    monthlyS3StorageGb: 50,
    monthlyS3Requests: 50000,
    monthlyS3PutRequests: 10000,
    monthlyS3GetRequests: 40000,
    monthlyNatTrafficGb: 50,
    monthlyLambdaInvocations: 1000000,
    averageLambdaDurationMs: 200,
  },
  'Medium Production': {
    preset: 'Medium Production',
    monthlyOperatingHours: 730,
    averageCpuUtilization: 65,
    monthlyDataTransferOutGb: 500,
    monthlyS3StorageGb: 500,
    monthlyS3Requests: 500000,
    monthlyS3PutRequests: 100000,
    monthlyS3GetRequests: 400000,
    monthlyNatTrafficGb: 250,
    monthlyLambdaInvocations: 10000000,
    averageLambdaDurationMs: 250,
  },
  'High Traffic': {
    preset: 'High Traffic',
    monthlyOperatingHours: 730,
    averageCpuUtilization: 80,
    monthlyDataTransferOutGb: 5000,
    monthlyS3StorageGb: 5000,
    monthlyS3Requests: 10000000,
    monthlyS3PutRequests: 2000000,
    monthlyS3GetRequests: 8000000,
    monthlyNatTrafficGb: 2500,
    monthlyLambdaInvocations: 100000000,
    averageLambdaDurationMs: 350,
  },
  Custom: {
    preset: 'Custom',
    monthlyOperatingHours: 730,
    averageCpuUtilization: 50,
    monthlyDataTransferOutGb: 100,
    monthlyS3StorageGb: 50,
    monthlyS3Requests: 50000,
    monthlyS3PutRequests: 10000,
    monthlyS3GetRequests: 40000,
    monthlyNatTrafficGb: 50,
    monthlyLambdaInvocations: 1000000,
    averageLambdaDurationMs: 200,
  },
};

export function getDefaultAssumptions(): WorkloadAssumptions {
  return structuredClone(WORKLOAD_PRESETS['Small Production']);
}
