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

  it('does not show Applied when recommendation is returned as Partial Targets by Apply All', async () => {
    const onApplyMock = vi.fn().mockResolvedValue(undefined);
    const onApplyAllMock = vi.fn().mockResolvedValue({
      applied: [],
      skipped: [],
      partialTargets: ['REC-GRAVITON-1'],
      conflicting: [],
      failed: [],
      recalculationFailed: false,
    });
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

    // First, individually apply the recommendation (adds to appliedIds)
    const { rerender } = render(
      <CostOptimizationSection
        recommendations={recommendations}
        onApply={onApplyMock}
      />,
    );

    const applyBtn = screen.getByRole('button', { name: /Apply Optimization/i });
    await user.click(applyBtn);

    await waitFor(() => {
      expect(onApplyMock).toHaveBeenCalledWith('REC-GRAVITON-1');
    });

    // Now simulate Apply All returning it as partialTargets
    // Re-render with onApplyAll and the Apply All result
    rerender(
      <CostOptimizationSection
        recommendations={recommendations}
        onApply={onApplyMock}
        onApplyAll={onApplyAllMock}
      />,
    );

    // Click Apply All
    const applyAllBtn = screen.getByRole('button', { name: /Apply All/i });
    await user.click(applyAllBtn);

    await waitFor(() => {
      expect(onApplyAllMock).toHaveBeenCalled();
    });

    // Badge should show Partial Targets, NOT Applied
    const partialLabels = screen.getAllByText('Partial Targets');
    expect(partialLabels.length).toBe(2); // 1 count card title + 1 badge

    // Button should show Apply Optimization, NOT Applied
    expect(screen.getByRole('button', { name: /Apply Optimization/i })).toBeInTheDocument();
  });

  it('displays Partial Targets count and section when Apply All returns partialTargets', async () => {
    const onApplyAllMock = vi.fn().mockResolvedValue({
      applied: [],
      skipped: [],
      partialTargets: ['REC-1', 'REC-2'],
      conflicting: [],
      failed: [],
      recalculationFailed: false,
    });
    const recommendations: CostOptimizationRecommendation[] = [
      {
        recommendationId: 'REC-1',
        title: 'Optimization 1',
        category: 'compute',
        priority: 'high',
        affectedResourceIds: ['ec2-1'],
        currentConfiguration: { instance_type: 't3.large' },
        proposedConfiguration: { instance_type: 't4g.large' },
        explanation: 'Test explanation 1',
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
        recommendationId: 'REC-2',
        title: 'Optimization 2',
        category: 'storage',
        priority: 'medium',
        affectedResourceIds: ['ebs-1'],
        currentConfiguration: { volume_type: 'gp2' },
        proposedConfiguration: { volume_type: 'gp3' },
        explanation: 'Test explanation 2',
        estimatedCurrentCost: 10.0,
        estimatedOptimizedCost: 8.0,
        estimatedMonthlySavings: 2.0,
        savingsPercentage: 20,
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

    render(
      <CostOptimizationSection
        recommendations={recommendations}
        onApply={vi.fn()}
        onApplyAll={onApplyAllMock}
      />,
    );

    const applyAllBtn = screen.getByRole('button', { name: /Apply All/i });
    await user.click(applyAllBtn);

    await waitFor(() => {
      expect(onApplyAllMock).toHaveBeenCalled();
    });

    // Partial Targets count card (1 count card title + 2 badge labels = 3 elements)
    const partialLabels = screen.getAllByText('Partial Targets');
    expect(partialLabels.length).toBe(3);
    expect(screen.getByText('2')).toBeInTheDocument();

    // Partial Targets section listing
    expect(screen.getByText('Partial Target Recommendations')).toBeInTheDocument();
    expect(screen.getAllByText('Optimization 1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Optimization 2').length).toBeGreaterThanOrEqual(1);
  });

  it('displays recalculation failure message when recalculationFailed is true', async () => {
    const onApplyAllMock = vi.fn().mockResolvedValue({
      applied: ['REC-1'],
      skipped: [],
      partialTargets: [],
      conflicting: [],
      failed: [],
      recalculationFailed: true,
    });
    const recommendations: CostOptimizationRecommendation[] = [
      {
        recommendationId: 'REC-1',
        title: 'Optimization 1',
        category: 'compute',
        priority: 'high',
        affectedResourceIds: ['ec2-1'],
        currentConfiguration: { instance_type: 't3.large' },
        proposedConfiguration: { instance_type: 't4g.large' },
        explanation: 'Test explanation',
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
    ];

    render(
      <CostOptimizationSection
        recommendations={recommendations}
        onApply={vi.fn()}
        onApplyAll={onApplyAllMock}
      />,
    );

    const applyAllBtn = screen.getByRole('button', { name: /Apply All/i });
    await user.click(applyAllBtn);

    await waitFor(() => {
      expect(onApplyAllMock).toHaveBeenCalled();
    });

    expect(screen.getByText('Cost Recalculation Failed')).toBeInTheDocument();
    expect(screen.getByText(/Database updates were applied/)).toBeInTheDocument();
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

    it('verifies strict parity between frontend and backend calculators on shared benchmark fixture within 0.01 tolerance', async () => {
      const { BENCHMARK_NODES, BENCHMARK_ASSUMPTIONS } = await import(
        './data/pricingBenchmarkFixtures'
      );
      const { CostCalculator } = await import(
        '../../../../backend/src/modules/pricing/engine/costCalculator.js'
      );

      const frontendResult = calculateClientCost(
        'arch-parity',
        'us-east-1',
        BENCHMARK_NODES as any,
        [],
        BENCHMARK_ASSUMPTIONS,
      );

      const backendResult = CostCalculator.calculateCost(
        'arch-parity',
        'us-east-1',
        BENCHMARK_NODES as any,
        BENCHMARK_ASSUMPTIONS,
      );

      const TOLERANCE = 0.01;

      // 1. Total Monthly & Hourly Cost Parity
      const totalDiff = Math.abs(frontendResult.totalEstimatedMonthly - backendResult.totalEstimatedMonthly);
      expect(totalDiff).toBeLessThanOrEqual(TOLERANCE);

      const hourlyDiff = Math.abs(frontendResult.totalEstimatedHourly - backendResult.totalEstimatedHourly);
      expect(hourlyDiff).toBeLessThanOrEqual(TOLERANCE);

      // 2. Resource-Level Cost Parity & Dimension Parity
      expect(frontendResult.resourceItems.length).toBe(backendResult.resourceItems.length);
      for (const fItem of frontendResult.resourceItems) {
        const bItem = backendResult.resourceItems.find((r) => r.resourceId === fItem.resourceId);
        expect(bItem).toBeDefined();
        const diff = Math.abs(fItem.monthlyCost - bItem!.monthlyCost);
        expect(diff).toBeLessThanOrEqual(TOLERANCE);

        const hDiff = Math.abs(fItem.hourlyCost - bItem!.hourlyCost);
        expect(hDiff).toBeLessThanOrEqual(TOLERANCE);

        expect(fItem.dimensions.length).toBe(bItem!.dimensions.length);
        for (let i = 0; i < fItem.dimensions.length; i++) {
          const dimDiff = Math.abs(fItem.dimensions[i].extendedCost - bItem!.dimensions[i].extendedCost);
          expect(dimDiff).toBeLessThanOrEqual(TOLERANCE);
          const priceDiff = Math.abs(fItem.dimensions[i].unitPrice - bItem!.dimensions[i].unitPrice);
          expect(priceDiff).toBeLessThanOrEqual(TOLERANCE);
          expect(fItem.dimensions[i].quantity).toBe(bItem!.dimensions[i].quantity);
        }
      }

      // 3. Service Breakdown Parity
      for (const fService of frontendResult.serviceBreakdown) {
        const bService = backendResult.serviceBreakdown.find((s) => s.serviceCode === fService.serviceCode);
        expect(bService).toBeDefined();
        const diff = Math.abs(fService.monthlyCost - bService!.monthlyCost);
        expect(diff).toBeLessThanOrEqual(TOLERANCE);
        const pctDiff = Math.abs(fService.percentage - bService!.percentage);
        expect(pctDiff).toBeLessThanOrEqual(0.01);
      }
    });

    it('handles three Savings Plans where first and third overlap but second does not', () => {
      const recs = [
        {
          recommendationId: 'REC-SP-1',
          title: 'EC2-1 3-Year Savings Plan',
          category: 'pricing-model' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ec2-1'],
          currentConfiguration: {},
          proposedConfiguration: {},
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 50.0,
          estimatedMonthlySavings: 50.0,
          savingsPercentage: 50,
          currency: 'USD',
          performanceImpact: 'neutral' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'low' as const,
          confidenceLevel: 'high' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        },
        {
          recommendationId: 'REC-SP-2',
          title: 'EC2-2 1-Year Savings Plan',
          category: 'pricing-model' as const,
          priority: 'medium' as const,
          affectedResourceIds: ['ec2-2'],
          currentConfiguration: {},
          proposedConfiguration: {},
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 70.0,
          estimatedMonthlySavings: 30.0,
          savingsPercentage: 30,
          currency: 'USD',
          performanceImpact: 'neutral' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'low' as const,
          confidenceLevel: 'medium' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        },
        {
          recommendationId: 'REC-SP-3',
          title: 'EC2-1 1-Year Savings Plan (Conflicting)',
          category: 'pricing-model' as const,
          priority: 'medium' as const,
          affectedResourceIds: ['ec2-1'],
          currentConfiguration: {},
          proposedConfiguration: {},
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 65.0,
          estimatedMonthlySavings: 35.0,
          savingsPercentage: 35,
          currency: 'USD',
          performanceImpact: 'neutral' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'low' as const,
          confidenceLevel: 'medium' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        },
      ];

      const analysis = calculateAchievableSavings(recs);

      // SP-1 ($50 on ec2-1) and SP-2 ($30 on ec2-2) are independent -> both accepted = $80.
      // SP-3 ($35 on ec2-1) is rejected due to conflict with SP-1 on ec2-1.
      expect(analysis.combinedAchievableSavings).toBe(80.0);
      expect(analysis.hasOverlappingRecommendations).toBe(true);
      expect(analysis.overlapNotes.some((n) => n.includes('overlaps with applied commitment plan') && n.includes('ec2-1'))).toBe(true);
    });

    it('handles two independent Savings Plans on separate EC2 resources without conflict', () => {
      const recs = [
        {
          recommendationId: 'REC-SP-A',
          title: 'EC2-A Savings Plan',
          category: 'pricing-model' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ec2-a'],
          currentConfiguration: {},
          proposedConfiguration: {},
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 60.0,
          estimatedMonthlySavings: 40.0,
          savingsPercentage: 40,
          currency: 'USD',
          performanceImpact: 'neutral' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'low' as const,
          confidenceLevel: 'high' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        },
        {
          recommendationId: 'REC-SP-B',
          title: 'EC2-B Savings Plan',
          category: 'pricing-model' as const,
          priority: 'medium' as const,
          affectedResourceIds: ['ec2-b'],
          currentConfiguration: {},
          proposedConfiguration: {},
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 75.0,
          estimatedMonthlySavings: 25.0,
          savingsPercentage: 25,
          currency: 'USD',
          performanceImpact: 'neutral' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'low' as const,
          confidenceLevel: 'medium' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        },
      ];

      const analysis = calculateAchievableSavings(recs);

      // Both independent plans applied: $40 + $25 = $65.
      expect(analysis.combinedAchievableSavings).toBe(65.0);
      expect(analysis.hasOverlappingRecommendations).toBe(false);
      expect(analysis.overlapNotes.length).toBe(0);
    });

    it('allocates multi-resource recommendation savings proportionally using unequal EC2 resource costs', () => {
      const resourceCosts = new Map<string, number>([
        ['ec2-web', 30.0],
        ['ec2-api', 70.0],
      ]);

      const recs = [
        {
          recommendationId: 'REC-FLEET-OPT',
          title: 'Fleet-wide Workload Optimization',
          category: 'compute' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ec2-web', 'ec2-api'],
          currentConfiguration: { fleet_scaling: 'standard' },
          proposedConfiguration: { fleet_scaling: 'optimized' },
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 80.0,
          estimatedMonthlySavings: 20.0,
          savingsPercentage: 20,
          currency: 'USD',
          performanceImpact: 'neutral' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'medium' as const,
          confidenceLevel: 'high' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        },
      ];

      const analysis = calculateAchievableSavings(recs, resourceCosts);

      // Total savings = $20. Proportional allocation:
      // ec2-web ($30 / $100 = 30%) -> $6.00
      // ec2-api ($70 / $100 = 70%) -> $14.00
      expect(analysis.combinedAchievableSavings).toBe(20.0);
    });

    it('determines dominant recommendation deterministically regardless of input array ordering', () => {
      const recA = {
        recommendationId: 'REC-LOW-SAVINGS',
        title: 'Upgrade to t3.medium',
        category: 'compute' as const,
        priority: 'medium' as const,
        affectedResourceIds: ['ec2-1'],
        currentConfiguration: { instance_type: 't3.small' },
        proposedConfiguration: { instance_type: 't3.medium' },
        explanation: '',
        estimatedCurrentCost: 100.0,
        estimatedOptimizedCost: 70.0,
        estimatedMonthlySavings: 30.0,
        savingsPercentage: 30,
        currency: 'USD',
        performanceImpact: 'neutral' as const,
        securityImpact: 'neutral' as const,
        availabilityImpact: 'neutral' as const,
        implementationEffort: 'low' as const,
        confidenceLevel: 'medium' as const,
        requiredAssumptions: [],
        documentationReferences: [],
        status: 'pending' as const,
      };

      const recB = {
        recommendationId: 'REC-HIGH-SAVINGS',
        title: 'Migrate to c6g.medium (Graviton)',
        category: 'compute' as const,
        priority: 'high' as const,
        affectedResourceIds: ['ec2-1'],
        currentConfiguration: { instance_type: 't3.small' },
        proposedConfiguration: { instance_type: 'c6g.medium' },
        explanation: '',
        estimatedCurrentCost: 100.0,
        estimatedOptimizedCost: 40.0,
        estimatedMonthlySavings: 60.0,
        savingsPercentage: 60,
        currency: 'USD',
        performanceImpact: 'neutral' as const,
        securityImpact: 'neutral' as const,
        availabilityImpact: 'neutral' as const,
        implementationEffort: 'low' as const,
        confidenceLevel: 'high' as const,
        requiredAssumptions: [],
        documentationReferences: [],
        status: 'pending' as const,
      };

      // Order 1: [Low, High]
      const analysis1 = calculateAchievableSavings([recA, recB]);
      // Order 2: [High, Low]
      const analysis2 = calculateAchievableSavings([recB, recA]);

      // Both orders must keep dominant recB ($60) and exclude recA ($30)
      expect(analysis1.combinedAchievableSavings).toBe(60.0);
      expect(analysis2.combinedAchievableSavings).toBe(60.0);
      expect(analysis1.combinedAchievableSavings).toBe(analysis2.combinedAchievableSavings);
    });

    it('calculates Savings Plan after optimizations affecting only a subset of resources without deducting unrelated resources', () => {
      const resourceCosts = new Map<string, number>([
        ['ec2-1', 100.0],
        ['ec2-2', 100.0],
        ['ec2-unrelated', 100.0],
      ]);

      const recs = [
        // Architectural optimization on ec2-1 only ($20 reduction -> remaining $80)
        {
          recommendationId: 'REC-OPT-EC2-1',
          title: 'Right-size EC2-1',
          category: 'compute' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ec2-1'],
          currentConfiguration: { instance_type: 't3.large' },
          proposedConfiguration: { instance_type: 't3.medium' },
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 80.0,
          estimatedMonthlySavings: 20.0,
          savingsPercentage: 20,
          currency: 'USD',
          performanceImpact: 'neutral' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'low' as const,
          confidenceLevel: 'high' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        },
        // Architectural optimization on ec2-unrelated ($50 reduction)
        {
          recommendationId: 'REC-OPT-UNRELATED',
          title: 'Right-size Unrelated EC2',
          category: 'compute' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ec2-unrelated'],
          currentConfiguration: { instance_type: 'm5.xlarge' },
          proposedConfiguration: { instance_type: 'm5.large' },
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 50.0,
          estimatedMonthlySavings: 50.0,
          savingsPercentage: 50,
          currency: 'USD',
          performanceImpact: 'neutral' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'low' as const,
          confidenceLevel: 'high' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        },
        // Savings Plan covering ONLY ec2-1 and ec2-2 (NOT ec2-unrelated)
        {
          recommendationId: 'REC-SP-CLUSTER',
          title: 'Compute Savings Plan for Cluster',
          category: 'pricing-model' as const,
          priority: 'medium' as const,
          affectedResourceIds: ['ec2-1', 'ec2-2'],
          currentConfiguration: { pricing_model: 'On-Demand' },
          proposedConfiguration: { pricing_model: 'Savings Plan' },
          explanation: '',
          estimatedCurrentCost: 200.0,
          estimatedOptimizedCost: 140.0,
          estimatedMonthlySavings: 60.0,
          savingsPercentage: 30, // 30% discount
          currency: 'USD',
          performanceImpact: 'neutral' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'low' as const,
          confidenceLevel: 'high' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        },
      ];

      const analysis = calculateAchievableSavings(recs, resourceCosts);

      // Architectural savings:
      // ec2-1: $20 (remaining: $80)
      // ec2-unrelated: $50 (remaining: $50)
      // Savings Plan eligible baseline for ['ec2-1', 'ec2-2']:
      // ec2-1 remaining ($80) + ec2-2 remaining ($100) = $180.
      // (The $50 reduction on ec2-unrelated is strictly NOT deducted!)
      // SP savings = $180 * 0.30 = $54.00.
      // Total combined = $20 + $50 + $54 = $124.00.
      expect(analysis.combinedAchievableSavings).toBe(124.0);
    });

    it('ensures savings never exceed resource baseline', () => {
      const resourceCosts = new Map<string, number>([
        ['ec2-small', 25.0],
      ]);

      const recs = [
        {
          recommendationId: 'REC-OVERSIZED-SAVINGS',
          title: 'Overly Ambitious Optimization',
          category: 'compute' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ec2-small'],
          currentConfiguration: { instance_type: 't3.nano' },
          proposedConfiguration: { instance_type: 'serverless' },
          explanation: '',
          estimatedCurrentCost: 25.0,
          estimatedOptimizedCost: 0.0,
          estimatedMonthlySavings: 60.0, // Nominally claims $60 savings on a $25 resource
          savingsPercentage: 100,
          currency: 'USD',
          performanceImpact: 'neutral' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'low' as const,
          confidenceLevel: 'low' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        },
      ];

      const analysis = calculateAchievableSavings(recs, resourceCosts);

      // Savings must be clamped to the actual remaining baseline ($25.00)
      expect(analysis.combinedAchievableSavings).toBe(25.0);
    });

    describe('Partially Unknown Resource Costs & Robust Fallback Allocation', () => {
      it('allocates savings proportionally when all resource costs are known', () => {
        const resourceCosts = new Map<string, number>([
          ['ec2-1', 40.0],
          ['ec2-2', 60.0],
        ]);
        const recs = [
          {
            recommendationId: 'REC-ALL-KNOWN',
            title: 'Fleet Optimization',
            category: 'compute' as const,
            priority: 'high' as const,
            affectedResourceIds: ['ec2-1', 'ec2-2'],
            currentConfiguration: {},
            proposedConfiguration: {},
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 80.0,
            estimatedMonthlySavings: 20.0,
            savingsPercentage: 20,
            currency: 'USD',
            performanceImpact: 'neutral' as const,
            securityImpact: 'neutral' as const,
            availabilityImpact: 'neutral' as const,
            implementationEffort: 'low' as const,
            confidenceLevel: 'high' as const,
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending' as const,
          },
        ];

        const analysis = calculateAchievableSavings(recs, resourceCosts);
        // ec2-1: 40/100 * 20 = $8.00; ec2-2: 60/100 * 20 = $12.00
        expect(analysis.combinedAchievableSavings).toBe(20.0);
      });

      it('allocates savings when one resource is known and one is unknown without assigning zero weight', () => {
        const resourceCosts = new Map<string, number>([
          ['ec2-known', 60.0],
          // ec2-unknown is not in map
        ]);
        const recs = [
          {
            recommendationId: 'REC-ONE-UNKNOWN',
            title: 'Cluster Optimization',
            category: 'compute' as const,
            priority: 'high' as const,
            affectedResourceIds: ['ec2-known', 'ec2-unknown'],
            currentConfiguration: {},
            proposedConfiguration: {},
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 80.0,
            estimatedMonthlySavings: 20.0,
            savingsPercentage: 20,
            currency: 'USD',
            performanceImpact: 'neutral' as const,
            securityImpact: 'neutral' as const,
            availabilityImpact: 'neutral' as const,
            implementationEffort: 'low' as const,
            confidenceLevel: 'high' as const,
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending' as const,
          },
        ];

        const analysis = calculateAchievableSavings(recs, resourceCosts);
        // Fallback cost for ec2-unknown = $100 - $60 = $40. Total = $100.
        // ec2-known: 60%, ec2-unknown: 40% (never 0 weight!).
        // Total savings = 20.0, never exceeds estimatedMonthlySavings or baseline.
        expect(analysis.combinedAchievableSavings).toBe(20.0);
      });

      it('allocates savings equally when all resource costs are unknown', () => {
        const recs = [
          {
            recommendationId: 'REC-ALL-UNKNOWN',
            title: 'Unknown Cluster Optimization',
            category: 'compute' as const,
            priority: 'high' as const,
            affectedResourceIds: ['ec2-u1', 'ec2-u2'],
            currentConfiguration: {},
            proposedConfiguration: {},
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 70.0,
            estimatedMonthlySavings: 30.0,
            savingsPercentage: 30,
            currency: 'USD',
            performanceImpact: 'neutral' as const,
            securityImpact: 'neutral' as const,
            availabilityImpact: 'neutral' as const,
            implementationEffort: 'low' as const,
            confidenceLevel: 'high' as const,
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending' as const,
          },
        ];

        const analysis = calculateAchievableSavings(recs);
        // Equal share: $15 each. Total = $30.
        expect(analysis.combinedAchievableSavings).toBe(30.0);
      });

      it('handles zero-cost resources by ensuring allocated savings never exceed zero baseline', () => {
        const resourceCosts = new Map<string, number>([
          ['iam-zero', 0.0],
          ['ec2-active', 100.0],
        ]);
        const recs = [
          {
            recommendationId: 'REC-ZERO-COST-MIXED',
            title: 'Security and Compute Optimization',
            category: 'compute' as const,
            priority: 'medium' as const,
            affectedResourceIds: ['iam-zero', 'ec2-active'],
            currentConfiguration: {},
            proposedConfiguration: {},
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 75.0,
            estimatedMonthlySavings: 25.0,
            savingsPercentage: 25,
            currency: 'USD',
            performanceImpact: 'neutral' as const,
            securityImpact: 'neutral' as const,
            availabilityImpact: 'neutral' as const,
            implementationEffort: 'low' as const,
            confidenceLevel: 'high' as const,
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending' as const,
          },
        ];

        const analysis = calculateAchievableSavings(recs, resourceCosts);
        // iam-zero has 0 cost, ec2-active has $100. ec2-active gets 100% weight ($25), iam-zero gets $0.
        expect(analysis.combinedAchievableSavings).toBe(25.0);

        // Standalone recommendation solely on zero-cost resource
        const zeroOnlyRec = [
          {
            recommendationId: 'REC-ZERO-STANDALONE',
            title: 'Delete Free Role',
            category: 'compute' as const,
            priority: 'low' as const,
            affectedResourceIds: ['iam-zero'],
            currentConfiguration: {},
            proposedConfiguration: {},
            explanation: '',
            estimatedCurrentCost: 0.0,
            estimatedOptimizedCost: 0.0,
            estimatedMonthlySavings: 15.0, // claims $15 nominal savings on a $0 resource
            savingsPercentage: 100,
            currency: 'USD',
            performanceImpact: 'neutral' as const,
            securityImpact: 'neutral' as const,
            availabilityImpact: 'neutral' as const,
            implementationEffort: 'low' as const,
            confidenceLevel: 'low' as const,
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending' as const,
          },
        ];
        const zeroAnalysis = calculateAchievableSavings(zeroOnlyRec, resourceCosts);
        expect(zeroAnalysis.combinedAchievableSavings).toBe(0.0);
      });
    });

    describe('Achievable Savings Dominance Selection', () => {
      it('selects dominant recommendation based on achievable savings rather than nominal savings', () => {
        const resourceCosts = new Map<string, number>([
          ['ec2-bottleneck', 15.0],
          ['ec2-large', 85.0],
        ]);

        // REC-HIGH-NOMINAL: Claims $50.00 nominal savings, but affects only ec2-bottleneck ($15.00 baseline)
        // Achievable savings against resource baseline is strictly capped at $15.00.
        const recHighNominal = {
          recommendationId: 'REC-HIGH-NOMINAL',
          title: 'Nominally High Savings Option',
          category: 'compute' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ec2-bottleneck'],
          currentConfiguration: { instance_type: 't3.small' },
          proposedConfiguration: { instance_type: 't3.nano' },
          explanation: '',
          estimatedCurrentCost: 15.0,
          estimatedOptimizedCost: 0.0,
          estimatedMonthlySavings: 50.0, // High nominal claim ($50)
          savingsPercentage: 100,
          currency: 'USD',
          performanceImpact: 'neutral' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'low' as const,
          confidenceLevel: 'high' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        };

        // REC-HIGH-ACHIEVABLE: Claims $35.00 nominal savings across ec2-bottleneck ($15) and ec2-large ($85)
        // Achievable savings against resource baselines is $35.00 ($35.00 > $15.00).
        const recHighAchievable = {
          recommendationId: 'REC-HIGH-ACHIEVABLE',
          title: 'Achievable High Savings Option',
          category: 'compute' as const,
          priority: 'medium' as const,
          affectedResourceIds: ['ec2-bottleneck', 'ec2-large'],
          currentConfiguration: { instance_type: 't3.small' },
          proposedConfiguration: { instance_type: 'c6g.medium' },
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 65.0,
          estimatedMonthlySavings: 35.0, // Lower nominal claim ($35), but fully achievable
          savingsPercentage: 35,
          currency: 'USD',
          performanceImpact: 'neutral' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'low' as const,
          confidenceLevel: 'high' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        };

        // Order 1: [NominalHigh ($50 nom / $15 ach), AchievableHigh ($35 nom / $35 ach)]
        const analysis1 = calculateAchievableSavings([recHighNominal, recHighAchievable], resourceCosts);
        // Order 2: [AchievableHigh ($35 nom / $35 ach), NominalHigh ($50 nom / $15 ach)]
        const analysis2 = calculateAchievableSavings([recHighAchievable, recHighNominal], resourceCosts);

        // Both orders must select REC-HIGH-ACHIEVABLE ($35.00) and reject REC-HIGH-NOMINAL ($15.00)
        expect(analysis1.combinedAchievableSavings).toBe(35.0);
        expect(analysis2.combinedAchievableSavings).toBe(35.0);
        expect(analysis1.overlapNotes.some((n) => n.includes('mutually exclusive') && n.includes('REC-HIGH-ACHIEVABLE'))).toBe(true);
      });
    });

    describe('Savings Plan Percentage Boundary Validation', () => {
      const resourceCosts = new Map<string, number>([
        ['ec2-compute', 100.0],
      ]);

      it('produces zero savings when savingsPercentage is explicitly zero (no 35% fallback)', () => {
        const recs = [
          {
            recommendationId: 'REC-SP-ZERO',
            title: 'Zero Discount Savings Plan',
            category: 'pricing-model' as const,
            priority: 'low' as const,
            affectedResourceIds: ['ec2-compute'],
            currentConfiguration: {},
            proposedConfiguration: {},
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 100.0,
            estimatedMonthlySavings: 0.0,
            savingsPercentage: 0,
            currency: 'USD',
            performanceImpact: 'neutral' as const,
            securityImpact: 'neutral' as const,
            availabilityImpact: 'neutral' as const,
            implementationEffort: 'low' as const,
            confidenceLevel: 'high' as const,
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending' as const,
          },
        ];

        const analysis = calculateAchievableSavings(recs, resourceCosts);
        // Must be exactly $0.00 (not 35% fallback!)
        expect(analysis.combinedAchievableSavings).toBe(0.0);
      });

      it('produces zero savings and records warning when savingsPercentage is negative', () => {
        const recs = [
          {
            recommendationId: 'REC-SP-NEG',
            title: 'Negative Discount Savings Plan',
            category: 'pricing-model' as const,
            priority: 'low' as const,
            affectedResourceIds: ['ec2-compute'],
            currentConfiguration: {},
            proposedConfiguration: {},
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 100.0,
            estimatedMonthlySavings: 0.0,
            savingsPercentage: -15,
            currency: 'USD',
            performanceImpact: 'neutral' as const,
            securityImpact: 'neutral' as const,
            availabilityImpact: 'neutral' as const,
            implementationEffort: 'low' as const,
            confidenceLevel: 'low' as const,
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending' as const,
          },
        ];

        const analysis = calculateAchievableSavings(recs, resourceCosts);
        expect(analysis.combinedAchievableSavings).toBe(0.0);
        expect(analysis.overlapNotes.some((n) => n.includes('negative savingsPercentage (-15%)'))).toBe(true);
      });

      it('produces zero savings and records warning when savingsPercentage is missing or NaN', () => {
        const recs = [
          {
            recommendationId: 'REC-SP-MISSING',
            title: 'Missing Percentage Savings Plan',
            category: 'pricing-model' as const,
            priority: 'low' as const,
            affectedResourceIds: ['ec2-compute'],
            currentConfiguration: {},
            proposedConfiguration: {},
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 100.0,
            estimatedMonthlySavings: 30.0,
            savingsPercentage: NaN,
            currency: 'USD',
            performanceImpact: 'neutral' as const,
            securityImpact: 'neutral' as const,
            availabilityImpact: 'neutral' as const,
            implementationEffort: 'low' as const,
            confidenceLevel: 'low' as const,
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending' as const,
          },
        ];

        const analysis = calculateAchievableSavings(recs, resourceCosts);
        expect(analysis.combinedAchievableSavings).toBe(0.0);
        expect(analysis.overlapNotes.some((n) => n.includes('missing or invalid savingsPercentage'))).toBe(true);
      });

      it('produces zero savings and records warning when savingsPercentage exceeds 100%', () => {
        const recs = [
          {
            recommendationId: 'REC-SP-OVER100',
            title: 'Over 100 Percent Savings Plan',
            category: 'pricing-model' as const,
            priority: 'low' as const,
            affectedResourceIds: ['ec2-compute'],
            currentConfiguration: {},
            proposedConfiguration: {},
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 0.0,
            estimatedMonthlySavings: 150.0,
            savingsPercentage: 150,
            currency: 'USD',
            performanceImpact: 'neutral' as const,
            securityImpact: 'neutral' as const,
            availabilityImpact: 'neutral' as const,
            implementationEffort: 'low' as const,
            confidenceLevel: 'low' as const,
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending' as const,
          },
        ];

        const analysis = calculateAchievableSavings(recs, resourceCosts);
        expect(analysis.combinedAchievableSavings).toBe(0.0);
        expect(analysis.overlapNotes.some((n) => n.includes('savingsPercentage exceeding 100% (150%)'))).toBe(true);
      });
    });

    describe('Optimization Engine Critical Fixes (Phase 08 Audit)', () => {
      it('selects optimal combination over greedy in conflict component with > 15 recommendations', () => {
        const recs: CostOptimizationRecommendation[] = [
          {
            recommendationId: 'REC-DOMINANT',
            title: 'Multi-Resource Instance Upgrade',
            category: 'compute',
            priority: 'high',
            affectedResourceIds: ['ec2-1', 'ec2-2'],
            currentConfiguration: { instance_type: 'm5.large' },
            proposedConfiguration: { instance_type: 'm6g.large' },
            explanation: '',
            estimatedCurrentCost: 200.0,
            estimatedOptimizedCost: 100.0,
            estimatedMonthlySavings: 100.0,
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
            recommendationId: 'REC-SUB-1',
            title: 'EC2-1 Dedicated Optimization',
            category: 'compute',
            priority: 'high',
            affectedResourceIds: ['ec2-1'],
            currentConfiguration: { instance_type: 'm5.large' },
            proposedConfiguration: { instance_type: 'c6g.large' },
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 40.0,
            estimatedMonthlySavings: 60.0,
            savingsPercentage: 60,
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
            recommendationId: 'REC-SUB-2',
            title: 'EC2-2 Dedicated Optimization',
            category: 'compute',
            priority: 'high',
            affectedResourceIds: ['ec2-2'],
            currentConfiguration: { instance_type: 'm5.large' },
            proposedConfiguration: { instance_type: 'c6g.large' },
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 40.0,
            estimatedMonthlySavings: 60.0,
            savingsPercentage: 60,
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

        for (let i = 3; i <= 15; i++) {
          recs.push({
            recommendationId: `REC-EXTRA-${i}`,
            title: `Extra Rec ${i}`,
            category: 'compute',
            priority: 'low',
            affectedResourceIds: ['ec2-1'],
            currentConfiguration: { instance_type: 'm5.large' },
            proposedConfiguration: { instance_type: `t4g.${i}xlarge` },
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 98.0,
            estimatedMonthlySavings: 2.0,
            savingsPercentage: 2,
            currency: 'USD',
            performanceImpact: 'neutral',
            securityImpact: 'neutral',
            availabilityImpact: 'neutral',
            implementationEffort: 'low',
            confidenceLevel: 'low',
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending',
          });
        }

        const costs = new Map<string, number>([
          ['ec2-1', 100.0],
          ['ec2-2', 100.0],
        ]);

        const analysis = calculateAchievableSavings(recs, costs);
        expect(analysis.combinedAchievableSavings).toBe(120.0);
        expect(analysis.overlapNotes.some((n) => n.includes('heuristic optimization strategy'))).toBe(false);
      });

      it('transparently reports heuristic fallback when conflict component exceeds search complexity limit', () => {
        const recs: CostOptimizationRecommendation[] = [];
        for (let i = 1; i <= 30; i++) {
          const r1 = `res-${(i % 10) + 1}`;
          const r2 = `res-${((i + 1) % 10) + 1}`;
          recs.push({
            recommendationId: `REC-CHAIN-${i}`,
            title: `Chain Rec ${i}`,
            category: 'compute',
            priority: 'medium',
            affectedResourceIds: [r1, r2],
            currentConfiguration: { instance_type: 't3.medium' },
            proposedConfiguration: { instance_type: 't4g.medium' },
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 80.0,
            estimatedMonthlySavings: 20.0,
            savingsPercentage: 20,
            currency: 'USD',
            performanceImpact: 'neutral',
            securityImpact: 'neutral',
            availabilityImpact: 'neutral',
            implementationEffort: 'low',
            confidenceLevel: 'medium',
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending',
          });
        }

        const costs = new Map<string, number>();
        for (let r = 1; r <= 10; r++) costs.set(`res-${r}`, 100.0);

        const analysis = calculateAchievableSavings(recs, costs);
        expect(analysis.combinedAchievableSavings).toBeGreaterThan(0);
        expect(analysis.overlapNotes.some((n) => n.includes('heuristic optimization strategy'))).toBe(true);
      });

      it('allocates Savings Plan savings proportionally with unequal resource costs', () => {
        const costs = new Map<string, number>([
          ['ec2-a', 20.0],
          ['ec2-b', 180.0],
        ]);

        const recs: CostOptimizationRecommendation[] = [
          {
            recommendationId: 'REC-SP-PROPORTIONAL',
            title: '10 Percent Savings Plan',
            category: 'pricing-model',
            priority: 'high',
            affectedResourceIds: ['ec2-a', 'ec2-b'],
            currentConfiguration: { pricing_model: 'On-Demand' },
            proposedConfiguration: { pricing_model: 'Savings Plan' },
            explanation: '',
            estimatedCurrentCost: 200.0,
            estimatedOptimizedCost: 180.0,
            estimatedMonthlySavings: 20.0,
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

        const analysis = calculateAchievableSavings(recs, costs);
        expect(analysis.combinedAchievableSavings).toBe(20.0);

        const recsWithFollowUp: CostOptimizationRecommendation[] = [
          {
            recommendationId: 'REC-EC2A-STORAGE',
            title: 'EC2-A Storage Optimization',
            category: 'storage',
            priority: 'medium',
            affectedResourceIds: ['ec2-a'],
            currentConfiguration: { volume_type: 'gp2' },
            proposedConfiguration: { volume_type: 'gp3' },
            explanation: '',
            estimatedCurrentCost: 20.0,
            estimatedOptimizedCost: 10.0,
            estimatedMonthlySavings: 10.0,
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
          recs[0],
        ];

        const analysisWithFollowUp = calculateAchievableSavings(recsWithFollowUp, costs);
        expect(analysisWithFollowUp.combinedAchievableSavings).toBe(29.0);
      });

      it('safely handles zero-cost resources and rounding boundaries without negative cost or lost cents', () => {
        const costs = new Map<string, number>([
          ['ec2-zero', 0.0],
          ['ec2-active', 100.0],
        ]);

        const recs: CostOptimizationRecommendation[] = [
          {
            recommendationId: 'REC-SP-ZERO-RES',
            title: 'Savings Plan with Zero-Cost Resource',
            category: 'pricing-model',
            priority: 'medium',
            affectedResourceIds: ['ec2-zero', 'ec2-active'],
            currentConfiguration: { pricing_model: 'On-Demand' },
            proposedConfiguration: { pricing_model: 'Savings Plan' },
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 80.0,
            estimatedMonthlySavings: 20.0,
            savingsPercentage: 20,
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

        const analysis = calculateAchievableSavings(recs, costs);
        expect(analysis.combinedAchievableSavings).toBe(20.0);

        const splitCosts = new Map<string, number>([
          ['res-1', 33.33],
          ['res-2', 33.33],
          ['res-3', 33.34],
        ]);

        const splitRecs: CostOptimizationRecommendation[] = [
          {
            recommendationId: 'REC-SP-SPLIT',
            title: '10 Percent Savings Plan Split Across 3 Resources',
            category: 'pricing-model',
            priority: 'high',
            affectedResourceIds: ['res-1', 'res-2', 'res-3'],
            currentConfiguration: { pricing_model: 'On-Demand' },
            proposedConfiguration: { pricing_model: 'Savings Plan' },
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 90.0,
            estimatedMonthlySavings: 10.0,
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

        const splitAnalysis = calculateAchievableSavings(splitRecs, splitCosts);
        expect(splitAnalysis.combinedAchievableSavings).toBe(10.0);
      });
    });
  });
});
