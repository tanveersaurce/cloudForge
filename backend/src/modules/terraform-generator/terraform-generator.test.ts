import { describe, expect, it } from 'vitest';
import { TerraformGenerator } from './terraform-generator.service.js';

interface TestNode {
  id: string;
  resourceType: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

interface TestEdge {
  id: string;
  source: string;
  target: string;
  relationshipType?: string;
  direction?: string;
  metadata?: Record<string, unknown>;
}

function hclContains(content: string, snippet: string): boolean {
  return content.includes(snippet);
}

describe('Terraform Generator', () => {
  describe('VPC → Subnet → EC2 references', () => {
    it('generates correct references for VPC, Subnet, and EC2 chain', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'Main VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'aws_subnet', label: 'App Subnet', metadata: { cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a' } },
        { id: 'i1', resourceType: 'aws_instance', label: 'App Server', metadata: { instance_type: 't3.micro', ami: 'ami-0c55b159cbfafe1f0', root_volume_size: 20 } },
      ];
      const edges: TestEdge[] = [
        { id: 'e1', source: 'v1', target: 's1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e2', source: 's1', target: 'i1', relationshipType: 'contains', direction: 'source-to-target' },
      ];

      const { files, issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);

      const allContent = files.map((f) => f.content).join('\n');

      // VPC resource exists
      expect(hclContains(allContent, 'resource "aws_vpc"')).toBe(true);
      // Find the subnet file and check it references VPC with .id
      const subnetFile = files.find((f) => f.filename.startsWith('subnet/'))?.content ?? '';
      expect(subnetFile).toContain('vpc_id = aws_vpc.main_vpc.id');
      // Find the EC2 file and check it references Subnet with .id
      const ec2File = files.find((f) => f.filename.startsWith('ec2/'))?.content ?? '';
      expect(ec2File).toContain('subnet_id = aws_subnet.app_subnet.id');
      // No errors for this valid chain
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('Security Group → EC2 references', () => {
    it('generates correct security group reference on EC2 via accesses edge', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'Main VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'aws_subnet', label: 'App Subnet', metadata: { cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a' } },
        { id: 'sg1', resourceType: 'aws_security_group', label: 'Web SG', metadata: { ingress_rules: [{ cidr_blocks: ['0.0.0.0/0'], from_port: 80, to_port: 80, protocol: 'tcp' }] } },
        { id: 'i1', resourceType: 'aws_instance', label: 'App Server', metadata: { instance_type: 't3.micro', ami: 'ami-0c55b159cbfafe1f0', root_volume_size: 20 } },
      ];
      const edges: TestEdge[] = [
        { id: 'e1', source: 'v1', target: 's1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e2', source: 'v1', target: 'sg1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e3', source: 's1', target: 'i1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e4', source: 'sg1', target: 'i1', relationshipType: 'accesses', direction: 'source-to-target' },
      ];

      const { files, issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);

      const allContent = files.map((f) => f.content).join('\n');

      // Security group references VPC
      expect(hclContains(allContent, 'vpc_id = aws_vpc.')).toBe(true);
      // EC2 references security group
      expect(hclContains(allContent, 'vpc_security_group_ids = [aws_security_group.')).toBe(true);
      // No errors
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('ALB with multiple subnets and security groups', () => {
    it('generates ALB with multiple subnet and security group references', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'Main VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'aws_subnet', label: 'Subnet 1', metadata: { cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a' } },
        { id: 's2', resourceType: 'aws_subnet', label: 'Subnet 2', metadata: { cidr_block: '10.0.2.0/24', availability_zone: 'us-east-1b' } },
        { id: 'sg1', resourceType: 'aws_security_group', label: 'ALB SG', metadata: { ingress_rules: [{ cidr_blocks: ['0.0.0.0/0'], from_port: 80, to_port: 80, protocol: 'tcp' }] } },
        { id: 'lb1', resourceType: 'aws_lb', label: 'Main ALB', metadata: { load_balancer_type: 'application', internal: false } },
      ];
      const edges: TestEdge[] = [
        { id: 'e1', source: 'v1', target: 's1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e2', source: 'v1', target: 's2', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e3', source: 'v1', target: 'sg1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e4', source: 's1', target: 'lb1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e5', source: 's2', target: 'lb1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e6', source: 'sg1', target: 'lb1', relationshipType: 'accesses', direction: 'source-to-target' },
      ];

      const { files, issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);

      const allContent = files.map((f) => f.content).join('\n');

      // ALB resource exists
      expect(hclContains(allContent, 'resource "aws_lb"')).toBe(true);
      // Find the ALB file and check it references subnets with .id
      const albFile = files.find((f) => f.filename.startsWith('alb/'))?.content ?? '';
      const subnetRefs = (albFile.match(/aws_subnet\.[a-z0-9_]+\.id/g) || []);
      expect(subnetRefs.length).toBeGreaterThanOrEqual(2);
      // ALB file references security group with .id
      expect(albFile).toContain('aws_security_group.alb_sg.id');
      // No errors
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('NAT Gateway subnet reference', () => {
    it('generates NAT Gateway with subnet .id reference', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'aws_subnet', label: 'Public Subnet', metadata: { cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a' } },
        { id: 'ngw1', resourceType: 'aws_nat_gateway', label: 'NAT GW', metadata: {} },
      ];
      const edges: TestEdge[] = [
        { id: 'e1', source: 'v1', target: 's1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e2', source: 's1', target: 'ngw1', relationshipType: 'contains', direction: 'source-to-target' },
      ];

      const { files, issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      const allContent = files.map((f) => f.content).join('\n');

      const natFile = files.find((f) => f.filename.startsWith('nat-gateway/') && !f.filename.endsWith('-eip.tf'))?.content ?? '';
      expect(natFile).toMatch(/subnet_id = aws_subnet\.[a-z0-9_]+\.id/);
      // NAT Gateway block also references EIP allocation_id with .id
      expect(natFile).toMatch(/allocation_id = aws_eip\.[a-z0-9_]+\.id/);
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('RDS subnet reference', () => {
    it('generates RDS with subnet .id reference', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'aws_subnet', label: 'DB Subnet', metadata: { cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a' } },
        { id: 'db1', resourceType: 'aws_db_instance', label: 'DB', metadata: { engine: 'postgres', instance_class: 'db.t3.micro', allocated_storage: 20 } },
      ];
      const edges: TestEdge[] = [
        { id: 'e1', source: 'v1', target: 's1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e2', source: 's1', target: 'db1', relationshipType: 'contains', direction: 'source-to-target' },
      ];

      const { files, issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      const allContent = files.map((f) => f.content).join('\n');

      const rdsFile = files.find((f) => f.filename.startsWith('rds/'))?.content ?? '';
      expect(rdsFile).toMatch(/subnet_id = aws_subnet\.[a-z0-9_]+\.id/);
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('Lambda with generated IAM Role', () => {
    it('generates Lambda with correct IAM role ARN reference', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'Main VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 'role1', resourceType: 'aws_iam_role', label: 'Lambda Exec Role', metadata: { name: 'lambda-exec-role', assume_role_policy: JSON.stringify({ Version: '2012-10-17', Statement: [{ Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' }, Action: 'sts:AssumeRole' }] }) } },
        { id: 'fn1', resourceType: 'aws_lambda_function', label: 'Process Function', metadata: { function_name: 'process-fn', runtime: 'nodejs20.x', handler: 'index.handler', memory_size: 128, timeout: 30 } },
      ];
      const edges: TestEdge[] = [
        { id: 'e1', source: 'fn1', target: 'role1', relationshipType: 'accesses', direction: 'source-to-target' },
      ];

      const { files, issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);

      const allContent = files.map((f) => f.content).join('\n');

      // Lambda resource exists
      expect(hclContains(allContent, 'resource "aws_lambda_function"')).toBe(true);
      // IAM role resource exists
      expect(hclContains(allContent, 'resource "aws_iam_role"')).toBe(true);
      // Lambda references IAM role ARN
      expect(hclContains(allContent, 'role = aws_iam_role.')).toBe(true);
      expect(hclContains(allContent, '.arn')).toBe(true);
      // No errors (warnings about missing AMI are OK)
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('Duplicate resource labels', () => {
    it('generates unique Terraform resource names for duplicate labels', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'Production VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 'v2', resourceType: 'aws_vpc', label: 'Production VPC', metadata: { cidr_block: '10.0.0.0/16' } },
      ];
      const edges: TestEdge[] = [];

      const { files } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);

      const allContent = files.map((f) => f.content).join('\n');

      // Both VPCs should generate distinct resource blocks
      const vpcBlockCount = (allContent.match(/resource "aws_vpc" /g) || []).length;
      expect(vpcBlockCount).toBe(2);
    });
  });

  describe('Missing and ambiguous relationships', () => {
    it('reports error when Subnet has no VPC', () => {
      const nodes: TestNode[] = [
        { id: 's1', resourceType: 'aws_subnet', label: 'Orphan Subnet', metadata: { cidr_block: '10.0.1.0/24' } },
      ];
      const edges: TestEdge[] = [];

      const { issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);

      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].missing).toContain('VPC');
    });

    it('reports error when EC2 has no Subnet', () => {
      const nodes: TestNode[] = [
        { id: 'i1', resourceType: 'aws_instance', label: 'Orphan EC2', metadata: { instance_type: 't3.micro', ami: 'ami-0c55b159cbfafe1f0' } },
      ];
      const edges: TestEdge[] = [];

      const { issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);

      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].missing).toContain('Subnet');
    });

    it('reports error when Security Group has no VPC', () => {
      const nodes: TestNode[] = [
        { id: 'sg1', resourceType: 'aws_security_group', label: 'Orphan SG', metadata: {} },
      ];
      const edges: TestEdge[] = [];

      const { issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);

      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].missing).toContain('VPC');
    });

    it('rejects reverse-direction edges (SG contains VPC instead of VPC contains SG)', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 'sg1', resourceType: 'aws_security_group', label: 'SG', metadata: {} },
      ];
      // Reverse: SG contains VPC (invalid — SG cannot contain VPC)
      const edges: TestEdge[] = [
        { id: 'e1', source: 'sg1', target: 'v1', relationshipType: 'contains', direction: 'source-to-target' },
      ];

      const { issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects invalid relationship directions', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'aws_subnet', label: 'Subnet', metadata: { cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a' } },
      ];
      // Invalid direction value
      const edges: TestEdge[] = [
        { id: 'e1', source: 'v1', target: 's1', relationshipType: 'contains', direction: 'invalid-direction' as any },
      ];

      const { issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('accepts valid bidirectional edges', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'aws_subnet', label: 'Subnet', metadata: { cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a' } },
      ];
      const edges: TestEdge[] = [
        { id: 'e1', source: 'v1', target: 's1', relationshipType: 'contains', direction: 'bidirectional' },
      ];

      const { files, issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      const allContent = files.map((f) => f.content).join('\n');
      expect(allContent).toMatch(/aws_vpc\.[a-z0-9_]+\.id/);
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('Unsupported resources', () => {
    it('includes unsupported resource type without crashing', () => {
      const nodes: TestNode[] = [
        { id: 'r1', resourceType: 'aws_redshift_cluster', label: 'Redshift', metadata: {} },
      ];
      const edges: TestEdge[] = [];

      const { files, issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);

      // Should not crash, should generate files (even if just provider/variables)
      expect(files.length).toBeGreaterThan(0);
      // Should report that resource type has no HCL generator
      const allContent = files.map((f) => f.content).join('\n');
      expect(allContent).not.toContain('aws_redshift_cluster');
    });
  });

  describe('Circular dependencies', () => {
    it('handles circular contains edges without infinite loop', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'aws_subnet', label: 'Subnet', metadata: { cidr_block: '10.0.1.0/24' } },
      ];
      const edges: TestEdge[] = [
        { id: 'e1', source: 'v1', target: 's1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e2', source: 's1', target: 'v1', relationshipType: 'contains', direction: 'source-to-target' }, // circular
      ];

      const { files } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      expect(files.length).toBeGreaterThan(0);
    });
  });

  describe('Multiple architectures with different regions', () => {
    it('uses correct region in provider and variables', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'VPC', metadata: { cidr_block: '10.0.0.0/16' } },
      ];
      const edges: TestEdge[] = [];

      const { files } = TerraformGenerator.generate('Test Arch', 'eu-west-1', nodes, edges);

      const providerContent = files.find((f) => f.filename === 'provider.tf')?.content || '';
      const variablesContent = files.find((f) => f.filename === 'variables.tf')?.content || '';

      expect(providerContent).toContain('region = var.aws_region');
      expect(variablesContent).toContain('default = "eu-west-1"');
    });
  });

  describe('HCL expression handling', () => {
    it('EC2 AMI variable is not quoted (Terraform expression)', () => {
      const nodes: TestNode[] = [
        { id: 'i1', resourceType: 'aws_instance', label: 'Server', metadata: { instance_type: 't3.micro', root_volume_size: 20 } },
      ];
      const edges: TestEdge[] = [];

      const { files } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      const allContent = files.map((f) => f.content).join('\n');

      // AMI should be a bare reference, not quoted
      expect(allContent).toContain('ami = var.ec2_ami');
      expect(allContent).not.toContain('ami = "var.ec2_ami"');
    });

    it('ordinary strings remain quoted', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'My VPC', metadata: { cidr_block: '10.0.0.0/16' } },
      ];
      const edges: TestEdge[] = [];

      const { files } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      const allContent = files.map((f) => f.content).join('\n');

      // Tags Name should be quoted string
      expect(allContent).toContain('tags = {');
      expect(allContent).toContain('Name = "My VPC"');
    });

    it('VPC reference ends in .id', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'Main VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'aws_subnet', label: 'Subnet', metadata: { cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a' } },
      ];
      const edges: TestEdge[] = [
        { id: 'e1', source: 'v1', target: 's1', relationshipType: 'contains', direction: 'source-to-target' },
      ];

      const { files } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      const allContent = files.map((f) => f.content).join('\n');

      expect(allContent).toMatch(/aws_vpc\.[a-z0-9_]+\.id/);
    });

    it('NAT subnet reference ends in .id', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'aws_subnet', label: 'Public Subnet', metadata: { cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a' } },
        { id: 'ngw1', resourceType: 'aws_nat_gateway', label: 'NAT GW', metadata: {} },
      ];
      const edges: TestEdge[] = [
        { id: 'e1', source: 'v1', target: 's1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e2', source: 's1', target: 'ngw1', relationshipType: 'contains', direction: 'source-to-target' },
      ];

      const { files } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      const allContent = files.map((f) => f.content).join('\n');

      expect(allContent).toMatch(/aws_subnet\.[a-z0-9_]+\.id/);
    });

    it('reverse-direction edges are rejected (SG contains VPC instead of VPC contains SG)', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 'sg1', resourceType: 'aws_security_group', label: 'SG', metadata: {} },
      ];
      // Reverse: SG contains VPC (invalid)
      const edges: TestEdge[] = [
        { id: 'e1', source: 'sg1', target: 'v1', relationshipType: 'contains', direction: 'source-to-target' },
      ];

      const { issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('ambiguous relationships are reported', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'VPC 1', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 'v2', resourceType: 'aws_vpc', label: 'VPC 2', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'aws_subnet', label: 'Subnet', metadata: { cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a' } },
      ];
      // Subnet contained by both VPCs
      const edges: TestEdge[] = [
        { id: 'e1', source: 'v1', target: 's1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e2', source: 'v2', target: 's1', relationshipType: 'contains', direction: 'source-to-target' },
      ];

      const { issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.missing.toLowerCase().includes('ambiguous'))).toBe(true);
    });

    it('unsupported resource types produce issues', () => {
      const nodes: TestNode[] = [
        { id: 'r1', resourceType: 'aws_redshift_cluster', label: 'Redshift', metadata: {} },
      ];
      const edges: TestEdge[] = [];

      const { issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].missing).toContain('Unsupported resource type');
    });

    it('circular dependencies are detected without infinite loop', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'aws_subnet', label: 'Subnet', metadata: { cidr_block: '10.0.1.0/24' } },
      ];
      const edges: TestEdge[] = [
        { id: 'e1', source: 'v1', target: 's1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e2', source: 's1', target: 'v1', relationshipType: 'contains', direction: 'source-to-target' },
      ];

      const { files, issues } = TerraformGenerator.generate('Test Arch', 'us-east-1', nodes, edges);
      expect(files.length).toBeGreaterThan(0);
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.some((e) => e.missing.toLowerCase().includes('circular'))).toBe(true);
    });

    it('filters out boundary container nodes and normalizes template types', () => {
      const nodes: TestNode[] = [
        { id: 'b1', resourceType: 'aws-cloud', label: 'AWS Cloud', metadata: { isBoundary: true } },
        { id: 'b2', resourceType: 'region', label: 'us-east-1', metadata: { isBoundary: true } },
        { id: 'b3', resourceType: 'aws_availability_zone', label: 'us-east-1a', metadata: { isBoundary: true } },
        { id: 'v1', resourceType: 'vpc', label: 'App VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'subnet', label: 'Public Subnet', metadata: { cidr_block: '10.0.1.0/24' } },
        { id: 'nat1', resourceType: 'nat-gateway', label: 'Public NAT', metadata: {} },
        { id: 'q1', resourceType: 'sqs-queue', label: 'App Queue', metadata: {} },
        { id: 'cf1', resourceType: 'cloudfront', label: 'App CDN', metadata: {} },
        { id: 'rds1', resourceType: 'rds-instance', label: 'Main RDS', metadata: {} },
        { id: 'ec21', resourceType: 'ec2-instance', label: 'App EC2', metadata: {} },
        { id: 'cert1', resourceType: 'acm', label: 'Wildcard Cert', metadata: {} },
      ];
      const edges: TestEdge[] = [
        { id: 'e1', source: 'b1', target: 'b2', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e2', source: 'b2', target: 'v1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e3', source: 'v1', target: 'b3', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e4', source: 'b3', target: 's1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e5', source: 's1', target: 'nat1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e6', source: 's1', target: 'rds1', relationshipType: 'contains', direction: 'source-to-target' },
        { id: 'e7', source: 's1', target: 'ec21', relationshipType: 'contains', direction: 'source-to-target' },
      ];

      const { files, issues } = TerraformGenerator.generate('Template Test', 'us-east-1', nodes, edges);
      const errors = issues.filter((i) => i.severity === 'error');

      // No errors - boundaries excluded, types normalized to aws_*, and SQS/CloudFront/RDS generated
      expect(errors).toHaveLength(0);

      // Boundaries should not have TF resource blocks
      const allHcl = files.map((f) => f.content).join('\n');
      expect(allHcl).not.toContain('resource "aws_cloud"');
      expect(allHcl).not.toContain('resource "region"');
      expect(allHcl).not.toContain('resource "aws_availability_zone"');

      // Concrete resources must exist
      expect(allHcl).toContain('resource "aws_vpc"');
      expect(allHcl).toContain('resource "aws_subnet"');
      expect(allHcl).toContain('resource "aws_nat_gateway"');
      expect(allHcl).toContain('resource "aws_sqs_queue"');
      expect(allHcl).toContain('resource "aws_cloudfront_distribution"');
      expect(allHcl).toContain('resource "aws_db_instance"');
      expect(allHcl).toContain('resource "aws_instance"');
      expect(allHcl).toContain('resource "aws_acm_certificate"');
    });
  });

  describe('Modular Terraform Generator (Phase 08 Extended)', () => {
    it('generates standard export when mode is standard or omitted', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'VPC', metadata: { cidr_block: '10.0.0.0/16' } },
      ];
      const result = TerraformGenerator.generate('Standard Arch', 'us-east-1', nodes, []);
      expect(result.mode).toBe('standard');
      expect(result.files.some((f) => f.filename.startsWith('vpc/'))).toBe(true);
      expect(result.files.some((f) => f.filename.startsWith('modules/'))).toBe(false);
    });

    it('generates complete modular directory structure in modular mode', () => {
      const nodes: TestNode[] = [
        { id: 'v1', resourceType: 'aws_vpc', label: 'Main VPC', metadata: { cidr_block: '10.0.0.0/16' } },
        { id: 's1', resourceType: 'aws_subnet', label: 'Public Subnet 1', metadata: { cidr_block: '10.0.1.0/24', map_public_ip_on_launch: true } },
        { id: 's2', resourceType: 'aws_subnet', label: 'Private Subnet 1', metadata: { cidr_block: '10.0.2.0/24' } },
        { id: 'i1', resourceType: 'aws_instance', label: 'App Server', metadata: { ami: 'ami-12345678' } },
        { id: 'db1', resourceType: 'aws_db_instance', label: 'Postgres DB', metadata: { engine: 'postgres' } },
        { id: 'b1', resourceType: 'aws_s3_bucket', label: 'Static Assets_Bucket' },
      ];
      const edges: TestEdge[] = [
        { id: 'e1', source: 'v1', target: 's1', relationshipType: 'contains' },
        { id: 'e2', source: 'v1', target: 's2', relationshipType: 'contains' },
        { id: 'e3', source: 's1', target: 'i1', relationshipType: 'contains' },
        { id: 'e4', source: 's2', target: 'db1', relationshipType: 'contains' },
      ];

      const { files, issues, mode } = TerraformGenerator.generate(
        'Enterprise Stack',
        'us-east-1',
        nodes,
        edges,
        { mode: 'modular' },
      );

      expect(mode).toBe('modular');
      const fileNames = files.map((f) => f.filename);

      // Root files
      expect(fileNames).toContain('main.tf');
      expect(fileNames).toContain('provider.tf');
      expect(fileNames).toContain('versions.tf');
      expect(fileNames).toContain('variables.tf');
      expect(fileNames).toContain('outputs.tf');
      expect(fileNames).toContain('terraform.tfvars.example');
      expect(fileNames).toContain('.gitignore');
      expect(fileNames).toContain('README.md');
      expect(fileNames).toContain('environments/dev/terraform.tfvars.example');
      expect(fileNames).toContain('environments/dev/README.md');

      // Relevant child modules exist
      expect(fileNames).toContain('modules/networking/main.tf');
      expect(fileNames).toContain('modules/networking/variables.tf');
      expect(fileNames).toContain('modules/networking/outputs.tf');

      expect(fileNames).toContain('modules/compute/main.tf');
      expect(fileNames).toContain('modules/compute/variables.tf');
      expect(fileNames).toContain('modules/compute/outputs.tf');

      expect(fileNames).toContain('modules/database/main.tf');
      expect(fileNames).toContain('modules/database/variables.tf');
      expect(fileNames).toContain('modules/database/outputs.tf');

      expect(fileNames).toContain('modules/storage/main.tf');
      expect(fileNames).toContain('modules/storage/variables.tf');
      expect(fileNames).toContain('modules/storage/outputs.tf');

      // Unused modules must NOT be created
      expect(fileNames.some((f) => f.startsWith('modules/ai-agent/'))).toBe(false);
      expect(fileNames.some((f) => f.startsWith('modules/chat/'))).toBe(false);
      expect(fileNames.some((f) => f.startsWith('modules/video-processing/'))).toBe(false);
      expect(fileNames.some((f) => f.startsWith('modules/cdn/'))).toBe(false);
      expect(fileNames.some((f) => f.startsWith('modules/monitoring/'))).toBe(false);

      // Root main.tf orchestrates child modules with module blocks
      const rootMain = files.find((f) => f.filename === 'main.tf')?.content ?? '';
      expect(rootMain).toContain('module "networking" {');
      expect(rootMain).toContain('source = "./modules/networking"');
      expect(rootMain).toContain('module "compute" {');
      expect(rootMain).toContain('source = "./modules/compute"');
      expect(rootMain).toContain('vpc_id       = module.networking.vpc_id');
      expect(rootMain).toContain('subnet_ids   = module.networking.public_subnet_ids');
      expect(rootMain).toContain('module "database" {');
      expect(rootMain).toContain('source = "./modules/database"');
      expect(rootMain).toContain('module "storage" {');
      expect(rootMain).toContain('source = "./modules/storage"');

      // Database uses DB Subnet Group and sensitive password
      const dbMain = files.find((f) => f.filename === 'modules/database/main.tf')?.content ?? '';
      expect(dbMain).toContain('resource "aws_db_subnet_group" "main"');
      expect(dbMain).toContain('db_subnet_group_name = aws_db_subnet_group.main.name');
      expect(dbMain).not.toContain('subnet_id =');

      const dbVars = files.find((f) => f.filename === 'modules/database/variables.tf')?.content ?? '';
      expect(dbVars).toContain('sensitive = true');

      // Storage sanitizes underscores in bucket name
      const storageMain = files.find((f) => f.filename === 'modules/storage/main.tf')?.content ?? '';
      expect(storageMain).toContain('static-assets-bucket');
      expect(storageMain).not.toContain('Static Assets_Bucket');

      // No errors for valid architecture
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('generates Bedrock, CloudFront, WebSocket, and MediaConvert modules when present', () => {
      const nodes: TestNode[] = [
        { id: 'b1', resourceType: 'aws_bedrock_agent', label: 'Support AI' },
        { id: 'c1', resourceType: 'aws_cloudfront_distribution', label: 'App CDN' },
        { id: 'ws1', resourceType: 'aws_apigatewayv2_api', label: 'Chat WS', metadata: { protocol_type: 'WEBSOCKET' } },
        { id: 'mc1', resourceType: 'aws_media_convert', label: 'Transcoder' },
        { id: 'mon1', resourceType: 'aws_cloudwatch_metric_alarm', label: 'CPU Alarm' },
      ];

      const { files, mode } = TerraformGenerator.generate(
        'Advanced Services Stack',
        'us-east-1',
        nodes,
        [],
        { mode: 'modular' },
      );

      expect(mode).toBe('modular');
      const fileNames = files.map((f) => f.filename);

      // AI Agent module with IAM execution role & foundation model
      expect(fileNames).toContain('modules/ai-agent/main.tf');
      const aiMain = files.find((f) => f.filename === 'modules/ai-agent/main.tf')?.content ?? '';
      expect(aiMain).toContain('resource "aws_bedrockagent_agent"');
      expect(aiMain).toContain('resource "aws_iam_role" "bedrock_agent_role"');
      expect(aiMain).toContain('foundation_model = var.bedrock_model_id');

      // CDN module with complete origin, cache behavior, and restrictions
      expect(fileNames).toContain('modules/cdn/main.tf');
      const cdnMain = files.find((f) => f.filename === 'modules/cdn/main.tf')?.content ?? '';
      expect(cdnMain).toContain('origin {');
      expect(cdnMain).toContain('default_cache_behavior {');
      expect(cdnMain).toContain('restrictions {');
      expect(cdnMain).toContain('viewer_certificate {');

      // Chat WebSocket module
      expect(fileNames).toContain('modules/chat/main.tf');
      const chatMain = files.find((f) => f.filename === 'modules/chat/main.tf')?.content ?? '';
      expect(chatMain).toContain('resource "aws_apigatewayv2_api"');
      expect(chatMain).toContain('protocol_type = "WEBSOCKET"');

      // Video processing module
      expect(fileNames).toContain('modules/video-processing/main.tf');
      const videoMain = files.find((f) => f.filename === 'modules/video-processing/main.tf')?.content ?? '';
      expect(videoMain).toContain('resource "aws_media_convert_queue"');
      expect(videoMain).toContain('resource "aws_sqs_queue"');

      // Monitoring module
      expect(fileNames).toContain('modules/monitoring/main.tf');
      const monMain = files.find((f) => f.filename === 'modules/monitoring/main.tf')?.content ?? '';
      expect(monMain).toContain('resource "aws_cloudwatch_metric_alarm"');
      expect(monMain).toContain('resource "aws_cloudwatch_log_group"');

      // Root main.tf calls them
      const rootMain = files.find((f) => f.filename === 'main.tf')?.content ?? '';
      expect(rootMain).toContain('module "ai_agent"');
      expect(rootMain).toContain('module "cdn"');
      expect(rootMain).toContain('module "chat"');
      expect(rootMain).toContain('module "video_processing"');
      expect(rootMain).toContain('module "monitoring"');
    });

    it('handles empty architecture gracefully without creating empty modules', () => {
      const { files, issues, mode } = TerraformGenerator.generate(
        'Empty Arch',
        'us-east-1',
        [],
        [],
        { mode: 'modular' },
      );

      expect(mode).toBe('modular');
      expect(issues).toHaveLength(0);
      const fileNames = files.map((f) => f.filename);

      // Root files exist
      expect(fileNames).toContain('main.tf');
      expect(fileNames).toContain('provider.tf');
      expect(fileNames).toContain('versions.tf');
      expect(fileNames).toContain('variables.tf');
      expect(fileNames).toContain('outputs.tf');

      // No child module directories
      expect(fileNames.some((f) => f.startsWith('modules/'))).toBe(false);

      const mainContent = files.find((f) => f.filename === 'main.tf')?.content ?? '';
      expect(mainContent).toContain('No cloud resources found in this architecture');
    });

    it('filters visual boundary containers in modular mode', () => {
      const nodes: TestNode[] = [
        { id: 'c1', resourceType: 'aws_cloud', label: 'Cloud Global Scope', metadata: { isBoundary: true } },
        { id: 'r1', resourceType: 'aws_region', label: 'Region us-east-1', metadata: { isBoundary: true } },
        { id: 'v1', resourceType: 'aws_vpc', label: 'VPC', metadata: { cidr_block: '10.0.0.0/16' } },
      ];
      const { files } = TerraformGenerator.generate('Boundary Arch', 'us-east-1', nodes, [], { mode: 'modular' });
      const allContent = files.map((f) => f.content).join('\n');
      expect(allContent).not.toContain('resource "aws_cloud"');
      expect(allContent).not.toContain('resource "aws_region"');
      expect(allContent).toContain('resource "aws_vpc"');
    });
  });
});
