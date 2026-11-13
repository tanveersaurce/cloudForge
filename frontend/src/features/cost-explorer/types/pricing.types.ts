export type PricingPriceType = 'OnDemand' | 'Reserved1Yr' | 'Spot';

export interface PricingDimensionRate {
  serviceCode: string;
  resourceType: string;
  region: string;
  dimension: string;
  unit: string;
  pricePerUnit: number;
  currency: string;
  priceType: PricingPriceType;
  source: string;
  retrievedAt: string;
}

export type WorkloadPreset =
  | 'Development'
  | 'Small Production'
  | 'Medium Production'
  | 'High Traffic'
  | 'Custom';

export interface WorkloadAssumptions {
  preset: WorkloadPreset;
  monthlyOperatingHours: number;
  averageCpuUtilization: number;
  monthlyDataTransferOutGb: number;
  monthlyS3StorageGb: number;
  monthlyS3Requests: number;
  monthlyNatTrafficGb: number;
  monthlyLambdaInvocations: number;
  averageLambdaDurationMs: number;
}

export interface DimensionBreakdown {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  extendedCost: number;
}

export interface CostItemEstimate {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  serviceCode: string;
  region: string;
  dimensions: DimensionBreakdown[];
  monthlyCost: number;
  hourlyCost: number;
  currency: string;
  isPricingAvailable: boolean;
  pricingSource: string;
  pricingRetrievedAt: string;
  warnings: string[];
}

export interface ServiceCostSummary {
  serviceCode: string;
  serviceName: string;
  monthlyCost: number;
  percentage: number;
  resourceCount: number;
}

export type OptimizationCategory =
  | 'compute'
  | 'storage'
  | 'database'
  | 'networking'
  | 'architecture'
  | 'pricing-model';

export type OptimizationPriority = 'high' | 'medium' | 'low';

export type PerformanceImpact = 'neutral' | 'improved' | 'trade-off';
export type SecurityImpact = 'neutral' | 'improved';
export type AvailabilityImpact = 'neutral' | 'improved' | 'trade-off';
export type ImplementationEffort = 'low' | 'medium' | 'high';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type RecommendationStatus = 'pending' | 'accepted' | 'rejected' | 'applied';

export interface CostOptimizationRecommendation {
  recommendationId: string;
  title: string;
  category: OptimizationCategory;
  priority: OptimizationPriority;
  affectedResourceIds: string[];
  currentConfiguration: Record<string, unknown>;
  proposedConfiguration: Record<string, unknown>;
  explanation: string;
  estimatedCurrentCost: number;
  estimatedOptimizedCost: number;
  estimatedMonthlySavings: number;
  savingsPercentage: number;
  currency: string;
  performanceImpact: PerformanceImpact;
  securityImpact: SecurityImpact;
  availabilityImpact: AvailabilityImpact;
  implementationEffort: ImplementationEffort;
  confidenceLevel: ConfidenceLevel;
  requiredAssumptions: string[];
  documentationReferences: Array<{ title: string; url: string }>;
  status: RecommendationStatus;
}

export interface CostEstimationResult {
  architectureId: string;
  region: string;
  currency: string;
  totalEstimatedMonthly: number;
  totalEstimatedHourly: number;
  totalEstimatedAnnual: number;
  assumptions: WorkloadAssumptions;
  serviceBreakdown: ServiceCostSummary[];
  resourceItems: CostItemEstimate[];
  missingAssumptions: string[];
  potentialMonthlySavings: number;
  recommendations: CostOptimizationRecommendation[];
  calculatedAt: string;
}
