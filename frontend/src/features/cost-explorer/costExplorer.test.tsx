import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ArchitectureFlowNode } from '../architecture-builder/types/architecture.types';
import { CostOptimizationSection } from './components/CostOptimizationSection';
import { CostSummaryCards } from './components/CostSummaryCards';
import { ServiceBreakdownChart } from './components/ServiceBreakdownChart';
import { WorkloadAssumptionsModal } from './components/WorkloadAssumptionsModal';
import {
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
});
