import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useArchitectureBuilderStore } from '@/store/useArchitectureBuilderStore';
import type { ArchitectureFlowEdge, ArchitectureFlowNode } from '../architecture-builder/types/architecture.types';
import { ValidationDashboardDrawer } from './components/ValidationDashboardDrawer';
import { runClientValidation } from './engine/clientValidationEngine';
import { doCidrsOverlap, isCidrContained, parseCidr } from './utils/cidrUtils';

describe('Validation CIDR Utilities', () => {
  it('parses valid CIDR blocks and rejects invalid formats', () => {
    const vpc = parseCidr('10.0.0.0/16');
    expect(vpc).not.toBeNull();
    expect(vpc?.prefix).toBe(16);

    const subnet = parseCidr('10.0.1.0/24');
    expect(subnet).not.toBeNull();
    expect(subnet?.prefix).toBe(24);

    expect(parseCidr('invalid-cidr')).toBeNull();
    expect(parseCidr('10.0.0.0/35')).toBeNull();
    expect(parseCidr('300.0.0.0/16')).toBeNull();
  });

  it('correctly determines whether a subnet CIDR is contained within VPC CIDR', () => {
    expect(isCidrContained('10.0.0.0/16', '10.0.1.0/24')).toBe(true);
    expect(isCidrContained('10.0.0.0/16', '10.0.255.0/24')).toBe(true);
    expect(isCidrContained('10.0.0.0/16', '10.1.0.0/24')).toBe(false);
    expect(isCidrContained('10.0.0.0/16', '192.168.1.0/24')).toBe(false);
    expect(isCidrContained('10.0.0.0/16', '10.0.0.0/8')).toBe(false);
  });

  it('correctly detects overlapping CIDR ranges', () => {
    expect(doCidrsOverlap('10.0.1.0/24', '10.0.1.128/25')).toBe(true);
    expect(doCidrsOverlap('10.0.1.0/24', '10.0.2.0/24')).toBe(false);
    expect(doCidrsOverlap('172.16.0.0/16', '172.16.5.0/24')).toBe(true);
  });
});

describe('Client Validation Engine', () => {
  it('flags structural, network, security, and reliability issues', () => {
    const nodes: ArchitectureFlowNode[] = [
      {
        id: 'node-vpc-1',
        type: 'awsResource',
        position: { x: 0, y: 0 },
        data: {
          serviceId: 'svc-vpc',
          serviceSlug: 'amazon-vpc',
          serviceName: 'Amazon VPC',
          categorySlug: 'networking-content-delivery',
          categoryName: 'Networking',
          iconKey: 'vpc',
          resourceName: 'VPC',
          resourceType: 'aws_vpc',
          label: 'Primary VPC',
          description: '',
          metadata: { cidr_block: '10.0.0.0/16' },
        },
      },
      {
        id: 'node-sub-bad',
        type: 'awsResource',
        position: { x: 100, y: 100 },
        data: {
          serviceId: 'svc-vpc',
          serviceSlug: 'amazon-vpc',
          serviceName: 'Amazon VPC',
          categorySlug: 'networking-content-delivery',
          categoryName: 'Networking',
          iconKey: 'vpc',
          resourceName: 'Subnet',
          resourceType: 'aws_subnet',
          label: 'Bad Subnet',
          description: '',
          metadata: { cidr_block: '172.16.0.0/24' }, // Out of 10.0.0.0/16
        },
      },
      {
        id: 'node-rds-exposed',
        type: 'awsResource',
        position: { x: 200, y: 200 },
        data: {
          serviceId: 'svc-rds',
          serviceSlug: 'amazon-rds',
          serviceName: 'Amazon RDS',
          categorySlug: 'database',
          categoryName: 'Database',
          iconKey: 'rds',
          resourceName: 'RDS Database',
          resourceType: 'aws_db_instance',
          label: 'Public DB',
          description: '',
          metadata: {
            publicly_accessible: true,
            multi_az: false,
          },
        },
      },
      {
        id: 'node-sg-open',
        type: 'awsResource',
        position: { x: 300, y: 300 },
        data: {
          serviceId: 'svc-vpc',
          serviceSlug: 'amazon-vpc',
          serviceName: 'Amazon VPC',
          categorySlug: 'networking-content-delivery',
          categoryName: 'Networking',
          iconKey: 'vpc',
          resourceName: 'Security Group',
          resourceType: 'aws_security_group',
          label: 'Open SSH SG',
          description: '',
          metadata: {
            ingress_rules: [
              { from_port: 22, to_port: 22, protocol: 'tcp', cidr_blocks: '0.0.0.0/0' },
            ],
          },
        },
      },
    ];

    const edges: ArchitectureFlowEdge[] = [
      {
        id: 'e-1',
        source: 'node-vpc-1',
        target: 'node-sub-bad',
        data: { relationshipType: 'contains' },
      },
    ];

    const result = runClientValidation('arch-test', nodes, edges);
    expect(result.summary.status).toBe('invalid');
    expect(result.summary.criticalCount).toBeGreaterThanOrEqual(2);

    const ruleIds = result.findings.map((f) => f.ruleId);
    expect(ruleIds).toContain('NET-001'); // Subnet CIDR containment
    expect(ruleIds).toContain('SEC-001'); // Public RDS
    expect(ruleIds).toContain('SEC-002'); // Open SSH
    expect(ruleIds).toContain('REL-001'); // Single AZ RDS
  });

  it('marks a well-configured architecture as valid', () => {
    const nodes: ArchitectureFlowNode[] = [
      {
        id: 'vpc-1',
        type: 'awsResource',
        position: { x: 0, y: 0 },
        data: {
          serviceId: 'svc-vpc',
          serviceSlug: 'amazon-vpc',
          serviceName: 'Amazon VPC',
          categorySlug: 'networking-content-delivery',
          categoryName: 'Networking',
          iconKey: 'vpc',
          resourceName: 'VPC',
          resourceType: 'aws_vpc',
          label: 'Compliant VPC',
          description: '',
          metadata: { cidr_block: '10.0.0.0/16' },
        },
      },
      {
        id: 'sub-1',
        type: 'awsResource',
        position: { x: 100, y: 100 },
        data: {
          serviceId: 'svc-vpc',
          serviceSlug: 'amazon-vpc',
          serviceName: 'Amazon VPC',
          categorySlug: 'networking-content-delivery',
          categoryName: 'Networking',
          iconKey: 'vpc',
          resourceName: 'Subnet',
          resourceType: 'aws_subnet',
          label: 'Compliant Subnet',
          description: '',
          metadata: { cidr_block: '10.0.1.0/24' },
        },
      },
      {
        id: 'db-1',
        type: 'awsResource',
        position: { x: 200, y: 200 },
        data: {
          serviceId: 'svc-rds',
          serviceSlug: 'amazon-rds',
          serviceName: 'Amazon RDS',
          categorySlug: 'database',
          categoryName: 'Database',
          iconKey: 'rds',
          resourceName: 'RDS Database',
          resourceType: 'aws_db_instance',
          label: 'Compliant DB',
          description: '',
          metadata: {
            publicly_accessible: false,
            multi_az: true,
            storage_encrypted: true,
            backup_retention_period: 7,
          },
        },
      },
    ];

    const edges: ArchitectureFlowEdge[] = [
      { id: 'e-1', source: 'vpc-1', target: 'sub-1', data: { relationshipType: 'contains' } },
      { id: 'e-2', source: 'sub-1', target: 'db-1', data: { relationshipType: 'contains' } },
    ];

    const result = runClientValidation('arch-valid', nodes, edges);
    expect(result.summary.status).toBe('valid');
    expect(result.summary.criticalCount).toBe(0);
    expect(result.summary.highCount).toBe(0);
  });

  it('A3-16 & A3-07: distinguishes missing vs invalid RDS configurations and validates edge relationship direction in client engine', () => {
    // 1. Missing multi_az and missing backup_retention produce 'unknown' status
    const unconfiguredDbNode: ArchitectureFlowNode = {
      id: 'db-unconfig',
      type: 'awsResource',
      position: { x: 0, y: 0 },
      data: {
        serviceId: 'svc-rds',
        serviceSlug: 'amazon-rds',
        serviceName: 'Amazon RDS',
        categorySlug: 'database',
        categoryName: 'Database',
        iconKey: 'rds',
        resourceName: 'RDS Database',
        resourceType: 'aws_db_instance',
        label: 'Unconfigured RDS',
        description: '',
        metadata: {},
      },
    };

    const resUnconfig = runClientValidation('arch-unconfig', [unconfiguredDbNode], []);
    const rel001Finding = resUnconfig.findings.find((f) => f.ruleId === 'REL-001');
    const rel002Finding = resUnconfig.findings.find((f) => f.ruleId === 'REL-002');
    expect(rel001Finding?.status).toBe('unknown');
    expect(rel002Finding?.status).toBe('unknown');

    // 2. Disabled backups (retention = 0) and Single-AZ (multi_az = false) produce 'invalid'
    const disabledDbNode: ArchitectureFlowNode = {
      id: 'db-disabled',
      type: 'awsResource',
      position: { x: 0, y: 0 },
      data: {
        serviceId: 'svc-rds',
        serviceSlug: 'amazon-rds',
        serviceName: 'Amazon RDS',
        categorySlug: 'database',
        categoryName: 'Database',
        iconKey: 'rds',
        resourceName: 'RDS Database',
        resourceType: 'aws_db_instance',
        label: 'Disabled RDS',
        description: '',
        metadata: {
          multi_az: false,
          backup_retention_period: 0,
        },
      },
    };

    const resDisabled = runClientValidation('arch-disabled', [disabledDbNode], []);
    const rel001Disabled = resDisabled.findings.find((f) => f.ruleId === 'REL-001');
    const rel002Disabled = resDisabled.findings.find((f) => f.ruleId === 'REL-002');
    expect(rel001Disabled?.status).toBe('invalid');
    expect(rel002Disabled?.status).toBe('invalid');

    // 3. STRUCT-001 rejects invalid relationshipType on Subnet-VPC connection
    const vpcNode: ArchitectureFlowNode = {
      id: 'vpc-node',
      type: 'awsResource',
      position: { x: 0, y: 0 },
      data: {
        serviceId: 'svc-vpc',
        serviceSlug: 'amazon-vpc',
        serviceName: 'Amazon VPC',
        categorySlug: 'networking-content-delivery',
        categoryName: 'Networking',
        iconKey: 'vpc',
        resourceName: 'VPC',
        resourceType: 'aws_vpc',
        label: 'VPC',
        description: '',
        metadata: { cidr_block: '10.0.0.0/16' },
      },
    };
    const subnetNode: ArchitectureFlowNode = {
      id: 'sub-node',
      type: 'awsResource',
      position: { x: 10, y: 10 },
      data: {
        serviceId: 'svc-vpc',
        serviceSlug: 'amazon-vpc',
        serviceName: 'Amazon VPC',
        categorySlug: 'networking-content-delivery',
        categoryName: 'Networking',
        iconKey: 'vpc',
        resourceName: 'Subnet',
        resourceType: 'aws_subnet',
        label: 'Subnet',
        description: '',
        metadata: { cidr_block: '10.0.1.0/24' },
      },
    };

    const badRelEdge: ArchitectureFlowEdge = {
      id: 'e-bad-rel',
      source: 'vpc-node',
      target: 'sub-node',
      data: { relationshipType: 'sends-traffic-to' },
    };

    const resBadRel = runClientValidation('arch-bad-rel', [vpcNode, subnetNode], [badRelEdge]);
    expect(resBadRel.findings.some((f) => f.ruleId === 'STRUCT-001')).toBe(true);

    // 4. NET-005 detects NAT Gateway in subnet without route to IGW
    const natNode: ArchitectureFlowNode = {
      id: 'nat-node',
      type: 'awsResource',
      position: { x: 20, y: 20 },
      data: {
        serviceId: 'svc-vpc',
        serviceSlug: 'amazon-vpc',
        serviceName: 'Amazon VPC',
        categorySlug: 'networking-content-delivery',
        categoryName: 'Networking',
        iconKey: 'nat',
        resourceName: 'NAT Gateway',
        resourceType: 'aws_nat_gateway',
        label: 'NAT Gateway',
        description: '',
        metadata: {},
      },
    };
    const natEdge: ArchitectureFlowEdge = {
      id: 'e-nat',
      source: 'sub-node',
      target: 'nat-node',
      data: { relationshipType: 'contains' },
    };

    const resNat = runClientValidation('arch-nat', [vpcNode, subnetNode, natNode], [badRelEdge, natEdge]);
    expect(resNat.findings.some((f) => f.ruleId === 'NET-005')).toBe(true);
  });
});

describe('Validation Dashboard Drawer Component', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    useArchitectureBuilderStore.getState().resetBuilder();
  });

  it('renders summary cards, filters by category, and highlights affected nodes', async () => {
    const nodes: ArchitectureFlowNode[] = [
      {
        id: 'bad-rds',
        type: 'awsResource',
        position: { x: 0, y: 0 },
        data: {
          serviceId: 'svc-rds',
          serviceSlug: 'amazon-rds',
          serviceName: 'Amazon RDS',
          categorySlug: 'database',
          categoryName: 'Database',
          iconKey: 'rds',
          resourceName: 'RDS Database',
          resourceType: 'aws_db_instance',
          label: 'Public RDS',
          description: '',
          metadata: { publicly_accessible: true },
        },
      },
    ];

    useArchitectureBuilderStore.setState({
      nodes,
      edges: [],
      validationResult: runClientValidation('arch-ui', nodes, []),
      isValidationDrawerOpen: true,
    });

    const onCloseMock = vi.fn();
    render(<ValidationDashboardDrawer isOpen={true} onClose={onCloseMock} />);

    // Header & Badge
    expect(screen.getByText('AWS Architecture Validation')).toBeInTheDocument();
    expect(screen.getByText('ISSUES DETECTED')).toBeInTheDocument();

    // Summary counters
    expect(screen.getAllByText(/Critical/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('RDS Database Must Not Be Publicly Accessible')).toBeInTheDocument();

    // Category filtering
    const securityFilter = screen.getByRole('button', { name: /^security$/i });
    await user.click(securityFilter);
    expect(screen.getByText('RDS Database Must Not Be Publicly Accessible')).toBeInTheDocument();

    // Highlight on canvas button
    const highlightBtn = screen.getByRole('button', { name: /Highlight on canvas/i });
    await user.click(highlightBtn);

    await waitFor(() => {
      expect(
        useArchitectureBuilderStore.getState().highlightedValidationNodeIds,
      ).toContain('bad-rds');
    });

    // Close button
    const closeBtn = screen.getByRole('button', { name: /Close validation drawer/i });
    await user.click(closeBtn);
    expect(onCloseMock).toHaveBeenCalled();
  });
});
