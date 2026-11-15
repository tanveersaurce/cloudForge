import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ArchitectureFlowNode } from '../architecture-builder/types/architecture.types';
import { CostOptimizationSection } from './components/CostOptimizationSection';
import { CostSummaryCards } from './components/CostSummaryCards';
import { ServiceBreakdownChart } from './components/ServiceBreakdownChart';
import { WorkloadAssumptionsModal } from './components/WorkloadAssumptionsModal';
import {
  calculateAchievableSavings,
  calculateClientCost,
  DEFAULT_CLIENT_ASSUMPTIONS,
} from './engine/clientCostCalculator';
import type { CostOptimizationRecommendation } from './types/pricing.types';

describe('Client Cost Calculator & Optimization Engine', () => {
  it('calculates monthly and hourly estimates across compute, database, storage, and networking', () => {
    const nodes: ArchitectureFlowNode[] = [
      {
        id: 'ec2-1',
        type: 'awsResource',
        position: { x: 0, y: 0 },
        data: {
          serviceId: 'svc-ec2',
          serviceSlug: 'amazon-ec2',
          serviceName: 'Amazon EC2',
          categorySlug: 'compute',
          categoryName: 'Compute',
          iconKey: 'ec2',
          resourceName: 'EC2',
          resourceType: 'aws_instance',
          label: 'App Server',
          description: '',
          metadata: { instance_type: 't3.medium', root_volume_size: 30 },
        },
      },
      {
        id: 'rds-1',
        type: 'awsResource',
        position: { x: 100, y: 100 },
        data: {
          serviceId: 'svc-rds',
          serviceSlug: 'amazon-rds',
          serviceName: 'Amazon RDS',
          categorySlug: 'database',
          categoryName: 'Database',
          iconKey: 'rds',
          resourceName: 'RDS',
          resourceType: 'aws_db_instance',
          label: 'Postgres DB',
          description: '',
          metadata: { instance_class: 'db.t3.medium', multi_az: true, allocated_storage: 100 },
        },
      },
      {
        id: 'nat-1',
        type: 'awsResource',
        position: { x: 200, y: 200 },
        data: {
          serviceId: 'svc-vpc',
          serviceSlug: 'amazon-vpc',
          serviceName: 'Amazon VPC',
          categorySlug: 'networking-content-delivery',
          categoryName: 'Networking',
          iconKey: 'vpc',
          resourceName: 'NAT Gateway',
          resourceType: 'aws_nat_gateway',
          label: 'Main NAT',
          description: '',
          metadata: {},
        },
      },
      {
        id: 's3-1',
        type: 'awsResource',
        position: { x: 300, y: 300 },
        data: {
          serviceId: 'svc-s3',
          serviceSlug: 'amazon-s3',
          serviceName: 'Amazon S3',
          categorySlug: 'storage',
          categoryName: 'Storage',
          iconKey: 's3',
          resourceName: 'S3 Bucket',
          resourceType: 'aws_s3_bucket',
          label: 'Assets S3',
          description: '',
          metadata: {},
        },
      },
    ];

    const result = calculateClientCost('arch-1', 'us-east-1', nodes, [], DEFAULT_CLIENT_ASSUMPTIONS);

    expect(result.totalEstimatedMonthly).toBeGreaterThan(100);
    expect(result.totalEstimatedHourly).toBeGreaterThan(0);
    expect(result.serviceBreakdown.length).toBe(4);

    // Verify recommendations generated
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.potentialMonthlySavings).toBeGreaterThan(0);

    const graviton = result.recommendations.find((r) => r.recommendationId.includes('GRAVITON'));
    expect(graviton).toBeDefined();
    expect(graviton?.proposedConfiguration.instance_type).toBe('t4g.medium');
  });

  it('respects workload operating hours between Development and Production presets', () => {
    const nodes: ArchitectureFlowNode[] = [
      {
        id: 'ec2-test',
        type: 'awsResource',
        position: { x: 0, y: 0 },
        data: {
          serviceId: 'svc-ec2',
          serviceSlug: 'amazon-ec2',
          serviceName: 'Amazon EC2',
          categorySlug: 'compute',
          categoryName: 'Compute',
          iconKey: 'ec2',
          resourceName: 'EC2',
          resourceType: 'aws_instance',
          label: 'Worker',
          description: '',
          metadata: { instance_type: 't3.micro' },
        },
      },
    ];

    const devAssumptions = { ...DEFAULT_CLIENT_ASSUMPTIONS, monthlyOperatingHours: 240 };
    const prodAssumptions = { ...DEFAULT_CLIENT_ASSUMPTIONS, monthlyOperatingHours: 730 };

    const devCost = calculateClientCost('arch-dev', 'us-east-1', nodes, [], devAssumptions);
    const prodCost = calculateClientCost('arch-prod', 'us-east-1', nodes, [], prodAssumptions);

    expect(devCost.totalEstimatedMonthly).toBeLessThan(prodCost.totalEstimatedMonthly);
  });
});

describe('Cost Summary Cards Component', () => {
  it('renders estimated monthly, hourly, savings, and optimized target', () => {
    const mockEstimate = calculateClientCost(
      'arch-test',
      'us-east-1',
      [
        {
          id: 'ec2-1',
          type: 'awsResource',
          position: { x: 0, y: 0 },
          data: {
            serviceId: 'svc-ec2',
            serviceSlug: 'amazon-ec2',
            serviceName: 'Amazon EC2',
            categorySlug: 'compute',
            categoryName: 'Compute',
            iconKey: 'ec2',
            resourceName: 'EC2',
            resourceType: 'aws_instance',
            label: 'Web',
            description: '',
            metadata: { instance_type: 't3.large' },
          },
        },
      ],
      [],
      DEFAULT_CLIENT_ASSUMPTIONS,
    );

    render(<CostSummaryCards estimate={mockEstimate} />);

    expect(screen.getByText(/Estimated Monthly/i)).toBeInTheDocument();
    expect(screen.getByText(/Estimated Hourly/i)).toBeInTheDocument();
    expect(screen.getByText(/Potential Savings/i)).toBeInTheDocument();
    expect(screen.getByText(/Optimized Target/i)).toBeInTheDocument();
  });
});

describe('Service Breakdown Chart Component', () => {
  it('renders service items and percentages', () => {
    const breakdown = [
      { serviceCode: 'AmazonEC2', serviceName: 'Amazon EC2', monthlyCost: 80.0, percentage: 80, resourceCount: 2 },
      { serviceCode: 'AmazonS3', serviceName: 'Amazon S3', monthlyCost: 20.0, percentage: 20, resourceCount: 1 },
    ];

    render(<ServiceBreakdownChart breakdown={breakdown} totalMonthly={100.0} />);

    expect(screen.getByText('Service-Wise Cost Distribution')).toBeInTheDocument();
    expect(screen.getByText('Amazon EC2')).toBeInTheDocument();
    expect(screen.getByText('Amazon S3')).toBeInTheDocument();
    expect(screen.getByText('$80.00/mo')).toBeInTheDocument();
    expect(screen.getByText('$20.00/mo')).toBeInTheDocument();
  });
});

describe('Workload Assumptions Modal Component', () => {
  const user = userEvent.setup();

  it('switches presets and saves new assumptions', async () => {
    const onSaveMock = vi.fn();
    const onCloseMock = vi.fn();

    render(
      <WorkloadAssumptionsModal
        isOpen={true}
        onClose={onCloseMock}
        currentAssumptions={DEFAULT_CLIENT_ASSUMPTIONS}
        onSave={onSaveMock}
      />,
    );

    expect(screen.getByText('Workload Assumptions')).toBeInTheDocument();

    // Click Development preset
    const devBtn = screen.getByRole('button', { name: /Development/i });
    await user.click(devBtn);

    // Save
    const saveBtn = screen.getByRole('button', { name: /Apply Assumptions/i });
    await user.click(saveBtn);

    expect(onSaveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        preset: 'Development',
        monthlyOperatingHours: 240,
      }),
    );
    expect(onCloseMock).toHaveBeenCalled();
  });
});

describe('Cost Optimization Section Component', () => {
  const user = userEvent.setup();

  it('displays recommendations with before/after diff and applies optimization', async () => {
    const onApplyMock = vi.fn().mockResolvedValue(undefined);
    const recommendations: CostOptimizationRecommendation[] = [
      {
        recommendationId: 'REC-GRAVITON-1',
        title: 'Adopt AWS Graviton (t4g.large)',
        category: 'compute',
        priority: 'high',
        affectedResourceIds: ['ec2-node'],
        currentConfiguration: { instance_type: 't3.large' },
        proposedConfiguration: { instance_type: 't4g.large' },
        explanation: 'Switching to Graviton provides 20% lower cost.',
        estimatedCurrentCost: 60.0,
        estimatedOptimizedCost: 48.0,
        estimatedMonthlySavings: 12.0,
        savingsPercentage: 20,
        currency: 'USD',
        performanceImpact: 'improved',
        securityImpact: 'neutral',
        availabilityImpact: 'neutral',
        implementationEffort: 'low',
        confidenceLevel: 'high',
        requiredAssumptions: ['Supports ARM64'],
        documentationReferences: [{ title: 'AWS Graviton', url: 'https://aws.amazon.com' }],
        status: 'pending',
      },
    ];

    render(
      <CostOptimizationSection
        recommendations={recommendations}
        onApply={onApplyMock}
      />,
    );

    expect(screen.getByText('Adopt AWS Graviton (t4g.large)')).toBeInTheDocument();
    expect(screen.getByText('Save $12.00/mo')).toBeInTheDocument();
    expect(screen.getByText('Current Configuration')).toBeInTheDocument();
    expect(screen.getByText('Proposed Configuration')).toBeInTheDocument();

    // Click Apply
    const applyBtn = screen.getByRole('button', { name: /Apply Optimization/i });
    await user.click(applyBtn);

    await waitFor(() => {
      expect(onApplyMock).toHaveBeenCalledWith('REC-GRAVITON-1');
    });
  });

  describe('Pricing Engine Accuracy, Regional Scaling & Missing Configurations', () => {
    it('applies regional pricing multipliers accurately in client-side calculations', () => {
      const node: ArchitectureFlowNode = {
        id: 'ec2-regional',
        type: 'awsResource',
        position: { x: 0, y: 0 },
        data: {
          serviceId: 'svc-ec2',
          serviceSlug: 'amazon-ec2',
          serviceName: 'Amazon EC2',
          categorySlug: 'compute',
          categoryName: 'Compute',
          iconKey: 'ec2',
          resourceName: 'EC2',
          resourceType: 'aws_instance',
          label: 'Regional Server',
          description: '',
          metadata: { instance_type: 't3.micro', root_volume_size: 20 },
        },
      };

      const usEastResult = calculateClientCost('arch-reg', 'us-east-1', [node], [], DEFAULT_CLIENT_ASSUMPTIONS);
      const tokyoResult = calculateClientCost('arch-reg', 'ap-northeast-1', [node], [], DEFAULT_CLIENT_ASSUMPTIONS);

      // Tokyo regional multiplier is 1.14x
      expect(tokyoResult.totalEstimatedMonthly).toBeGreaterThan(usEastResult.totalEstimatedMonthly);
      expect(tokyoResult.totalEstimatedMonthly).toBeCloseTo(usEastResult.totalEstimatedMonthly * 1.14, 0);

      // Check item metadata
      expect(tokyoResult.resourceItems[0].region).toBe('ap-northeast-1');
      expect(tokyoResult.resourceItems[0].pricingSource).toBe('AWS Price List Reference Snapshot (Illustrative)');
      expect(tokyoResult.resourceItems[0].pricingRetrievedAt).toBe('2026-11-01T00:00:00.000Z');
    });

    it('marks pricing as unavailable for unrecognized instance types without silently falling back to t3.micro', () => {
      const node: ArchitectureFlowNode = {
        id: 'ec2-unknown-sku',
        type: 'awsResource',
        position: { x: 0, y: 0 },
        data: {
          serviceId: 'svc-ec2',
          serviceSlug: 'amazon-ec2',
          serviceName: 'Amazon EC2',
          categorySlug: 'compute',
          categoryName: 'Compute',
          iconKey: 'ec2',
          resourceName: 'EC2',
          resourceType: 'aws_instance',
          label: 'Super Compute',
          description: '',
          metadata: { instance_type: 'c5.24xlarge' }, // Not in catalog
        },
      };

      const result = calculateClientCost('arch-sku', 'us-east-1', [node], [], DEFAULT_CLIENT_ASSUMPTIONS);
      const item = result.resourceItems[0];

      // Must be flagged as unavailable
      expect(item.isPricingAvailable).toBe(false);
      expect(item.warnings.some((w) => w.includes('Pricing unavailable for instance type "c5.24xlarge"'))).toBe(true);
    });

    it('records explicit warnings and missingAssumptions when configurations default silently', () => {
      const node: ArchitectureFlowNode = {
        id: 'ec2-defaults',
        type: 'awsResource',
        position: { x: 0, y: 0 },
        data: {
          serviceId: 'svc-ec2',
          serviceSlug: 'amazon-ec2',
          serviceName: 'Amazon EC2',
          categorySlug: 'compute',
          categoryName: 'Compute',
          iconKey: 'ec2',
          resourceName: 'EC2',
          resourceType: 'aws_instance',
          label: 'Default Instance',
          description: '',
          metadata: {}, // Missing instance_type and root_volume_size
        },
      };

      const result = calculateClientCost('arch-def', 'us-east-1', [node], [], DEFAULT_CLIENT_ASSUMPTIONS);

      expect(result.missingAssumptions.length).toBeGreaterThanOrEqual(2);
      expect(result.missingAssumptions.some((a) => a.includes('instance_type not configured'))).toBe(true);
      expect(result.missingAssumptions.some((a) => a.includes('root_volume_size not configured'))).toBe(true);
    });

    it('flags unsupported regions in missingAssumptions and individual resource warnings', () => {
      const node: ArchitectureFlowNode = {
        id: 'ec2-unsupported',
        type: 'awsResource',
        position: { x: 0, y: 0 },
        data: {
          serviceId: 'svc-ec2',
          serviceSlug: 'amazon-ec2',
          serviceName: 'Amazon EC2',
          categorySlug: 'compute',
          categoryName: 'Compute',
          iconKey: 'ec2',
          resourceName: 'EC2',
          resourceType: 'aws_instance',
          label: 'Unsupported Region Instance',
          description: '',
          metadata: { instance_type: 't3.micro', root_volume_size: 20 },
        },
      };

      const result = calculateClientCost('arch-unsupp', 'ap-south-1', [node], [], DEFAULT_CLIENT_ASSUMPTIONS);

      expect(result.missingAssumptions.some((a) => a.includes('ap-south-1'))).toBe(true);
      expect(result.resourceItems[0].warnings.some((w) => w.includes('ap-south-1'))).toBe(true);
      expect(result.resourceItems[0].warnings.some((w) => w.includes('illustrative'))).toBe(true);
    });

    it('scales services according to service-specific regional multipliers', () => {
      const ec2Node: ArchitectureFlowNode = {
        id: 'ec2-node',
        type: 'awsResource',
        position: { x: 0, y: 0 },
        data: {
          serviceId: 'svc-ec2',
          serviceSlug: 'amazon-ec2',
          serviceName: 'Amazon EC2',
          categorySlug: 'compute',
          categoryName: 'Compute',
          iconKey: 'ec2',
          resourceName: 'EC2',
          resourceType: 'aws_instance',
          label: 'EC2',
          description: '',
          metadata: { instance_type: 't3.micro', root_volume_size: 0 },
        },
      };

      const natNode: ArchitectureFlowNode = {
        id: 'nat-node',
        type: 'awsResource',
        position: { x: 100, y: 0 },
        data: {
          serviceId: 'svc-vpc',
          serviceSlug: 'amazon-vpc',
          serviceName: 'Amazon VPC',
          categorySlug: 'networking-content-delivery',
          categoryName: 'Networking',
          iconKey: 'vpc',
          resourceName: 'NAT',
          resourceType: 'aws_nat_gateway',
          label: 'NAT Gateway',
          description: '',
          metadata: {},
        },
      };

      const tokyo = calculateClientCost('arch-mult', 'ap-northeast-1', [ec2Node, natNode], [], DEFAULT_CLIENT_ASSUMPTIONS);
      const ec2Item = tokyo.resourceItems.find((i) => i.resourceType === 'aws_instance');
      const natItem = tokyo.resourceItems.find((i) => i.resourceType === 'aws_nat_gateway');

      // EC2 multiplier in Tokyo is 1.14x, NAT Gateway (VPC) multiplier is 1.38x
      const ec2ComputeRate = ec2Item?.dimensions[0]?.unitPrice;
      const natHourlyRate = natItem?.dimensions[0]?.unitPrice;

      expect(ec2ComputeRate).toBeCloseTo(0.0104 * 1.14, 4);
      expect(natHourlyRate).toBeCloseTo(0.045 * 1.38, 4);
    });

    it('handles incompatible recommendations by choosing the higher savings option', () => {
      const recs: CostOptimizationRecommendation[] = [
        {
          recommendationId: 'REC-GRAVITON',
          title: 'Switch to Graviton t4g.medium',
          category: 'compute',
          priority: 'high',
          affectedResourceIds: ['ec2-1'],
          currentConfiguration: { instance_type: 't3.medium' },
          proposedConfiguration: { instance_type: 't4g.medium' },
          explanation: '',
          estimatedCurrentCost: 30.37,
          estimatedOptimizedCost: 24.53,
          estimatedMonthlySavings: 5.84,
          savingsPercentage: 19,
          currency: 'USD',
          performanceImpact: 'improved',
          securityImpact: 'neutral',
          availabilityImpact: 'neutral',
          implementationEffort: 'low',
          confidenceLevel: 'high',
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending',
        },
        {
          recommendationId: 'REC-AMD',
          title: 'Switch to AMD t3a.medium',
          category: 'compute',
          priority: 'medium',
          affectedResourceIds: ['ec2-1'],
          currentConfiguration: { instance_type: 't3.medium' },
          proposedConfiguration: { instance_type: 't3a.medium' },
          explanation: '',
          estimatedCurrentCost: 30.37,
          estimatedOptimizedCost: 27.33,
          estimatedMonthlySavings: 3.04,
          savingsPercentage: 10,
          currency: 'USD',
          performanceImpact: 'neutral',
          securityImpact: 'neutral',
          availabilityImpact: 'neutral',
          implementationEffort: 'low',
          confidenceLevel: 'high',
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending',
        },
      ];

      const analysis = calculateAchievableSavings(recs);

      expect(analysis.individualSavingsSum).toBe(8.88);
      expect(analysis.combinedAchievableSavings).toBe(5.84);
      expect(analysis.hasOverlappingRecommendations).toBe(true);
      expect(analysis.overlapNotes.some((n) => n.includes('mutually exclusive'))).toBe(true);
    });

    it('combines compatible recommendations on the same EBS volume sequentially without dropping', () => {
      const recs: CostOptimizationRecommendation[] = [
        {
          recommendationId: 'REC-DOWNSIZE',
          title: 'Downsize EBS volume from 100GB to 50GB',
          category: 'storage',
          priority: 'high',
          affectedResourceIds: ['ebs-1'],
          currentConfiguration: { size: 100 },
          proposedConfiguration: { size: 50 },
          explanation: '',
          estimatedCurrentCost: 10.0,
          estimatedOptimizedCost: 5.0,
          estimatedMonthlySavings: 5.0,
          savingsPercentage: 50,
          currency: 'USD',
          performanceImpact: 'neutral',
          securityImpact: 'neutral',
          availabilityImpact: 'neutral',
          implementationEffort: 'low',
          confidenceLevel: 'high',
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending',
        },
        {
          recommendationId: 'REC-GP3',
          title: 'Upgrade EBS volume to gp3',
          category: 'storage',
          priority: 'high',
          affectedResourceIds: ['ebs-1'],
          currentConfiguration: { volume_type: 'gp2' },
          proposedConfiguration: { volume_type: 'gp3' },
          explanation: '',
          estimatedCurrentCost: 10.0,
          estimatedOptimizedCost: 8.0,
          estimatedMonthlySavings: 2.0,
          savingsPercentage: 20,
          currency: 'USD',
          performanceImpact: 'improved',
          securityImpact: 'neutral',
          availabilityImpact: 'neutral',
          implementationEffort: 'low',
          confidenceLevel: 'high',
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending',
        },
      ];

      const analysis = calculateAchievableSavings(recs);

      // Downsizing: $5.00 savings. gp3 on remaining $5.00: 20% = $1.00.
      expect(analysis.individualSavingsSum).toBe(7.0);
      expect(analysis.combinedAchievableSavings).toBe(6.0);
      expect(analysis.hasOverlappingRecommendations).toBe(true);
      expect(analysis.overlapNotes.some((n) => n.includes('compounding'))).toBe(true);
    });

    it('adjusts Savings Plans to baseline after architectural compute reductions', () => {
      const recs: CostOptimizationRecommendation[] = [
        {
          recommendationId: 'REC-GRAVITON',
          title: 'Adopt Graviton',
          category: 'compute',
          priority: 'high',
          affectedResourceIds: ['ec2-1'],
          currentConfiguration: { instance_type: 'm5.large' },
          proposedConfiguration: { instance_type: 'm6g.large' },
          explanation: '',
          estimatedCurrentCost: 70.08,
          estimatedOptimizedCost: 56.21,
          estimatedMonthlySavings: 13.87,
          savingsPercentage: 20,
          currency: 'USD',
          performanceImpact: 'improved',
          securityImpact: 'neutral',
          availabilityImpact: 'neutral',
          implementationEffort: 'low',
          confidenceLevel: 'high',
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending',
        },
        {
          recommendationId: 'REC-SP',
          title: 'Compute Savings Plan',
          category: 'pricing-model',
          priority: 'medium',
          affectedResourceIds: ['ec2-1'],
          currentConfiguration: { pricing_model: 'On-Demand' },
          proposedConfiguration: { pricing_model: 'Savings Plan' },
          explanation: '',
          estimatedCurrentCost: 70.08,
          estimatedOptimizedCost: 45.55,
          estimatedMonthlySavings: 24.53,
          savingsPercentage: 35,
          currency: 'USD',
          performanceImpact: 'neutral',
          securityImpact: 'neutral',
          availabilityImpact: 'neutral',
          implementationEffort: 'low',
          confidenceLevel: 'medium',
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending',
        },
      ];

      const analysis = calculateAchievableSavings(recs);

      expect(analysis.individualSavingsSum).toBe(38.4);
      expect(analysis.combinedAchievableSavings).toBe(33.54);
      expect(analysis.hasOverlappingRecommendations).toBe(true);
    });

    it('allocates multi-resource recommendation savings proportionally without multiplying', () => {
      const rec: CostOptimizationRecommendation = {
        recommendationId: 'REC-MULTI-NAT',
        title: 'Bypass NAT Gateways for S3',
        category: 'networking',
        priority: 'high',
        affectedResourceIds: ['nat-1', 'nat-2'],
        currentConfiguration: { s3_routing: 'NAT' },
        proposedConfiguration: { s3_routing: 'Gateway Endpoint' },
        explanation: 'Multi-resource gateway endpoint',
        estimatedCurrentCost: 90.0,
        estimatedOptimizedCost: 45.0,
        estimatedMonthlySavings: 45.0,
        savingsPercentage: 50,
        currency: 'USD',
        performanceImpact: 'improved',
        securityImpact: 'neutral',
        availabilityImpact: 'neutral',
        implementationEffort: 'low',
        confidenceLevel: 'high',
        requiredAssumptions: [],
        documentationReferences: [],
        status: 'pending',
      };

      const analysis = calculateAchievableSavings([rec]);

      expect(analysis.individualSavingsSum).toBe(45.0);
      expect(analysis.combinedAchievableSavings).toBe(45.0);
    });

    it('compounds multiple compatible recommendations across multiple resources at the resource level', () => {
      const recs: CostOptimizationRecommendation[] = [
        {
          recommendationId: 'REC-MULTI-GRAVITON',
          title: 'Graviton on EC2 Cluster',
          category: 'compute',
          priority: 'high',
          affectedResourceIds: ['ec2-1', 'ec2-2'],
          currentConfiguration: { instance_type: 't3.medium' },
          proposedConfiguration: { instance_type: 't4g.medium' },
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 80.0,
          estimatedMonthlySavings: 20.0,
          savingsPercentage: 20,
          currency: 'USD',
          performanceImpact: 'improved',
          securityImpact: 'neutral',
          availabilityImpact: 'neutral',
          implementationEffort: 'low',
          confidenceLevel: 'high',
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending',
        },
        {
          recommendationId: 'REC-MULTI-SCHEDULE',
          title: 'Weekend Auto-Shutdown Schedule',
          category: 'compute',
          priority: 'medium',
          affectedResourceIds: ['ec2-1', 'ec2-2'],
          currentConfiguration: { schedule: '24x7' },
          proposedConfiguration: { schedule: 'business-hours' },
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 70.0,
          estimatedMonthlySavings: 30.0,
          savingsPercentage: 30,
          currency: 'USD',
          performanceImpact: 'neutral',
          securityImpact: 'neutral',
          availabilityImpact: 'neutral',
          implementationEffort: 'low',
          confidenceLevel: 'high',
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending',
        },
      ];

      const analysis = calculateAchievableSavings(recs);

      // Rec 1: $10 saved per instance ($20 total). Remaining cost per instance: $40.
      // Rec 2: 30% discount compounded on $40 remaining = $12 saved per instance ($24 total).
      // Combined savings = $20 + $24 = $44.00 (individual sum = $50.00).
      expect(analysis.individualSavingsSum).toBe(50.0);
      expect(analysis.combinedAchievableSavings).toBe(44.0);
      expect(analysis.hasOverlappingRecommendations).toBe(true);
    });

    it('rejects conflicting recommendations across multiple resources', () => {
      const recs: CostOptimizationRecommendation[] = [
        {
          recommendationId: 'REC-GRAVITON',
          title: 'Upgrade to Graviton',
          category: 'compute',
          priority: 'high',
          affectedResourceIds: ['ec2-1', 'ec2-2'],
          currentConfiguration: { instance_type: 't3.medium' },
          proposedConfiguration: { instance_type: 't4g.medium' },
          explanation: '',
          estimatedCurrentCost: 60.0,
          estimatedOptimizedCost: 48.0,
          estimatedMonthlySavings: 12.0,
          savingsPercentage: 20,
          currency: 'USD',
          performanceImpact: 'improved',
          securityImpact: 'neutral',
          availabilityImpact: 'neutral',
          implementationEffort: 'low',
          confidenceLevel: 'high',
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending',
        },
        {
          recommendationId: 'REC-AMD',
          title: 'Switch to AMD',
          category: 'compute',
          priority: 'medium',
          affectedResourceIds: ['ec2-1', 'ec2-3'],
          currentConfiguration: { instance_type: 't3.medium' },
          proposedConfiguration: { instance_type: 't3a.medium' },
          explanation: '',
          estimatedCurrentCost: 60.0,
          estimatedOptimizedCost: 54.0,
          estimatedMonthlySavings: 6.0,
          savingsPercentage: 10,
          currency: 'USD',
          performanceImpact: 'neutral',
          securityImpact: 'neutral',
          availabilityImpact: 'neutral',
          implementationEffort: 'low',
          confidenceLevel: 'high',
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending',
        },
      ];

      const analysis = calculateAchievableSavings(recs);

      expect(analysis.combinedAchievableSavings).toBe(12.0);
      expect(analysis.hasOverlappingRecommendations).toBe(true);
      expect(analysis.overlapNotes.some((n) => n.includes('mutually exclusive'))).toBe(true);
    });

    it('deducts architectural compute savings exactly once across multiple EC2 instances before Savings Plans', () => {
      const recs: CostOptimizationRecommendation[] = [
        {
          recommendationId: 'REC-EC2-1',
          title: 'Graviton Web',
          category: 'compute',
          priority: 'high',
          affectedResourceIds: ['ec2-1'],
          currentConfiguration: { instance_type: 't3.medium' },
          proposedConfiguration: { instance_type: 't4g.medium' },
          explanation: '',
          estimatedCurrentCost: 30.0,
          estimatedOptimizedCost: 20.0,
          estimatedMonthlySavings: 10.0,
          savingsPercentage: 33.3,
          currency: 'USD',
          performanceImpact: 'improved',
          securityImpact: 'neutral',
          availabilityImpact: 'neutral',
          implementationEffort: 'low',
          confidenceLevel: 'high',
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending',
        },
        {
          recommendationId: 'REC-EC2-2',
          title: 'Graviton API',
          category: 'compute',
          priority: 'high',
          affectedResourceIds: ['ec2-2'],
          currentConfiguration: { instance_type: 'm5.large' },
          proposedConfiguration: { instance_type: 'm6g.large' },
          explanation: '',
          estimatedCurrentCost: 70.0,
          estimatedOptimizedCost: 55.0,
          estimatedMonthlySavings: 15.0,
          savingsPercentage: 21.4,
          currency: 'USD',
          performanceImpact: 'improved',
          securityImpact: 'neutral',
          availabilityImpact: 'neutral',
          implementationEffort: 'low',
          confidenceLevel: 'high',
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending',
        },
        {
          recommendationId: 'REC-SP',
          title: 'Compute Savings Plan',
          category: 'pricing-model',
          priority: 'medium',
          affectedResourceIds: ['ec2-1', 'ec2-2'],
          currentConfiguration: { pricing_model: 'On-Demand' },
          proposedConfiguration: { pricing_model: 'Savings Plan' },
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 65.0,
          estimatedMonthlySavings: 35.0,
          savingsPercentage: 35,
          currency: 'USD',
          performanceImpact: 'neutral',
          securityImpact: 'neutral',
          availabilityImpact: 'neutral',
          implementationEffort: 'low',
          confidenceLevel: 'medium',
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending',
        },
      ];

      const analysis = calculateAchievableSavings(recs);

      // Total compute savings: $10 + $15 = $25. Remaining: $100 - $25 = $75.
      // Savings Plan: $75 * 0.35 = $26.25. Total = $25 + $26.25 = $51.25.
      expect(analysis.combinedAchievableSavings).toBe(51.25);
    });

    it('handles multiple Savings Plan recommendations by picking dominant commitment plan', () => {
      const recs: CostOptimizationRecommendation[] = [
        {
          recommendationId: 'REC-SP-3YR',
          title: '3-Year Compute Savings Plan',
          category: 'pricing-model',
          priority: 'high',
          affectedResourceIds: ['ec2-1'],
          currentConfiguration: { pricing_model: 'On-Demand' },
          proposedConfiguration: { pricing_model: '3-Year SP' },
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 50.0,
          estimatedMonthlySavings: 50.0,
          savingsPercentage: 50,
          currency: 'USD',
          performanceImpact: 'neutral',
          securityImpact: 'neutral',
          availabilityImpact: 'neutral',
          implementationEffort: 'low',
          confidenceLevel: 'high',
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending',
        },
        {
          recommendationId: 'REC-SP-1YR',
          title: '1-Year Compute Savings Plan',
          category: 'pricing-model',
          priority: 'medium',
          affectedResourceIds: ['ec2-1'],
          currentConfiguration: { pricing_model: 'On-Demand' },
          proposedConfiguration: { pricing_model: '1-Year SP' },
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 65.0,
          estimatedMonthlySavings: 35.0,
          savingsPercentage: 35,
          currency: 'USD',
          performanceImpact: 'neutral',
          securityImpact: 'neutral',
          availabilityImpact: 'neutral',
          implementationEffort: 'low',
          confidenceLevel: 'medium',
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending',
        },
      ];

      const analysis = calculateAchievableSavings(recs);

      expect(analysis.combinedAchievableSavings).toBe(50.0);
      expect(analysis.overlapNotes.some((n) => n.includes('overlaps with applied commitment plan'))).toBe(true);
    });

    it('safely handles zero-cost and missing-cost resources without throwing or NaN', () => {
      const rec: CostOptimizationRecommendation = {
        recommendationId: 'REC-FREE-IAM',
        title: 'Delete Unused Role',
        category: 'compute',
        priority: 'low',
        affectedResourceIds: ['iam-role-1'],
        currentConfiguration: {},
        proposedConfiguration: {},
        explanation: '',
        estimatedCurrentCost: 0.0,
        estimatedOptimizedCost: 0.0,
        estimatedMonthlySavings: 0.0,
        savingsPercentage: 0,
        currency: 'USD',
        performanceImpact: 'neutral',
        securityImpact: 'neutral',
        availabilityImpact: 'neutral',
        implementationEffort: 'low',
        confidenceLevel: 'low',
        requiredAssumptions: [],
        documentationReferences: [],
        status: 'pending',
      };

      const analysis = calculateAchievableSavings([rec]);
      expect(analysis.combinedAchievableSavings).toBe(0.0);
      expect(isNaN(analysis.combinedAchievableSavings)).toBe(false);
    });

    it('separates S3 Tier 1 (PUT/COPY/POST/LIST) and Tier 2 (GET/SELECT) request dimensions accurately', () => {
      const assumptions = {
        ...DEFAULT_CLIENT_ASSUMPTIONS,
        monthlyS3StorageGb: 100,
        monthlyS3PutRequests: 20000,
        monthlyS3GetRequests: 100000,
      };

      const nodes: ArchitectureFlowNode[] = [
        {
          id: 's3-bucket',
          type: 'awsResource',
          position: { x: 0, y: 0 },
          data: {
            serviceId: 'svc-s3',
            serviceSlug: 'amazon-s3',
            serviceName: 'Amazon S3',
            categorySlug: 'storage',
            categoryName: 'Storage',
            iconKey: 's3',
            resourceName: 'S3',
            resourceType: 'aws_s3_bucket',
            label: 'App S3',
            description: '',
            metadata: {},
          },
        },
      ];

      const result = calculateClientCost('arch-s3-reqs', 'us-east-1', nodes, [], assumptions);
      const s3Item = result.resourceItems[0];

      // Storage: 100 GB @ $0.023 = $2.30
      // Tier 1: 20k @ $0.005/1k = $0.10
      // Tier 2: 100k @ $0.0004/1k = $0.04
      // Total = $2.44
      expect(s3Item.monthlyCost).toBe(2.44);

      const tier1Dim = s3Item.dimensions.find((d) => d.name.includes('Tier 1 Requests'));
      const tier2Dim = s3Item.dimensions.find((d) => d.name.includes('Tier 2 Requests'));

      expect(tier1Dim).toBeDefined();
      expect(tier1Dim?.extendedCost).toBe(0.1);
      expect(tier2Dim).toBeDefined();
      expect(tier2Dim?.extendedCost).toBe(0.04);
    });

    it('verifies strict parity on shared benchmark fixture within 0.01 tolerance against BENCHMARK_EXPECTED', async () => {
      const { BENCHMARK_NODES, BENCHMARK_ASSUMPTIONS, BENCHMARK_EXPECTED } = await import(
        './data/pricingBenchmarkFixtures'
      );

      const result = calculateClientCost(
        'arch-parity',
        'us-east-1',
        BENCHMARK_NODES as any,
        [],
        BENCHMARK_ASSUMPTIONS,
      );

      const TOLERANCE = 0.01;

      // 1. Total Monthly Cost Parity
      const totalDiff = Math.abs(result.totalEstimatedMonthly - BENCHMARK_EXPECTED.totalEstimatedMonthly);
      expect(totalDiff).toBeLessThanOrEqual(TOLERANCE);
      expect(result.totalEstimatedMonthly).toBe(BENCHMARK_EXPECTED.totalEstimatedMonthly);

      // 2. Resource-Level Cost Parity
      expect(result.resourceItems.length).toBe(BENCHMARK_NODES.length);
      for (const [resId, expectedCost] of Object.entries(BENCHMARK_EXPECTED.resourceCosts)) {
        const item = result.resourceItems.find((r) => r.resourceId === resId);
        expect(item).toBeDefined();
        const diff = Math.abs(item!.monthlyCost - expectedCost);
        expect(diff).toBeLessThanOrEqual(TOLERANCE);
      }
    });
  });
});
